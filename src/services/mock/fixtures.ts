import type { Colaborador, Departamento, Projeto, StatusTarefa, Tarefa } from '../../types/domain'

/**
 * Dados fictícios para desenvolver o front antes da integração real com o
 * Bitrix24 (ver acessoService/dashboardService para o plano de trocar isso por
 * chamadas diretas via BX24.callMethod). Os ids usados aqui são os mesmos ids
 * que existiriam no Bitrix (departamento, usuário, grupo, tarefa).
 */

function diasA(offsetDias: number): string {
  const data = new Date()
  data.setDate(data.getDate() + offsetDias)
  return data.toISOString()
}

export const departamentosFixture: Departamento[] = [
  { id: 1, nome: 'Jurídico' },
  { id: 2, nome: 'Jurídico - Cível' },
  { id: 3, nome: 'Financeiro' },
  { id: 4, nome: 'TI' },
]

export const colaboradoresFixture: Colaborador[] = [
  { id: 101, nome: 'Ana Souza', ativo: true },
  { id: 102, nome: 'Bruno Lima', ativo: true },
  { id: 103, nome: 'Carla Mendes', ativo: true },
  { id: 104, nome: 'Diego Alves', ativo: true },
  { id: 105, nome: 'Elaine Costa', ativo: true },
  { id: 106, nome: 'Fábio Rocha', ativo: false },
  { id: 107, nome: 'Gabriel Torres', ativo: true },
  { id: 108, nome: 'Helena Prado', ativo: true },
  { id: 109, nome: 'Igor Nunes', ativo: true },
  { id: 110, nome: 'Julia Franco', ativo: true },
]

const colaboradoresDepartamentosFixture: Array<{ colaboradorId: number; departamentoId: number }> =
  [
    { colaboradorId: 101, departamentoId: 2 },
    { colaboradorId: 102, departamentoId: 1 },
    { colaboradorId: 103, departamentoId: 3 },
    { colaboradorId: 104, departamentoId: 4 },
    { colaboradorId: 105, departamentoId: 3 },
    { colaboradorId: 106, departamentoId: 4 },
    { colaboradorId: 107, departamentoId: 1 },
    { colaboradorId: 108, departamentoId: 3 },
    { colaboradorId: 109, departamentoId: 4 },
    { colaboradorId: 110, departamentoId: 2 },
  ]

export const projetosFixture: Projeto[] = [
  { id: 86, nome: 'Processos Cíveis' },
  { id: 92, nome: 'Contas a Pagar' },
  { id: 94, nome: 'Infraestrutura' },
]

const projetosColaboradoresFixture: Array<{ projetoId: number; colaboradorId: number }> = [
  { projetoId: 86, colaboradorId: 101 },
  { projetoId: 86, colaboradorId: 102 },
  { projetoId: 86, colaboradorId: 107 },
  { projetoId: 86, colaboradorId: 110 },
  { projetoId: 92, colaboradorId: 103 },
  { projetoId: 92, colaboradorId: 105 },
  { projetoId: 92, colaboradorId: 108 },
  { projetoId: 94, colaboradorId: 104 },
  { projetoId: 94, colaboradorId: 106 },
  { projetoId: 94, colaboradorId: 109 },
]

function departamentosDoColaborador(colaboradorId: number): string[] {
  return colaboradoresDepartamentosFixture
    .filter((v) => v.colaboradorId === colaboradorId)
    .map((v) => departamentosFixture.find((d) => d.id === v.departamentoId)!.nome)
}

export function projetosPermitidosDoColaborador(colaboradorId: number): Projeto[] {
  return projetosColaboradoresFixture
    .filter((v) => v.colaboradorId === colaboradorId)
    .map((v) => projetosFixture.find((p) => p.id === v.projetoId)!)
}

interface TarefaSeed {
  id: number
  titulo: string
  prazoFinalOffsetDias: number
  status: StatusTarefa
  finalizadoOffsetDias: number | null
  fechadoPorId: number | null
  projetoId: number | null
}

/**
 * Gera um volume maior de tarefas fictícias por projeto, cobrindo os 5 status
 * reais, prazos passados/futuros e colaboradores variados — o suficiente para
 * exercitar paginação (30+ registros), filtros e métricas com dados visíveis.
 */
function gerarTarefasDoProjeto(
  projetoId: number,
  tituloBase: string[],
  colaboradorIds: number[],
  idInicial: number,
  quantidade: number,
): TarefaSeed[] {
  // Ciclo fixo de status para ter uma distribuição previsível e variada
  // (concluído, em andamento, aguardando execução, aguardando controle, adiado).
  const cicloStatus: StatusTarefa[] = [5, 3, 2, 5, 4, 3, 2, 5, 6, 3]

  return Array.from({ length: quantidade }, (_, i) => {
    const status = cicloStatus[i % cicloStatus.length]
    // Espalha os prazos de -25 a +34 dias em relação a hoje, em passos de 3.
    const prazoFinalOffsetDias = -25 + i * 3
    const concluida = status === 5
    const colaboradorId = colaboradorIds[i % colaboradorIds.length]

    return {
      id: idInicial + i,
      titulo: `${tituloBase[i % tituloBase.length]} nº ${1000 + idInicial + i}`,
      prazoFinalOffsetDias,
      status,
      finalizadoOffsetDias: concluida ? prazoFinalOffsetDias - 1 : null,
      fechadoPorId: concluida ? colaboradorId : null,
      projetoId,
    }
  })
}

const tarefasSeed: TarefaSeed[] = [
  ...gerarTarefasDoProjeto(
    86,
    [
      'Protocolar petição inicial',
      'Elaborar contestação',
      'Revisar recurso',
      'Audiência de conciliação',
      'Análise de provas periciais',
      'Elaborar réplica',
      'Cumprimento de sentença',
      'Protocolar embargos de declaração',
      'Acompanhar perícia técnica',
      'Elaborar contrarrazões',
    ],
    [101, 102, 107, 110],
    9001,
    32,
  ),
  ...gerarTarefasDoProjeto(
    92,
    [
      'Pagamento fornecedor',
      'Conciliação bancária mensal',
      'Emitir boletos',
      'Fechamento contábil',
      'Revisão de contrato de fornecimento',
      'Análise de despesas do mês',
      'Pagamento de tributos',
      'Reembolso de despesas',
      'Auditoria de notas fiscais',
      'Renegociação de dívida',
    ],
    [103, 105, 108],
    9101,
    28,
  ),
  ...gerarTarefasDoProjeto(
    94,
    [
      'Atualizar servidor de aplicação',
      'Backup semanal',
      'Migração de banco de dados',
      'Revisão de política de acesso',
      'Renovação de certificado SSL',
      'Monitoramento de infraestrutura',
      'Atualização de firewall',
      'Troca de storage',
      'Auditoria de segurança',
      'Configuração de novo servidor',
    ],
    [104, 106, 109],
    9201,
    24,
  ),
  // sem projeto vinculado (caso de borda)
  {
    id: 9301,
    titulo: 'Tarefa órfã sem projeto',
    prazoFinalOffsetDias: 5,
    status: 2,
    finalizadoOffsetDias: null,
    fechadoPorId: null,
    projetoId: null,
  },
]

export const tarefasFixture: Tarefa[] = tarefasSeed.map((seed) => {
  const colaborador = seed.fechadoPorId
    ? (colaboradoresFixture.find((c) => c.id === seed.fechadoPorId) ?? null)
    : null
  const projeto = seed.projetoId
    ? (projetosFixture.find((p) => p.id === seed.projetoId) ?? null)
    : null

  return {
    id: seed.id,
    titulo: seed.titulo,
    prazoFinal: diasA(seed.prazoFinalOffsetDias),
    status: seed.status,
    finalizadoEm: seed.finalizadoOffsetDias === null ? null : diasA(seed.finalizadoOffsetDias),
    projetoId: projeto?.id ?? null,
    projetoNome: projeto?.nome ?? null,
    fechadoPorId: colaborador?.id ?? null,
    fechadoPorNome: colaborador?.nome ?? null,
    fechadoPorDepartamentos: colaborador ? departamentosDoColaborador(colaborador.id) : [],
  }
})
