'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getFunnels(tenantId: string) {
    const supabase = await createClient();

    let { data: funnels, error } = await supabase
        .from('funnels')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true });

    if (error) return { success: false, error: error.message };

    // Se o tenant ainda não tiver nenhum funil (novo tenant), criamos o padrão
    if (!funnels || funnels.length === 0) {
        const { data: newFunnel, error: insertError } = await supabase
            .from('funnels')
            .insert({
                tenant_id: tenantId,
                name: 'Funil Padrão',
                order_index: 0
            })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') {
                // Conflito de unicidade (se existir), tentamos buscar de novo
                const { data: existingFunnels } = await supabase
                    .from('funnels')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('order_index', { ascending: true });
                funnels = existingFunnels || [];
            } else {
                return { success: false, error: insertError.message };
            }
        } else if (newFunnel) {
            funnels = [newFunnel];
        }
    }

    return { success: true, data: funnels };
}

export async function createFunnel(tenantId: string, name: string) {
    const supabase = await createClient();

    // 1. Obter o plano do tenant e seu limite
    const { data: tenant } = await supabase
        .from('tenants')
        .select('plan_type')
        .eq('id', tenantId)
        .single();

    if (!tenant) return { success: false, error: 'Tenant não encontrado' };

    const { data: planLimit } = await supabase
        .from('plan_limits')
        .select('max_funnels')
        .eq('plan_type', tenant.plan_type)
        .single();

    const maxFunnels = planLimit?.max_funnels || 1;

    // 2. Contar quantos funis o tenant já tem
    const { count, error: countError } = await supabase
        .from('funnels')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

    if (countError) return { success: false, error: countError.message };

    // 3. Validar o limite
    if (count && count >= maxFunnels) {
        return { 
            success: false, 
            error: `Limite de funis atingido. Seu plano permite até ${maxFunnels} funis. Faça upgrade para criar mais.`,
            limitReached: true
        };
    }

    // 4. Pegar o último order_index
    const { data: lastFunnel } = await supabase
        .from('funnels')
        .select('order_index')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

    const nextOrder = lastFunnel ? (lastFunnel.order_index || 0) + 1 : 0;

    // 5. Inserir o novo funil
    const { data, error } = await supabase
        .from('funnels')
        .insert({
            tenant_id: tenantId,
            name,
            order_index: nextOrder
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/leads');
    return { success: true, data };
}

export async function updateFunnel(
    funnelId: string, 
    data: { name?: string; allowed_sources?: string[]; owner_user_id?: string | null }
) {
    const supabase = await createClient();

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.allowed_sources !== undefined) updatePayload.allowed_sources = data.allowed_sources;
    if (data.owner_user_id !== undefined) updatePayload.owner_user_id = data.owner_user_id;

    const { error } = await supabase
        .from('funnels')
        .update(updatePayload)
        .eq('id', funnelId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/leads');
    return { success: true };
}

// Manter compatibilidade retroativa com chamadas existentes
export async function updateFunnelName(funnelId: string, name: string) {
    return updateFunnel(funnelId, { name });
}

export async function deleteFunnel(tenantId: string, funnelId: string) {
    const supabase = await createClient();

    // Validar para não deixar o tenant sem nenhum funil
    const { count } = await supabase
        .from('funnels')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

    if (count && count <= 1) {
        return { success: false, error: 'Você não pode excluir o único funil restante.' };
    }

    const { error } = await supabase
        .from('funnels')
        .delete()
        .eq('id', funnelId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/leads');
    return { success: true };
}

export async function reorderFunnels(orderedIds: string[]) {
    const supabase = await createClient();

    const updates = orderedIds.map((id, index) =>
        supabase
            .from('funnels')
            .update({ order_index: index, updated_at: new Date().toISOString() })
            .eq('id', id)
    );

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed?.error) return { success: false, error: failed.error.message };

    revalidatePath('/leads');
    return { success: true };
}
