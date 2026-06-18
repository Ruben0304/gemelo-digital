/**
 * Cálculo de la posición del Sol en el cielo para una fecha, hora y ubicación.
 * Algoritmo NOAA simplificado — precisión suficiente para visualización de sombras.
 *
 * Devuelve elevación (°) y azimut (°, 0=Norte, 90=Este).
 */

export interface SunPosition {
  elevationDeg: number;   // 0 = horizonte, 90 = cenit. Negativo = bajo el horizonte
  azimuthDeg: number;     // 0 = Norte, 90 = Este, 180 = Sur, 270 = Oeste
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Día del año (1-365).
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function sunPosition(
  date: Date,
  latitudeDeg: number,
  longitudeDeg: number,
): SunPosition {
  const lat = toRad(latitudeDeg);
  const N = dayOfYear(date);

  // Declinación solar (°)
  const decl = toRad(23.45 * Math.sin(toRad((360 / 365) * (N - 81))));

  // Ecuación del tiempo (minutos)
  const B = toRad((360 / 365) * (N - 81));
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Hora solar local (h decimal, ya en hora local del navegador)
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // Ajuste por longitud — asumimos tz=longitud/15 (no se considera DST con precisión)
  const tzOffset = -date.getTimezoneOffset() / 60; // horas relativas a UTC
  const LSTM = 15 * tzOffset;
  const timeCorrection = 4 * (longitudeDeg - LSTM) + eqTime;
  const solarTime = hours + timeCorrection / 60;

  // Ángulo horario (°)
  const HRA = toRad(15 * (solarTime - 12));

  // Elevación
  const sinElev = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(HRA);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinElev)));

  // Azimut (medido desde el norte, en sentido horario)
  const cosAz = (Math.sin(decl) - Math.sin(elev) * Math.sin(lat)) / (Math.cos(elev) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (HRA > 0) az = 2 * Math.PI - az;

  return {
    elevationDeg: toDeg(elev),
    azimuthDeg: toDeg(az),
  };
}

/**
 * Convierte una posición solar a vector cartesiano (x este, y arriba, z sur).
 * Devuelve un vector unitario apuntando del observador hacia el sol.
 */
export function sunDirection(pos: SunPosition): { x: number; y: number; z: number } {
  const elev = toRad(pos.elevationDeg);
  const az = toRad(pos.azimuthDeg);
  // En el sistema Three.js (Y arriba), X = este, Z = sur (asumimos cámara mirando al norte)
  const x = Math.cos(elev) * Math.sin(az);
  const y = Math.sin(elev);
  const z = -Math.cos(elev) * Math.cos(az); // Z hacia el sur (Three default)
  return { x, y, z };
}
