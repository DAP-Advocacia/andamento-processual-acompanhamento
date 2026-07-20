import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Extraído das cores computadas de dapadvocacia.com.br (dourado/bronze da marca).
const dourado: MantineColorsTuple = [
  '#f9f6f0',
  '#f1e8da',
  '#e3d1b5',
  '#d3b688',
  '#c59f63',
  '#b38842',
  '#8d6b34',
  '#775a2c',
  '#614924',
  '#433319',
]

const fontStack =
  'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

export const theme = createTheme({
  primaryColor: 'dourado',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily: fontStack,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: { fontFamily: fontStack },
  colors: {
    dourado,
  },
  // Superfícies (Paper/Card e componentes derivados) usam a variável de tema
  // --superficie, definida por color scheme em index.css, para seguir a
  // alternância normal/invertido junto com o resto da UI.
  components: {
    Paper: {
      styles: {
        root: {
          backgroundColor: 'var(--superficie)',
          color: 'var(--mantine-color-text)',
        },
      },
    },
  },
})

/** Cor de destaque para o item ativo de paginação/navegação (chevrons de métricas, Pagination). */
export const CorNavegacaoAtiva = 'goldenrod'
