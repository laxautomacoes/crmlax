'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from './profile'
import { Tables } from '@/lib/supabase/database.types'

function isWonStage(name: string): boolean {
    if (!name) return false
    const n = name.toLowerCase().trim()
    if (n.includes('perdida') || n.includes('perdido') || n.includes('desqualificado')) return false
    return (
        n.includes('ganho') ||
        n.includes('fechado') ||
        n.includes('concluído') ||
        n.includes('concluido') ||
        n === 'venda' ||
        n.includes('venda feita') ||
        n.includes('venda concluída') ||
        n.includes('venda concluida') ||
        n.includes('venda ganha')
    )
}

export interface FunnelStageData {
    id: string
    name: string
    order_index: number
    color?: string
    count: number
    isWon?: boolean
}

export interface FunnelData {
    id: string
    name: string
    order_index: number
    stages: FunnelStageData[]
    totalLeads: number
    conversions: number
    revenue: number
}

export interface DashboardMetrics {
    kpis: {
        leadsAtivos: number
        leadsAtivosTrend: string
        properties: number
        propertiesTrend: string
        conversoes: number
        conversoesTrend: string
    }
    funnelSteps: Array<{
        label: string
        count: number
        stageId: string
        color?: string
        funnelId?: string
    }>
    funnelsData: FunnelData[]
    recentLeads: Array<{
        id: string
        name: string
        interest: string
        status: string
        color?: string
        created_at: string
        last_interaction_at?: string | null
        assigned_to_name?: string
        stage_id?: string
        funnel_id?: string
    }>
}

export interface ROIMetrics {
    totalCustos: number
    totalReceita: number
    roi: number
    cpl: number // Custo por Lead
    leadsCount: number
    byFunnel?: Record<string, {
        revenue: number
        leadsCount: number
        roi: number
        cpl: number
    }>
}

export async function getDashboardMetrics(tenantId: string) {
    const supabase = await createClient()
    const { profile } = await getProfile()
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

    try {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

        // 1. Chamar RPC para agregar todos os counts
        const countsQuery = supabase.rpc('get_dashboard_counts', {
            p_tenant_id: tenantId,
            p_user_id: (!isAdmin && profile?.id) ? profile.id : null,
            p_start_curr: thirtyDaysAgo,
            p_start_prev: sixtyDaysAgo
        })

        const funnelsQuery = supabase
            .from('funnels')
            .select('id, name, order_index')
            .eq('tenant_id', tenantId)
            .order('order_index', { ascending: true })

        const stagesQuery = supabase
            .from('lead_stages')
            .select('id, name, order_index, color, funnel_id')
            .eq('tenant_id', tenantId)
            .order('order_index', { ascending: true })

        let recentLeadsQuery = supabase
            .from('leads')
            .select(`
                id,
                created_at,
                stage_id,
                source,
                last_interaction_at,
                contacts (
                    name
                ),
                profiles:assigned_to (
                    full_name
                )
            `)
            .eq('tenant_id', tenantId)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .limit(50)

        if (!isAdmin && profile?.id) {
            recentLeadsQuery = recentLeadsQuery.eq('assigned_to', profile.id)
        }

        // 2. Executar em paralelo
        const [
            countsRes,
            stagesRes,
            recentLeadsRes,
            funnelsRes
        ] = await Promise.all([
            countsQuery,
            stagesQuery,
            recentLeadsQuery,
            funnelsQuery
        ])

        if (countsRes.error) throw countsRes.error
        if (stagesRes.error) throw stagesRes.error
        if (recentLeadsRes.error) throw recentLeadsRes.error

        const countsData = countsRes.data as any
        const totalLeads = countsData?.leads?.total || 0
        const totalProperties = countsData?.properties?.total || 0
        const stages = stagesRes.data || []
        const recentLeadsData = recentLeadsRes.data || []
        const currLeadsCount = countsData?.leads?.curr || 0
        const prevLeadsCount = countsData?.leads?.prev || 0
        const currPropertiesCount = countsData?.properties?.curr || 0
        const prevPropertiesCount = countsData?.properties?.prev || 0
        const funnelCounts = countsData?.funnel || {}
        let funnels = funnelsRes.data || []

        if (stages.length === 0) {
            console.log('Nenhum estágio encontrado para o tenant:', tenantId);
            return {
                success: true,
                data: {
                    kpis: {
                        leadsAtivos: totalLeads,
                        leadsAtivosTrend: '+0%',
                        properties: totalProperties,
                        propertiesTrend: '+0',
                        conversoes: 0,
                        conversoesTrend: '+0'
                    },
                    funnelSteps: [],
                    funnelsData: [],
                    recentLeads: []
                } as DashboardMetrics
            };
        }

        // Se não houver nenhum funil cadastrado na tabela funnels, criar um agrupador sintético
        if (funnels.length === 0) {
            funnels = [{
                id: stages[0]?.funnel_id || 'default',
                name: 'Funil Padrão',
                order_index: 0
            }]
        }

        const stageMap = new Map<string, typeof stages[0]>()
        stages.forEach((s: any) => stageMap.set(s.id, s))

        // Estruturar dados por funil
        const funnelsData: FunnelData[] = funnels.map((funnel: any) => {
            const funnelStages = stages
                .filter((s: any) => s.funnel_id === funnel.id || (!s.funnel_id && funnel.id === 'default'))
                .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    order_index: s.order_index ?? 0,
                    color: s.color || undefined,
                    count: funnelCounts[s.id] || 0,
                    isWon: isWonStage(s.name)
                }))

            const fLeads = funnelStages.reduce((acc: number, s: any) => acc + s.count, 0)
            const fConversions = funnelStages
                .filter((s: any) => s.isWon)
                .reduce((acc: number, s: any) => acc + s.count, 0)

            return {
                id: funnel.id,
                name: funnel.name,
                order_index: funnel.order_index ?? 0,
                stages: funnelStages,
                totalLeads: fLeads,
                conversions: fConversions,
                revenue: 0
            }
        })

        // Conversões consolidadas de todos os funis
        const totalConversions = funnelsData.reduce((acc, f) => acc + f.conversions, 0)

        // Passos para compatibilidade com o formato legado
        const funnelSteps = stages.map((stage: any) => ({
            label: stage.name,
            count: funnelCounts[stage.id] || 0,
            stageId: stage.id,
            color: stage.color || undefined,
            funnelId: stage.funnel_id || undefined
        }))

        const recentLeads = recentLeadsData.map((lead: any) => {
            const stage = stageMap.get(lead.stage_id)
            return {
                id: lead.id,
                name: lead.contacts?.name || 'Sem nome',
                interest: lead.source || 'N/A',
                status: stage?.name || 'Novo',
                color: stage?.color || undefined,
                created_at: lead.created_at,
                last_interaction_at: lead.last_interaction_at,
                assigned_to_name: lead.profiles?.full_name || 'Sem responsável',
                stage_id: lead.stage_id,
                funnel_id: stage?.funnel_id || undefined
            }
        })

        const calcTrend = (curr: number, prev: number): string => {
            if (prev === 0) return curr > 0 ? '+100%' : '+0%'
            const pct = Math.round(((curr - prev) / prev) * 100)
            return pct >= 0 ? `+${pct}%` : `${pct}%`
        }

        return {
            success: true,
            data: {
                kpis: {
                    leadsAtivos: totalLeads,
                    leadsAtivosTrend: calcTrend(currLeadsCount, prevLeadsCount),
                    properties: totalProperties,
                    propertiesTrend: calcTrend(currPropertiesCount, prevPropertiesCount),
                    conversoes: totalConversions,
                    conversoesTrend: calcTrend(totalConversions, 0)
                },
                funnelSteps,
                funnelsData,
                recentLeads
            } as DashboardMetrics
        }
    } catch (error: any) {
        console.error('Error fetching dashboard metrics:', error)
        const parts: string[] = []
        if (error?.message && error.message.trim()) parts.push(error.message.trim())
        if (error?.hint && error.hint.trim()) parts.push(`Dica: ${error.hint.trim()}`)
        if (error?.code) parts.push(`Código: ${error.code}`)
        if (error?.status) parts.push(`HTTP ${error.status}`)
        const errorDetails = parts.length > 0
            ? parts.join(' | ')
            : (typeof error === 'object' ? JSON.stringify(error) : String(error))
        return {
            success: false,
            error: errorDetails || "Erro desconhecido ao carregar métricas"
        }
    }
}

export async function getROIMetrics(tenantId: string): Promise<{ success: boolean; data?: ROIMetrics; error?: string }> {
    const supabase = await createClient()
    
    try {
        // 1. Iniciar queries independentes principais
        const txQuery = supabase
            .from('transacoes_financeiras')
            .select('valor, tipo, categoria')
            .eq('tenant_id', tenantId)
            .eq('status', 'pago')

        const leadsCountQuery = supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)

        const stagesQuery = supabase
            .from('lead_stages')
            .select('id, name, funnel_id')
            .eq('tenant_id', tenantId)

        const funnelsQuery = supabase
            .from('funnels')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .order('order_index', { ascending: true })

        // 2. Executar buscas principais em paralelo
        const [txRes, leadsCountRes, stagesRes, funnelsRes] = await Promise.all([
            txQuery, 
            leadsCountQuery, 
            stagesQuery,
            funnelsQuery
        ])

        if (txRes.error) throw txRes.error
        if (leadsCountRes.error) throw leadsCountRes.error
        if (stagesRes.error) throw stagesRes.error

        const txData = txRes.data || []
        const leadsCount = leadsCountRes.count || 0
        const allStages = stagesRes.data || []
        const funnels = funnelsRes.data || []

        // Identificar se a categoria é de Marketing / Ads / Tráfego Pago
        const isMarketingCategory = (catName: string | null): boolean => {
            if (!catName) return false
            const normalized = catName.toLowerCase()
            return (
                normalized.includes('marketing') ||
                normalized.includes('ads') ||
                normalized.includes('tráfego') ||
                normalized.includes('trafego') ||
                normalized.includes('anúncio') ||
                normalized.includes('anuncio') ||
                normalized.includes('meta') ||
                normalized.includes('google') ||
                normalized.includes('facebook') ||
                normalized.includes('instagram') ||
                normalized.includes('mídia') ||
                normalized.includes('midia') ||
                normalized.includes('propaganda')
            )
        }

        // Apenas despesas do tipo 'Despesa' com categoria de Marketing/Ads entram como Investimento Ads (totalCustos)
        const totalCustos = txData
            .filter((t: any) => t.tipo === 'Despesa' && isMarketingCategory(t.categoria))
            .reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)

        // Receita das transações financeiras pagas
        const totalTxReceita = txData
            .filter((t: any) => t.tipo === 'Receita')
            .reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)

        // Identificar todas as etapas de vitória do tenant
        const wonStages = allStages.filter((s: any) => isWonStage(s.name))
        const wonStageIds = wonStages.map((s: any) => s.id)

        let totalLeadsReceita = 0
        const revenueByFunnel: Record<string, number> = {}

        if (wonStageIds.length > 0) {
            const { data: wonLeadsData } = await supabase
                .from('leads')
                .select('id, stage_id, value, sale_value')
                .eq('tenant_id', tenantId)
                .in('stage_id', wonStageIds)

            const stageFunnelMap = new Map<string, string>()
            allStages.forEach((s: any) => {
                if (s.funnel_id) stageFunnelMap.set(s.id, s.funnel_id)
            })

            ;(wonLeadsData || []).forEach((curr: any) => {
                const val = Number(curr.sale_value || curr.value) || 0
                totalLeadsReceita += val
                const funnelId = stageFunnelMap.get(curr.stage_id)
                if (funnelId) {
                    revenueByFunnel[funnelId] = (revenueByFunnel[funnelId] || 0) + val
                }
            })
        }

        // totalReceita é o maior entre receitas pagas no financeiro e valor estimado dos leads ganhos
        const totalReceita = Math.max(totalTxReceita, totalLeadsReceita)

        // Contagem de leads por funil
        const leadsCountByFunnel: Record<string, number> = {}
        const { data: leadsByStage } = await supabase
            .from('leads')
            .select('stage_id')
            .eq('tenant_id', tenantId)
            .eq('is_archived', false)

        const stageToFunnel = new Map<string, string>()
        allStages.forEach((s: any) => {
            if (s.funnel_id) stageToFunnel.set(s.id, s.funnel_id)
        })

        ;(leadsByStage || []).forEach((l: any) => {
            if (l.stage_id) {
                const fId = stageToFunnel.get(l.stage_id)
                if (fId) {
                    leadsCountByFunnel[fId] = (leadsCountByFunnel[fId] || 0) + 1
                }
            }
        })

        // 4. Calcular ROI e CPL consolidado
        const roi = totalCustos > 0 ? ((totalReceita - totalCustos) / totalCustos) * 100 : 0
        const cpl = leadsCount > 0 ? totalCustos / leadsCount : 0

        // 5. Calcular por funil
        const byFunnel: Record<string, { revenue: number; leadsCount: number; roi: number; cpl: number }> = {}
        funnels.forEach((f: any) => {
            const fRev = revenueByFunnel[f.id] || 0
            const fLeads = leadsCountByFunnel[f.id] || 0
            const fCpl = fLeads > 0 ? totalCustos / fLeads : 0
            const fRoi = totalCustos > 0 ? ((fRev - totalCustos) / totalCustos) * 100 : 0
            byFunnel[f.id] = {
                revenue: fRev,
                leadsCount: fLeads,
                roi: fRoi,
                cpl: fCpl
            }
        })

        return {
            success: true,
            data: {
                totalCustos,
                totalReceita,
                roi,
                cpl,
                leadsCount,
                byFunnel
            }
        }
    } catch (error: any) {
        console.error('Error fetching ROI metrics:', error)
        const parts: string[] = []
        if (error?.message && error.message.trim()) parts.push(error.message.trim())
        if (error?.hint && error.hint.trim()) parts.push(`Dica: ${error.hint.trim()}`)
        if (error?.code) parts.push(`Código: ${error.code}`)
        if (error?.status) parts.push(`HTTP ${error.status}`)
        const errorDetails = parts.length > 0
            ? parts.join(' | ')
            : (typeof error === 'object' ? JSON.stringify(error) : String(error))
        return { success: false, error: errorDetails || "Erro desconhecido ao carregar ROI" }
    }
}

