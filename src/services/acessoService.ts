import { GRUPOS_MONITORADOS } from './bitrixConfig'
import { bx24Disponivel } from './bitrixSdk'
import { fonteAtiva, listarTodasPaginas } from './bitrixTransport'
import type { Projeto, SessaoUsuario } from '../types/domain'

interface GrupoBitrix {
  GROUP_ID?: string
  GROUP_NAME?: string
  // sonet_group.get devolve ID/NAME (maiúsculas diferentes de user.groups).
  ID?: string
  NAME?: string
}

/**
 * Resolve o colaborador logado + os projetos aos quais ele tem acesso, sempre ao
 * vivo do Bitrix (não há mock nem backend próprio):
 *
 *  - Embutido no Bitrix (BX24): busca os grupos do usuário atual via
 *    `sonet_group.user.groups` (chamada como o próprio usuário), restringindo a
 *    GRUPOS_MONITORADOS. Retorna `null` se o usuário não está em nenhum deles
 *    ("sem acesso" — não é erro fatal; ver useSessaoUsuario / EstadoVazio).
 *  - Via webhook REST (fora do iframe): não há sessão de usuário, então assume
 *    todos os GRUPOS_MONITORADOS fixos e busca seus nomes via `sonet_group.get`.
 *  - Sem fonte real: lança, e o chamador mostra o estado de erro.
 */
export async function resolverAcesso(
  idBitrix: number,
  nome: string,
): Promise<SessaoUsuario | null> {
  if (bx24Disponivel()) {
    const grupos = await listarTodasPaginas<GrupoBitrix>('sonet_group.user.groups')
    const projetosPermitidos = grupos
      .filter((g) => GRUPOS_MONITORADOS.includes(Number(g.GROUP_ID)))
      .map((g) => ({ id: Number(g.GROUP_ID), nome: g.GROUP_NAME ?? `Projeto ${g.GROUP_ID}` }))

    if (projetosPermitidos.length === 0) {
      return null
    }
    return { colaborador: { id: idBitrix, nome, ativo: true }, projetosPermitidos }
  }

  if (fonteAtiva() === 'webhook') {
    const projetosPermitidos = await grupposMonitoradosViaWebhook()
    return {
      colaborador: { id: idBitrix, nome, ativo: true },
      projetosPermitidos,
    }
  }

  throw new Error(
    'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
  )
}

/** Nomes dos grupos monitorados via webhook (sem sessão de usuário). */
async function grupposMonitoradosViaWebhook(): Promise<Projeto[]> {
  const grupos = await listarTodasPaginas<GrupoBitrix>('sonet_group.get', {
    FILTER: { ID: GRUPOS_MONITORADOS },
  })
  const nomePorId = new Map<number, string>()
  grupos.forEach((g) => {
    const id = Number(g.ID ?? g.GROUP_ID)
    const nome = g.NAME ?? g.GROUP_NAME
    if (Number.isFinite(id) && nome) nomePorId.set(id, nome)
  })

  return GRUPOS_MONITORADOS.map((id) => ({ id, nome: nomePorId.get(id) ?? `Projeto ${id}` }))
}
