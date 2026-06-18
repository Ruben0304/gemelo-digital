/**
 * Cálculo geométrico de sombra sobre un panel solar dado un conjunto de obstáculos.
 * Se muestrea una grilla de puntos sobre el panel y para cada uno se lanza un rayo
 * hacia el sol; si interseca cualquier obstáculo, ese punto está en sombra.
 */

export type Vec3 = { x: number; y: number; z: number };

export type ObstacleType = 'tree' | 'building';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  position: Vec3;       // base (suelo) en el plano XZ
  height: number;       // alto en Y
  radius: number;       // árbol → radio de copa; edificio → media-anchura
  rotationY?: number;   // rotación visual en eje Y (radianes); no afecta sombra
}

export interface PanelRect {
  center: Vec3;
  width: number;        // dimensión horizontal en X (antes de inclinación)
  depth: number;        // dimensión en Z (antes de inclinación)
  tiltDeg: number;      // inclinación, eje X (techo a dos aguas)
  azimuthDeg: number;   // orientación del panel; 180 = sur
}

const SAMPLES_PER_SIDE = 6;  // 6×6 = 36 puntos por panel (perf > precisión)

function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }

/** Genera puntos de muestreo distribuidos sobre la superficie del panel inclinado. */
function panelSamplePoints(panel: PanelRect): Vec3[] {
  const points: Vec3[] = [];
  const tilt = (panel.tiltDeg * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = 0; i < SAMPLES_PER_SIDE; i++) {
    for (let j = 0; j < SAMPLES_PER_SIDE; j++) {
      const u = (i / (SAMPLES_PER_SIDE - 1) - 0.5) * panel.width;
      const v = (j / (SAMPLES_PER_SIDE - 1) - 0.5) * panel.depth;
      // Inclinación alrededor del eje X (Z y Y rotan)
      const x = u;
      const y = v * sinT;
      const z = v * cosT;
      points.push({
        x: panel.center.x + x,
        y: panel.center.y + y,
        z: panel.center.z + z,
      });
    }
  }
  return points;
}

/** Intersección rayo–esfera. Devuelve true si el rayo toca la esfera en t > 0. */
function raySphereHit(origin: Vec3, dir: Vec3, sphereCenter: Vec3, radius: number): boolean {
  const oc = sub(origin, sphereCenter);
  const b = dot(oc, dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return false;
  const sqrtD = Math.sqrt(disc);
  const t1 = -b - sqrtD;
  const t2 = -b + sqrtD;
  return t1 > 0.01 || t2 > 0.01;
}

/** Intersección rayo–AABB. Devuelve true si el rayo toca el bloque en t > 0. */
function rayBoxHit(origin: Vec3, dir: Vec3, min: Vec3, max: Vec3): boolean {
  let tmin = -Infinity, tmax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return false;
    } else {
      const t1 = (min[axis] - origin[axis]) / dir[axis];
      const t2 = (max[axis] - origin[axis]) / dir[axis];
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) return false;
    }
  }
  return tmax > 0.01;
}

/** Verifica si un obstáculo bloquea un rayo determinado. */
function blocks(obstacle: Obstacle, origin: Vec3, dir: Vec3): boolean {
  if (obstacle.type === 'tree') {
    // Copa = esfera centrada a altura = height (radio = radius)
    const center = { x: obstacle.position.x, y: obstacle.height, z: obstacle.position.z };
    return raySphereHit(origin, dir, center, obstacle.radius);
  } else {
    // Edificio = AABB desde el suelo hasta height, ancho 2*radius
    const min: Vec3 = {
      x: obstacle.position.x - obstacle.radius,
      y: 0,
      z: obstacle.position.z - obstacle.radius,
    };
    const max: Vec3 = {
      x: obstacle.position.x + obstacle.radius,
      y: obstacle.height,
      z: obstacle.position.z + obstacle.radius,
    };
    return rayBoxHit(origin, dir, min, max);
  }
}

export interface ShadowResult {
  shadowPct: number;       // 0-100
  litPoints: Vec3[];       // puntos del panel iluminados (para overlay opcional)
  shadowedPoints: Vec3[];  // puntos en sombra
}

/**
 * Calcula el porcentaje de área del panel en sombra.
 * @param panel rectángulo del panel
 * @param sunDir vector unitario apuntando del observador al sol
 * @param obstacles obstáculos en la escena
 * @param sunElevDeg si el sol está bajo el horizonte (≤0), todo está en "sombra de la noche"
 */
export function computeShadow(
  panel: PanelRect,
  sunDir: Vec3,
  obstacles: Obstacle[],
  sunElevDeg: number,
): ShadowResult {
  const points = panelSamplePoints(panel);

  if (sunElevDeg <= 0) {
    return { shadowPct: 100, litPoints: [], shadowedPoints: points };
  }

  const lit: Vec3[] = [];
  const shadowed: Vec3[] = [];

  for (const p of points) {
    let isShadowed = false;
    for (const obs of obstacles) {
      if (blocks(obs, p, sunDir)) {
        isShadowed = true;
        break;
      }
    }
    if (isShadowed) shadowed.push(p);
    else lit.push(p);
  }

  return {
    shadowPct: (shadowed.length / points.length) * 100,
    litPoints: lit,
    shadowedPoints: shadowed,
  };
}
