import { describe, it, expect } from 'vitest'
import { canAccessModule, moduleKeyFromPath, type SettingsModuleKey } from '../permissions'

// ─────────────────────────────────────────────────────────────────────────────
// canAccessModule
// ─────────────────────────────────────────────────────────────────────────────

describe('canAccessModule', () => {
  // ── Admin tiene acceso a todo ─────────────────────────────────────────────
  const allModules: SettingsModuleKey[] = [
    'paneles', 'baterias', 'inversores', 'electrodomesticos',
    'consumo', 'clima', 'ubicacion', 'reportes', 'sombras',
  ]

  it.each(allModules)('admin puede acceder a "%s"', (mod) => {
    expect(canAccessModule('admin', mod)).toBe(true)
  })

  // ── User solo tiene acceso a reportes ────────────────────────────────────
  const adminOnlyModules: SettingsModuleKey[] = [
    'paneles', 'baterias', 'inversores', 'electrodomesticos',
    'consumo', 'clima', 'ubicacion', 'sombras',
  ]

  it.each(adminOnlyModules)('user NO puede acceder a "%s"', (mod) => {
    expect(canAccessModule('user', mod)).toBe(false)
  })

  it('user SÍ puede acceder a "reportes"', () => {
    expect(canAccessModule('user', 'reportes')).toBe(true)
  })

  // ── Rol vacío o nulo ──────────────────────────────────────────────────────
  it('null retorna false para cualquier módulo', () => {
    expect(canAccessModule(null, 'paneles')).toBe(false)
  })

  it('undefined retorna false para cualquier módulo', () => {
    expect(canAccessModule(undefined, 'paneles')).toBe(false)
  })

  it('cadena vacía retorna false', () => {
    expect(canAccessModule('', 'paneles')).toBe(false)
  })

  it('rol desconocido retorna false', () => {
    expect(canAccessModule('superadmin', 'paneles')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// moduleKeyFromPath
// ─────────────────────────────────────────────────────────────────────────────

describe('moduleKeyFromPath', () => {
  it('extrae "paneles" de /ajustes/paneles', () => {
    expect(moduleKeyFromPath('/ajustes/paneles')).toBe('paneles')
  })

  it('extrae "baterias" de /ajustes/baterias', () => {
    expect(moduleKeyFromPath('/ajustes/baterias')).toBe('baterias')
  })

  it('extrae "inversores" de /ajustes/inversores', () => {
    expect(moduleKeyFromPath('/ajustes/inversores')).toBe('inversores')
  })

  it('extrae "electrodomesticos" de /ajustes/electrodomesticos', () => {
    expect(moduleKeyFromPath('/ajustes/electrodomesticos')).toBe('electrodomesticos')
  })

  it('extrae "consumo" de /ajustes/consumo', () => {
    expect(moduleKeyFromPath('/ajustes/consumo')).toBe('consumo')
  })

  it('extrae "clima" de /ajustes/clima', () => {
    expect(moduleKeyFromPath('/ajustes/clima')).toBe('clima')
  })

  it('extrae "ubicacion" de /ajustes/ubicacion', () => {
    expect(moduleKeyFromPath('/ajustes/ubicacion')).toBe('ubicacion')
  })

  it('extrae "reportes" de /ajustes/reportes', () => {
    expect(moduleKeyFromPath('/ajustes/reportes')).toBe('reportes')
  })

  it('extrae "sombras" de /ajustes/sombras', () => {
    expect(moduleKeyFromPath('/ajustes/sombras')).toBe('sombras')
  })

  it('ignora query params en la ruta', () => {
    expect(moduleKeyFromPath('/ajustes/paneles?tab=lista')).toBe('paneles')
  })

  it('retorna null para ruta raíz', () => {
    expect(moduleKeyFromPath('/')).toBeNull()
  })

  it('retorna null para ruta que no es de ajustes', () => {
    expect(moduleKeyFromPath('/dashboard')).toBeNull()
  })

  it('retorna null para módulo desconocido', () => {
    expect(moduleKeyFromPath('/ajustes/modulo-inexistente')).toBeNull()
  })

  it('retorna null para /ajustes sin subpath', () => {
    expect(moduleKeyFromPath('/ajustes')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Flujo completo: ruta → módulo → permisos
// ─────────────────────────────────────────────────────────────────────────────

describe('flujo ruta → módulo → permisos', () => {
  it('admin en /ajustes/paneles tiene acceso', () => {
    const key = moduleKeyFromPath('/ajustes/paneles')
    expect(key).not.toBeNull()
    expect(canAccessModule('admin', key!)).toBe(true)
  })

  it('user en /ajustes/paneles no tiene acceso', () => {
    const key = moduleKeyFromPath('/ajustes/paneles')
    expect(key).not.toBeNull()
    expect(canAccessModule('user', key!)).toBe(false)
  })

  it('user en /ajustes/reportes tiene acceso', () => {
    const key = moduleKeyFromPath('/ajustes/reportes')
    expect(key).not.toBeNull()
    expect(canAccessModule('user', key!)).toBe(true)
  })

  it('ruta desconocida retorna null y no da acceso', () => {
    const key = moduleKeyFromPath('/ajustes/xyz')
    expect(key).toBeNull()
  })
})
