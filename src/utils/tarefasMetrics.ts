import {
  EQUIPES_ATENDIMENTO,
  STATUS_CONCLUIDO,
  type ContagemSituacao,
  type EquipeAtendimento,
  type FiltrosDashboard,
  type InteligenciaDados,
  type InteligenciaEquipe,
  type MetricasPorSetor,
  type MetricasTarefas,
  type PacoteAtendimento,
  type Tarefa,
  type VolumeFechadoPor,
  type VolumeResponsavel,
} from '../types/domain'

export function tarefaEstaAtrasada(tarefa: Tarefa, agora: Date): boolean {
  return tarefa.status < STATUS_CONCLUIDO && new Date(tarefa.prazoFinal) < agora
}

export function tarefaEstaConcluida(tarefa: Tarefa): boolean {
  return tarefa.status === STATUS_CONCLUIDO
}

export function tarefaNoPrazo(tarefa: Tarefa, agora: Date): boolean {
  return tarefa.status < STATUS_CONCLUIDO && new Date(tarefa.prazoFinal) >= agora
}

export function calcularMetricas(tarefas: Tarefa[]): MetricasTarefas {
  const total = tarefas.length
  const concluidas = tarefas.filter(tarefaEstaConcluida).length
  const agora = new Date()
  const atrasadas = tarefas.filter((t) => tarefaEstaAtrasada(t, agora)).length
  const eficiencia = total === 0 ? 0 : (concluidas / total) * 100
  return { total, concluidas, atrasadas, eficiencia }
}

export function aplicarFiltros(tarefas: Tarefa[], filtros: FiltrosDashboard): Tarefa[] {
  const agora = new Date()
  // Ambos os limites em horário local: "YYYY-MM-DD" puro seria interpretado como
  // meia-noite UTC, deslocando o início do período em relação ao fim.
  const dataInicioLimite = filtros.dataInicio ? new Date(`${filtros.dataInicio}T00:00:00`) : null
  // dataFim é inclusiva até o fim do dia informado.
  const dataFimLimite = filtros.dataFim ? new Date(`${filtros.dataFim}T23:59:59.999`) : null

  return tarefas.filter((tarefa) => {
    const prazo = new Date(tarefa.prazoFinal)

    if (dataInicioLimite && prazo < dataInicioLimite) return false
    if (dataFimLimite && prazo > dataFimLimite) return false
    if (filtros.status === 'concluido' && !tarefaEstaConcluida(tarefa)) return false
    if (filtros.status === 'atrasado' && !tarefaEstaAtrasada(tarefa, agora)) return false
    if (filtros.status === 'no_prazo' && !tarefaNoPrazo(tarefa, agora)) return false
    if (filtros.setor && !tarefa.fechadoPorDepartamentos.includes(filtros.setor)) return false
    if (filtros.projetoId !== null && tarefa.projetoId !== filtros.projetoId) return false
    if (filtros.fechadoPorId !== null && tarefa.fechadoPorId !== filtros.fechadoPorId) return false
    if (filtros.responsavelId !== null && tarefa.responsavelId !== filtros.responsavelId) return false
    if (filtros.prioridade !== null && tarefa.prioridade !== filtros.prioridade) return false

    return true
  })
}

// Ordem de exibição das equipes: as 4 conhecidas primeiro, "indefinido" por último.
const ORDEM_EQUIPES: EquipeAtendimento[] = [...EQUIPES_ATENDIMENTO, 'indefinido']

/**
 * Empacota os cards por responsável pelo atendimento. Cada pacote reúne todos os
 * cards do mesmo responsável, com a equipe dele. Os pacotes vêm ordenados por
 * equipe (ordem fixa) e, dentro da equipe, do maior para o menor volume de cards.
 */
export function empacotarPorAtendimento(tarefas: Tarefa[]): PacoteAtendimento[] {
  // Chave por responsável; cards sem responsável definido caem em um pacote único.
  const pacotesPorChave = new Map<string, PacoteAtendimento>()

  tarefas.forEach((tarefa) => {
    const chave =
      tarefa.responsavelAtendimentoId === null
        ? 'sem-responsavel'
        : String(tarefa.responsavelAtendimentoId)

    let pacote = pacotesPorChave.get(chave)
    if (!pacote) {
      pacote = {
        responsavelAtendimentoId: tarefa.responsavelAtendimentoId,
        responsavelAtendimentoNome:
          tarefa.responsavelAtendimentoNome ?? 'Sem responsável pelo atendimento',
        equipe: tarefa.equipeAtendimento,
        cards: [],
      }
      pacotesPorChave.set(chave, pacote)
    }
    pacote.cards.push(tarefa)
  })

  return Array.from(pacotesPorChave.values()).sort((a, b) => {
    const ordemA = ORDEM_EQUIPES.indexOf(a.equipe)
    const ordemB = ORDEM_EQUIPES.indexOf(b.equipe)
    if (ordemA !== ordemB) return ordemA - ordemB
    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length
    return a.responsavelAtendimentoNome.localeCompare(b.responsavelAtendimentoNome)
  })
}

function contagemVazia(): ContagemSituacao {
  return { total: 0, noPrazo: 0, atrasadas: 0, concluidas: 0, adiadas: 0 }
}

/** Classifica um card em uma única situação de prazo (excludentes). */
function acumularSituacao(acc: ContagemSituacao, tarefa: Tarefa, agora: Date): void {
  acc.total += 1
  if (tarefaEstaConcluida(tarefa)) acc.concluidas += 1
  else if (tarefa.status === 6) acc.adiadas += 1
  else if (tarefaEstaAtrasada(tarefa, agora)) acc.atrasadas += 1
  else acc.noPrazo += 1
}

const TOP_RESPONSAVEIS = 10
const TOP_FECHADO_POR = 10

/**
 * Consolida os pacotes no modelo de dados de inteligência que alimenta os
 * gráficos: contagem por situação de cada equipe (na ordem fixa das equipes), o
 * ranking dos responsáveis por volume de cards e o ranking de "fechado por".
 * Recalculado a cada filtro.
 */
export function calcularInteligencia(pacotes: PacoteAtendimento[]): InteligenciaDados {
  const agora = new Date()

  const contagemPorEquipe = new Map<EquipeAtendimento, ContagemSituacao>()
  const responsaveisPorEquipe = new Map<EquipeAtendimento, number>()
  ORDEM_EQUIPES.forEach((equipe) => {
    contagemPorEquipe.set(equipe, contagemVazia())
    responsaveisPorEquipe.set(equipe, 0)
  })

  const volumes: VolumeResponsavel[] = []
  // Agregação de "fechado por" por pessoa (chave string; null = sem valor).
  const fechadoPorAgg = new Map<string, VolumeFechadoPor>()
  let totalCards = 0

  pacotes.forEach((pacote) => {
    const contagem = contagemPorEquipe.get(pacote.equipe)!
    pacote.cards.forEach((card) => {
      acumularSituacao(contagem, card, agora)
      acumularFechadoPor(fechadoPorAgg, card)
    })
    responsaveisPorEquipe.set(pacote.equipe, responsaveisPorEquipe.get(pacote.equipe)! + 1)
    totalCards += pacote.cards.length

    volumes.push({
      responsavelAtendimentoId: pacote.responsavelAtendimentoId,
      nome: pacote.responsavelAtendimentoNome,
      equipe: pacote.equipe,
      total: pacote.cards.length,
    })
  })

  const porEquipe: InteligenciaEquipe[] = ORDEM_EQUIPES.map((equipe) => ({
    equipe,
    contagem: contagemPorEquipe.get(equipe)!,
    responsaveis: responsaveisPorEquipe.get(equipe)!,
  }))

  const topResponsaveis = volumes
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, TOP_RESPONSAVEIS)

  const topFechadoPor = Array.from(fechadoPorAgg.values())
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, TOP_FECHADO_POR)

  return { porEquipe, topResponsaveis, topFechadoPor, totalCards }
}

/** Acumula o "fechado por" (campo customizado) de um card no agregado. */
function acumularFechadoPor(agg: Map<string, VolumeFechadoPor>, card: Tarefa): void {
  const chave = card.fechadoPorId === null ? 'sem-fechado-por' : String(card.fechadoPorId)
  const existente = agg.get(chave)
  if (existente) {
    existente.total += 1
    return
  }
  agg.set(chave, {
    fechadoPorId: card.fechadoPorId,
    nome: card.fechadoPorNome ?? 'Não informado',
    total: 1,
  })
}

/** Agrupa as tarefas por setor (fechadoPorDepartamentos) e calcula as métricas de cada grupo. */
export function calcularMetricasPorSetor(tarefas: Tarefa[]): MetricasPorSetor[] {
  const tarefasPorSetor = new Map<string, Tarefa[]>()

  tarefas.forEach((tarefa) => {
    tarefa.fechadoPorDepartamentos.forEach((setor) => {
      const lista = tarefasPorSetor.get(setor) ?? []
      lista.push(tarefa)
      tarefasPorSetor.set(setor, lista)
    })
  })

  return Array.from(tarefasPorSetor.entries())
    .map(([setor, tarefasDoSetor]) => ({ setor, metricas: calcularMetricas(tarefasDoSetor) }))
    .sort((a, b) => a.setor.localeCompare(b.setor))
}
