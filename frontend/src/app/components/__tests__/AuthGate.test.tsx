/**
 * Tests para el componente AuthGate.
 * Verifica cambio de modo, validación de formulario y flujo de autenticación.
 * La mutación GraphQL se mockea via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthGate from '../AuthGate'
import type { User } from '@/types'

vi.mock('@/lib/graphql-client', () => ({
  executeMutation: vi.fn(),
  // AuthGate consulta ldapEnabled al montar; por defecto la pestaña LDAP oculta.
  executeQuery: vi.fn(() => Promise.resolve({ ldapEnabled: false })),
}))

import { executeMutation, executeQuery } from '@/lib/graphql-client'
const mockMutation = executeMutation as ReturnType<typeof vi.fn>
const mockQuery = executeQuery as ReturnType<typeof vi.fn>

const mockUser: User = {
  _id: 'user-1',
  email: 'test@test.cu',
  name: 'Test User',
  role: 'user',
  token: 'jwt-token',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Por defecto LDAP deshabilitado; los tests que lo necesiten lo sobreescriben.
    mockQuery.mockResolvedValue({ ldapEnabled: false })
  })

  it('renderiza en modo login por defecto', () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    expect(screen.getByText('Acceder al gemelo digital')).toBeInTheDocument()
  })

  it('cambia al modo registro al hacer clic en "Registro"', () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Registro/i }))
    expect(screen.getByText('Crear cuenta')).toBeInTheDocument()
  })

  it('cambia al modo LDAP al hacer clic en "LDAP"', async () => {
    mockQuery.mockResolvedValue({ ldapEnabled: true })
    render(<AuthGate onAuthenticated={vi.fn()} />)
    // La pestaña LDAP aparece tras resolverse la consulta ldapEnabled.
    const ldapTab = await screen.findByRole('button', { name: /LDAP/i })
    fireEvent.click(ldapTab)
    expect(screen.getByText('Acceso LDAP institucional')).toBeInTheDocument()
  })

  it('oculta la pestaña LDAP cuando el directorio está deshabilitado', async () => {
    mockQuery.mockResolvedValue({ ldapEnabled: false })
    render(<AuthGate onAuthenticated={vi.fn()} />)
    await waitFor(() => expect(mockQuery).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /^LDAP$/i })).not.toBeInTheDocument()
  })

  it('muestra campo de nombre solo en modo registro', () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    expect(screen.queryByLabelText(/Nombre completo/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Registro/i }))
    expect(screen.getByLabelText(/Nombre completo/)).toBeInTheDocument()
  })

  it('muestra campo de código de invitación en modo registro', () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Registro/i }))
    expect(screen.getByLabelText('Código de invitación')).toBeInTheDocument()
  })

  it('muestra error si la contraseña tiene menos de 8 caracteres en registro', async () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Registro/i }))

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'user@test.cu' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'corta' },
    })
    fireEvent.change(screen.getByLabelText('Código de invitación'), {
      target: { value: 'ABC123' },
    })

    const form = screen.getByRole('button', { name: /Registrar/ }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/al menos 8 caracteres/)
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('llama a onAuthenticated tras login exitoso', async () => {
    mockMutation.mockResolvedValueOnce({
      loginUser: { token: 'jwt-token', user: mockUser },
    })

    const onAuthenticated = vi.fn()
    render(<AuthGate onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'test@test.cu' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'password123' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /Iniciar sesión/ }).closest('form')!
    )

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@test.cu', token: 'jwt-token' })
      )
    })
  })

  it('muestra mensaje de error cuando la autenticación falla', async () => {
    mockMutation.mockRejectedValueOnce(new Error('Credenciales incorrectas'))

    render(<AuthGate onAuthenticated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'bad@test.cu' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'wrongpass' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /Iniciar sesión/ }).closest('form')!
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciales incorrectas')
    })
  })

  it('rellena los campos con datos demo al hacer clic en "Rellenar datos demo"', () => {
    render(<AuthGate onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Rellenar datos demo/ }))
    const emailInput = screen.getByLabelText('Correo electrónico') as HTMLInputElement
    expect(emailInput.value).toBe('demo@microrred.cu')
  })

  it('el botón de envío se deshabilita mientras carga', async () => {
    mockMutation.mockImplementation(() => new Promise(() => {}))

    render(<AuthGate onAuthenticated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'test@test.cu' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'password123' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /Iniciar sesión/ }).closest('form')!
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Procesando/ })).toBeDisabled()
    })
  })
})
