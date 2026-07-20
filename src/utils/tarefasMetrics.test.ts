import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calcularMetricas } from './tarefasMetrics'
import type { Tarefa } from '../types/domain'

describe('calcularMetricas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calcula as métricas de andamento e risco corretamente', () => {
    const tarefas: Partial<Tarefa>[] = [
      // 1. Em Andamento (No prazo, > 3 dias)
      { status: 3, prazoFinal: '2024-01-15T12:00:00Z' }, 
      // 2. Vence em breve (No prazo, <= 3 dias)
      { status: 3, prazoFinal: '2024-01-12T12:00:00Z' }, 
      // 3. Vence em breve (Status 4)
      { status: 4, prazoFinal: '2024-01-11T12:00:00Z' },
      // 4. Atrasada (Vencida, status 3)
      { status: 3, prazoFinal: '2024-01-09T12:00:00Z' },
      // 5. Atrasada (Vencida, status 4)
      { status: 4, prazoFinal: '2024-01-08T12:00:00Z' },
      // 6. Concluída (vencida, mas não conta como atrasada pois concluiu)
      { status: 5, prazoFinal: '2024-01-09T12:00:00Z' },
      // 7. Concluída (no prazo)
      { status: 5, prazoFinal: '2024-01-15T12:00:00Z' },
      // 8. Adiada (Status 6)
      { status: 6, prazoFinal: '2024-01-08T12:00:00Z' }
    ]

    const metricas = calcularMetricas(tarefas as Tarefa[])

    expect(metricas.total).toBe(8)
    expect(metricas.concluidas).toBe(2)
    expect(metricas.atrasadas).toBe(2) // 4 e 5
    expect(metricas.vencemEmBreve).toBe(2) // 2 e 3
    expect(metricas.aguardandoRevisao).toBe(2) // 3 e 5
    expect(metricas.emAndamento).toBe(3) // 1, 2 e 3 (menor que 5, e >= agora)
    expect(metricas.eficiencia).toBe(25) // (2 / 8) * 100
    // ativas: total(8) - concluidas(2) - adiadas(1) = 5
    // taxaAtraso: atrasadas(2) / ativas(5) = 40%
    expect(metricas.taxaAtraso).toBe(40) 
  })
})
