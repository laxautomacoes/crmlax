'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, MoreVertical, LayoutGrid, ChevronDown, Star } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Modal } from '@/components/shared/Modal'
import { FormInput } from '@/components/shared/forms/FormInput'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'

interface Funnel {
    id: string
    name: string
    allowed_sources?: string[] | null
    owner_user_id?: string | null
}

interface FunnelSelectorProps {
    funnels: Funnel[]
    selectedFunnelId: string | null
    preferredFunnelId?: string | null
    currentUserId?: string | null
    onSelect: (id: string) => void
    onSetPreferred?: (id: string | null) => Promise<void> | void
    onCreate: (name: string) => Promise<{ success: boolean; error?: string; limitReached?: boolean }>
    onEdit: (id: string, data: { name: string; allowed_sources: string[]; owner_user_id: string | null }) => Promise<{ success: boolean; error?: string }>
    onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
}

export function FunnelSelector({ funnels, selectedFunnelId, preferredFunnelId, currentUserId, onSelect, onSetPreferred, onCreate, onEdit, onDelete }: FunnelSelectorProps) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [newFunnelName, setNewFunnelName] = useState('')
    const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null)
    const [editSources, setEditSources] = useState('')
    const [editIsPersonal, setEditIsPersonal] = useState(false)
    const [editIsPreferred, setEditIsPreferred] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreate = async () => {
        if (!newFunnelName.trim()) return
        setIsSubmitting(true)
        const result = await onCreate(newFunnelName.trim())
        setIsSubmitting(false)

        if (result.success) {
            toast.success('Funil criado com sucesso')
            setIsCreateModalOpen(false)
            setNewFunnelName('')
        } else if (result.limitReached) {
            toast.error(result.error)
        } else {
            toast.error(result.error || 'Erro ao criar funil')
        }
    }

    const handleEdit = async () => {
        if (!editingFunnel || !editingFunnel.name.trim()) return
        setIsSubmitting(true)
        
        // Converter a string de origens em array, limpando espaços
        const sourcesArray = editSources
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)

        const result = await onEdit(editingFunnel.id, {
            name: editingFunnel.name.trim(),
            allowed_sources: sourcesArray,
            owner_user_id: editIsPersonal && currentUserId ? currentUserId : null,
        })

        if (onSetPreferred && editingFunnel) {
            const wasPreferred = preferredFunnelId === editingFunnel.id
            if (editIsPreferred && !wasPreferred) {
                await onSetPreferred(editingFunnel.id)
            } else if (!editIsPreferred && wasPreferred) {
                await onSetPreferred(null)
            }
        }

        setIsSubmitting(false)

        if (result.success) {
            toast.success('Funil atualizado com sucesso')
            setIsEditModalOpen(false)
            setEditingFunnel(null)
            setEditSources('')
            setEditIsPersonal(false)
        } else {
            toast.error(result.error || 'Erro ao atualizar funil')
        }
    }

    const handleDelete = async () => {
        if (!selectedFunnelId) return
        if (funnels.length <= 1) {
            toast.error('Você não pode excluir o único funil restante.')
            setIsDeleteModalOpen(false)
            return
        }

        setIsSubmitting(true)
        const result = await onDelete(selectedFunnelId)
        setIsSubmitting(false)

        if (result.success) {
            toast.success('Funil excluído com sucesso')
            setIsDeleteModalOpen(false)
        } else {
            toast.error(result.error || 'Erro ao excluir funil')
        }
    }

    const openEdit = (funnel: Funnel) => {
        setEditingFunnel(funnel)
        setEditSources((funnel.allowed_sources || []).join(', '))
        setEditIsPersonal(!!funnel.owner_user_id)
        setEditIsPreferred(preferredFunnelId === funnel.id)
        setIsEditModalOpen(true)
    }

    const selectedFunnel = funnels.find(f => f.id === selectedFunnelId)
    const isCurrentPreferred = selectedFunnel && selectedFunnel.id === preferredFunnelId

    return (
        <div className="flex items-center gap-2 mb-4 bg-card border border-border p-1.5 rounded-lg shadow-sm w-fit">
            <div className="flex items-center text-muted-foreground pl-2 pr-2 border-r border-border">
                <LayoutGrid size={18} />
            </div>
            
            <div className="relative flex items-center">
                <select
                    value={selectedFunnelId || ''}
                    onChange={(e) => onSelect(e.target.value)}
                    className="w-[200px] h-8 bg-transparent text-sm font-bold text-foreground border-0 focus:ring-0 appearance-none pr-8 cursor-pointer outline-none"
                >
                    <option value="" disabled>Selecione um funil</option>
                    {funnels.map(funnel => (
                        <option key={funnel.id} value={funnel.id}>
                            {funnel.name}{funnel.id === preferredFunnelId ? ' ★' : ''}
                        </option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 text-muted-foreground pointer-events-none" />
            </div>

            {isCurrentPreferred && (
                <div title="Funil preferido — abre primeiro ao carregar a página" className="flex items-center text-amber-500 pr-1">
                    <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                </div>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Opções do funil">
                        <MoreVertical size={16} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {selectedFunnel && onSetPreferred && (
                        <DropdownMenuItem 
                            onClick={() => onSetPreferred(isCurrentPreferred ? null : selectedFunnel.id)} 
                            className="cursor-pointer gap-2"
                        >
                            <Star size={16} className={isCurrentPreferred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
                            {isCurrentPreferred ? 'Remover dos preferidos' : 'Definir como preferido'}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsCreateModalOpen(true)} className="cursor-pointer gap-2">
                        <Plus size={16} />
                        Criar novo funil
                    </DropdownMenuItem>
                    {selectedFunnel && (
                        <>
                            <DropdownMenuItem onClick={() => openEdit(selectedFunnel)} className="cursor-pointer gap-2">
                                <Edit2 size={16} />
                                Editar funil atual
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsDeleteModalOpen(true)} className="cursor-pointer gap-2 text-red-500 hover:text-red-600 focus:text-red-600">
                                <Trash2 size={16} />
                                Excluir funil atual
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal — Criar Funil */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Criar Novo Funil">
                <div className="space-y-4">
                    <div className="flex flex-col">
                        <label className="text-xs font-bold text-foreground ml-1 mb-2">Nome do Funil</label>
                        <FormInput
                            value={newFunnelName}
                            onChange={(e) => setNewFunnelName(e.target.value)}
                            placeholder="Ex: Funil RD Station"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                        <button 
                            type="button" 
                            onClick={() => setIsCreateModalOpen(false)} 
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-foreground border border-border/20 hover:bg-muted/50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={handleCreate} 
                            disabled={!newFunnelName.trim() || isSubmitting} 
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-secondary text-secondary-foreground hover:bg-[#F2DB00] transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
                        >
                            Criar Funil
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal — Editar Funil */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Funil">
                <div className="space-y-8">
                    {/* Seção 1: Nome */}
                    <div className="space-y-4">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-foreground ml-1 mb-2">Nome do Funil</label>
                            <FormInput
                                value={editingFunnel?.name || ''}
                                onChange={(e) => setEditingFunnel(prev => prev ? { ...prev, name: e.target.value } : null)}
                                placeholder="Ex: Funil Comercial"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Seção 2: Origens de Webhook */}
                    <div className="space-y-4 pt-8 border-t border-border/50">
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                                Origens de Webhook
                            </h3>
                            <p className="text-xs text-muted-foreground leading-snug mt-1">
                                <span className="block">Defina quais origens de leads serão direcionadas automaticamente para este funil.</span>
                                <span className="block">Separe múltiplas origens por vírgula (ex: Meta Ads, Google Ads, RD Station).</span>
                            </p>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-foreground ml-1 mb-2">Origens Permitidas (Opcional)</label>
                            <FormInput
                                value={editSources}
                                onChange={(e) => setEditSources(e.target.value)}
                                placeholder="Ex: Meta Ads, Google Ads, RD Station"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Seção 3: Funil Pessoal */}
                    <div className="space-y-4 pt-8 border-t border-border/50">
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                                Funil Pessoal
                            </h3>
                            <p className="text-xs text-muted-foreground leading-snug mt-1">
                                <span className="block">Ao ativar, todos os leads que chegarem neste funil serão atribuídos diretamente a você.</span>
                                <span className="block">Ideal para campanhas pessoais. Leads não passarão pela roleta de distribuição.</span>
                            </p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer select-none group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={editIsPersonal}
                                    onChange={(e) => setEditIsPersonal(e.target.checked)}
                                    disabled={isSubmitting}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-[#404F4F] dark:peer-checked:bg-secondary transition-colors" />
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                                {editIsPersonal ? 'Funil pessoal ativado — leads serão atribuídos a mim' : 'Desativado — leads seguem a roleta padrão'}
                            </span>
                        </label>
                    </div>

                    {/* Seção 4: Funil Preferido */}
                    {onSetPreferred && (
                        <div className="space-y-4 pt-8 border-t border-border/50">
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                                    Funil Preferido
                                </h3>
                                <p className="text-xs text-muted-foreground leading-snug mt-1">
                                    <span className="block">Ao ativar, este funil será aberto automaticamente em primeiro lugar ao carregar a página de Leads.</span>
                                </p>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer select-none group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={editIsPreferred}
                                        onChange={(e) => setEditIsPreferred(e.target.checked)}
                                        disabled={isSubmitting}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-[#404F4F] dark:peer-checked:bg-secondary transition-colors" />
                                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                                </div>
                                <span className="text-sm font-medium text-foreground">
                                    {editIsPreferred ? 'Funil preferido ativado — abre primeiro ao carregar' : 'Desativado — não é o funil preferido'}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Rodapé */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                        <button 
                            type="button" 
                            onClick={() => setIsEditModalOpen(false)} 
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-foreground border border-border/20 hover:bg-muted/50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={handleEdit} 
                            disabled={!editingFunnel?.name.trim() || isSubmitting} 
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-secondary text-secondary-foreground hover:bg-[#F2DB00] transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>

            {isDeleteModalOpen && (
                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    title="Excluir Funil?"
                    message={`Tem certeza que deseja excluir o funil "${selectedFunnel?.name}"? Esta ação não pode ser desfeita e afetará as etapas dentro dele.`}
                    onConfirm={handleDelete}
                    onCancel={() => setIsDeleteModalOpen(false)}
                    isLoading={isSubmitting}
                />
            )}
        </div>
    )
}
