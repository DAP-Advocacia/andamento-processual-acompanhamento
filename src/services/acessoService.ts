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
 * Resolve o colaborador logado + os projetos monitorados, sempre ao vivo do
 * Bitrix (não há mock nem backend próprio). A tela de inteligência trabalha
 * sobre TODOS os GRUPOS_MONITORADOS (não só os grupos de trabalho do usuário
 * logado) — os grupos do usuário servem apenas para decidir se ele tem acesso:
 *
 *  - Embutido no Bitrix (BX24): busca os grupos do usuário atual via
 *    `sonet_group.user.groups` (chamada como o próprio usuário). Se nenhum
 *    deles está em GRUPOS_MONITORADOS, retorna `null` ("sem acesso" — não é
 *    erro fatal; ver useSessaoUsuario / EstadoVazio). Caso contrário, os
 *    `projetosPermitidos` retornados são TODOS os GRUPOS_MONITORADOS.
 *  - Via webhook REST (fora do iframe): não há sessão de usuário, então assume
 *    acesso liberado a todos os GRUPOS_MONITORADOS fixos.
 *  - Sem fonte real: lança, e o chamador mostra o estado de erro.
 */
export async function resolverAcesso(
  idBitrix: number,
  nome: string,
): Promise<SessaoUsuario | null> {
  if (bx24Disponivel()) {
    const grupos = await listarTodasPaginas<GrupoBitrix>('sonet_group.user.groups')
    const temAcessoAMonitorado = grupos.some((g) => GRUPOS_MONITORADOS.includes(Number(g.GROUP_ID)))

    if (!temAcessoAMonitorado) {
      return null
    }
    const projetosPermitidos = await gruposMonitoradosViaWebhook()
    return { colaborador: { id: idBitrix, nome, ativo: true }, projetosPermitidos }
  }

  if (fonteAtiva() === 'webhook') {
    const projetosPermitidos = await gruposMonitoradosViaWebhook()
    return {
      colaborador: { id: idBitrix, nome, ativo: true },
      projetosPermitidos,
    }
  }

  throw new Error(
    'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
  )
}

/** Nomes de todos os grupos monitorados (via `sonet_group.get`, sem depender de sessão). */
async function gruposMonitoradosViaWebhook(): Promise<Projeto[]> {
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
