/**
 * IDs dos grupos (projetos) do Bitrix24 monitorados pelo dashboard. Fixos por
 * variável de ambiente de build, não editáveis pela UI — mesma decisão do
 * documento original, só que aplicada a uma env var do Vite em vez de uma
 * Edge Function (não há mais backend próprio).
 */
export const GRUPOS_MONITORADOS: number[] = (import.meta.env.VITE_BITRIX_GRUPOS_ALVO ?? '86,92,94')
  .split(',')
  .map((valor) => Number(valor.trim()))
  .filter((valor) => Number.isFinite(valor))
