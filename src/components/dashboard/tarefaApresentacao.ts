import type { Tarefa } from '../../types/domain'
import { tarefaEstaAtrasada, tarefaEstaConcluida } from '../../utils/tarefasMetrics'

/** Cor do badge de status, compartilhada entre a tabela e o modal de detalhes. */
export function corDoStatus(tarefa: Tarefa): string {
  if (tarefaEstaConcluida(tarefa)) return 'green'
  if (tarefa.status === 6) return 'gray'
  if (tarefaEstaAtrasada(tarefa, new Date())) return 'red'
  return 'blue'
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
