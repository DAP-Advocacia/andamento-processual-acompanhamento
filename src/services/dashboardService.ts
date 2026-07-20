import { fonteAtiva, listarTodasPaginas } from './bitrixTransport'
import { reiniciarCapturaBitrix, registrarTarefasResolvidas } from './debugBitrix'
import {
  aplicarFiltros,
  calcularMetricas,
  calcularMetricasPorSetor,
  empacotarPorAtendimento,
} from '../utils/tarefasMetrics'
import {
  EQUIPES_ATENDIMENTO,
  type EquipeAtendimento,
  type EquipeResolvida,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasTarefas,
  type PacoteAtendimento,
  type PrioridadeTarefa,
  type Projeto,
  type StatusTarefa,
  type Tarefa,
} from '../types/domain'

/** Campo customizado do card com o responsável pelo atendimento ao cliente. */
const CAMPO_RESPONSAVEL_ATENDIMENTO = 'UF_CRM_20_1780943729'

/**
 * Campo customizado "Fechado por" (userfield que será criado no card). Distinto
 * do CLOSED_BY nativo. Ajuste esta constante quando o nome real do campo existir
 * no Bitrix — o painel de debug mostra os campos brutos do card para confirmar.
 */
const CAMPO_FECHADO_POR = 'UF_CRM_FECHADO_POR'

// --- Carga dos dados: sempre ao vivo do Bitrix (BX24 embutido ou webhook REST) ---
//
// Não há backend/banco próprio nem mock: a versão real busca tudo direto do
// Bitrix a cada carregamento do dashboard e mantém em memória pelo
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
  responsibleId: string
  priority: string
  /**
   * Campo customizado do responsável pelo atendimento. O conteúdo real varia
   * (id de usuário, array, ou referência de entidade), por isso é `unknown` e
   * normalizado em `extrairIdResponsavelAtendimento`. A chave literal é
   * CAMPO_RESPONSAVEL_ATENDIMENTO — presente sob o mesmo nome no payload.
   */
  [CAMPO_RESPONSAVEL_ATENDIMENTO_KEY: string]: unknown
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

function obterUsuariosBitrix(): Promise<Map<number, { nome: string; departamentoIds: number[] }>> {
  if (!cacheUsuarios) {
    // Sem filtro de ACTIVE: tarefas antigas podem ter sido fechadas por
    // colaboradores já desativados, e o histórico precisa manter nome/setor.
    cacheUsuarios = listarTodasPaginas<UsuarioBitrix>('user.get').then((usuarios) => {
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

/**
 * Normaliza um campo customizado que referencia um usuário (responsável pelo
 * atendimento, fechado por, etc.) em um id de usuário. O conteúdo real desses
 * userfields ainda é incerto — pode vir como número, string numérica, array
 * (multi-valor) ou referência tipo "user_123" —, então extraímos o primeiro id
 * numérico que aparecer. O painel de debug mostra o valor bruto para confirmar
 * o formato contra os dados reais do Bitrix.
 */
function extrairIdUsuario(valorBruto: unknown): number | null {
  const valor = Array.isArray(valorBruto) ? valorBruto[0] : valorBruto
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const casado = String(valor).match(/\d+/)
  if (!casado) return null
  const id = Number(casado[0])
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * Classifica um responsável em uma das equipes de atendimento a partir dos
 * nomes dos departamentos dele. Se nenhum departamento bater com as equipes
 * conhecidas (ou o responsável não tiver departamento), retorna "indefinido".
 */
function equipeDoAtendimento(nomesDepartamentos: string[]): EquipeAtendimento {
  const encontrada = EQUIPES_ATENDIMENTO.find((equipe) => nomesDepartamentos.includes(equipe))
  return encontrada ?? 'indefinido'
}

async function buscarTarefasBitrix(projetosPermitidos: Projeto[]): Promise<Tarefa[]> {
  // Usuários, departamentos e tarefas em paralelo; tarefas de todos os projetos
  // permitidos em uma única listagem (GROUP_ID aceita array), paginada em lote
  // via batch dentro de callMethodTodasPaginas.
  const [usuarios, departamentos, tasks] = await Promise.all([
    obterUsuariosBitrix(),
    obterDepartamentosBitrix(),
    listarTodasPaginas<TaskBitrix>(
      'tasks.task.list',
      {
        filter: { GROUP_ID: projetosPermitidos.map((p) => p.id) },
        select: [
          'ID',
          'TITLE',
          'DEADLINE',
          'REAL_STATUS',
          'CLOSED_DATE',
          'CLOSED_BY',
          'GROUP_ID',
          'RESPONSIBLE_ID',
          'PRIORITY',
          CAMPO_RESPONSAVEL_ATENDIMENTO,
          CAMPO_FECHADO_POR,
        ],
      },
      extrairTasks,
    ),
  ])
  const projetoNomePorId = new Map(projetosPermitidos.map((p) => [p.id, p.nome]))

  const nomesDepartamentos = (departamentoIds: number[]): string[] =>
    departamentoIds
      .map((id) => departamentos.get(id))
      .filter((nome): nome is string => Boolean(nome))

  const resolvidas = tasks
    .filter((task) => Boolean(task.deadline)) // sem prazo definido não entra no acompanhamento de prazos
    .map((task): Tarefa => {
      const projetoId = Number(task.groupId)
      const responsavelId = task.responsibleId ? Number(task.responsibleId) : null
      const responsavel = responsavelId ? usuarios.get(responsavelId) : undefined

      // "Fechado por": prioriza o campo customizado; se vazio, usa o CLOSED_BY
      // nativo — assim funciona antes e depois de o campo novo existir no card.
      const fechadoPorId =
        extrairIdUsuario(task[CAMPO_FECHADO_POR]) ?? (task.closedBy ? Number(task.closedBy) : null)
      const fechadoPor = fechadoPorId ? usuarios.get(fechadoPorId) : undefined

      const responsavelAtendimentoId = extrairIdUsuario(task[CAMPO_RESPONSAVEL_ATENDIMENTO])
      const responsavelAtendimento = responsavelAtendimentoId
        ? usuarios.get(responsavelAtendimentoId)
        : undefined
      const departamentosAtendimento = nomesDepartamentos(
        responsavelAtendimento?.departamentoIds ?? [],
      )

      return {
        id: Number(task.id),
        titulo: task.title,
        prazoFinal: task.deadline!,
        status: Number(task.realStatus) as StatusTarefa,
        finalizadoEm: task.closedDate ?? null,
        projetoId,
        projetoNome: projetoNomePorId.get(projetoId) ?? null,
        fechadoPorId,
        fechadoPorNome: fechadoPor?.nome ?? null,
        fechadoPorDepartamentos: nomesDepartamentos(fechadoPor?.departamentoIds ?? []),
        responsavelId,
        responsavelNome: responsavel?.nome ?? null,
        prioridade: task.priority as PrioridadeTarefa,
        responsavelAtendimentoId,
        responsavelAtendimentoNome: responsavelAtendimento?.nome ?? null,
        equipeAtendimento: equipeDoAtendimento(departamentosAtendimento),
      }
    })

  registrarTarefasResolvidas(resolvidas)
  return resolvidas
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

  if (fonteAtiva() === 'nenhuma') {
    // Sem fonte real (nem BX24 embutido nem VITE_BITRIX_API_URL): não há mais
    // fixture — falha explicitamente para o front mostrar o estado de erro.
    return Promise.reject(
      new Error(
        'Fonte de dados do Bitrix não configurada. Rode embutido no Bitrix24 ou defina VITE_BITRIX_API_URL.',
      ),
    )
  }

  cacheChave = chave
  cachePromise = buscarTarefasBitrix(projetosPermitidos)
  return cachePromise
}

/** Descarta os caches em memória (tarefas, usuários, departamentos) forçando nova busca no Bitrix. */
export async function sincronizarComBitrix(projetosPermitidos: Projeto[]): Promise<void> {
  cacheChave = null
  cachePromise = null
  cacheUsuarios = null
  cacheDepartamentos = null
  reiniciarCapturaBitrix()
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
 * "Busca as equipes das pessoas informadas": valida os 4 nomes de equipe contra
 * os departamentos reais do Bitrix (via a fonte ativa — BX24 ou webhook/api_url).
 * Serve ao tracking da modelagem de dados exibido junto aos gráficos.
 */
export async function resolverEquipesInformadas(): Promise<EquipeResolvida[]> {
  const departamentos = await obterDepartamentosBitrix()
  // nome do departamento -> id (para achar cada equipe pelo nome).
  const idPorNome = new Map<string, number>()
  departamentos.forEach((nome, id) => idPorNome.set(nome, id))

  return EQUIPES_ATENDIMENTO.map((nome) => {
    const departamentoId = idPorNome.get(nome) ?? null
    return { nome, departamentoId, encontrada: departamentoId !== null }
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
