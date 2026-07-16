import { Badge, Group, Pagination, Text } from '@mantine/core'
import { motion, useInView } from 'motion/react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CorNavegacaoAtiva } from '../../theme'
import { STATUS_LABELS, type Tarefa } from '../../types/domain'
import { EstadoVazio } from '../EstadoVazio'
import { TarefaDetalheModal } from './TarefaDetalheModal'
import { corDoStatus, formatarData } from './tarefaApresentacao'
import classes from './TarefasTable.module.css'

interface TarefasTableProps {
  tarefas: Tarefa[]
  totalRegistros: number
  pagina: number
  itensPorPagina: number
  onMudarPagina: (pagina: number) => void
}

interface AnimatedItemProps {
  children: ReactNode
  delay?: number
  index: number
}

/** Item da lista com entrada animada ao rolar: desliza horizontalmente (adaptado do AnimatedList / reactbits). */
function AnimatedItem({ children, delay = 0, index }: AnimatedItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5, once: false })
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ x: -40, opacity: 0 }}
      animate={inView ? { x: 0, opacity: 1 } : { x: -40, opacity: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{ marginBottom: 13, cursor: 'pointer' }}
    >
      {children}
    </motion.div>
  )
}

export function TarefasTable({
  tarefas,
  totalRegistros,
  pagina,
  itensPorPagina,
  onMudarPagina,
}: TarefasTableProps) {
  const [tarefaSelecionada, setTarefaSelecionada] = useState<Tarefa | null>(null)

  if (tarefas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma tarefa encontrada"
        descricao="Ajuste os filtros para ver outras tarefas."
      />
    )
  }

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / itensPorPagina))

  return (
    <div>
      <div className={classes.tabela}>
        <div className={classes.cabecalho}>
          <Text className={classes.rotuloCabecalho}>Título</Text>
          <Text className={classes.rotuloCabecalho}>Projeto</Text>
          <Text className={classes.rotuloCabecalho}>Prazo final</Text>
          <Text className={classes.rotuloCabecalho}>Fechado por</Text>
          <Text className={classes.rotuloCabecalho}>Setor</Text>
          <Text className={classes.rotuloCabecalho}>Status</Text>
        </div>

        {tarefas.map((tarefa, index) => (
          <AnimatedItem key={tarefa.id} delay={index * 0.08} index={index}>
            <div
              className={classes.row}
              role="button"
              tabIndex={0}
              onClick={() => setTarefaSelecionada(tarefa)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setTarefaSelecionada(tarefa)
              }}
            >
              <Text className={classes.celula} fw={600} truncate="end">
                {tarefa.titulo}
              </Text>
              <Text className={classes.celula} truncate="end">
                {tarefa.projetoNome ?? '—'}
              </Text>
              <Text className={classes.celula}>{formatarData(tarefa.prazoFinal)}</Text>
              <Text className={classes.celula} truncate="end">
                {tarefa.fechadoPorNome ?? '—'}
              </Text>
              <Text className={classes.celula} truncate="end">
                {tarefa.fechadoPorDepartamentos.join(', ') || '—'}
              </Text>
              <Badge color={corDoStatus(tarefa)} variant="light" size="sm">
                {STATUS_LABELS[tarefa.status]}
              </Badge>
            </div>
          </AnimatedItem>
        ))}
      </div>

      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">
          {totalRegistros} tarefa(s) no total
        </Text>
        <Pagination
          value={pagina}
          onChange={onMudarPagina}
          total={totalPaginas}
          styles={{
            control: {
              '--pagination-active-bg': CorNavegacaoAtiva,
              borderColor: 'transparent',
            } as CSSProperties,
          }}
        />
      </Group>

      <TarefaDetalheModal tarefa={tarefaSelecionada} aoFechar={() => setTarefaSelecionada(null)} />
    </div>
  )
}
