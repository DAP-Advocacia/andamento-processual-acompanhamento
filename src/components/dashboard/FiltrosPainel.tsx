import { Checkbox, Grid, Select } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useEffect, useState } from 'react'
import {
  listarColaboradoresDisponiveis,
  listarEstadosDisponiveis,
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
  dropdown: classes.dropdown,
  option: classes.option,
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
  const [estadosDisponiveis, setEstadosDisponiveis] = useState<string[]>([])
  const {
    dataInicio,
    dataFim,
    status,
    setor,
    projetoId,
    fechadoPorId,
    responsavelId,
    prioridade,
    estado,
    ocultarIndefinidos,
    ocultarForaDasEquipes,
  } = filtros

  useEffect(() => {
    let cancelado = false
    listarSetoresDisponiveis(
      {
        dataInicio,
        dataFim,
        status,
        projetoId,
        fechadoPorId,
        responsavelId,
        prioridade,
        estado,
        ocultarIndefinidos,
        ocultarForaDasEquipes,
      },
      projetosPermitidos,
    ).then((setores) => {
      if (!cancelado) setSetoresDisponiveis(setores)
    })
    return () => {
      cancelado = true
    }
  }, [
    dataInicio,
    dataFim,
    status,
    projetoId,
    fechadoPorId,
    responsavelId,
    prioridade,
    estado,
    ocultarIndefinidos,
    ocultarForaDasEquipes,
    projetosPermitidos,
  ])

  useEffect(() => {
    let cancelado = false
    listarColaboradoresDisponiveis(
      {
        dataInicio,
        dataFim,
        status,
        setor,
        projetoId,
        responsavelId,
        prioridade,
        estado,
        ocultarIndefinidos,
        ocultarForaDasEquipes,
      },
      projetosPermitidos,
    ).then((colaboradores) => {
      if (!cancelado) setColaboradoresDisponiveis(colaboradores)
    })
    return () => {
      cancelado = true
    }
  }, [
    dataInicio,
    dataFim,
    status,
    setor,
    projetoId,
    responsavelId,
    prioridade,
    estado,
    ocultarIndefinidos,
    ocultarForaDasEquipes,
    projetosPermitidos,
  ])

  useEffect(() => {
    let cancelado = false
    listarResponsaveisDisponiveis(
      {
        dataInicio,
        dataFim,
        status,
        setor,
        projetoId,
        fechadoPorId,
        prioridade,
        estado,
        ocultarIndefinidos,
        ocultarForaDasEquipes,
      },
      projetosPermitidos,
    ).then((responsaveis) => {
      if (!cancelado) setResponsaveisDisponiveis(responsaveis)
    })
    return () => {
      cancelado = true
    }
  }, [
    dataInicio,
    dataFim,
    status,
    setor,
    projetoId,
    fechadoPorId,
    prioridade,
    estado,
    ocultarIndefinidos,
    ocultarForaDasEquipes,
    projetosPermitidos,
  ])

  useEffect(() => {
    let cancelado = false
    listarEstadosDisponiveis(
      {
        dataInicio,
        dataFim,
        status,
        setor,
        projetoId,
        fechadoPorId,
        responsavelId,
        prioridade,
        ocultarIndefinidos,
        ocultarForaDasEquipes,
      },
      projetosPermitidos,
    ).then((estados) => {
      if (!cancelado) setEstadosDisponiveis(estados)
    })
    return () => {
      cancelado = true
    }
  }, [
    dataInicio,
    dataFim,
    status,
    setor,
    projetoId,
    fechadoPorId,
    responsavelId,
    prioridade,
    ocultarIndefinidos,
    ocultarForaDasEquipes,
    projetosPermitidos,
  ])

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
          label="Departamento"
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
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          radius="lg"
          classNames={CLASSES_INPUT}
          label="Estado (UF)"
          placeholder="Todos"
          data={estadosDisponiveis}
          value={filtros.estado}
          onChange={(valor) => onChange({ ...filtros, estado: valor })}
          searchable
          clearable
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Checkbox
          classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
          label="Ocultar dados indefinidos"
          checked={filtros.ocultarIndefinidos}
          onChange={(evento) =>
            onChange({ ...filtros, ocultarIndefinidos: evento.currentTarget.checked })
          }
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Checkbox
          classNames={{ input: classes.checkboxInput, label: classes.checkboxLabel }}
          label="Ocultar quem não é das equipes"
          checked={filtros.ocultarForaDasEquipes}
          onChange={(evento) =>
            onChange({ ...filtros, ocultarForaDasEquipes: evento.currentTarget.checked })
          }
        />
      </Grid.Col>

    </Grid>
  )
}
