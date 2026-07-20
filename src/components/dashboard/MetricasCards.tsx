import { Group, Skeleton, Text } from '@mantine/core'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { MetricasPorSetor, MetricasTarefas } from '../../types/domain'
import classes from './MetricasCards.module.css'

interface MetricasCardsProps {
  titulo: string
  metricas: MetricasTarefas | null
  metricasPorSetor: MetricasPorSetor[]
  aoSincronizar: () => void
  sincronizando: boolean
}

function montarStats(metricas: MetricasTarefas) {
  return [
    {
      label: 'Total',
      valor: String(metricas.total),
      descricao: 'Tarefas com prazo nos projetos monitorados',
    },
    {
      label: 'Concluídas',
      valor: String(metricas.concluidas),
      descricao: 'Tarefas com status "Concluído"',
    },
    {
      label: 'Atrasadas',
      valor: String(metricas.atrasadas),
      descricao: 'Não concluídas com prazo final já vencido',
    },
    {
      label: 'Eficiência',
      valor: `${metricas.eficiencia.toFixed(1)}%`,
      descricao: 'Concluídas em relação ao total',
    },
  ]
}

export function MetricasCards({
  titulo,
  metricas,
  metricasPorSetor,
  aoSincronizar,
  sincronizando,
}: MetricasCardsProps) {
  const [grupoAtivo, setGrupoAtivo] = useState(0)
  const [direcao, setDirecao] = useState(1)

  const totalGrupos = 1 + metricasPorSetor.length
  const grupo = Math.min(grupoAtivo, totalGrupos - 1)

  const tituloGrupo = grupo === 0 ? titulo : `Métricas — ${metricasPorSetor[grupo - 1].setor}`
  const metricasDoGrupo = grupo === 0 ? metricas : metricasPorSetor[grupo - 1].metricas
  const stats = metricasDoGrupo ? montarStats(metricasDoGrupo) : []

  function irParaAnterior() {
    setDirecao(-1)
    setGrupoAtivo((atual) => (atual - 1 + totalGrupos) % totalGrupos)
  }

  function irParaProximo() {
    setDirecao(1)
    setGrupoAtivo((atual) => (atual + 1) % totalGrupos)
  }

  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Text fw={600} c="white">
          {tituloGrupo}
        </Text>

        <button
          type="button"
          className={classes.syncControl}
          aria-label="Sincronizar dados do Bitrix"
          disabled={sincronizando}
          onClick={aoSincronizar}
        >
          <svg
            className={sincronizando ? classes.syncGirando : undefined}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </Group>

      <div className={classes.carrossel}>
        {totalGrupos > 1 && (
          <>
            <button
              type="button"
              className={`${classes.navControl} ${classes.navAnterior}`}
              aria-label="Grupo de métricas anterior"
              onClick={irParaAnterior}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${classes.navControl} ${classes.navProximo}`}
              aria-label="Próximo grupo de métricas"
              onClick={irParaProximo}
            >
              ›
            </button>
          </>
        )}

        {metricasDoGrupo === null ? (
          <Skeleton height={150} radius="md" />
        ) : (
          <div className={classes.root}>
            <AnimatePresence mode="wait" initial={false} custom={direcao}>
              <motion.div
                key={grupo}
                custom={direcao}
                initial={{ x: direcao > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direcao > 0 ? -60 : 60, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', width: '100%' }}
              >
                {stats.map((stat) => (
                  <div key={stat.label} className={classes.stat}>
                    <Text className={classes.count}>{stat.valor}</Text>
                    <Text className={classes.title}>{stat.label}</Text>
                    <Text className={classes.description}>{stat.descricao}</Text>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
