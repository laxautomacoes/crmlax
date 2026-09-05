'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Switch } from '@/components/ui/Switch';
import { FormInput } from '@/components/shared/forms/FormInput';
import { FormSelect } from '@/components/shared/forms/FormSelect';
import { RDStationIcon } from '@/components/icons/BrandIcons';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RDStationModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'active' | 'inactive';
    savedToken: string;
    settings: any;
    funnels: Array<{ id: string; name: string }>;
    onSaveToken: (token: string, targetFunnelId?: string | null) => Promise<boolean>;
    onToggleStatus: (checked: boolean) => Promise<void>;
    onSync: () => Promise<void>;
    isSyncing: boolean;
}

export function RDStationModal({
    isOpen,
    onClose,
    status,
    savedToken,
    settings,
    funnels,
    onSaveToken,
    onToggleStatus,
    onSync,
    isSyncing
}: RDStationModalProps) {
    const [token, setToken] = useState(savedToken || '');
    const [targetFunnelId, setTargetFunnelId] = useState(settings?.target_funnel_id || 'auto');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setToken(savedToken || '');
        setTargetFunnelId(settings?.target_funnel_id || 'auto');
    }, [savedToken, settings?.target_funnel_id, isOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token.trim()) return;
        setIsSaving(true);
        const ok = await onSaveToken(token.trim(), targetFunnelId || 'auto');
        setIsSaving(false);
        if (ok) toast.success('Configurações do RD Station salvas com sucesso!');
    };

    const syncHistory = (() => {
        if (Array.isArray(settings?.sync_history) && settings.sync_history.length > 0) {
            return settings.sync_history;
        }
        if (settings?.last_sync_at) {
            return [
                {
                    date: settings.last_sync_at,
                    imported: settings.last_sync_imported ?? 0,
                    updated: settings.last_sync_updated ?? 0,
                    skipped: settings.last_sync_skipped ?? 0,
                }
            ];
        }
        return [];
    })();

    const lastSyncAt = settings?.last_sync_at
        ? new Date(settings.last_sync_at).toLocaleString('pt-BR')
        : 'Nenhuma sincronização ainda';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#0082FF]/10 text-[#0082FF]">
                        <RDStationIcon size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-widest">
                            Configurar RD Station CRM
                        </h3>
                        <p className="text-xs text-muted-foreground leading-snug mt-1">
                            <span className="block">Sincronize contatos e negociações com o seu pipeline.</span>
                        </p>
                    </div>
                </div>
            }
        >
            <div className="space-y-8">
                {/* Seção 1: Status */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2">
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                                Status da Conexão
                            </h3>
                            <p className="text-xs text-muted-foreground leading-snug mt-1">
                                <span className="block">Habilite ou desative a integração a qualquer momento.</span>
                            </p>
                        </div>
                        <Switch
                            checked={status === 'active'}
                            onChange={(checked) => onToggleStatus(checked)}
                        />
                    </div>
                </div>

                {/* Seção 2: Credenciais e Roteamento */}
                <div className="space-y-4 pt-8 border-t border-border/50">
                    <div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                            Credenciais e Roteamento
                        </h3>
                        <p className="text-xs text-muted-foreground leading-snug mt-1">
                            <span className="block">Localize seu token pessoal no RD Station CRM em:</span>
                            <span className="block font-medium text-foreground">Configurações &gt; Integrações &gt; Dados de Acesso &gt; Token.</span>
                        </p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-foreground ml-1 mb-2">Token Pessoal (API)</label>
                            <FormInput
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Insira seu token do RD Station CRM..."
                                required
                            />
                        </div>

                        <div className="flex flex-col">
                            <FormSelect
                                label="Funil de Destino"
                                value={targetFunnelId}
                                onChange={(e) => setTargetFunnelId(e.target.value)}
                                options={[
                                    { value: 'auto', label: '✨ Criar / Sincronizar Funil RD Station (Automático)' },
                                    ...funnels.map((f) => ({ value: f.id, label: f.name }))
                                ]}
                            />
                            <p className="text-xs text-muted-foreground leading-snug mt-1 ml-1">
                                <span className="block">No modo automático, o crmLAX cria o funil e todas as etapas idênticas às do RD Station.</span>
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || !token.trim()}
                                className="h-[34px] min-w-[130px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 rounded-lg hover:bg-[#F2DB00] active:scale-[0.99] transition-all text-xs font-bold uppercase tracking-widest shadow-sm disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                                Salvar Configurações
                            </button>
                        </div>
                    </form>
                </div>

                {/* Seção 3: Sincronização */}
                <div className="space-y-4 pt-8 border-t border-border/50">
                    <div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                            Sincronização de Negócios
                        </h3>
                        <p className="text-xs text-muted-foreground leading-snug mt-1">
                            <span className="block">Importa novas negociações e atualiza os valores das existentes.</span>
                            <span className="block">Último sync: {lastSyncAt}</span>
                        </p>
                    </div>

                    {/* Métricas do último sync */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Importados</span>
                            <p className="text-lg font-black text-foreground mt-0.5">{settings?.last_sync_imported ?? 0}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Atualizados</span>
                            <p className="text-lg font-black text-foreground mt-0.5">{settings?.last_sync_updated ?? 0}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ignorados</span>
                            <p className="text-lg font-black text-muted-foreground mt-0.5">{settings?.last_sync_skipped ?? 0}</p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={onSync}
                            disabled={isSyncing || status !== 'active' || !savedToken}
                            className="h-[34px] min-w-[160px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 rounded-lg hover:bg-[#F2DB00] active:scale-[0.99] transition-all text-xs font-bold uppercase tracking-widest shadow-sm disabled:opacity-50"
                        >
                            {isSyncing ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={14} />
                                    Sincronizar Agora
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Seção 4: Histórico de Sincronizações */}
                <div className="space-y-4 pt-8 border-t border-border/50">
                    <div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                            Histórico de Sincronizações
                        </h3>
                        <p className="text-xs text-muted-foreground leading-snug mt-1">
                            <span className="block">Registro detalhado dos últimos sincronismos realizados nesta integração.</span>
                        </p>
                    </div>

                    {syncHistory.length === 0 ? (
                        <div className="p-4 rounded-lg bg-muted/20 border border-border text-center text-xs text-muted-foreground">
                            Nenhuma sincronização registrada no histórico ainda.
                        </div>
                    ) : (
                        <div className="bg-card rounded-lg border border-muted-foreground/30 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
                                    <thead className="bg-gray-200 dark:bg-muted/50 border-b border-muted-foreground/30">
                                        <tr>
                                            <th className="px-4 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
                                                Data / Hora
                                            </th>
                                            <th className="px-3 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider text-center w-24">
                                                Novos
                                            </th>
                                            <th className="px-3 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider text-center w-28">
                                                Atualizados
                                            </th>
                                            <th className="px-3 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider text-center w-24">
                                                Ignorados
                                            </th>
                                            <th className="px-3 py-2.5 text-[10px] font-bold text-foreground uppercase tracking-wider text-center w-20">
                                                Notas
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-muted-foreground/30">
                                        {syncHistory.map((item: any, index: number) => {
                                            const formattedDate = item.date
                                                ? new Date(item.date).toLocaleString('pt-BR', {
                                                      day: '2-digit',
                                                      month: '2-digit',
                                                      year: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                      second: '2-digit',
                                                  })
                                                : '-';

                                            return (
                                                <tr key={index} className="hover:bg-muted/50 transition-colors">
                                                    <td className="px-4 py-2.5 text-xs font-medium text-foreground">
                                                        {formattedDate}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center">
                                                        +{item.imported ?? 0}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-bold text-foreground text-center">
                                                        {item.updated ?? 0}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-center">
                                                        {item.skipped ?? 0}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-bold text-foreground text-center">
                                                        {item.notes_synced !== undefined ? item.notes_synced : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
