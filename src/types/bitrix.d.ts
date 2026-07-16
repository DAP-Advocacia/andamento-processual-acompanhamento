export {}

/** Superfície mínima do BX24 JS SDK que este app usa (ver https://apidocs.bitrix24.com). */
export interface Bitrix24Result {
  error(): { ex?: { error?: string; error_description?: string } } | false | undefined
  data(): unknown
  /** Total de registros da listagem (quando o método REST devolve `total`). */
  total(): number
  more(): boolean
  next(callback: (result: Bitrix24Result) => void): void
}

interface Bitrix24Sdk {
  init(callback: () => void): void
  callMethod(
    method: string,
    params: Record<string, unknown>,
    callback: (result: Bitrix24Result) => void,
  ): void
  /** Até 50 chamadas em uma única requisição HTTP; resultados na mesma ordem. */
  callBatch(
    calls: Array<{ method: string; params: Record<string, unknown> }>,
    callback: (results: Bitrix24Result[]) => void,
    bShowAjax?: boolean,
  ): void
}

declare global {
  interface Window {
    // O script do BX24 pode deixar isso como null (não só undefined) quando
    // roda fora de um iframe do Bitrix24 e falha ao inicializar.
    BX24?: Bitrix24Sdk | null
  }
}
