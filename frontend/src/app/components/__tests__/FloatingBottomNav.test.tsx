/**
 * Tests para el componente FloatingBottomNav.
 * Verifica que muestra los ítems correctos, marca el activo y dispara callbacks.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FloatingBottomNav from '../FloatingBottomNav'

describe('FloatingBottomNav', () => {
  it('muestra los 3 ítems base cuando no es admin', () => {
    render(<FloatingBottomNav active="overview" onSelect={vi.fn()} />)
    expect(screen.getByLabelText('Info general')).toBeInTheDocument()
    expect(screen.getByLabelText('Estadísticas')).toBeInTheDocument()
    expect(screen.getByLabelText('Ajustes')).toBeInTheDocument()
    expect(screen.queryByLabelText('Admin')).not.toBeInTheDocument()
  })

  it('muestra el ítem Admin cuando isAdmin es true', () => {
    render(<FloatingBottomNav active="overview" onSelect={vi.fn()} isAdmin />)
    expect(screen.getByLabelText('Admin')).toBeInTheDocument()
  })

  it('el botón activo tiene aria-current="page"', () => {
    render(<FloatingBottomNav active="stats" onSelect={vi.fn()} />)
    expect(screen.getByLabelText('Estadísticas')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Info general')).not.toHaveAttribute('aria-current')
  })

  it('llama a onSelect con el id correcto al hacer clic', () => {
    const onSelect = vi.fn()
    render(<FloatingBottomNav active="overview" onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Estadísticas'))
    expect(onSelect).toHaveBeenCalledWith('stats')
  })

  it('llama a onSelect con "admin" al hacer clic en el ítem admin', () => {
    const onSelect = vi.fn()
    render(<FloatingBottomNav active="overview" onSelect={onSelect} isAdmin />)
    fireEvent.click(screen.getByLabelText('Admin'))
    expect(onSelect).toHaveBeenCalledWith('admin')
  })

  it('tiene 4 botones con isAdmin=true y 3 sin isAdmin', () => {
    const { rerender } = render(<FloatingBottomNav active="overview" onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)

    rerender(<FloatingBottomNav active="overview" onSelect={vi.fn()} isAdmin />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('muestra las etiquetas de texto visibles', () => {
    render(<FloatingBottomNav active="overview" onSelect={vi.fn()} />)
    expect(screen.getByText('Info general')).toBeInTheDocument()
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })
})
