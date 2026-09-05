import { createAdminClient } from '@/lib/supabase/admin';

interface SyncResult {
    imported: number;
    updated: number;
    skipped: number;
}

export async function fetchRDStationDealsPage(token: string, page = 1, limit = 200) {
    const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(token)}&page=${page}&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
        throw new Error(`Erro na API do RD Station: HTTP ${res.status}`);
    }
    return res.json();
}

export async function processRDStationBatch(
    tenantId: string,
    profileId: string,
    defaultStageId: string | null,
    deals: any[]
): Promise<SyncResult> {
    const supabase = createAdminClient();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const deal of deals) {
        const dealId = deal.id || deal._id;
        const primaryContact = deal.contacts?.[0];
        const rawPhone = primaryContact?.phones?.[0]?.phone || '';
        const phone = rawPhone.replace(/\D/g, '');

        if (!phone && !primaryContact?.name) {
            skipped++;
            continue;
        }

        const contactName = primaryContact?.name || deal.name || 'Lead RD Station';
        const contactEmail = primaryContact?.emails?.[0]?.email || null;
        const contactRdId = primaryContact?.id || primaryContact?._id || dealId;

        // 1. Upsert Contato
        const { data: contact } = await supabase
            .from('contacts')
            .upsert({
                tenant_id: tenantId,
                name: contactName,
                phone: phone || null,
                email: contactEmail,
                rd_station_id: contactRdId,
            }, { onConflict: 'tenant_id,phone' })
            .select('id')
            .single();

        const contactId = contact?.id;
        if (!contactId) {
            skipped++;
            continue;
        }

        // 2. Verificar se já existe lead pelo rd_station_id
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('rd_station_id', dealId)
            .maybeSingle();

        const sourceName = deal.deal_source?.name || 'RD Station';
        const dealValue = Number(deal.amount_total || deal.amount_unique || 0);

        if (existingLead) {
            await supabase
                .from('leads')
                .update({
                    value: dealValue,
                    valor_estimado: dealValue,
                    last_interaction_at: new Date().toISOString(),
                })
                .eq('id', existingLead.id);
            updated++;
        } else {
            await supabase
                .from('leads')
                .insert({
                    tenant_id: tenantId,
                    contact_id: contactId,
                    assigned_to: profileId,
                    stage_id: defaultStageId,
                    status: 'new',
                    source: sourceName,
                    lead_source: sourceName,
                    rd_station_id: dealId,
                    value: dealValue,
                    valor_estimado: dealValue,
                    date: new Date().toISOString().split('T')[0],
                    utm_data: deal.deal_source ? { rd_source: deal.deal_source } : {},
                });
            imported++;
        }
    }

    return { imported, updated, skipped };
}

export async function runFullRDStationSync(tenantId: string, profileId: string, token: string): Promise<SyncResult> {
    const supabase = createAdminClient();

    // Obter estágio padrão "Novo" do funil principal
    const { data: defaultStage } = await supabase
        .from('lead_stages')
        .select('id')
        .eq('tenant_id', tenantId)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

    const defaultStageId = defaultStage?.id || null;
    let page = 1;
    let hasMore = true;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    while (hasMore && page <= 25) { // limite de segurança: 25 páginas (até 5.000 deals)
        const data = await fetchRDStationDealsPage(token, page, 200);
        const deals = data.deals || [];
        if (deals.length === 0) break;

        const batchRes = await processRDStationBatch(tenantId, profileId, defaultStageId, deals);
        totalImported += batchRes.imported;
        totalUpdated += batchRes.updated;
        totalSkipped += batchRes.skipped;

        hasMore = Boolean(data.has_more);
        page++;
    }

    return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped };
}
