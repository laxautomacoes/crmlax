'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { runFullRDStationSync } from '@/services/rd-station-service';

export async function getRDStationConfig() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Não autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return { data: null, error: 'Perfil não encontrado' };

    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'rd_station')
        .maybeSingle();

    return { data, error: error?.message };
}

export async function saveRDStationToken(token: string) {
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
    | { success: true; imported: number; updated: number; skipped: number }
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
    const token = credentials.token;
    if (!integration || !token) return { success: false as const, error: 'Token do RD Station não configurado' };

    try {
        const syncResult = await runFullRDStationSync(profile.tenant_id, user.id, token);
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

        return { success: true as const, ...syncResult };
    } catch (err: any) {
        return { success: false as const, error: err.message || 'Falha ao sincronizar com o RD Station CRM' };
    }
}
