'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import type { FunnelData } from '@/app/_actions/dashboard';

interface SalesFunnelProps {
    funnelsData?: FunnelData[];
    selectedFunnelId?: string;
    onSelectFunnel?: (funnelId: string) => void;
    funnelSteps?: Array<{
        label: string;
        count: number;
        stageId: string;
        color?: string;
    }>;
}

export default function SalesFunnel({ 
    funnelsData = [], 
    selectedFunnelId = '', 
    onSelectFunnel,
    funnelSteps = [] 
}: SalesFunnelProps) {
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const getStageColor = (color?: string) => {
        if (!color) return undefined;
        const upperColor = color.toUpperCase();
        if (upperColor === '#FFFFFF' || upperColor === '#FFF') return undefined;

        // Se estiver no modo claro e for amarelo ou cores muito claras, escurece para garantir o contraste/legibilidade
        const isDark = mounted && resolvedTheme === 'dark';
        if (!isDark) {
            if (upperColor === '#FFE600' || upperColor === '#FACC15' || upperColor === '#FDE047' || upperColor === '#FEF08A' || upperColor === '#FCD34D') {
                return '#CA8A04'; // Tom dourado/âmbar legível no modo claro
            }
        }
        return color;
    };

    // Determinar os funis a exibir
    const activeFunnels = selectedFunnelId 
        ? funnelsData.filter(f => f.id === selectedFunnelId)
        : funnelsData;

    const renderStageCard = (stage: { id: string; name: string; count: number; color?: string }) => {
        const hasColor = stage.color && stage.color !== '#FFFFFF';
        return (
            <div
                key={stage.id}
                onClick={() => router.push('/leads')}
                className="flex-1 min-w-[120px] flex-shrink-0 md:flex-shrink md:min-w-0 flex flex-col items-center justify-center p-3.5 border border-muted-foreground/30 rounded-lg bg-background shadow-sm hover:bg-muted/30 transition-all active:scale-[0.99] cursor-pointer"
                style={{
                    borderTop: hasColor ? `4px solid ${stage.color}` : undefined,
                }}
            >
                <div className="h-8 flex items-center justify-center mb-1 w-full">
                    <span 
                        className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight line-clamp-2"
                        style={stage.color ? { color: getStageColor(stage.color) } : undefined}
                    >
                        {stage.name}
                    </span>
                </div>
                <span className="text-xl font-bold text-foreground">
                    {stage.count}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div 
                    onClick={() => router.push('/leads')}
                    className="inline-block cursor-pointer group"
                >
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                        <span>Funil de Vendas</span>
                        {selectedFunnelId && activeFunnels[0] && (
                            <span className="text-sm font-normal text-muted-foreground">
                                — {activeFunnels[0].name}
                            </span>
                        )}
                    </h3>
                </div>

                {/* Se houver mais de um funil e função de troca disponível, exibir abas rápidas */}
                {funnelsData.length > 1 && onSelectFunnel && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => onSelectFunnel('')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                !selectedFunnelId
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        >
                            Todos os Funis
                        </button>
                        {funnelsData.map(funnel => (
                            <button
                                key={funnel.id}
                                type="button"
                                onClick={() => onSelectFunnel(funnel.id)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                    selectedFunnelId === funnel.id
                                        ? 'bg-secondary text-secondary-foreground shadow-sm'
                                        : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                            >
                                {funnel.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Renderização com funnelsData estruturado */}
            {funnelsData.length > 0 ? (
                <div className="space-y-4">
                    {activeFunnels.map(funnel => (
                        <div 
                            key={funnel.id} 
                            className="bg-card rounded-xl border border-muted-foreground/30 p-4 shadow-sm space-y-3"
                        >
                            {/* Cabeçalho do Funil (quando múltiplos funis estiverem visíveis) */}
                            {!selectedFunnelId && funnelsData.length > 1 && (
                                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                    <span className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
                                        {funnel.name}
                                    </span>
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        {funnel.totalLeads} {funnel.totalLeads === 1 ? 'lead ativo' : 'leads ativos'}
                                    </span>
                                </div>
                            )}

                            <div className="overflow-x-auto pb-2 md:pb-0">
                                {funnel.stages.length > 0 ? (
                                    <div 
                                        className="flex gap-3 md:grid"
                                        style={{
                                            gridTemplateColumns: `repeat(${funnel.stages.length}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {funnel.stages.map(renderStageCard)}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground text-sm py-6">
                                        Nenhum estágio configurado neste funil.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : funnelSteps.length > 0 ? (
                /* Fallback legado caso funnelsData não tenha sido carregado */
                <div className="bg-card rounded-xl border border-muted-foreground/30 p-4 shadow-sm">
                    <div className="overflow-x-auto pb-2 md:pb-0">
                        <div 
                            className="flex gap-4 md:grid"
                            style={{
                                gridTemplateColumns: `repeat(${funnelSteps.length}, minmax(0, 1fr))`
                            }}
                        >
                            {funnelSteps.map((step, index) => renderStageCard({
                                id: step.stageId || String(index),
                                name: step.label,
                                count: step.count,
                                color: step.color
                            }))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-card rounded-xl border border-muted-foreground/30 p-8 text-center text-muted-foreground text-sm shadow-sm">
                    Nenhum estágio ou funil configurado.
                </div>
            )}
        </div>
    );
}
