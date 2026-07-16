import { Badge, Divider, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core'
import { STATUS_LABELS, type Tarefa } from '../../types/domain'
import { tarefaEstaAtrasada, tarefaEstaConcluida } from '../../utils/tarefasMetrics'
import { corDoStatus, formatarData, formatarDataHora } from './tarefaApresentacao'

interface TarefaDetalheModalProps {
  tarefa: Tarefa | null
  aoFechar: () => void
}

const DIA_MS = 24 * 60 * 60 * 1000

function descreverSituacao(tarefa: Tarefa): string {
  const agora = new Date()
  const prazo = new Date(tarefa.prazoFinal)

  if (tarefaEstaConcluida(tarefa)) {
    if (!tarefa.finalizadoEm) return 'Concluída'
    return new Date(tarefa.finalizadoEm) <= prazo
      ? 'Concluída dentro do prazo'
      : 'Concluída com atraso'
  }
  if (tarefaEstaAtrasada(tarefa, agora)) {
    const dias = Math.floor((agora.getTime() - prazo.getTime()) / DIA_MS)
    return dias === 0 ? 'Atrasada — o prazo venceu hoje' : `Atrasada há ${dias} dia(s)`
  }
  if (tarefa.status === 6) return 'Adiada'
  const dias = Math.ceil((prazo.getTime() - agora.getTime()) / DIA_MS)
  return dias === 0 ? 'No prazo — vence hoje' : `No prazo — vence em ${dias} dia(s)`
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {rotulo}
      </Text>
      <Text size="sm">{valor}</Text>
    </div>
  )
}

export function TarefaDetalheModal({ tarefa, aoFechar }: TarefaDetalheModalProps) {
  return (
    <Modal
      opened={tarefa !== null}
      onClose={aoFechar}
      title="Andamento processual"
      centered
      size="lg"
      radius="md"
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      {tarefa && (
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Text fw={700} size="lg">
              {tarefa.titulo}
            </Text>
            <Badge color={corDoStatus(tarefa)} variant="light">
              {STATUS_LABELS[tarefa.status]}
            </Badge>
          </Group>

          <Text size="sm" fw={600}>
            {descreverSituacao(tarefa)}
          </Text>

          <Divider />

          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <Campo rotulo="Projeto" valor={tarefa.projetoNome ?? '—'} />
            <Campo rotulo="Prazo final" valor={formatarData(tarefa.prazoFinal)} />
            <Campo rotulo="Finalizado em" valor={formatarDataHora(tarefa.finalizadoEm)} />
            <Campo rotulo="Fechado por" valor={tarefa.fechadoPorNome ?? '—'} />
            <Campo rotulo="Setor(es)" valor={tarefa.fechadoPorDepartamentos.join(', ') || '—'} />
            <Campo rotulo="ID no Bitrix" valor={String(tarefa.id)} />
          </SimpleGrid>
        </Stack>
      )}
    </Modal>
  )
}
