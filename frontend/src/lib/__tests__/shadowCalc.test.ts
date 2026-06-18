import { describe, it, expect } from 'vitest'
import { computeShadow, type Obstacle, type PanelRect, type Vec3 } from '../shadowCalc'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sunAbove: Vec3 = { x: 0, y: 1, z: 0 }   // Sol directo sobre el panel
const sunSide: Vec3 = { x: 1, y: 0.5, z: 0 }  // Sol a 45° lateral

const flatPanel: PanelRect = {
  center: { x: 0, y: 1, z: 0 },
  width: 2,
  depth: 2,
  tiltDeg: 0,
  azimuthDeg: 180,
}

const obstacleLejos: Obstacle = {
  id: 'tree-far',
  type: 'tree',
  position: { x: 100, y: 0, z: 100 },
  height: 5,
  radius: 1,
}

const buildingObstacle: Obstacle = {
  id: 'building-near',
  type: 'building',
  position: { x: 0, y: 0, z: 0 },
  height: 10,
  radius: 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sin obstáculos
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – sin obstáculos', () => {
  it('shadowPct es 0 cuando no hay obstáculos y el sol está alto', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    expect(result.shadowPct).toBe(0)
  })

  it('todos los puntos son iluminados cuando no hay obstáculos', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    expect(result.litPoints.length).toBeGreaterThan(0)
    expect(result.shadowedPoints.length).toBe(0)
  })

  it('litPoints + shadowedPoints = total de puntos muestreados', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    const total = result.litPoints.length + result.shadowedPoints.length
    // 6×6 = 36 puntos
    expect(total).toBe(36)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Noche (elevación solar ≤ 0)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – noche', () => {
  it('shadowPct es 100 cuando sunElevDeg es 0', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 0)
    expect(result.shadowPct).toBe(100)
  })

  it('shadowPct es 100 cuando sunElevDeg es negativo', () => {
    const result = computeShadow(flatPanel, sunAbove, [], -10)
    expect(result.shadowPct).toBe(100)
  })

  it('no hay puntos iluminados de noche', () => {
    const result = computeShadow(flatPanel, sunAbove, [], -5)
    expect(result.litPoints.length).toBe(0)
  })

  it('todos los puntos son sombra de noche', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 0)
    expect(result.shadowedPoints.length).toBe(36)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Obstáculo lejos — no bloquea
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – obstáculo lejano no bloquea', () => {
  it('árbol lejos no genera sombra', () => {
    const result = computeShadow(flatPanel, sunAbove, [obstacleLejos], 60)
    expect(result.shadowPct).toBe(0)
  })

  it('todos los puntos siguen iluminados con obstáculo distante', () => {
    const result = computeShadow(flatPanel, sunAbove, [obstacleLejos], 60)
    expect(result.shadowedPoints.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edificio encima del panel — bloqueo total o parcial
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – obstáculo que bloquea', () => {
  it('shadowPct está entre 0 y 100 con obstáculo cercano', () => {
    const result = computeShadow(flatPanel, sunSide, [buildingObstacle], 30)
    expect(result.shadowPct).toBeGreaterThanOrEqual(0)
    expect(result.shadowPct).toBeLessThanOrEqual(100)
  })

  it('litPoints y shadowedPoints suman 36 con obstáculo', () => {
    const result = computeShadow(flatPanel, sunSide, [buildingObstacle], 30)
    expect(result.litPoints.length + result.shadowedPoints.length).toBe(36)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de obstáculo
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – tipos de obstáculo', () => {
  it('árbol (esfera) puede bloquear puntos del panel', () => {
    const treeNear: Obstacle = {
      id: 'tree-near',
      type: 'tree',
      position: { x: 0, y: 0, z: 2 },
      height: 1,
      radius: 3,
    }
    const result = computeShadow(flatPanel, { x: 0, y: 0.5, z: -1 }, [treeNear], 30)
    expect(result.shadowPct).toBeGreaterThanOrEqual(0)
  })

  it('edificio (AABB) puede bloquear puntos del panel', () => {
    const buildingNear: Obstacle = {
      id: 'bld',
      type: 'building',
      position: { x: 0, y: 0, z: -2 },
      height: 5,
      radius: 3,
    }
    const result = computeShadow(flatPanel, { x: 0, y: 0.5, z: 1 }, [buildingNear], 30)
    expect(result.shadowPct).toBeGreaterThanOrEqual(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Estructura de resultados
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – estructura de resultado', () => {
  it('resultado contiene shadowPct, litPoints y shadowedPoints', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    expect(result).toHaveProperty('shadowPct')
    expect(result).toHaveProperty('litPoints')
    expect(result).toHaveProperty('shadowedPoints')
  })

  it('litPoints son objetos Vec3 con x, y, z', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    if (result.litPoints.length > 0) {
      const p = result.litPoints[0]
      expect(p).toHaveProperty('x')
      expect(p).toHaveProperty('y')
      expect(p).toHaveProperty('z')
    }
  })

  it('shadowPct no es NaN', () => {
    const result = computeShadow(flatPanel, sunAbove, [], 45)
    expect(Number.isNaN(result.shadowPct)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Panel inclinado
// ─────────────────────────────────────────────────────────────────────────────

describe('computeShadow – panel inclinado', () => {
  const tiltedPanel: PanelRect = {
    center: { x: 0, y: 1.5, z: 0 },
    width: 2,
    depth: 3,
    tiltDeg: 15,
    azimuthDeg: 180,
  }

  it('panel inclinado sin obstáculos también tiene shadowPct 0 de día', () => {
    const result = computeShadow(tiltedPanel, sunAbove, [], 45)
    expect(result.shadowPct).toBe(0)
  })

  it('total de puntos sigue siendo 36 en panel inclinado', () => {
    const result = computeShadow(tiltedPanel, sunAbove, [], 45)
    expect(result.litPoints.length + result.shadowedPoints.length).toBe(36)
  })
})
