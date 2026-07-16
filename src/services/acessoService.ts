import { GRUPOS_MONITORADOS } from './bitrixConfig'
import { bx24Disponivel, callMethodTodasPaginas } from './bitrixSdk'
import { colaboradoresFixture, projetosPermitidosDoColaborador } from './mock/fixtures'
import type { SessaoUsuario } from '../types/domain'

const LATENCIA_SIMULADA_MS = 300

interface GrupoBitrix {
  GROUP_ID: string
  GROUP_NAME: string
}

/**
 * Resolve o colaborador logado + os projetos aos quais ele tem acesso. Sem
 * backend próprio: busca isso direto no Bitrix via `sonet_group.user.groups`
 * (grupos do usuário atualmente autenticado, chamada como o próprio usuário via
 * BX24), restringindo aos grupos monitorados (GRUPOS_MONITORADOS).
 *
 * Retorna `null` quando o colaborador não está em nenhum projeto monitorado — o
 * chamador deve tratar isso como "sem acesso", nunca como erro fatal (ver
 * useSessaoUsuario / EstadoVazio).
 */
export async function resolverAcesso(
  idBitrix: number,
  nome: string,
): Promise<SessaoUsuario | null> {
  if (!bx24Disponivel()) {
    return resolverAcessoMock(idBitrix)
  }

  const grupos = await callMethodTodasPaginas<GrupoBitrix>('sonet_group.user.groups')
  const projetosPermitidos = grupos
    .filter((g) => GRUPOS_MONITORADOS.includes(Number(g.GROUP_ID)))
    .map((g) => ({ id: Number(g.GROUP_ID), nome: g.GROUP_NAME }))

  if (projetosPermitidos.length === 0) {
    return null
  }

  return { colaborador: { id: idBitrix, nome, ativo: true }, projetosPermitidos }
}

function resolverAcessoMock(idBitrix: number): Promise<SessaoUsuario | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const colaborador = colaboradoresFixture.find((c) => c.id === idBitrix && c.ativo)
      if (!colaborador) {
        resolve(null)
        return
      }

      const projetosPermitidos = projetosPermitidosDoColaborador(idBitrix)
      if (projetosPermitidos.length === 0) {
        resolve(null)
        return
      }

      resolve({ colaborador, projetosPermitidos })
    }, LATENCIA_SIMULADA_MS)
  })
}
