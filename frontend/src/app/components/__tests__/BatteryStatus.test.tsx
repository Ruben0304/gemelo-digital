/**
 * Tests para el componente BatteryStatus.
 * Verifica cálculos de capacidad, modal de estimación y estado sin baterías.
 * Se mockean next/navigation y el cliente GraphQL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import BatteryStatus from '../BatteryStatus'
import type { BatteryConfig } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/graphql-client', () => ({
  executeQuery: vi.fn(),
}))

vi.mock('@/lib/graphql-queries', () => ({
  BATTERY_DISCHARGE_ESTIMATE_QUERY: 'BATTERY_DISCHARGE_ESTIMATE_QUERY',
}))

import { executeQuery } from '@/lib/graphql-client'
const mockQuery = executeQuery as ReturnType<typeof vi.fn>

const makeBattery = (overrides: Partial<BatteryConfig> = {}): BatteryConfig => ({
  _id: 'bat-1',
  manufacturer: 'BYD',
  model: 'LFP-100',
  capacityKwh: 50,
  quantity: 2,
  nominalVoltage: 48,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
})

describe('BatteryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra la capacidad total en la sección "Capacidad total"', () => {
    render(<BatteryStatus batteries={[makeBattery()]} />)
    const label = screen.getByText('Capacidad total')
    expect(label.nextElementSibling?.textContent).toBe('100.0 kWh')
  })

  it('muestra el mensaje de estado vacío cuando no hay baterías', () => {
    render(<BatteryStatus batteries={[]} />)
    expect(screen.getByText(/No hay baterías registradas/)).toBeInTheDocument()
  })

  it('muestra el número de módulos total', () => {
    render(
      <BatteryStatus
        batteries={[
          makeBattery({ quantity: 3 }),
          makeBattery({ _id: 'bat-2', quantity: 2 }),
        ]}
      />
    )
    // Buscamos el bloque "Cantidad de baterías" y su valor
    const labels = screen.getAllByText(/Cantidad de baterías/i)
    const countSection = labels[0].closest('.rounded-lg')
    expect(within(countSection!).getByText('5')).toBeInTheDocument()
  })

  it('suma correctamente capacidad de múltiples baterías', () => {
    render(
      <BatteryStatus
        batteries={[
          makeBattery({ capacityKwh: 50, quantity: 2 }),
          makeBattery({ _id: 'bat-2', capacityKwh: 25, quantity: 4 }),
        ]}
      />
    )
    const label = screen.getByText('Capacidad total')
    expect(label.nextElementSibling?.textContent).toBe('200.0 kWh')
  })

  it('abre el diálogo de estimación al hacer clic en "¿Cuándo se descargará?"', () => {
    render(<BatteryStatus batteries={[makeBattery()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Cuándo se descargará/ }))
    expect(screen.getByText('Estimar autonomía')).toBeInTheDocument()
  })

  it('cierra el diálogo al hacer clic en el fondo (backdrop)', () => {
    render(<BatteryStatus batteries={[makeBattery()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Cuándo se descargará/ }))
    expect(screen.getByText('Estimar autonomía')).toBeInTheDocument()

    // El backdrop es el div.fixed.inset-0 que tiene onClick=closeDialog
    const backdrop = document.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)
    expect(screen.queryByText('Estimar autonomía')).not.toBeInTheDocument()
  })

  it('muestra el resultado de la estimación en horas y minutos', async () => {
    mockQuery.mockResolvedValueOnce({
      batteryDischargeEstimate: {
        minutesToEmpty: 150,
        startHour: 14,
        batteryCapacityKwh: 100,
      },
    })

    render(<BatteryStatus batteries={[makeBattery()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Cuándo se descargará/ }))
    fireEvent.click(screen.getByRole('button', { name: /Consultar estimación/ }))

    await waitFor(() => {
      expect(screen.getByText('2 h 30 min')).toBeInTheDocument()
    })
  })

  it('muestra mensaje de error si la consulta falla', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Error de red'))

    render(<BatteryStatus batteries={[makeBattery()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Cuándo se descargará/ }))
    fireEvent.click(screen.getByRole('button', { name: /Consultar estimación/ }))

    await waitFor(() => {
      expect(screen.getByText(/No se pudo obtener la estimación/)).toBeInTheDocument()
    })
  })

  it('muestra "No se vacía en 48h" cuando minutesToEmpty es null', async () => {
    mockQuery.mockResolvedValueOnce({
      batteryDischargeEstimate: {
        minutesToEmpty: null,
        startHour: 14,
        batteryCapacityKwh: 100,
      },
    })

    render(<BatteryStatus batteries={[makeBattery()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Cuándo se descargará/ }))
    fireEvent.click(screen.getByRole('button', { name: /Consultar estimación/ }))

    await waitFor(() => {
      expect(screen.getByText('No se vacía en 48h')).toBeInTheDocument()
    })
  })

  it('los botones de acción están deshabilitados sin baterías', () => {
    render(<BatteryStatus batteries={[]} />)
    expect(screen.getByRole('button', { name: /Cuándo se descargará/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Simular escenario/ })).toBeDisabled()
  })
})
