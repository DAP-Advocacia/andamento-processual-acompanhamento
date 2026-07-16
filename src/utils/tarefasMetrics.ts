import {
  STATUS_CONCLUIDO,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasTarefas,
  type Tarefa,
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

/** Restringe às tarefas de projetos aos quais o colaborador logado tem acesso. */
export function restringirAProjetosPermitidos(
  tarefas: Tarefa[],
  projetosPermitidosIds: number[],
): Tarefa[] {
  return tarefas.filter((t) => t.projetoId !== null && projetosPermitidosIds.includes(t.projetoId))
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

    return true
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
