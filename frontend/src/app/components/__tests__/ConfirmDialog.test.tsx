/**
 * Tests para el componente ConfirmDialog.
 * Verifica renderizado condicional, callbacks, estilos y accesibilidad.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from '../ConfirmDialog'

const defaultProps = {
  open: true,
  message: 'Esta acción no se puede deshacer.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando open es false', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza el mensaje cuando open es true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument()
  })

  it('muestra el título por defecto', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument()
  })

  it('muestra un título personalizado', () => {
    render(<ConfirmDialog {...defaultProps} title="¿Eliminar panel?" />)
    expect(screen.getByText('¿Eliminar panel?')).toBeInTheDocument()
  })

  it('usa etiquetas de botón personalizadas', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Sí, borrar"
        cancelLabel="No, volver"
      />
    )
    expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, volver' })).toBeInTheDocument()
  })

  it('llama a onConfirm al hacer clic en el botón confirmar', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('llama a onCancel al hacer clic en el botón cancelar', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('llama a onCancel al hacer clic en el fondo (backdrop)', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('no llama a onCancel al hacer clic dentro de la tarjeta', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Esta acción no se puede deshacer.'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cierra con la tecla Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('botón confirmar es rojo en modo destructive', () => {
    render(<ConfirmDialog {...defaultProps} destructive />)
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirmBtn.className).toMatch(/bg-red/)
  })

  it('botón confirmar es azul en modo normal (no destructive)', () => {
    render(<ConfirmDialog {...defaultProps} destructive={false} />)
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirmBtn.className).toMatch(/bg-blue/)
  })

  it('tiene rol dialog y aria-modal', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
