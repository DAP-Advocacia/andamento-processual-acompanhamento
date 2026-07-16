import type { Bitrix24Result } from '../types/bitrix'

export interface UsuarioBitrixAtual {
  idBitrix: number
  nome: string
}

// Ana Souza (fixture) — usado só em `npm run dev` fora do iframe do Bitrix24,
// onde window.BX24 não existe. Nunca ativo em build de produção.
const DEV_ID_BITRIX_FALLBACK = 101

const MAX_TENTATIVAS_RATE_LIMIT = 5

// Tamanho fixo de página das listagens REST do Bitrix24 e limite de comandos
// por requisição batch.
const TAMANHO_PAGINA_BITRIX = 50
const MAX_CHAMADAS_POR_BATCH = 50

export function bx24Disponivel(): boolean {
  // O script oficial do BX24 define window.BX24 = null (não undefined) quando
  // roda fora de um iframe embutido pelo Bitrix24 e não consegue inicializar.
  return typeof window !== 'undefined' && Boolean(window.BX24)
}

function exigirBx24(): void {
  if (!bx24Disponivel()) {
    throw new Error(
      'SDK do Bitrix24 (BX24) indisponível — o app precisa rodar embutido no Bitrix24.',
    )
  }
}

function inicializarBx24(): Promise<void> {
  exigirBx24()
  return new Promise((resolve) => {
    window.BX24!.init(() => resolve())
  })
}

function esperarMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ehRateLimit(erro: { ex?: { error?: string } }): boolean {
  return erro.ex?.error === 'QUERY_LIMIT_EXCEEDED'
}

function erroDeChamada(method: string, erro: { ex?: { error_description?: string } }): Error {
  return new Error(erro.ex?.error_description ?? `Erro ao chamar ${method} no Bitrix24.`)
}

/** Chama um método do Bitrix24 que devolve um único registro/objeto (não paginado). */
export async function callMethod<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  await inicializarBx24()
  return chamarComRetry<T>(method, params)
}

function chamarComRetry<T>(
  method: string,
  params: Record<string, unknown>,
  tentativa = 0,
): Promise<T> {
  return new Promise((resolve, reject) => {
    window.BX24!.callMethod(method, params, (result) => {
      const erro = result.error()
      if (erro) {
        if (ehRateLimit(erro) && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
          esperarMs(1000 * (tentativa + 1)).then(() =>
            chamarComRetry<T>(method, params, tentativa + 1).then(resolve, reject),
          )
          return
        }
        reject(erroDeChamada(method, erro))
        return
      }
      resolve(result.data() as T)
    })
  })
}

interface PrimeiraPagina<T> {
  itens: T[]
  total: number
  /** true quando a listagem coube inteira na primeira página (ou foi esgotada em fallback). */
  completo: boolean
}

/**
 * Chama um método de listagem do Bitrix24 trazendo todos os registros de forma
 * performática: a primeira página revela o `total` e as demais são buscadas em
 * lote via BX24.callBatch (até 50 páginas por requisição HTTP), em vez do
 * padrão sequencial result.next() — que custa uma ida ao servidor por página.
 *
 * `extrairLista` cobre métodos cujo payload não é um array direto (ex.:
 * tasks.task.list devolve `{ tasks: [...] }`).
 */
export async function callMethodTodasPaginas<T>(
  method: string,
  params: Record<string, unknown> = {},
  extrairLista: (payload: unknown) => T[] = (payload) => payload as T[],
): Promise<T[]> {
  await inicializarBx24()

  const primeira = await buscarPrimeiraPagina<T>(method, params, extrairLista)
  const acumulado = [...primeira.itens]
  if (primeira.completo) {
    return acumulado
  }

  const offsets: number[] = []
  for (let start = TAMANHO_PAGINA_BITRIX; start < primeira.total; start += TAMANHO_PAGINA_BITRIX) {
    offsets.push(start)
  }

  for (let i = 0; i < offsets.length; i += MAX_CHAMADAS_POR_BATCH) {
    const lote = offsets.slice(i, i + MAX_CHAMADAS_POR_BATCH)
    const resultados = await new Promise<Bitrix24Result[]>((resolve) => {
      window.BX24!.callBatch(
        lote.map((start) => ({ method, params: { ...params, start } })),
        (batch) => resolve(batch),
      )
    })

    for (let j = 0; j < resultados.length; j++) {
      const erro = resultados[j].error()
      if (erro) {
        // Sub-chamada falhou (ex.: rate limit no meio do lote): refaz só ela.
        const payload = await chamarComRetry<unknown>(method, { ...params, start: lote[j] })
        acumulado.push(...extrairLista(payload))
      } else {
        acumulado.push(...extrairLista(resultados[j].data()))
      }
    }
  }

  return acumulado
}

function buscarPrimeiraPagina<T>(
  method: string,
  params: Record<string, unknown>,
  extrairLista: (payload: unknown) => T[],
): Promise<PrimeiraPagina<T>> {
  return new Promise((resolve, reject) => {
    const acumuladoFallback: T[] = []

    function tratar(result: Bitrix24Result, tentativa = 0, emFallback = false) {
      const erro = result.error()
      if (erro) {
        if (ehRateLimit(erro) && tentativa < MAX_TENTATIVAS_RATE_LIMIT) {
          esperarMs(1000 * (tentativa + 1)).then(() => {
            if (emFallback) {
              result.next((proximo) => tratar(proximo, tentativa + 1, true))
            } else {
              window.BX24!.callMethod(method, params, (novo) => tratar(novo, tentativa + 1))
            }
          })
          return
        }
        reject(erroDeChamada(method, erro))
        return
      }

      const itens = extrairLista(result.data())

      if (emFallback) {
        acumuladoFallback.push(...itens)
        if (result.more()) {
          result.next((proximo) => tratar(proximo, 0, true))
        } else {
          resolve({ itens: acumuladoFallback, total: acumuladoFallback.length, completo: true })
        }
        return
      }

      if (!result.more()) {
        resolve({ itens, total: itens.length, completo: true })
        return
      }

      const total = Number(result.total()) || 0
      if (total > itens.length) {
        resolve({ itens, total, completo: false })
        return
      }

      // Método sem `total` confiável: percorre sequencialmente via next().
      acumuladoFallback.push(...itens)
      result.next((proximo) => tratar(proximo, 0, true))
    }

    window.BX24!.callMethod(method, params, (result) => tratar(result))
  })
}

export async function obterUsuarioBitrixAtual(): Promise<UsuarioBitrixAtual> {
  if (!bx24Disponivel()) {
    if (import.meta.env.DEV) {
      return { idBitrix: DEV_ID_BITRIX_FALLBACK, nome: '(dev) usuário simulado' }
    }
    throw new Error(
      'SDK do Bitrix24 (BX24) não encontrado. Este aplicativo só funciona embutido no Bitrix24.',
    )
  }

  const dados = await callMethod<{ ID: string; NAME?: string; LAST_NAME?: string }>('user.current')
  const nome = [dados.NAME, dados.LAST_NAME].filter(Boolean).join(' ')
  return { idBitrix: Number(dados.ID), nome: nome || `Usuário ${dados.ID}` }
}
