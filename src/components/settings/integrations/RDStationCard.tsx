'use client';

import { useState, useEffect } from 'react';
import { RDStationIcon } from '@/components/icons/BrandIcons';
import { RDStationModal } from './RDStationModal';
import {
    getRDStationConfig,
    saveRDStationToken,
    toggleRDStationStatus,
    syncRDStationAction
} from '@/app/_actions/rd-station';
import { toast } from 'sonner';

export function RDStationCard() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'active' | 'inactive'>('inactive');
    const [token, setToken] = useState('');
    const [settings, setSettings] = useState<any>({});
    const [funnels, setFunnels] = useState<Array<{ id: string; name: string }>>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const loadConfig = async () => {
        try {
            const res = await getRDStationConfig();
            if (res.data) {
                setStatus(res.data.status === 'active' ? 'active' : 'inactive');
                setToken(res.data.credentials?.token || '');
                setSettings(res.data.settings || {});
            }
            if (res.funnels) {
                setFunnels(res.funnels);
            }
        } catch (err) {
            console.error('Erro ao carregar RD Station:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSaveToken = async (newToken: string, newTargetFunnelId?: string | null) => {
        const res = await saveRDStationToken(newToken, newTargetFunnelId);
        if (res.success) {
            setToken(newToken);
            setStatus('active');
            await loadConfig();
            return true;
        }
        toast.error('Erro ao salvar configurações: ' + res.error);
        return false;
    };

    const handleToggleStatus = async (checked: boolean) => {
        const nextStatus = checked ? 'active' : 'inactive';
        const res = await toggleRDStationStatus(nextStatus);
        if (res.success) {
            setStatus(nextStatus);
            toast.success(`RD Station CRM ${checked ? 'ativado' : 'desativado'}.`);
        } else {
            toast.error('Erro ao alterar status: ' + res.error);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncRDStationAction();
            if (res.success) {
                toast.success(`Sincronização concluída! ${res.imported} novos, ${res.updated} atualizados.`);
                await loadConfig();
            } else {
                toast.error('Erro na sincronização: ' + res.error);
            }
        } catch (err: any) {
            toast.error('Erro ao sincronizar: ' + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-center min-h-[120px]">
                <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const isAuto = !settings?.target_funnel_id || settings?.target_funnel_id === 'auto';
    const targetFunnel = funnels.find((f) => f.id === settings?.target_funnel_id);
    const funnelLabel = isAuto ? 'Funil RD Station (Auto)' : (targetFunnel ? targetFunnel.name : 'Funil Padrão');

    return (
        <>
            <div
                className="bg-card rounded-xl border border-border overflow-hidden transition-all hover:bg-muted/5 cursor-pointer select-none"
                onClick={() => setIsModalOpen(true)}
            >
                <div className="p-5 bg-muted/30 flex flex-col gap-3">
                    <div className="flex items-start justify-between mb-1">
                        <div className="p-2.5 rounded-xl bg-[#0082FF]/10 text-[#0082FF] w-fit">
                            <RDStationIcon size={22} />
                        </div>
                        <span className={`flex h-2.5 w-2.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>

                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-foreground line-clamp-1">RD Station CRM</h3>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            Sincronize negociações e contatos via API Token.
                        </p>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate max-w-[130px]" title={funnelLabel}>{funnelLabel}</span>
                        <span>{settings?.last_sync_imported ? `${settings.last_sync_imported} importados` : 'Pronto para sync'}</span>
                    </div>
                </div>
            </div>

            <RDStationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                status={status}
                savedToken={token}
                settings={settings}
                funnels={funnels}
                onSaveToken={handleSaveToken}
                onToggleStatus={handleToggleStatus}
                onSync={handleSync}
                isSyncing={isSyncing}
            />
        </>
    );
}
