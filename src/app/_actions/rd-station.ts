'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { runFullRDStationSync } from '@/services/rd-station-service';

export async function getRDStationConfig() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, funnels: [], error: 'Não autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return { data: null, funnels: [], error: 'Perfil não encontrado' };

    const [integrationRes, funnelsRes] = await Promise.all([
        supabase
            .from('integrations')
            .select('*')
            .eq('tenant_id', profile.tenant_id)
            .eq('provider', 'rd_station')
            .maybeSingle(),
        supabase
            .from('funnels')
            .select('id, name')
            .eq('tenant_id', profile.tenant_id)
            .order('order_index', { ascending: true })
    ]);

    return {
        data: integrationRes.data,
        funnels: (funnelsRes.data || []) as Array<{ id: string; name: string }>,
        error: integrationRes.error?.message || funnelsRes.error?.message
    };
}

export async function saveRDStationToken(token: string, targetFunnelId?: string | null) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return { success: false, error: 'Perfil não encontrado' };

    const { data: existing } = await supabase
        .from('integrations')
        .select('id, settings')
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'rd_station')
        .maybeSingle();

    const currentSettings = (existing?.settings as Record<string, any>) || {};
    if (targetFunnelId !== undefined) {
        currentSettings.target_funnel_id = targetFunnelId || null;
    }

    const admin = createAdminClient();
    const { error } = await admin
        .from('integrations')
        .upsert({
            id: existing?.id,
            tenant_id: profile.tenant_id,
            profile_id: user.id,
            provider: 'rd_station',
            credentials: { token: token.trim() },
            settings: currentSettings,
            status: 'active',
            updated_at: new Date().toISOString()
        });

    if (error) return { success: false, error: error.message };

    revalidatePath('/settings/integrations');
    return { success: true };
}

export async function toggleRDStationStatus(status: 'active' | 'inactive') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return { success: false, error: 'Perfil não encontrado' };

    const admin = createAdminClient();
    const { error } = await admin
        .from('integrations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'rd_station');

    if (error) return { success: false, error: error.message };

    revalidatePath('/settings/integrations');
    return { success: true };
}

export type SyncActionResponse =
    | { success: true; imported: number; updated: number; skipped: number; notes_synced?: number }
    | { success: false; error: string };

export async function syncRDStationAction(): Promise<SyncActionResponse> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return { success: false, error: 'Perfil não encontrado' };

    const admin = createAdminClient();
    const { data: integration } = await admin
        .from('integrations')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'rd_station')
        .maybeSingle();

    const credentials = (integration?.credentials as Record<string, any>) || {};
    const currentSettings = (integration?.settings as Record<string, any>) || {};
    const token = credentials.token;
    if (!integration || !token) return { success: false as const, error: 'Token do RD Station não configurado' };

    const targetFunnelId = currentSettings.target_funnel_id || 'auto';

    try {
        const syncResult = await runFullRDStationSync(profile.tenant_id, user.id, token, targetFunnelId);
        const now = new Date().toISOString();

        const currentSettings = (integration.settings as Record<string, any>) || {};
        const prevHistory = Array.isArray(currentSettings.sync_history) ? currentSettings.sync_history : [];
        const newHistory = [
            { date: now, ...syncResult },
            ...prevHistory.slice(0, 9)
        ];

        await admin
            .from('integrations')
            .update({
                settings: {
                    ...currentSettings,
                    last_sync_at: now,
                    last_sync_imported: syncResult.imported,
                    last_sync_updated: syncResult.updated,
                    last_sync_skipped: syncResult.skipped,
                    sync_history: newHistory
                },
                status: 'active',
                updated_at: now
            })
            .eq('id', integration.id);

        revalidatePath('/settings/integrations');
        revalidatePath('/leads');
        revalidatePath('/notes');

        return { success: true as const, ...syncResult };
    } catch (err: any) {
        return { success: false as const, error: err.message || 'Falha ao sincronizar com o RD Station CRM' };
    }
}
