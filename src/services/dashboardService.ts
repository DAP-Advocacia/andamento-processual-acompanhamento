import { bx24Disponivel, callMethodTodasPaginas } from './bitrixSdk'
import { tarefasFixture } from './mock/fixtures'
import {
  aplicarFiltros,
  calcularMetricas,
  calcularMetricasPorSetor,
  restringirAProjetosPermitidos,
} from '../utils/tarefasMetrics'
import type {
  FiltrosDashboard,
  MetricasPorSetor,
  MetricasTarefas,
  Projeto,
  StatusTarefa,
  Tarefa,
} from '../types/domain'

export const ITENS_POR_PAGINA = 10

const LATENCIA_SIMULADA_MOCK_MS = 300

function comLatenciaSimulada<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_SIMULADA_MOCK_MS))
}

export interface ResultadoTarefasPaginado {
  tarefas: Tarefa[]
  totalRegistros: number
}

// --- Carga dos dados: mock (dev fora do Bitrix) ou Bitrix ao vivo via BX24 ---
//
// Não há backend/banco próprio (decidimos não usar Supabase): a versão real busca
// tudo direto do Bitrix a cada carregamento do dashboard e mantém em memória pelo
// tempo de vida da página — não há necessidade de refazer as chamadas a cada troca
// de filtro, já que os filtros são só uma questão de recombinar os mesmos dados.

let cacheChave: string | null = null
let cachePromise: Promise<Tarefa[]> | null = null

let cacheUsuarios: Promise<Map<number, { nome: string; departamentoIds: number[] }>> | null = null
let cacheDepartamentos: Promise<Map<number, string>> | null = null

interface TaskBitrix {
  id: string
  title: string
  deadline: string | null
  realStatus: string
  closedDate: string | null
  closedBy: string | null
  groupId: string
}

interface UsuarioBitrix {
  ID: string
  NAME?: string
  LAST_NAME?: string
  UF_DEPARTMENT?: Array<number | string>
}

interface DepartamentoBitrix {
  ID: string
  NAME: string
}

function obterDepartamentosBitrix(): Promise<Map<number, string>> {
  if (!cacheDepartamentos) {
    cacheDepartamentos = callMethodTodasPaginas<DepartamentoBitrix>('department.get').then(
      (deps) => {
        const mapa = new Map<number, string>()
        deps.forEach((d) => mapa.set(Number(d.ID), d.NAME))
        return mapa
      },
    )
  }
  return cacheDepartamentos
}

function obterUsuariosBitrix(): Promise<Map<number, { nome: string; departamentoIds: number[] }>> {
  if (!cacheUsuarios) {
    // Sem filtro de ACTIVE: tarefas antigas podem ter sido fechadas por
    // colaboradores já desativados, e o histórico precisa manter nome/setor.
    cacheUsuarios = callMethodTodasPaginas<UsuarioBitrix>('user.get').then((usuarios) => {
      const mapa = new Map<number, { nome: string; departamentoIds: number[] }>()
      usuarios.forEach((u) => {
        const nome = [u.NAME, u.LAST_NAME].filter(Boolean).join(' ') || `Usuário ${u.ID}`
        const departamentoIds = (u.UF_DEPARTMENT ?? []).map(Number)
        mapa.set(Number(u.ID), { nome, departamentoIds })
      })
      return mapa
    })
  }
  return cacheUsuarios
}

/** tasks.task.list devolve `{ tasks: [...] }` em vez de um array direto. */
function extrairTasks(payload: unknown): TaskBitrix[] {
  if (Array.isArray(payload)) return payload as TaskBitrix[]
  return (payload as { tasks?: TaskBitrix[] }).tasks ?? []
}

async function buscarTarefasBitrix(projetosPermitidos: Projeto[]): Promise<Tarefa[]> {
  // Usuários, departamentos e tarefas em paralelo; tarefas de todos os projetos
  // permitidos em uma única listagem (GROUP_ID aceita array), paginada em lote
  // via batch dentro de callMethodTodasPaginas.
  const [usuarios, departamentos, tasks] = await Promise.all([
    obterUsuariosBitrix(),
    obterDepartamentosBitrix(),
    callMethodTodasPaginas<TaskBitrix>(
      'tasks.task.list',
      {
        filter: { GROUP_ID: projetosPermitidos.map((p) => p.id) },
        select: ['ID', 'TITLE', 'DEADLINE', 'REAL_STATUS', 'CLOSED_DATE', 'CLOSED_BY', 'GROUP_ID'],
      },
      extrairTasks,
    ),
  ])
  const projetoNomePorId = new Map(projetosPermitidos.map((p) => [p.id, p.nome]))

  return tasks
    .filter((task) => Boolean(task.deadline)) // sem prazo definido não entra no acompanhamento de prazos
    .map((task): Tarefa => {
      const fechadoPorId = task.closedBy ? Number(task.closedBy) : null
      const usuario = fechadoPorId ? usuarios.get(fechadoPorId) : undefined
      const projetoId = Number(task.groupId)

      return {
        id: Number(task.id),
        titulo: task.title,
        prazoFinal: task.deadline!,
        status: Number(task.realStatus) as StatusTarefa,
        finalizadoEm: task.closedDate ?? null,
        projetoId,
        projetoNome: projetoNomePorId.get(projetoId) ?? null,
        fechadoPorId,
        fechadoPorNome: usuario?.nome ?? null,
        fechadoPorDepartamentos: (usuario?.departamentoIds ?? [])
          .map((id) => departamentos.get(id))
          .filter((nome): nome is string => Boolean(nome)),
      }
    })
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

  cacheChave = chave
  cachePromise = bx24Disponivel()
    ? buscarTarefasBitrix(projetosPermitidos)
    : comLatenciaSimulada(
        restringirAProjetosPermitidos(
          tarefasFixture,
          projetosPermitidos.map((p) => p.id),
        ),
      )

  return cachePromise
}

/** Descarta os caches em memória (tarefas, usuários, departamentos) forçando nova busca no Bitrix. */
export async function sincronizarComBitrix(projetosPermitidos: Projeto[]): Promise<void> {
  cacheChave = null
  cachePromise = null
  cacheUsuarios = null
  cacheDepartamentos = null
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

export async function obterTarefasFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  pagina: number,
): Promise<ResultadoTarefasPaginado> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos)
  const filtradas = aplicarFiltros(tarefas, filtros)
  const ordenadas = [...filtradas].sort(
    (a, b) => new Date(b.prazoFinal).getTime() - new Date(a.prazoFinal).getTime(),
  )
  const inicio = (pagina - 1) * ITENS_POR_PAGINA
  const tarefasDaPagina = ordenadas.slice(inicio, inicio + ITENS_POR_PAGINA)
  return { tarefas: tarefasDaPagina, totalRegistros: ordenadas.length }
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
