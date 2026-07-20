// Códigos de status reais do Bitrix24 (REAL_STATUS em tasks.task.list). Não existe
// um "1 = não encontrado" na API — isso só fazia sentido no sistema antigo, que
// mantinha uma cópia local que podia ficar desatualizada. Aqui os dados vêm sempre
// ao vivo do Bitrix, então uma tarefa que não existe mais simplesmente não aparece.
export type StatusTarefa = 2 | 3 | 4 | 5 | 6

export const STATUS_LABELS: Record<StatusTarefa, string> = {
  2: 'Aguardando a execução',
  3: 'Em andamento',
  4: 'Aguardando controle',
  5: 'Concluído',
  6: 'Adiado',
}

export const STATUS_CONCLUIDO: StatusTarefa = 5

// PRIORITY em tasks.task.list vem como string numérica: '0' baixa, '1' normal, '2' alta.
export type PrioridadeTarefa = '0' | '1' | '2'

export const PRIORIDADE_LABELS: Record<PrioridadeTarefa, string> = {
  '0': 'Baixa',
  '1': 'Normal',
  '2': 'Alta',
}

/** Não há mais banco local — o id de cada entidade é o próprio id no Bitrix24. */
export interface Departamento {
  id: number
  nome: string
}

export interface Colaborador {
  id: number
  nome: string
  ativo: boolean
}

export interface Projeto {
  id: number
  nome: string
}

export interface Tarefa {
  id: number
  titulo: string
  prazoFinal: string
  status: StatusTarefa
  finalizadoEm: string | null
  projetoId: number | null
  projetoNome: string | null
  fechadoPorId: number | null
  fechadoPorNome: string | null
  /** Um colaborador pode pertencer a mais de um departamento (N:N). */
  fechadoPorDepartamentos: string[]
  /** Responsável atual pela tarefa (RESPONSIBLE_ID), distinto de quem a fechou. */
  responsavelId: number | null
  responsavelNome: string | null
  prioridade: PrioridadeTarefa
  /**
   * Responsável pelo atendimento do cliente — vem do campo customizado
   * UF_CRM_20_1780943729 do card, distinto do responsável nativo da tarefa.
   * É o critério de agrupamento da tela de inteligência.
   */
  responsavelAtendimentoId: number | null
  responsavelAtendimentoNome: string | null
  /** Equipe (departamento) do responsável pelo atendimento, ou "indefinido". */
  equipeAtendimento: EquipeAtendimento
}

/**
 * Equipes de atendimento reconhecidas — cada uma é o departamento (pelo ID no
 * Bitrix24) da respectiva superiora. Um responsável cujo departamento não bate
 * com nenhum ID cai em "indefinido".
 */
export const EQUIPES_ATENDIMENTO = [
  'Cinthia Filgueiras',
  'Simone Freitas',
  'Quézia Karen',
  'Lorena Pontes',
] as const

export type EquipeAtendimento = (typeof EQUIPES_ATENDIMENTO)[number] | 'indefinido'

/** ID do departamento (Bitrix24) de cada equipe de atendimento. */
export const DEPARTAMENTO_ID_POR_EQUIPE: Record<(typeof EQUIPES_ATENDIMENTO)[number], number> = {
  'Cinthia Filgueiras': 782,
  'Simone Freitas': 784,
  'Quézia Karen': 864,
  'Lorena Pontes': 862,
}

/**
 * "Pacote" da tela de inteligência: todos os cards atribuídos a um mesmo
 * responsável pelo atendimento, já classificados na equipe dele.
 */
export interface PacoteAtendimento {
  responsavelAtendimentoId: number | null
  responsavelAtendimentoNome: string
  equipe: EquipeAtendimento
  cards: Tarefa[]
}

/** Contagem de cards por situação de prazo, base dos gráficos empilhados. */
export interface ContagemSituacao {
  total: number
  noPrazo: number
  atrasadas: number
  concluidas: number
  adiadas: number
}

/** Métricas de uma equipe para os gráficos de inteligência. */
export interface InteligenciaEquipe {
  equipe: EquipeAtendimento
  contagem: ContagemSituacao
  responsaveis: number
}

/** Volume de cards de um responsável (para o ranking por responsável). */
export interface VolumeResponsavel {
  responsavelAtendimentoId: number | null
  nome: string
  equipe: EquipeAtendimento
  total: number
}

/** Volume de cards por "fechado por" (campo customizado), para o gráfico próprio. */
export interface VolumeFechadoPor {
  fechadoPorId: number | null
  nome: string
  total: number
}

/**
 * Modelo de dados consolidado que alimenta os gráficos da tela de inteligência.
 * Derivado dos pacotes já filtrados — recalculado a cada mudança de filtro.
 */
export interface InteligenciaDados {
  porEquipe: InteligenciaEquipe[]
  topResponsaveis: VolumeResponsavel[]
  topFechadoPor: VolumeFechadoPor[]
  totalCards: number
}

/**
 * Resultado da validação dos nomes informados contra os departamentos do Bitrix
 * — o que a api_url busca para "trackear a modelagem de dados". Cada equipe pode
 * ou não existir como departamento na fonte real.
 */
export interface EquipeResolvida {
  nome: EquipeAtendimento
  departamentoId: number | null
  encontrada: boolean
}

export interface SessaoUsuario {
  colaborador: Colaborador
  projetosPermitidos: Projeto[]
}

export type FiltroStatus = 'todos' | 'concluido' | 'atrasado' | 'no_prazo'

/**
 * dataInicio/dataFim usam o mesmo formato de string (YYYY-MM-DD) que o
 * DatePickerInput do Mantine v9 retorna em `onChange`, evitando conversões.
 */
export interface FiltrosDashboard {
  dataInicio: string | null
  dataFim: string | null
  status: FiltroStatus
  setor: string | null
  projetoId: number | null
  fechadoPorId: number | null
  responsavelId: number | null
  prioridade: PrioridadeTarefa | null
}

/** Janela padrão de busca: evita baixar o histórico inteiro (grupos monitorados somam centenas de milhares de tarefas). */
export const JANELA_PADRAO_DIAS = 90

function formatarDataIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

/** Filtros vazios com a janela padrão de 90 dias (até hoje) já aplicada. */
export function filtrosVazios(agora: Date): FiltrosDashboard {
  const dataInicio = new Date(agora)
  dataInicio.setDate(dataInicio.getDate() - JANELA_PADRAO_DIAS)
  return {
    dataInicio: formatarDataIso(dataInicio),
    dataFim: formatarDataIso(agora),
    status: 'todos',
    setor: null,
    projetoId: null,
    fechadoPorId: null,
    responsavelId: null,
    prioridade: null,
  }
}

export interface MetricasTarefas {
  total: number
  concluidas: number
  atrasadas: number
  eficiencia: number
  vencemEmBreve: number
  aguardandoRevisao: number
  emAndamento: number
  taxaAtraso: number
}

export interface MetricasPorSetor {
  setor: string
  metricas: MetricasTarefas
}
