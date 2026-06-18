import { describe, it, expect } from 'vitest'
import type { Prediction, BatteryStatus, DayForecast, BlackoutSchedule } from '@/types'
import {
  predictProduction,
  applyBlackoutAdjustments,
  generateAlerts,
  generateHourlyPredictions,
} from '../predictions'
import type { SystemConfig } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────
const makeContext = (capacityKw = 50, panelEfficiency = 0.20, arrayAreaM2 = 250) =>
  ({ capacityKw, panelEfficiency, arrayAreaM2 }) as Parameters<typeof predictProduction>[4]

const makePrediction = (overrides: Partial<Prediction> = {}): Prediction => ({
  timestamp: '2024-06-15T12:00:00+00:00',
  hour: 12,
  expectedProduction: 30,
  expectedConsumption: 20,
  confidence: 85,
  ...overrides,
})

const makeBattery = (overrides: Partial<BatteryStatus> = {}): BatteryStatus => ({
  chargeLevel: 75,
  capacityKwh: 100,
  currentEnergy: 75,
  autonomyHours: 5,
  power: 0,
  ...overrides,
} as BatteryStatus)

const makeForecast = (overrides: Partial<DayForecast> = {}): DayForecast => ({
  date: '2024-06-15',
  condition: 'sunny',
  maxTemp: 32,
  minTemp: 22,
  humidity: 60,
  cloudCover: 10,
  windSpeed: 12,
  solarRadiation: 250,
  predictedProduction: 380,
  ...overrides,
} as unknown as DayForecast)

// Blackout que cubre 10:00–13:00 UTC el 2024-06-15
const makeBlackout = (): BlackoutSchedule => ({
  date: '2024-06-15',
  intervals: [{
    start: '2024-06-15T10:00:00+00:00',
    end:   '2024-06-15T13:00:00+00:00',
    durationMinutes: 180,
  }],
} as unknown as BlackoutSchedule)

// ─────────────────────────────────────────────────────────────────
// predictProduction
// ─────────────────────────────────────────────────────────────────
describe('predictProduction', () => {
  it('retorna 0 durante la noche (hora < 6)', () => {
    expect(predictProduction(800, 25, 10, 3, makeContext())).toBe(0)
  })

  it('retorna 0 durante la noche (hora > 20)', () => {
    expect(predictProduction(800, 25, 10, 21, makeContext())).toBe(0)
  })

  it('produce valores positivos al mediodía (hora pico)', () => {
    const prod = predictProduction(800, 25, 0, 13, makeContext())
    expect(prod).toBeGreaterThan(0)
  })

  it('reduce producción con mayor nubosidad', () => {
    const clear = predictProduction(800, 25, 0, 13, makeContext())
    const cloudy = predictProduction(800, 25, 80, 13, makeContext())
    expect(cloudy).toBeLessThan(clear)
  })

  it('no supera la capacidad máxima del sistema', () => {
    const prod = predictProduction(5000, 25, 0, 13, makeContext(50))
    expect(prod).toBeLessThanOrEqual(50)
  })

  it('producción al mediodía > producción a las 8h (factor horario)', () => {
    const noon = predictProduction(600, 25, 10, 13, makeContext())
    const morning = predictProduction(600, 25, 10, 8, makeContext())
    expect(noon).toBeGreaterThan(morning)
  })

  it('retorna valor no negativo siempre', () => {
    expect(predictProduction(0, 50, 100, 13, makeContext())).toBeGreaterThanOrEqual(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// applyBlackoutAdjustments
// ─────────────────────────────────────────────────────────────────
describe('applyBlackoutAdjustments', () => {
  it('devuelve predicciones sin cambios si no hay apagones', () => {
    const predictions = [makePrediction()]
    const result = applyBlackoutAdjustments(predictions, [])
    expect(result).toEqual(predictions)
  })

  it('reduce producción al 85 % durante un apagón', () => {
    // Predicción dentro del apagón (11:00 UTC)
    const prediction = makePrediction({
      timestamp: '2024-06-15T11:00:00+00:00',
      hour: 11,
      expectedProduction: 20,
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].expectedProduction).toBeCloseTo(17, 1) // 20 × 0.85
  })

  it('reduce consumo al 60 % durante un apagón', () => {
    const prediction = makePrediction({
      timestamp: '2024-06-15T11:00:00+00:00',
      hour: 11,
      expectedConsumption: 30,
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].expectedConsumption).toBeCloseTo(18, 1) // 30 × 0.60
  })

  it('penaliza la confianza en -12 puntos durante apagón', () => {
    const prediction = makePrediction({
      timestamp: '2024-06-15T11:00:00+00:00',
      hour: 11,
      confidence: 85,
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].confidence).toBe(73) // 85 - 12
  })

  it('no modifica predicciones fuera del intervalo del apagón', () => {
    const prediction = makePrediction({
      timestamp: '2024-06-15T08:00:00+00:00',
      hour: 8,
      expectedProduction: 25,
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].expectedProduction).toBe(25)
    expect(result[0].blackoutImpact).toBeUndefined()
  })

  it('adjunta blackoutImpact a predicciones afectadas', () => {
    const prediction = makePrediction({
      timestamp: '2024-06-15T11:00:00+00:00',
      hour: 11,
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].blackoutImpact).toBeDefined()
    expect(result[0].blackoutImpact!.loadFactor).toBe(0.6)
    expect(result[0].blackoutImpact!.productionFactor).toBe(0.85)
  })

  it('la confianza no baja de 40 (límite mínimo)', () => {
    const prediction = makePrediction({
      timestamp: '2024-06-15T11:00:00+00:00',
      hour: 11,
      confidence: 50, // 50 - 12 = 38 → debe ser 40
    })
    const result = applyBlackoutAdjustments([prediction], [makeBlackout()])
    expect(result[0].confidence).toBe(40)
  })
})

// ─────────────────────────────────────────────────────────────────
// generateAlerts
// ─────────────────────────────────────────────────────────────────
describe('generateAlerts', () => {
  it('genera alerta de batería baja cuando proyección mínima < 20 %', () => {
    const battery = makeBattery({ chargeLevel: 50, projectedMinLevel: 15 })
    const alerts = generateAlerts([], battery, [makeForecast()])
    const ids = alerts.map((a) => a.id)
    expect(ids).toContain('battery-low')
  })

  it('genera alerta crítica cuando proyección mínima < 10 %', () => {
    const battery = makeBattery({ chargeLevel: 50, projectedMinLevel: 8 })
    const alerts = generateAlerts([], battery, [makeForecast()])
    const ids = alerts.map((a) => a.id)
    expect(ids).toContain('battery-critical')
  })

  it('genera alerta de alta producción cuando forecast > 350 kWh', () => {
    const battery = makeBattery({ projectedMinLevel: 80 })
    const forecast = makeForecast({ predictedProduction: 400 })
    const alerts = generateAlerts([], battery, [forecast])
    const ids = alerts.map((a) => a.id)
    expect(ids).toContain('high-production-forecast')
  })

  it('no genera alertas cuando el sistema opera normalmente', () => {
    const battery = makeBattery({ chargeLevel: 80, projectedMinLevel: 70 })
    const forecast = makeForecast({ predictedProduction: 300 })
    const predictions = [makePrediction({ expectedProduction: 30, expectedConsumption: 20 })]
    const alerts = generateAlerts(predictions, battery, [forecast])
    // Sin alertas críticas ni battery-low
    expect(alerts.find((a) => a.type === 'critical')).toBeUndefined()
    expect(alerts.find((a) => a.id === 'battery-low')).toBeUndefined()
  })

  it('retorna array (puede estar vacío)', () => {
    const battery = makeBattery({ chargeLevel: 90, projectedMinLevel: 85 })
    const result = generateAlerts([], battery, [])
    expect(Array.isArray(result)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────
// generateHourlyPredictions
// ─────────────────────────────────────────────────────────────────
describe('generateHourlyPredictions', () => {
  const config: SystemConfig = {
    solar: {
      capacityKw: 50,
      panelCount: 100,
      panelRatedKw: 0.5,
      panelEfficiencyPercent: 20,
      panelAreaM2: 2.5,
    },
    battery: { capacityKwh: 100 },
    location: { lat: 23.1136, lon: -82.3666, timezone: 'America/Havana' },
  } as unknown as SystemConfig

  it('genera exactamente 24 predicciones', () => {
    const result = generateHourlyPredictions([makeForecast(), makeForecast()], config)
    expect(result.length).toBe(24)
  })

  it('cada predicción tiene todos los campos requeridos', () => {
    const result = generateHourlyPredictions([makeForecast()], config)
    const p = result[0]
    expect(p).toHaveProperty('timestamp')
    expect(p).toHaveProperty('hour')
    expect(p).toHaveProperty('expectedProduction')
    expect(p).toHaveProperty('expectedConsumption')
    expect(p).toHaveProperty('confidence')
  })

  it('todas las producciones son no-negativas', () => {
    const result = generateHourlyPredictions([makeForecast()], config)
    result.forEach((p) => expect(p.expectedProduction).toBeGreaterThanOrEqual(0))
  })

  it('todos los consumos son positivos', () => {
    const result = generateHourlyPredictions([makeForecast()], config)
    result.forEach((p) => expect(p.expectedConsumption).toBeGreaterThan(0))
  })

  it('la confianza está en el rango [50, 95]', () => {
    const result = generateHourlyPredictions([makeForecast()], config)
    result.forEach((p) => {
      expect(p.confidence).toBeGreaterThanOrEqual(50)
      expect(p.confidence).toBeLessThanOrEqual(95)
    })
  })
})
