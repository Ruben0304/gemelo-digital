import {
  Prediction,
  DayForecast,
  Alert,
  BatteryStatus,
  SystemConfig,
} from '@/types';
import { addHours } from 'date-fns';

const DEFAULT_PANEL_EFFICIENCY = 0.2; // 20% efficiency

interface SolarContext {
  capacityKw: number;
  panelEfficiency: number;
  arrayAreaM2: number;
}

function resolveSolarContext(config: SystemConfig): SolarContext {
  const capacityKw = config.solar.capacityKw;
  const panelEfficiency =
    config.solar.panelEfficiencyPercent && config.solar.panelEfficiencyPercent > 0
      ? config.solar.panelEfficiencyPercent / 100
      : DEFAULT_PANEL_EFFICIENCY;

  const panelArea = config.solar.panelAreaM2 && config.solar.panelAreaM2 > 0
    ? config.solar.panelAreaM2
    : (config.solar.panelRatedKw / panelEfficiency);

  const arrayAreaM2 = panelArea * config.solar.panelCount;

  return {
    capacityKw,
    panelEfficiency,
    arrayAreaM2,
  };
}

/**
 * Predict solar production based on weather forecast
 * Formula: Production = Solar Radiation × Panel Area × Efficiency × Correction Factors
 */
export function predictProduction(
  solarRadiation: number,   // W/m²
  temperature: number,      // °C
  cloudCover: number,       // %
  hour: number,             // Hour of day
  context: SolarContext
): number {
  // Base production from solar radiation
  let production = (solarRadiation * context.arrayAreaM2 * context.panelEfficiency) / 1000; // kW

  // Temperature correction: panels lose efficiency when hot
  // Reference temp: 25°C, coefficient: -0.4% per °C
  const tempReference = 25;
  const tempCoefficient = 0.004; // 0.4% per degree
  const tempFactor = 1 - (temperature - tempReference) * tempCoefficient;
  production *= tempFactor;

  // Cloud cover correction: each 10% clouds reduces ~5% production
  const cloudFactor = 1 - (cloudCover / 100) * 0.5;
  production *= cloudFactor;

  // Hour-based adjustment (atmospheric mass, sun angle)
  const hourFactor = getHourEfficiencyFactor(hour);
  production *= hourFactor;

  // Cap at maximum capacity
  production = Math.min(production, context.capacityKw);

  // No production at night
  if (hour < 6 || hour > 20) {
    production = 0;
  }

  return Math.max(0, Math.round(production * 100) / 100);
}

/**
 * Get efficiency factor based on hour of day
 * Accounts for sun angle and atmospheric conditions
 */
function getHourEfficiencyFactor(hour: number): number {
  // Peak efficiency at solar noon (12-14h)
  if (hour >= 12 && hour <= 14) return 1.0;
  if (hour >= 11 && hour <= 15) return 0.95;
  if (hour >= 10 && hour <= 16) return 0.85;
  if (hour >= 8 && hour <= 17) return 0.70;
  if (hour >= 7 && hour <= 18) return 0.50;
  if (hour >= 6 && hour <= 19) return 0.30;
  return 0;
}

/**
 * Generate hourly predictions for next 24 hours
 */
export function generateHourlyPredictions(
  weatherForecast: DayForecast[],
  config: SystemConfig
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date();
  const context = resolveSolarContext(config);
  const fallbackForecast = weatherForecast[0] ?? weatherForecast[weatherForecast.length - 1];

  for (let i = 0; i < 24; i++) {
    const timestamp = addHours(now, i);
    const hour = timestamp.getHours();

    // Use today's or tomorrow's forecast
    const forecastCandidate = i < 12 ? weatherForecast[0] : weatherForecast[1];
    const forecast = forecastCandidate ?? fallbackForecast;
    if (!forecast) {
      continue;
    }

    // Estimate hourly conditions
    const solarRadiation = estimateHourlySolarRadiation(hour, forecast.solarRadiation, forecast.cloudCover);
    const temperature = estimateHourlyTemperature(hour, forecast.maxTemp, forecast.minTemp);

    const production = predictProduction(
      solarRadiation,
      temperature,
      forecast.cloudCover,
      hour,
      context
    );

    // Predict consumption based on typical patterns
    const consumption = predictConsumption(hour);

    // Calculate confidence based on forecast reliability
    const confidence = calculatePredictionConfidence(i, forecast.cloudCover);

    predictions.push({
      timestamp: timestamp.toISOString(),
      hour,
      expectedProduction: Math.round(production * 100) / 100,
      expectedConsumption: Math.round(consumption * 100) / 100,
      confidence: Math.round(confidence),
    });
  }

  return predictions;
}

/**
 * Estimate solar radiation for specific hour based on daily average
 */
function estimateHourlySolarRadiation(
  hour: number,
  dailyAvgRadiation: number,
  cloudCover: number
): number {
  // Gaussian distribution throughout the day
  const peakHour = 13;
  const sigma = 4;
  const gaussian = Math.exp(-Math.pow(hour - peakHour, 2) / (2 * Math.pow(sigma, 2)));

  // Scale daily average by gaussian curve
  let radiation = dailyAvgRadiation * gaussian * 1.8; // 1.8 to reach peak values

  // Apply cloud variability
  const cloudVariability = 1 - (Math.random() * cloudCover / 200);
  radiation *= cloudVariability;

  return Math.max(0, Math.round(radiation));
}

/**
 * Estimate temperature for specific hour
 */
function estimateHourlyTemperature(hour: number, maxTemp: number, minTemp: number): number {
  // Temperature follows sinusoidal pattern
  // Min at 6 AM, Max at 3 PM
  const amplitude = (maxTemp - minTemp) / 2;
  const average = (maxTemp + minTemp) / 2;
  const phase = ((hour - 6) / 24) * 2 * Math.PI;
  const temp = average + amplitude * Math.sin(phase);

  return Math.round(temp * 10) / 10;
}

/**
 * Predict consumption based on hour of day
 */
function predictConsumption(hour: number): number {
  const baseDay = 35;   // kW during day
  const baseNight = 18; // kW at night

  // Peak hours: morning (7-9) and evening (18-22)
  if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) {
    return baseDay * 1.3;
  }
  // Normal day hours
  if (hour >= 6 && hour < 18) {
    return baseDay;
  }
  // Night hours
  return baseNight;
}

/**
 * Calculate prediction confidence
 * Decreases with time and increases with uncertainty
 */
function calculatePredictionConfidence(hoursAhead: number, cloudCover: number): number {
  // Base confidence decreases with time
  let confidence = 95 - (hoursAhead * 2);

  // Cloudy conditions reduce confidence
  const cloudUncertainty = cloudCover / 5; // Max 20% reduction
  confidence -= cloudUncertainty;

  return Math.max(50, Math.min(95, confidence));
}

/**
 * Generate intelligent alerts based on predictions
 */
export function generateAlerts(
  predictions: Prediction[],
  batteryStatus: BatteryStatus,
  weatherForecast: DayForecast[],
): Alert[] {
  const alerts: Alert[] = [];
  const startingLevel = batteryStatus.chargeLevel;
  const projectedMin = batteryStatus.projectedMinLevel ?? startingLevel;

  // Check for low battery
  if (projectedMin < 20) {
    alerts.push({
      id: 'battery-low',
      type: 'warning',
      title: 'Reserva de Batería Limitada',
      message: `Proyección mínima de ${projectedMin.toFixed(1)}% sin telemetría. Considere reducir consumos continuos.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check for very low battery
  if (projectedMin < 10) {
    alerts.push({
      id: 'battery-critical',
      type: 'critical',
      title: 'Reserva Crítica Estimada',
      message: `La proyección indica un mínimo de ${projectedMin.toFixed(1)}%. Asegure respaldo externo.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check for low production forecast tomorrow
  const tomorrow = weatherForecast[1];
  if (tomorrow && tomorrow.predictedProduction < 150) {
    alerts.push({
      id: 'low-production-forecast',
      type: 'warning',
      title: 'Baja Producción Esperada',
      message: `Se espera baja producción mañana (${tomorrow.predictedProduction.toFixed(0)} kWh) debido a ${tomorrow.condition === 'cloudy' ? 'nubosidad' : 'condiciones climáticas'}. Optimice consumo.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check for excellent production forecast
  const todayForecast = weatherForecast[0];
  if (todayForecast && todayForecast.predictedProduction > 350) {
    alerts.push({
      id: 'high-production-forecast',
      type: 'info',
      title: 'Excelente Producción Esperada',
      message: `Se espera alta producción hoy (${todayForecast.predictedProduction.toFixed(0)} kWh). Buen momento para cargas intensivas.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check next 6 hours for production deficit
  const next6Hours = predictions.slice(0, 6);
  const avgDeficit = next6Hours.reduce((sum, p) => {
    const deficit = p.expectedConsumption - p.expectedProduction;
    return sum + (deficit > 0 ? deficit : 0);
  }, 0) / 6;

  if (avgDeficit > 10 && projectedMin < 50) {
    alerts.push({
      id: 'deficit-warning',
      type: 'warning',
      title: 'Déficit Energético Próximo',
      message: `Se espera déficit promedio de ${avgDeficit.toFixed(1)} kW en las próximas 6 horas. Considere reducir consumo no esencial.`,
      timestamp: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * Generate recommendations based on current state and predictions
 */
export function generateRecommendations(
  predictions: Prediction[],
  batteryStatus: BatteryStatus,
  config: SystemConfig,
): string[] {
  const solarCapacity = Math.max(config.solar.capacityKw, 0.0001);
  const recommendations: string[] = [];
  const currentPrediction = predictions[0];
  const currentProduction = currentPrediction?.expectedProduction ?? 0;
  const currentConsumption = currentPrediction?.expectedConsumption ?? 0;
  const batteryLevel = batteryStatus.chargeLevel;
  const projectedMin = batteryStatus.projectedMinLevel ?? batteryLevel;
  const projectedMax = batteryStatus.projectedMaxLevel ?? batteryLevel;

  // Current surplus - recommend charging devices
  if (currentProduction > currentConsumption * 1.2) {
    recommendations.push('Se proyecta excedente solar inmediato. Buen momento para programar cargas intensivas supervisadas.');
  }

  // Low battery with good production coming
  const next3Hours = predictions.slice(0, 3);
  const avgProduction = next3Hours.reduce((sum, p) => sum + p.expectedProduction, 0) / 3;

  if (projectedMin < 40 && avgProduction > 30) {
    recommendations.push('Aunque la reserva es limitada, se espera repunte solar en pocas horas. Posponga consumos pesados hasta después del pico solar.');
  }

  // Peak production hours approaching
  const currentHour = new Date().getHours();
  if (currentHour >= 9 && currentHour <= 11 && projectedMax < 85) {
    recommendations.push('Se aproximan las horas de mayor producción (12-14h). Coordine actividades de alto consumo dentro de esa ventana.');
  }

  // Evening approaching with low battery
  if (currentHour >= 16 && currentHour <= 18 && projectedMin < 50) {
    recommendations.push('La producción solar caerá al atardecer. Asegure carga mínima o reduzca consumos no esenciales esta noche.');
  }

  // Excellent conditions
  if (currentProduction > solarCapacity * 0.8) {
    recommendations.push(`La proyección indica operación cercana al ${((currentProduction / solarCapacity) * 100).toFixed(0)}% de la capacidad instalada. Aproveche para tareas que requieran potencia.`);
  }

  // Poor production day
  const todayPrediction = predictions[0];
  if (todayPrediction && todayPrediction.expectedProduction < solarCapacity * 0.3) {
    recommendations.push('Día de baja producción estimada. Priorice consumos esenciales y considere apoyo de la red para cargas críticas.');
  }

  return recommendations;
}
