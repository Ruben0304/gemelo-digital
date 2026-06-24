/**
 * Umbral de suciedad de paneles — única fuente de verdad, compartida por el
 * modal de "comprobar limpieza" (DevicesView) y la alerta del Dashboard.
 *
 * Semántica: "a partir de qué % de suciedad se considera el panel sucio".
 * Se guarda en localStorage (no toca la BD): es una preferencia del cliente,
 * ajustable con el slider del modal. Por defecto 50%.
 */
export const SOILING_THRESHOLD_KEY = 'gd_soiling_threshold';
export const DEFAULT_SOILING_THRESHOLD = 50;
export const SOILING_THRESHOLD_MIN = 10;
export const SOILING_THRESHOLD_MAX = 90;

function clamp(value: number): number {
  return Math.min(SOILING_THRESHOLD_MAX, Math.max(SOILING_THRESHOLD_MIN, Math.round(value)));
}

/** Lee el umbral guardado (o el por defecto). Seguro en SSR. */
export function getSoilingThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_SOILING_THRESHOLD;
  const raw = window.localStorage.getItem(SOILING_THRESHOLD_KEY);
  const val = raw != null ? Number(raw) : NaN;
  return Number.isFinite(val) ? clamp(val) : DEFAULT_SOILING_THRESHOLD;
}

/** Persiste el umbral (acotado a [10, 90]). Seguro en SSR. */
export function setSoilingThreshold(value: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOILING_THRESHOLD_KEY, String(clamp(value)));
}

/** ¿Se considera sucio el panel según el umbral dado? */
export function isPanelDirty(porcentajeSucio: number, threshold: number): boolean {
  return porcentajeSucio >= threshold;
}
