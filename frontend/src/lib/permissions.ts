/**
 * Permisos por módulo de Ajustes, derivados del rol del usuario.
 *
 * Fuente única de verdad: el `role` del usuario (guardado en la sesión). A partir
 * de él se decide qué módulos de Ajustes puede ver/usar. Así la validación es una
 * sola (visibilidad = acceso): si un usuario no ve un módulo porque su rol no lo
 * permite, tampoco puede llegar a sus acciones, y no hay posibilidad de error.
 *
 * Regla actual: el administrador accede a todos los módulos; cualquier otro rol
 * solo puede exportar reportes.
 */

export type Role = 'admin' | 'user';

export type SettingsModuleKey =
  | 'paneles'
  | 'baterias'
  | 'inversores'
  | 'electrodomesticos'
  | 'consumo'
  | 'clima'
  | 'ubicacion'
  | 'reportes'
  | 'sombras';

const SETTINGS_MODULE_ROLES: Record<SettingsModuleKey, Role[]> = {
  paneles: ['admin'],
  baterias: ['admin'],
  inversores: ['admin'],
  electrodomesticos: ['admin'],
  consumo: ['admin'],
  clima: ['admin'],
  ubicacion: ['admin'],
  reportes: ['admin', 'user'],
  sombras: ['admin'],
};

/** ¿El rol indicado puede acceder al módulo de Ajustes dado? */
export function canAccessModule(role: string | null | undefined, key: SettingsModuleKey): boolean {
  if (!role) return false;
  return SETTINGS_MODULE_ROLES[key]?.includes(role as Role) ?? false;
}

/** Deriva la clave de módulo desde una ruta del tipo `/ajustes/<modulo>`. */
export function moduleKeyFromPath(pathname: string): SettingsModuleKey | null {
  const match = pathname.match(/^\/ajustes\/([a-zA-Z]+)/);
  if (!match) return null;
  const key = match[1] as SettingsModuleKey;
  return key in SETTINGS_MODULE_ROLES ? key : null;
}
