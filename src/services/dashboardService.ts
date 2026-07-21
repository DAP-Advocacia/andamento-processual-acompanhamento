import { listarTodasPaginas } from './bitrixTransport'
import { registrarSnapshotMetadata } from './debugSnapshot'
import { modoMockDevAtivo } from './modoMockDev'
import {
  aplicarFiltros,
  calcularMetricas,
  calcularMetricasPorSetor,
  calcularMetricasPorEquipe,
  empacotarPorAtendimento,
} from '../utils/tarefasMetrics'
import {
  DEPARTAMENTO_ID_POR_EQUIPE,
  EQUIPES_ATENDIMENTO,
  type EquipeResolvida,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasPorEquipe,
  type MetricasTarefas,
  type PacoteAtendimento,
  type Projeto,
  type Tarefa,
} from '../types/domain'

let cacheDepartamentos: Promise<Map<number, string>> | null = null

interface DepartamentoBitrix {
  ID: string
  NAME: string
}

function obterDepartamentosBitrix(): Promise<Map<number, string>> {
  if (!cacheDepartamentos) {
    cacheDepartamentos = listarTodasPaginas<DepartamentoBitrix>('department.get').then(
      (deps) => {
        const mapa = new Map<number, string>()
        deps.forEach((d) => mapa.set(Number(d.ID), d.NAME))
        return mapa
      },
    )
  }
  return cacheDepartamentos
}

// --- Carga dos dados: snapshot pré-processado pelo microsserviço de sync ---
//
// tasks.task.list é impraticavelmente lento neste portal Bitrix para o volume
// dos grupos monitorados (medido: ~2,8s/página de 50 itens, ~129 mil tarefas só
// no grupo 86 nos últimos 90 dias) — buscar ao vivo no navegador nunca
// terminaria em tempo útil. Um microsserviço próprio (sync-service/, FastAPI
// numa VPS) sincroniza continuamente em background e mantém um snapshot
// pronto; o front só lê esse snapshot via HTTP, instantâneo independente do
// volume real no Bitrix. Ver sync-service/README e VITE_SYNC_API_URL.

let cacheChave: string | null = null
let cachePromise: Promise<Tarefa[]> | null = null

function baseSyncApiUrl(): string | null {
  const bruta = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (!bruta) return null
  return bruta.endsWith('/') ? bruta.slice(0, -1) : bruta
}

interface SnapshotMetadata {
  syncedAt: string
  windowStart: string
  windowEnd: string
  groups: Array<{ id: number; nome: string; taskCount: number; error: string | null }>
  runId: string
}

async function buscarTarefasDoSnapshot(): Promise<Tarefa[]> {
  const base = baseSyncApiUrl()
  if (!base) {
    // Em dev, sem VITE_SYNC_API_URL configurado, cai num snapshot mock com
    // dados reais já resolvidos (para validar a tela sem depender da VPS).
    // O arquivo vive em public/ (fora do grafo de build do Vite) e é buscado
    // via fetch — NUNCA um `import()` estático/dinâmico dele, que o Rollup
    // sempre emite como chunk no dist independente de branch condicional (já
    // vazou uma vez assim: verificar `npm run build && ls dist/assets` não
    // deve listar nada com "snapshot-mock" antes de confiar nisto de novo).
    if (modoMockDevAtivo()) {
      const resposta = await fetch('/snapshot-mock.json')
      if (!resposta.ok) {
        throw new Error('Snapshot mock não encontrado em public/snapshot-mock.json.')
      }
      const mock = (await resposta.json()) as { tarefas: Tarefa[]; metadata: SnapshotMetadata }
      registrarSnapshotMetadata(mock.metadata)

      // Ajusta dinamicamente as datas do mock em relação à data atual para ter tarefas
      // em andamento e com risco de atraso em ambiente de desenvolvimento (mock offline).
      const agora = new Date()
      const maxMockTime = Math.max(...mock.tarefas.map((t) => new Date(t.prazoFinal).getTime()))
      const targetMaxTime = agora.getTime() + 20 * 24 * 60 * 60 * 1000
      const deltaMs = targetMaxTime - maxMockTime

      return mock.tarefas.map((t) => ({
        ...t,
        prazoFinal: new Date(new Date(t.prazoFinal).getTime() + deltaMs).toISOString(),
      }))
    }
    throw new Error(
      'Serviço de sincronização não configurado. Defina VITE_SYNC_API_URL apontando para o sync-service.',
    )
  }

  const resposta = await fetch(`${base}/snapshot`)
  if (resposta.status === 404) {
    throw new Error(
      'Nenhuma sincronização concluída ainda no serviço de sync. Aguarde o próximo ciclo.',
    )
  }
  if (!resposta.ok) {
    throw new Error(`Erro ao ler o snapshot de tarefas (HTTP ${resposta.status}).`)
  }

  const corpo = (await resposta.json()) as { tarefas: Tarefa[]; metadata: SnapshotMetadata }
  registrarSnapshotMetadata(corpo.metadata)
  return corpo.tarefas
}

function chaveDoCache(projetosPermitidos: Projeto[]): string {
  return projetosPermitidos
    .map((p) => p.id)
    .sort((a, b) => a - b)
    .join(',')
}

function carregarTarefasPermitidas(projetosPermitidos: Projeto[]): Promise<Tarefa[]> {
  const chave = chaveDoCache(projetosPermitidos)
  if (cacheChave === chave && cachePromise) {
    return cachePromise
  }

  const idsPermitidos = new Set(projetosPermitidos.map((p) => p.id))
  cacheChave = chave
  cachePromise = buscarTarefasDoSnapshot().then((tarefas) =>
    tarefas.filter((t) => t.projetoId !== null && idsPermitidos.has(t.projetoId)),
  )
  return cachePromise
}

/** Descarta o cache em memória, forçando nova leitura do snapshot mais recente. */
export async function sincronizarComBitrix(projetosPermitidos: Projeto[]): Promise<void> {
  cacheChave = null
  cachePromise = null
  await carregarTarefasPermitidas(projetosPermitidos)
}

// --- API pública consumida pelo front (mesma assinatura independente da fonte) ---

export async function obterMetricasGerais(projetosPermitidos: Projeto[]): Promise<MetricasTarefas> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  return calcularMetricas(tarefas)
}

export async function obterMetricasFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
): Promise<MetricasTarefas> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  return calcularMetricas(aplicarFiltros(tarefas, filtros))
}

export async function obterMetricasPorSetorFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
): Promise<MetricasPorSetor[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  return calcularMetricasPorSetor(aplicarFiltros(tarefas, filtros))
}

export async function obterMetricasPorEquipeFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
): Promise<MetricasPorEquipe[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  return calcularMetricasPorEquipe(aplicarFiltros(tarefas, filtros))
}

/**
 * Pacotes de atendimento: cada card é agrupado pelo responsável pelo atendimento
 * (UF_CRM_20_1780943729), com a equipe (departamento) do responsável já resolvida.
 * É a base da tela de inteligência.
 */
export async function obterPacotesAtendimento(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
): Promise<PacoteAtendimento[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  return empacotarPorAtendimento(aplicarFiltros(tarefas, filtros))
}

/**
 * "Busca as equipes das pessoas informadas": confirma que o ID de departamento
 * configurado em DEPARTAMENTO_ID_POR_EQUIPE existe de fato no Bitrix (via a
 * fonte ativa — BX24 ou webhook/api_url). Serve ao tracking da modelagem de
 * dados exibido junto aos gráficos.
 */
export async function resolverEquipesInformadas(): Promise<EquipeResolvida[]> {
  // Modo mock dev: não bate no Bitrix (department.get daria 401 sem token);
  // assume os 4 departamentos como encontrados (IDs já validados ao vivo).
  if (modoMockDevAtivo()) {
    return EQUIPES_ATENDIMENTO.map((nome) => ({
      nome,
      departamentoId: DEPARTAMENTO_ID_POR_EQUIPE[nome],
      encontrada: true,
    }))
  }

  const departamentos = await obterDepartamentosBitrix()

  return EQUIPES_ATENDIMENTO.map((nome) => {
    const departamentoId = DEPARTAMENTO_ID_POR_EQUIPE[nome]
    const encontrada = departamentos.has(departamentoId)
    return { nome, departamentoId, encontrada }
  })
}

/** Setores populados a partir dos demais filtros ativos, exceto o próprio setor. */
export async function listarSetoresDisponiveis(
  filtrosSemSetor: Omit<FiltrosDashboard, 'setor'>,
  projetosPermitidos: Projeto[],
): Promise<string[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  const filtradas = aplicarFiltros(tarefas, { ...filtrosSemSetor, setor: null })
  const setores = new Set<string>()
  filtradas.forEach((t) => t.fechadoPorDepartamentos.forEach((d) => setores.add(d)))
  return Array.from(setores).sort((a, b) => a.localeCompare(b))
}

/** Estados (UF) presentes nos dados, populados a partir dos demais filtros ativos. */
export async function listarEstadosDisponiveis(
  filtrosSemEstado: Omit<FiltrosDashboard, 'estado'>,
  projetosPermitidos: Projeto[],
): Promise<string[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  const filtradas = aplicarFiltros(tarefas, { ...filtrosSemEstado, estado: null })
  const estados = new Set<string>()
  filtradas.forEach((t) => {
    if (t.estadoUf) estados.add(t.estadoUf)
  })
  return Array.from(estados).sort((a, b) => a.localeCompare(b))
}

/** Colaboradores (que fecharam tarefas) populados a partir dos demais filtros ativos. */
export async function listarColaboradoresDisponiveis(
  filtrosSemFechadoPor: Omit<FiltrosDashboard, 'fechadoPorId'>,
  projetosPermitidos: Projeto[],
): Promise<Array<{ id: number; nome: string }>> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  const filtradas = aplicarFiltros(tarefas, { ...filtrosSemFechadoPor, fechadoPorId: null })
  const colaboradores = new Map<number, string>()
  filtradas.forEach((t) => {
    if (t.fechadoPorId !== null) colaboradores.set(t.fechadoPorId, t.fechadoPorNome ?? `Usuário ${t.fechadoPorId}`)
  })
  return Array.from(colaboradores.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Responsáveis atuais (RESPONSIBLE_ID) populados a partir dos demais filtros ativos. */
export async function listarResponsaveisDisponiveis(
  filtrosSemResponsavel: Omit<FiltrosDashboard, 'responsavelId'>,
  projetosPermitidos: Projeto[],
): Promise<Array<{ id: number; nome: string }>> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  const filtradas = aplicarFiltros(tarefas, { ...filtrosSemResponsavel, responsavelId: null })
  const responsaveis = new Map<number, string>()
  filtradas.forEach((t) => {
    if (t.responsavelId !== null)
      responsaveis.set(t.responsavelId, t.responsavelNome ?? `Usuário ${t.responsavelId}`)
  })
  return Array.from(responsaveis.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
