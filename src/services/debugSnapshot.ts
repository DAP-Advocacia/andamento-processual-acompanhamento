/**
 * Captura de diagnóstico do snapshot lido do sync-service — SOMENTE em
 * desenvolvimento (import.meta.env.DEV). Substitui, para a parte de tarefas,
 * o antigo rastro de requests ao vivo do Bitrix: agora a sincronização roda
 * fora do navegador, então o que dá para inspecionar aqui é a metadata do
 * último snapshot lido (quando sincronizou, quantas tarefas por grupo, erros).
 */

const ATIVO = import.meta.env.DEV

export interface GrupoSnapshot {
  id: number
  nome: string
  taskCount: number
  error: string | null
}

export interface SnapshotMetadataDebug {
  syncedAt: string
  windowStart: string
  windowEnd: string
  groups: GrupoSnapshot[]
  runId: string
}

let metadata: SnapshotMetadataDebug | null = null
const ouvintes = new Set<() => void>()

function notificar(): void {
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function registrarSnapshotMetadata(novaMetadata: SnapshotMetadataDebug): void {
  if (!ATIVO) return
  metadata = novaMetadata
  notificar()
}

export function lerSnapshotMetadataDebug(): SnapshotMetadataDebug | null {
  return metadata
}

export function assinarSnapshotDebug(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export const debugSnapshotAtivo = ATIVO
