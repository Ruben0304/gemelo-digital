/**
 * Tests para el componente BatteryStatus.
 * Verifica cálculos de capacidad y estado sin baterías.
 * Se mockea next/navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import BatteryStatus from '../BatteryStatus'
import type { BatteryConfig } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makeBattery = (overrides: Partial<BatteryConfig> = {}): BatteryConfig => ({
  _id: 'bat-1',
  manufacturer: 'BYD',
  model: 'LFP-100',
  capacityKwh: 50,
  quantity: 2,
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
    const countSection = labels[0].closest('.rounded-lg') as HTMLElement
    expect(within(countSection).getByText('5')).toBeInTheDocument()
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

  it('el botón "Simular escenario" está deshabilitado sin baterías', () => {
    render(<BatteryStatus batteries={[]} />)
    expect(screen.getByRole('button', { name: /Simular escenario/ })).toBeDisabled()
  })

  it('el botón "Simular escenario" está habilitado con baterías', () => {
    render(<BatteryStatus batteries={[makeBattery()]} />)
    expect(screen.getByRole('button', { name: /Simular escenario/ })).not.toBeDisabled()
  })
})
