import { Center, Loader, Stack, Title } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { EstadoVazio } from '../components/EstadoVazio'
import { Plasma } from '../components/Plasma'
import { FiltrosPainel } from '../components/dashboard/FiltrosPainel'
import { MetricasCards } from '../components/dashboard/MetricasCards'
import { TarefasTable } from '../components/dashboard/TarefasTable'
import { useSessaoUsuario } from '../hooks/useSessaoUsuario'
import {
  ITENS_POR_PAGINA,
  obterMetricasFiltradas,
  obterMetricasPorSetorFiltradas,
  obterTarefasFiltradas,
  sincronizarComBitrix,
  type ResultadoTarefasPaginado,
} from '../services/dashboardService'
import {
  FILTROS_VAZIOS,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasTarefas,
} from '../types/domain'
import classes from './DashboardPage.module.css'

export function DashboardPage() {
  const { estado, colaborador, projetosPermitidos, mensagemErro } = useSessaoUsuario()

  const [filtros, setFiltros] = useState<FiltrosDashboard>(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(1)
  const [metricas, setMetricas] = useState<MetricasTarefas | null>(null)
  const [metricasPorSetor, setMetricasPorSetor] = useState<MetricasPorSetor[]>([])
  const [resultadoTarefas, setResultadoTarefas] = useState<ResultadoTarefasPaginado | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    if (estado !== 'ok') return
    let cancelado = false
    Promise.all([
      obterMetricasFiltradas(filtros, projetosPermitidos),
      obterMetricasPorSetorFiltradas(filtros, projetosPermitidos),
      obterTarefasFiltradas(filtros, projetosPermitidos, pagina),
    ]).then(([novasMetricas, novasMetricasPorSetor, resultado]) => {
      if (cancelado) return
      setMetricas(novasMetricas)
      setMetricasPorSetor(novasMetricasPorSetor)
      setResultadoTarefas(resultado)
    })
    return () => {
      cancelado = true
    }
  }, [estado, filtros, pagina, projetosPermitidos])

  function aoMudarFiltros(novosFiltros: FiltrosDashboard) {
    setFiltros(novosFiltros)
    setPagina(1)
  }

  async function aoSincronizar() {
    if (sincronizando) return
    setSincronizando(true)
    try {
      await sincronizarComBitrix(projetosPermitidos)
      const [novasMetricas, novasMetricasPorSetor, resultado] = await Promise.all([
        obterMetricasFiltradas(filtros, projetosPermitidos),
        obterMetricasPorSetorFiltradas(filtros, projetosPermitidos),
        obterTarefasFiltradas(filtros, projetosPermitidos, pagina),
      ])
      setMetricas(novasMetricas)
      setMetricasPorSetor(novasMetricasPorSetor)
      setResultadoTarefas(resultado)
    } finally {
      setSincronizando(false)
    }
  }

  let conteudo: ReactNode

  if (estado === 'carregando') {
    conteudo = (
      <Center mih="60vh">
        <Loader />
      </Center>
    )
  } else if (estado === 'sem_acesso') {
    conteudo = (
      <div className={classes.conteudo}>
        <EstadoVazio
          titulo="Nenhum projeto vinculado"
          descricao="Seu usuário não foi encontrado ou não está vinculado a nenhum projeto monitorado. Fale com o administrador do sistema."
        />
      </div>
    )
  } else if (estado === 'erro') {
    conteudo = (
      <div className={classes.conteudo}>
        <EstadoVazio
          titulo="Não foi possível identificar o usuário"
          descricao={mensagemErro ?? 'Ocorreu um erro inesperado.'}
        />
      </div>
    )
  } else {
    conteudo = (
      <div className={classes.conteudo}>
        <Stack gap="xl">
          {colaborador && <Title order={2}>Olá, {colaborador.nome}</Title>}

          <FiltrosPainel
            filtros={filtros}
            onChange={aoMudarFiltros}
            projetosPermitidos={projetosPermitidos}
          />

          <MetricasCards
            titulo="Métricas"
            metricas={metricas}
            metricasPorSetor={metricasPorSetor}
            aoSincronizar={aoSincronizar}
            sincronizando={sincronizando}
          />

          {resultadoTarefas && (
            <TarefasTable
              tarefas={resultadoTarefas.tarefas}
              totalRegistros={resultadoTarefas.totalRegistros}
              pagina={pagina}
              itensPorPagina={ITENS_POR_PAGINA}
              onMudarPagina={setPagina}
            />
          )}
        </Stack>
      </div>
    )
  }

  return (
    <div className={classes.page}>
      <div className={classes.plasmaFundo}>
        <Plasma color="#1a3a6b" speed={0.6} scale={1.2} opacity={0.5} mouseInteractive={false} />
      </div>
      {conteudo}
    </div>
  )
}
