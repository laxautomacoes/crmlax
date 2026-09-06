'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Filter, Plus, ChevronDown } from 'lucide-react'
import KPICards from '@/components/dashboard/KPICards'
import SalesFunnel from '@/components/dashboard/SalesFunnel'
import RecentLeadsList from '@/components/dashboard/RecentLeadsList'
import ROIDashboard from '@/components/dashboard/ROIDashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import type { DashboardMetrics, ROIMetrics } from '@/app/_actions/dashboard'

// Lazy-loaded modals — só carregam quando o usuário abre
const FilterModal = dynamic(() => import('@/components/dashboard/FilterModal').then(mod => ({ default: mod.FilterModal })), { ssr: false })
const LeadModal = dynamic(() => import('@/components/dashboard/leads/LeadModal').then(mod => ({ default: mod.LeadModal })), { ssr: false })

export interface DashboardFilter {
    period: string
    startDate: string
    endDate: string
    funnelId: string
    stageId: string
    sourceId: string
    brokerId: string
}

export interface FilterOptions {
    funnels: Array<{ id: string; name: string }>
    stages: Array<{ id: string; name: string; color?: string | null; funnel_id?: string | null }>
    sources: Array<{ id: string; name: string }>
    members: Array<{ id: string; name: string }>
}

const INITIAL_FILTERS: DashboardFilter = {
    period: '',
    startDate: '',
    endDate: '',
    funnelId: '',
    stageId: '',
    sourceId: '',
    brokerId: '',
}

interface DashboardClientProps {
    metrics: DashboardMetrics
    roiData: ROIMetrics
    profileName: string
    tenantId: string
    userRole: string
    isAdmin: boolean
    filterOptions: FilterOptions
}

export default function DashboardClient({ metrics, roiData, profileName, tenantId, userRole, isAdmin, filterOptions }: DashboardClientProps) {
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
    const [filters, setFilters] = useState<DashboardFilter>(INITIAL_FILTERS)
    const router = useRouter()

    // Contar filtros ativos
    const activeFilterCount = useMemo(() => {
        let count = 0
        if (filters.period) count++
        if (filters.startDate || filters.endDate) count++
        if (filters.funnelId) count++
        if (filters.stageId) count++
        if (filters.sourceId) count++
        if (filters.brokerId) count++
        return count
    }, [filters])

    // Métricas de KPI dinâmicas pelo funil selecionado
    const currentKPIs = useMemo(() => {
        if (!filters.funnelId) {
            return metrics.kpis
        }
        const currentFunnel = (metrics.funnelsData || []).find(f => f.id === filters.funnelId)
        if (!currentFunnel) return metrics.kpis

        return {
            leadsAtivos: currentFunnel.totalLeads,
            leadsAtivosTrend: metrics.kpis.leadsAtivosTrend,
            properties: metrics.kpis.properties,
            propertiesTrend: metrics.kpis.propertiesTrend,
            conversoes: currentFunnel.conversions,
            conversoesTrend: metrics.kpis.conversoesTrend
        }
    }, [metrics.kpis, metrics.funnelsData, filters.funnelId])

    // Métricas de ROI dinâmicas pelo funil selecionado
    const currentROIData = useMemo(() => {
        if (!filters.funnelId || !roiData.byFunnel || !roiData.byFunnel[filters.funnelId]) {
            return roiData
        }
        const funnelROI = roiData.byFunnel[filters.funnelId]
        return {
            totalCustos: roiData.totalCustos,
            totalReceita: funnelROI.revenue,
            roi: funnelROI.roi,
            cpl: funnelROI.cpl,
            leadsCount: funnelROI.leadsCount,
            byFunnel: roiData.byFunnel
        }
    }, [roiData, filters.funnelId])

    // Filtrar leads recentes baseado nos filtros ativos (incluindo funil)
    const filteredRecentLeads = useMemo(() => {
        let leads = [...metrics.recentLeads]

        // Filtro por funil
        if (filters.funnelId) {
            leads = leads.filter(lead => lead.funnel_id === filters.funnelId)
        }

        // Filtro por período
        if (filters.period || (filters.startDate && filters.endDate)) {
            const now = new Date()
            let start: Date | null = null
            let end: Date | null = null

            switch (filters.period) {
                case 'today':
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
                    break
                case '7days':
                    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    end = now
                    break
                case '30days':
                    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    end = now
                    break
                case 'month':
                    start = new Date(now.getFullYear(), now.getMonth(), 1)
                    end = now
                    break
                case 'custom':
                    if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00')
                    if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59')
                    break
            }

            if (start || end) {
                leads = leads.filter(lead => {
                    const leadDate = new Date(lead.created_at)
                    if (start && leadDate < start) return false
                    if (end && leadDate > end) return false
                    return true
                })
            }
        }

        // Filtro por estágio
        if (filters.stageId) {
            const stageName = filterOptions.stages.find(s => s.id === filters.stageId)?.name
            if (stageName) {
                leads = leads.filter(lead => lead.status === stageName)
            }
        }

        // Filtro por origem (source do lead)
        if (filters.sourceId) {
            const sourceName = filterOptions.sources.find(s => s.id === filters.sourceId)?.name
            if (sourceName) {
                leads = leads.filter(lead =>
                    lead.interest?.toLowerCase().includes(sourceName.toLowerCase())
                )
            }
        }

        return leads
    }, [metrics.recentLeads, filters, filterOptions])

    // Filtrar passos de funil legado caso necessário
    const filteredFunnelSteps = useMemo(() => {
        let steps = metrics.funnelSteps
        if (filters.funnelId) {
            steps = steps.filter(step => step.funnelId === filters.funnelId)
        }
        if (filters.stageId) {
            steps = steps.filter(step => step.stageId === filters.stageId)
        }
        return steps
    }, [metrics.funnelSteps, filters.funnelId, filters.stageId])

    // Mapear os estágios do funil para o formato esperado pelo LeadModal
    const availableStagesForModal = useMemo(() => {
        if (filters.funnelId) {
            return filterOptions.stages
                .filter(s => s.funnel_id === filters.funnelId)
                .map(s => ({ id: s.id, name: s.name }))
        }
        return filterOptions.stages.map(s => ({ id: s.id, name: s.name }))
    }, [filterOptions.stages, filters.funnelId])

    const handleSuccess = () => {
        router.refresh()
    }

    const handleClearFilters = () => {
        setFilters(INITIAL_FILTERS)
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">

            {/* Header / Actions Section */}
            <PageHeader title="Dashboard">
                <div className="grid grid-cols-2 md:grid-flow-col md:auto-cols-max gap-2 md:gap-3 w-full md:w-max items-center">
                    
                    {/* Seletor Rápido de Funil no Cabeçalho */}
                    {filterOptions.funnels.length > 1 && (
                        <div className="relative col-span-2 md:col-span-1">
                            <select
                                value={filters.funnelId}
                                onChange={(e) => setFilters({ ...filters, funnelId: e.target.value, stageId: '' })}
                                className="w-full md:w-auto h-[34px] bg-card border border-muted-foreground/30 text-foreground text-xs font-bold uppercase tracking-wider rounded-lg px-3 pr-8 appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring/50 shadow-sm hover:bg-muted/30 transition-all"
                                title="Filtrar por Funil"
                            >
                                <option value="">Todos os funis</option>
                                {filterOptions.funnels.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    )}

                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={`w-full md:w-auto md:min-w-[130px] h-[34px] flex items-center justify-center gap-2 px-4 border rounded-lg transition-all text-xs font-bold uppercase tracking-widest whitespace-nowrap outline-none focus:ring-2 shadow-sm relative ${
                            activeFilterCount > 0
                                ? 'bg-secondary/10 border-secondary text-secondary-foreground hover:bg-secondary/20 focus:ring-secondary/50'
                                : 'bg-card border-muted-foreground/30 text-foreground hover:bg-muted/50 focus:ring-ring/50'
                        }`}
                    >
                        <Filter size={14} strokeWidth={1} />
                        <span>FILTRAR</span>
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-secondary text-secondary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsLeadModalOpen(true)}
                        className="w-full md:w-auto md:min-w-[130px] h-[34px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground border border-transparent px-4 rounded-lg hover:opacity-90 active:scale-[0.99] transition-all text-xs font-bold uppercase tracking-widest shadow-sm whitespace-nowrap"
                    >
                        <Plus size={14} strokeWidth={1} />
                        <span>NOVO LEAD</span>
                    </button>
                </div>
            </PageHeader>

            <hr className="hidden md:block border-border" />

            <KPICards kpis={currentKPIs} />

            {/* Seção ROI - Apenas para Admins */}
            {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin' || userRole === 'super administrador') && (
                <div className="pt-4">
                    <ROIDashboard data={currentROIData} />
                </div>
            )}

            <SalesFunnel 
                funnelsData={metrics.funnelsData || []}
                selectedFunnelId={filters.funnelId}
                onSelectFunnel={(id) => setFilters({ ...filters, funnelId: id, stageId: '' })}
                funnelSteps={filteredFunnelSteps}
            />

            <RecentLeadsList recentLeads={filteredRecentLeads} />

            <FilterModal
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                filters={filters}
                setFilters={setFilters}
                filterOptions={filterOptions}
                isAdmin={isAdmin}
                onClear={handleClearFilters}
            />

            <LeadModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                tenantId={tenantId}
                stages={availableStagesForModal}
                onSuccess={handleSuccess}
            />
        </div>
    )
}
