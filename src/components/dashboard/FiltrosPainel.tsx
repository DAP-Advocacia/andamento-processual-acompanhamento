import { Grid, Select } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useEffect, useState } from 'react'
import {
  listarColaboradoresDisponiveis,
  listarResponsaveisDisponiveis,
  listarSetoresDisponiveis,
} from '../../services/dashboardService'
import {
  type FiltroStatus,
  type FiltrosDashboard,
  type Projeto,
} from '../../types/domain'
import classes from './FiltrosPainel.module.css'

const OPCOES_STATUS: Array<{ value: FiltroStatus; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'no_prazo', label: 'No prazo' },
]


const CLASSES_INPUT = {
  input: classes.input,
  label: classes.label,
  section: classes.secao,
}

interface FiltrosPainelProps {
  filtros: FiltrosDashboard
  onChange: (filtros: FiltrosDashboard) => void
  projetosPermitidos: Projeto[]
}

export function FiltrosPainel({ filtros, onChange, projetosPermitidos }: FiltrosPainelProps) {
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([])
  const [colaboradoresDisponiveis, setColaboradoresDisponiveis] = useState<
    Array<{ id: number; nome: string }>
  >([])
  const [responsaveisDisponiveis, setResponsaveisDisponiveis] = useState<
    Array<{ id: number; nome: string }>
  >([])
  const { dataInicio, dataFim, status, setor, projetoId, fechadoPorId, responsavelId, prioridade } =
    filtros

  useEffect(() => {
    let cancelado = false
    listarSetoresDisponiveis(
      { dataInicio, dataFim, status, projetoId, fechadoPorId, responsavelId, prioridade },
      projetosPermitidos,
    ).then((setores) => {
      if (!cancelado) setSetoresDisponiveis(setores)
    })
    return () => {
      cancelado = true
    }
  }, [dataInicio, dataFim, status, projetoId, fechadoPorId, responsavelId, prioridade, projetosPermitidos])

  useEffect(() => {
    let cancelado = false
    listarColaboradoresDisponiveis(
      { dataInicio, dataFim, status, setor, projetoId, responsavelId, prioridade },
      projetosPermitidos,
    ).then((colaboradores) => {
      if (!cancelado) setColaboradoresDisponiveis(colaboradores)
    })
    return () => {
      cancelado = true
    }
  }, [dataInicio, dataFim, status, setor, projetoId, responsavelId, prioridade, projetosPermitidos])

  useEffect(() => {
    let cancelado = false
    listarResponsaveisDisponiveis(
      { dataInicio, dataFim, status, setor, projetoId, fechadoPorId, prioridade },
      projetosPermitidos,
    ).then((responsaveis) => {
      if (!cancelado) setResponsaveisDisponiveis(responsaveis)
    })
    return () => {
      cancelado = true
    }
  }, [dataInicio, dataFim, status, setor, projetoId, fechadoPorId, prioridade, projetosPermitidos])

  return (
    <Grid align="flex-end">
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <DatePickerInput
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Data início"
          placeholder="Selecione a data"
          value={filtros.dataInicio}
          onChange={(valor) => onChange({ ...filtros, dataInicio: valor })}
          clearable
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <DatePickerInput
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Data fim"
          placeholder="Selecione a data"
          value={filtros.dataFim}
          onChange={(valor) => onChange({ ...filtros, dataFim: valor })}
          clearable
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Status"
          data={OPCOES_STATUS}
          value={filtros.status}
          onChange={(valor) =>
            onChange({ ...filtros, status: (valor as FiltroStatus | null) ?? 'todos' })
          }
          allowDeselect={false}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Setor"
          placeholder="Todos"
          data={setoresDisponiveis}
          value={filtros.setor}
          onChange={(valor) => onChange({ ...filtros, setor: valor })}
          clearable
        />
      </Grid.Col>

      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Fechado por"
          placeholder="Todos"
          data={colaboradoresDisponiveis.map((c) => ({ value: String(c.id), label: c.nome }))}
          value={filtros.fechadoPorId === null ? null : String(filtros.fechadoPorId)}
          onChange={(valor) =>
            onChange({ ...filtros, fechadoPorId: valor === null ? null : Number(valor) })
          }
          searchable
          clearable
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Responsável"
          placeholder="Todos"
          data={responsaveisDisponiveis.map((r) => ({ value: String(r.id), label: r.nome }))}
          value={filtros.responsavelId === null ? null : String(filtros.responsavelId)}
          onChange={(valor) =>
            onChange({ ...filtros, responsavelId: valor === null ? null : Number(valor) })
          }
          searchable
          clearable
        />
      </Grid.Col>

    </Grid>
  )
}
