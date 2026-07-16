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
}

export const FILTROS_VAZIOS: FiltrosDashboard = {
  dataInicio: null,
  dataFim: null,
  status: 'todos',
  setor: null,
  projetoId: null,
  fechadoPorId: null,
}

export interface MetricasTarefas {
  total: number
  concluidas: number
  atrasadas: number
  eficiencia: number
}

export interface MetricasPorSetor {
  setor: string
  metricas: MetricasTarefas
}
