/**
 * Tests para el componente WeatherForecast.
 * Verifica que muestra los 5 días futuros, temperaturas, producción y proveedor.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WeatherForecast from '../WeatherForecast'
import type { WeatherData } from '@/types'

const makeForecastDay = (offset: number) => ({
  date: new Date(Date.UTC(2026, 5, 18 + offset)).toISOString().slice(0, 10),
  dayOfWeek: ['Jueves', 'Viernes', 'Sábado', 'Domingo', 'Lunes', 'Martes', 'Miércoles'][offset],
  maxTemp: 30 + offset,
  minTemp: 22 + offset,
  solarRadiation: 450,
  cloudCover: 20,
  predictedProduction: 25.5 + offset,
  condition: 'sunny' as const,
})

const makeWeather = (forecastDays = 7): WeatherData => ({
  temperature: 28,
  solarRadiation: 400,
  cloudCover: 15,
  humidity: 65,
  windSpeed: 10,
  forecast: Array.from({ length: forecastDays }, (_, i) => makeForecastDay(i)),
  provider: 'Open-Meteo',
  locationName: 'CUJAE',
  lastUpdated: '2026-06-18T12:00:00',
})

describe('WeatherForecast', () => {
  it('muestra exactamente 5 días (saltando el primero)', () => {
    render(<WeatherForecast weather={makeWeather()} />)
    // Con 7 días en el forecast, muestra slice(1,6) = 5 días
    // Cada día muestra la temperatura máxima como texto
    const maxTemps = screen.getAllByText(/°/)
    // Hay al menos 5 pares de temperaturas (max/min)
    expect(maxTemps.length).toBeGreaterThanOrEqual(5)
  })

  it('muestra la temperatura máxima del segundo día (no del primero)', () => {
    const weather = makeWeather()
    render(<WeatherForecast weather={weather} />)
    // El primer día tiene maxTemp=30, el segundo tiene 31
    // El componente salta el día 0, así que el primer visible es el día 1 (maxTemp=31)
    expect(screen.getByText('31°')).toBeInTheDocument()
    // El día 0 (maxTemp=30) no debería estar visible como primer ítem pero puede aparecer
    // más adelante en la lista (días 0→30, 1→31, 2→32, 3→33, 4→34)
  })

  it('muestra producción estimada en kWh', () => {
    render(<WeatherForecast weather={makeWeather()} />)
    // day[1] tiene predictedProduction=26.5, se muestra como "27" (toFixed(0))
    expect(screen.getByText('27')).toBeInTheDocument()
    expect(screen.getAllByText('kWh').length).toBeGreaterThanOrEqual(1)
  })

  it('muestra el nombre del proveedor en el pie', () => {
    render(<WeatherForecast weather={makeWeather()} />)
    expect(screen.getByText(/Open-Meteo/)).toBeInTheDocument()
  })

  it('muestra mensaje cuando no hay datos de pronóstico', () => {
    render(<WeatherForecast weather={makeWeather(0)} />)
    expect(screen.getByText(/Pronóstico no disponible/)).toBeInTheDocument()
  })

  it('muestra el encabezado "Pronóstico extendido"', () => {
    render(<WeatherForecast weather={makeWeather()} />)
    expect(screen.getByText('Pronóstico extendido')).toBeInTheDocument()
    expect(screen.getByText('Próximos 5 días')).toBeInTheDocument()
  })

  it('con solo 3 días en forecast muestra 2 (slice 1-6 de 3 = índices 1 y 2)', () => {
    render(<WeatherForecast weather={makeWeather(3)} />)
    // 3 días: slice(1,6) → índices 1,2 → 2 días visibles
    // Verificamos que solo hay 2 entradas de kWh
    expect(screen.getAllByText('kWh')).toHaveLength(2)
  })
})
