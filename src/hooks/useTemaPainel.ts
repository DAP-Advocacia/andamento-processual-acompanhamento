import { useCallback, useEffect, useState } from 'react'

export type TemaPainel = 'dark' | 'light'

const CHAVE_STORAGE = 'dashboard.tema'

function lerTemaSalvo(): TemaPainel {
  const salvo = localStorage.getItem(CHAVE_STORAGE)
  return salvo === 'light' ? 'light' : 'dark'
}

/**
 * Tema do painel (dark = visual original azul-marinho, mantido como default;
 * light = fundo #c7c7c7 introduzido agora), persistido em localStorage e
 * aplicado via atributo `data-theme` no elemento raiz — as variáveis CSS de
 * tema (src/index.css) fazem a troca de cores com transição suave.
 */
export function useTemaPainel(): [TemaPainel, () => void] {
  const [tema, setTema] = useState<TemaPainel>(lerTemaSalvo)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem(CHAVE_STORAGE, tema)
  }, [tema])

  const alternar = useCallback(() => {
    setTema((atual) => (atual === 'dark' ? 'light' : 'dark'))
  }, [])

  return [tema, alternar]
}
