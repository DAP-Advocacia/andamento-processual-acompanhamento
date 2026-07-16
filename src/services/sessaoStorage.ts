import type { SessaoUsuario } from '../types/domain'

const CHAVE_SESSAO = 'sessao_usuario'
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000 // 8 horas

interface SessaoArmazenada extends SessaoUsuario {
  expiraEm: number
}

// Todo acesso ao localStorage fica em try/catch: rodando como iframe de
// terceiro dentro do Bitrix24, navegadores com bloqueio de armazenamento
// (Safari com prevenção de rastreamento, janelas privadas) podem lançar
// SecurityError/QuotaExceeded — sem o cache o app segue funcionando, só
// reidentifica o usuário a cada carga.

export function lerSessaoValida(): SessaoUsuario | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null

    const sessao = JSON.parse(bruto) as SessaoArmazenada
    if (Date.now() >= sessao.expiraEm) {
      localStorage.removeItem(CHAVE_SESSAO)
      return null
    }
    return { colaborador: sessao.colaborador, projetosPermitidos: sessao.projetosPermitidos }
  } catch {
    try {
      localStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // armazenamento indisponível — nada a limpar
    }
    return null
  }
}

export function salvarSessao(sessao: SessaoUsuario): void {
  try {
    const armazenada: SessaoArmazenada = { ...sessao, expiraEm: Date.now() + DURACAO_SESSAO_MS }
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(armazenada))
  } catch {
    // armazenamento indisponível — segue sem cache de sessão
  }
}
