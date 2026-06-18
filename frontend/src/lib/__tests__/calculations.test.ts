import { describe, it, expect } from 'vitest'
import type { SolarData } from '@/types'
import {
  calculateSystemMetrics,
  calculateEnergyFlow,
  calculateEfficiency,
  calculateTheoreticalProduction,
  calculateROI,
  calculateBatteryStrategy,
  calculatePerformanceRatio,
} from '../calculations'

// Helper: construye un SolarData mínimo para tests (solo los campos que usan las funciones)
const sd = (production: number, consumption: number, efficiency = 80) =>
  ({ production, consumption, efficiency }) as unknown as SolarData

// ─────────────────────────────────────────────────────────────────
// calculateSystemMetrics
// ─────────────────────────────────────────────────────────────────
describe('calculateSystemMetrics', () => {
  it('calcula balance energético positivo cuando producción > consumo', () => {
    const result = calculateSystemMetrics(sd(30, 20), [])
    expect(result.energyBalance).toBe(10)
  })

  it('calcula balance energético negativo cuando consumo > producción', () => {
    const result = calculateSystemMetrics(sd(10, 25, 70), [])
    expect(result.energyBalance).toBe(-15)
  })

  it('suma correctamente producción y consumo diario del historial', () => {
    const history = [sd(10, 8), sd(20, 15), sd(15, 12)]
    const result = calculateSystemMetrics(sd(20, 15), history)
    expect(result.dailyProduction).toBe(45)
    expect(result.dailyConsumption).toBe(35)
  })

  it('calcula CO₂ evitado a razón de 0.5 kg/kWh', () => {
    const result = calculateSystemMetrics(sd(0, 0, 0), [sd(100, 80)])
    expect(result.co2Avoided).toBe(50)
  })

  it('retorna CO₂ = 0 sin historial', () => {
    const result = calculateSystemMetrics(sd(20, 15), [])
    expect(result.co2Avoided).toBe(0)
  })

  it('redondea valores a 2 decimales', () => {
    const result = calculateSystemMetrics(sd(10.333, 7.666), [])
    expect(result.currentProduction).toBe(10.33)
    expect(result.currentConsumption).toBe(7.67)
    // energyBalance = 10.333 - 7.666 = 2.667 → 2.67
    expect(result.energyBalance).toBe(2.67)
  })

  it('propaga eficiencia del punto actual', () => {
    const result = calculateSystemMetrics(sd(20, 15, 92), [])
    expect(result.systemEfficiency).toBe(92)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculateEnergyFlow
// ─────────────────────────────────────────────────────────────────
describe('calculateEnergyFlow', () => {
  it('dirige toda la solar al consumo cuando producción = consumo', () => {
    const flow = calculateEnergyFlow(20, 20, false, 0)
    expect(flow.solarToLoad).toBe(20)
    expect(flow.solarToBattery).toBe(0)
    expect(flow.solarToGrid).toBe(0)
    expect(flow.batteryToLoad).toBe(0)
    expect(flow.gridToLoad).toBe(0)
  })

  it('carga batería con excedente solar (surplus > batteryPower)', () => {
    // Surplus=10, batteryPowerFlow=8 → solarToBattery=min(10,8)=8, solarToGrid=2
    const flow = calculateEnergyFlow(30, 20, true, 8)
    expect(flow.solarToLoad).toBe(20)
    expect(flow.solarToBattery).toBe(8)
    expect(flow.solarToGrid).toBe(2)
    expect(flow.batteryToLoad).toBe(0)
    expect(flow.gridToLoad).toBe(0)
  })

  it('exporta todo el excedente a la red cuando batería no está cargando', () => {
    const flow = calculateEnergyFlow(30, 20, false, 0)
    expect(flow.solarToGrid).toBe(10)
    expect(flow.solarToBattery).toBe(0)
  })

  it('descarga batería para cubrir déficit parcialmente', () => {
    // Deficit=15, batteryPowerFlow=-12 → batteryToLoad=min(15,12)=12, gridToLoad=3
    const flow = calculateEnergyFlow(10, 25, false, -12)
    expect(flow.solarToLoad).toBe(10)
    expect(flow.batteryToLoad).toBe(12)
    expect(flow.gridToLoad).toBe(3)
  })

  it('importa todo el déficit de la red cuando batería está cargando', () => {
    const flow = calculateEnergyFlow(10, 25, true, 5)
    expect(flow.solarToLoad).toBe(10)
    expect(flow.gridToLoad).toBe(15)
    expect(flow.batteryToLoad).toBe(0)
  })

  it('dependencia total de la red cuando producción = 0', () => {
    const flow = calculateEnergyFlow(0, 30, false, 0)
    expect(flow.solarToLoad).toBe(0)
    expect(flow.gridToLoad).toBe(30)
  })

  it('todos los flujos son no-negativos', () => {
    const flow = calculateEnergyFlow(15, 40, false, -20)
    expect(flow.solarToLoad).toBeGreaterThanOrEqual(0)
    expect(flow.batteryToLoad).toBeGreaterThanOrEqual(0)
    expect(flow.gridToLoad).toBeGreaterThanOrEqual(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculateEfficiency
// ─────────────────────────────────────────────────────────────────
describe('calculateEfficiency', () => {
  it('retorna eficiencia base a 25 °C sin degradación por edad', () => {
    expect(calculateEfficiency(80, 100, 25, 0)).toBe(80)
  })

  it('aplica degradación por edad: 0.5 % por año (10 años = -5 %)', () => {
    expect(calculateEfficiency(100, 100, 25, 10)).toBe(95)
  })

  it('aplica degradación por edad: 0.5 % por año (1 año = -0.5 %)', () => {
    expect(calculateEfficiency(100, 100, 25, 1)).toBeCloseTo(99.5, 5)
  })

  it('nunca retorna por debajo de 0', () => {
    expect(calculateEfficiency(0, 100, 25, 50)).toBe(0)
  })

  it('nunca retorna por encima de 100', () => {
    expect(calculateEfficiency(1000, 1, 25, 0)).toBeLessThanOrEqual(100)
  })

  it('eficiencia base = 0 cuando producción actual = 0', () => {
    expect(calculateEfficiency(0, 100, 25, 0)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculateTheoreticalProduction
// ─────────────────────────────────────────────────────────────────
describe('calculateTheoreticalProduction', () => {
  it('calcula correctamente: 1000 W/m² × 50 m² × 0.20 / 1000 = 10 kW', () => {
    expect(calculateTheoreticalProduction(1000, 50, 0.20)).toBe(10)
  })

  it('usa eficiencia por defecto 20 % cuando no se especifica', () => {
    expect(calculateTheoreticalProduction(1000, 50)).toBe(10)
  })

  it('retorna 0 con radiación nula (noche)', () => {
    expect(calculateTheoreticalProduction(0, 100, 0.20)).toBe(0)
  })

  it('escala linealmente con el área del panel', () => {
    const half = calculateTheoreticalProduction(800, 25, 0.20)
    const full = calculateTheoreticalProduction(800, 50, 0.20)
    expect(full).toBeCloseTo(half * 2, 5)
  })

  it('escala linealmente con la eficiencia', () => {
    const low = calculateTheoreticalProduction(1000, 50, 0.10)
    const high = calculateTheoreticalProduction(1000, 50, 0.20)
    expect(high).toBeCloseTo(low * 2, 5)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculateROI
// ─────────────────────────────────────────────────────────────────
describe('calculateROI', () => {
  it('calcula ahorro diario: producción × precio', () => {
    const roi = calculateROI(200, 0.15, 30000, 500)
    expect(roi.dailySavings).toBe(30)
  })

  it('calcula ahorro anual: ahorro diario × 365', () => {
    const roi = calculateROI(200, 0.15, 30000, 500)
    expect(roi.annualSavings).toBe(10950)
  })

  it('mayor producción reduce el período de retorno', () => {
    const low = calculateROI(100, 0.15, 30000, 500)
    const high = calculateROI(300, 0.15, 30000, 500)
    expect(high.paybackYears).toBeLessThan(low.paybackYears)
  })

  it('usa valores por defecto cuando no se especifican', () => {
    const roi = calculateROI(200)
    expect(roi.dailySavings).toBe(30)     // 200 × 0.15
    expect(roi.annualSavings).toBe(10950)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculateBatteryStrategy
// ─────────────────────────────────────────────────────────────────
describe('calculateBatteryStrategy', () => {
  it('carga cuando hay excedente solar y batería < 90 %', () => {
    // surplus = 30-20 = 10 > 0, level=50 < 90
    const s = calculateBatteryStrategy(50, 30, 20, 25, 18)
    expect(s.action).toBe('charge')
    expect(s.power).toBeGreaterThan(0)
  })

  it('descarga cuando hay déficit y batería > 30 %', () => {
    // surplus = 10-30 = -20 < 0, level=60 > 30
    const s = calculateBatteryStrategy(60, 10, 30, 12, 28)
    expect(s.action).toBe('discharge')
    expect(s.power).toBeGreaterThan(0)
  })

  it('mantiene (hold) cuando batería está llena (> 95 %)', () => {
    const s = calculateBatteryStrategy(96, 30, 20, 25, 18)
    expect(s.action).toBe('hold')
    expect(s.power).toBe(0)
  })

  it('carga con prioridad crítica cuando batería < 20 % y hay excedente', () => {
    const s = calculateBatteryStrategy(15, 25, 10, 20, 15)
    expect(s.action).toBe('charge')
  })

  it('hold cuando batería baja < 30 % y hay déficit (no puede descargar)', () => {
    // level=25 ≤ 30, surplus=-20 → discharge condition fails → hold
    const s = calculateBatteryStrategy(25, 10, 30, 8, 25)
    expect(s.action).toBe('hold')
    expect(s.power).toBe(0)
  })

  it('retorna razón como string no vacío', () => {
    const s = calculateBatteryStrategy(50, 30, 20, 25, 18)
    expect(typeof s.reason).toBe('string')
    expect(s.reason.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// calculatePerformanceRatio
// ─────────────────────────────────────────────────────────────────
describe('calculatePerformanceRatio', () => {
  it('retorna 0 cuando producción teórica es 0 (evita división por cero)', () => {
    expect(calculatePerformanceRatio(100, 0)).toBe(0)
  })

  it('retorna 100 cuando producción real = producción teórica', () => {
    expect(calculatePerformanceRatio(50, 50)).toBe(100)
  })

  it('retorna < 100 cuando producción real < teórica', () => {
    expect(calculatePerformanceRatio(80, 100)).toBe(80)
  })

  it('redondea a 2 decimales', () => {
    expect(calculatePerformanceRatio(1, 3)).toBe(33.33)
  })

  it('puede superar 100 % (sobreproducción)', () => {
    expect(calculatePerformanceRatio(110, 100)).toBe(110)
  })
})
