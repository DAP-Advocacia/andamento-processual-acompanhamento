/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** IDs dos grupos do Bitrix24 monitorados, separados por vírgula. Ex.: "86,92,94". */
  readonly VITE_BITRIX_GRUPOS_ALVO?: string
  /**
   * URL de webhook REST de entrada do Bitrix24, com token embutido. Ex.:
   * "https://SEU_PORTAL.bitrix24.com/rest/1/xxxxxxxxxxxx/". Usada como fallback
   * quando o app roda FORA do iframe do Bitrix (dev/servidor), onde window.BX24
   * não existe. ATENÇÃO: variável VITE_ vai embutida no bundle do front — o token
   * fica visível a quem abrir o app. Não versione o valor real nem publique o
   * build para fora da empresa com o token dentro.
   */
  readonly VITE_BITRIX_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
