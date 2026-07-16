import { useEffect, useState } from 'react'
import { resolverAcesso } from '../services/acessoService'
import { obterUsuarioBitrixAtual } from '../services/bitrixSdk'
import { lerSessaoValida, salvarSessao } from '../services/sessaoStorage'
import type { SessaoUsuario } from '../types/domain'

export type EstadoSessao = 'carregando' | 'ok' | 'sem_acesso' | 'erro'

interface ResultadoSessao {
  estado: EstadoSessao
  colaborador: SessaoUsuario['colaborador'] | null
  projetosPermitidos: SessaoUsuario['projetosPermitidos']
  mensagemErro: string | null
}

/**
 * Identifica o usuário atual via BX24 e resolve seus projetos permitidos, sem
 * nenhuma tela de login. O resultado fica em localStorage por 8h — mas isso é só
 * cache de UI: cada chamada de dado real revalida o acesso no backend (ver
 * dashboardService/acessoService), nunca confiamos apenas nisto para segurança.
 */
export function useSessaoUsuario(): ResultadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>('carregando')
  const [sessao, setSessao] = useState<SessaoUsuario | null>(null)
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregarSessao() {
      const sessaoExistente = lerSessaoValida()
      if (sessaoExistente) {
        setSessao(sessaoExistente)
        setEstado('ok')
        return
      }

      try {
        const usuario = await obterUsuarioBitrixAtual()
        const acesso = await resolverAcesso(usuario.idBitrix, usuario.nome)
        if (cancelado) return

        if (!acesso) {
          setEstado('sem_acesso')
          return
        }

        salvarSessao(acesso)
        setSessao(acesso)
        setEstado('ok')
      } catch (erro) {
        if (cancelado) return
        setMensagemErro(
          erro instanceof Error ? erro.message : 'Erro desconhecido ao identificar usuário.',
        )
        setEstado('erro')
      }
    }

    carregarSessao()
    return () => {
      cancelado = true
    }
  }, [])

  return {
    estado,
    colaborador: sessao?.colaborador ?? null,
    projetosPermitidos: sessao?.projetosPermitidos ?? [],
    mensagemErro,
  }
}
