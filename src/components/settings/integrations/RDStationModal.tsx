'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Switch } from '@/components/ui/Switch';
import { FormInput } from '@/components/shared/forms/FormInput';
import { RDStationIcon } from '@/components/icons/BrandIcons';
import { Loader2, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface RDStationModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'active' | 'inactive';
    savedToken: string;
    settings: any;
    onSaveToken: (token: string) => Promise<boolean>;
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
    onSaveToken,
    onToggleStatus,
    onSync,
    isSyncing
}: RDStationModalProps) {
    const [token, setToken] = useState(savedToken || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token.trim()) return;
        setIsSaving(true);
        const ok = await onSaveToken(token.trim());
        setIsSaving(false);
        if (ok) toast.success('Token do RD Station salvo com sucesso!');
    };

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

                {/* Seção 2: Token de Acesso */}
                <div className="space-y-4 pt-8 border-t border-border/50">
                    <div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                            Token de API
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

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || !token.trim()}
                                className="h-[34px] min-w-[130px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 rounded-lg hover:bg-[#F2DB00] active:scale-[0.99] transition-all text-xs font-bold uppercase tracking-widest shadow-sm disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                                Salvar Token
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
            </div>
        </Modal>
    );
}
