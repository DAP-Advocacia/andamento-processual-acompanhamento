import type { EquipeAtendimento, PrioridadeTarefa, Tarefa } from '../../types/domain'
import { tarefaEstaAtrasada, tarefaEstaConcluida } from '../../utils/tarefasMetrics'

/**
 * Paleta categórica das equipes de atendimento — ordem FIXA (a cor segue a
 * equipe, nunca o rank/posição no gráfico). Validada com scripts/validate_palette.js
 * do skill dataviz (light surface): todos os checks passam (banda de luminosidade,
 * chroma, separação CVD, contraste). Não reordenar sem revalidar.
 */
export const COR_POR_EQUIPE: Record<EquipeAtendimento, string> = {
  'Cinthia Filgueiras': '#2f6fb0',
  'Simone Freitas': '#c96a12',
  'Quézia Karen': '#158a6f',
  'Lorena Pontes': '#a44fc0',
  indefinido: '#c0395a',
}

/**
 * Paleta de STATUS (situação de prazo) — cores semânticas reservadas, sempre
 * acompanhadas de rótulo/legenda (nunca cor sozinha). Mantém a convenção
 * verde=concluído / vermelho=atrasado.
 */
export const COR_POR_SITUACAO = {
  noPrazo: '#2f6fb0',
  adiadas: '#b8791a',
  concluidas: '#158a6f',
  atrasadas: '#c0395a',
} as const

/** Cor do badge de status, compartilhada entre a tabela e o modal de detalhes. */
export function corDoStatus(tarefa: Tarefa): string {
  if (tarefaEstaConcluida(tarefa)) return 'green'
  if (tarefa.status === 6) return 'gray'
  if (tarefaEstaAtrasada(tarefa, new Date())) return 'red'
  return 'blue'
}

const CORES_POR_PRIORIDADE: Record<PrioridadeTarefa, string> = {
  '0': 'gray',
  '1': 'blue',
  '2': 'red',
}

export function corDaPrioridade(prioridade: PrioridadeTarefa): string {
  return CORES_POR_PRIORIDADE[prioridade]
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
