import { Center, Loader, Stack, Title } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { EstadoVazio } from '../components/EstadoVazio'
import { ThemeToggle } from '../components/ThemeToggle'
import { DebugBitrixPanel } from '../components/dashboard/DebugBitrixPanel'
import { FiltrosPainel } from '../components/dashboard/FiltrosPainel'
import { GraficosInteligencia } from '../components/dashboard/GraficosInteligencia'
import { MetricasCards } from '../components/dashboard/MetricasCards'
import { useSessaoUsuario } from '../hooks/useSessaoUsuario'
import {
  obterMetricasFiltradas,
  obterMetricasPorSetorFiltradas,
  obterPacotesAtendimento,
  sincronizarComBitrix,
} from '../services/dashboardService'
import {
  filtrosVazios,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasTarefas,
  type PacoteAtendimento,
} from '../types/domain'
import classes from './DashboardPage.module.css'

export function DashboardPage() {
  const { estado, colaborador, projetosPermitidos, mensagemErro } = useSessaoUsuario()

  const [filtros, setFiltros] = useState<FiltrosDashboard>(() => filtrosVazios(new Date()))
  const [metricas, setMetricas] = useState<MetricasTarefas | null>(null)
  const [metricasPorSetor, setMetricasPorSetor] = useState<MetricasPorSetor[]>([])
  const [pacotes, setPacotes] = useState<PacoteAtendimento[] | null>(null)
  const [erroDados, setErroDados] = useState<string | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    if (estado !== 'ok') return
    let cancelado = false
    Promise.all([
      obterMetricasFiltradas(filtros, projetosPermitidos),
      obterMetricasPorSetorFiltradas(filtros, projetosPermitidos),
      obterPacotesAtendimento(filtros, projetosPermitidos),
    ])
      .then(([novasMetricas, novasMetricasPorSetor, novosPacotes]) => {
        if (cancelado) return
        setErroDados(null)
        setMetricas(novasMetricas)
        setMetricasPorSetor(novasMetricasPorSetor)
        setPacotes(novosPacotes)
      })
      .catch((erro) => {
        if (cancelado) return
        setErroDados(erro instanceof Error ? erro.message : 'Erro ao carregar dados do Bitrix.')
      })
    return () => {
      cancelado = true
    }
  }, [estado, filtros, projetosPermitidos])

  function aoMudarFiltros(novosFiltros: FiltrosDashboard) {
    setFiltros(novosFiltros)
  }

  async function aoSincronizar() {
    if (sincronizando) return
    setSincronizando(true)
    try {
      await sincronizarComBitrix(projetosPermitidos)
      const [novasMetricas, novasMetricasPorSetor, novosPacotes] = await Promise.all([
        obterMetricasFiltradas(filtros, projetosPermitidos),
        obterMetricasPorSetorFiltradas(filtros, projetosPermitidos),
        obterPacotesAtendimento(filtros, projetosPermitidos),
      ])
      setErroDados(null)
      setMetricas(novasMetricas)
      setMetricasPorSetor(novasMetricasPorSetor)
      setPacotes(novosPacotes)
    } catch (erro) {
      setErroDados(erro instanceof Error ? erro.message : 'Erro ao sincronizar com o Bitrix.')
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

          {erroDados ? (
            <EstadoVazio titulo="Não foi possível carregar os dados" descricao={erroDados} />
          ) : (
            <>
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

              <div>
                <Title order={3} mb="md">
                  Inteligência — visão por equipe
                </Title>
                <Stack gap="md">
                  {pacotes && <GraficosInteligencia pacotes={pacotes} />}
                </Stack>
              </div>
            </>
          )}
        </Stack>
      </div>
    )
  }

  return (
    <div className={classes.page}>
      <ThemeToggle />
      {conteudo}
      <DebugBitrixPanel />
    </div>
  )
}
