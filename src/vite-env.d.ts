/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** IDs dos grupos do Bitrix24 monitorados, separados por vírgula. Ex.: "86,92,94". */
  readonly VITE_BITRIX_GRUPOS_ALVO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
