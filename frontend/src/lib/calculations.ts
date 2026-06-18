import { SolarData, SystemMetrics, EnergyFlow } from '@/types';

/**
 * Calculate comprehensive system metrics from solar data
 */
export function calculateSystemMetrics(
  currentData: SolarData,
  historicalData: SolarData[]
): SystemMetrics {
  const { production, consumption, efficiency } = currentData;

  // Calculate energy balance (positive = surplus, negative = deficit)
  const energyBalance = production - consumption;

  // Calculate daily totals (sum of last 24 hours)
  const dailyProduction = historicalData.reduce((sum, d) => sum + d.production, 0);
  const dailyConsumption = historicalData.reduce((sum, d) => sum + d.consumption, 0);

  // Calculate CO2 avoided (assuming 0.5 kg CO2 per kWh from grid)
  const co2PerKwh = 0.5; // kg CO2 per kWh
  const co2Avoided = dailyProduction * co2PerKwh;

  return {
    currentProduction: Math.round(production * 100) / 100,
    currentConsumption: Math.round(consumption * 100) / 100,
    energyBalance: Math.round(energyBalance * 100) / 100,
    systemEfficiency: Math.round(efficiency * 100) / 100,
    dailyProduction: Math.round(dailyProduction * 100) / 100,
    dailyConsumption: Math.round(dailyConsumption * 100) / 100,
    co2Avoided: Math.round(co2Avoided * 100) / 100,
  };
}

/**
 * Calculate energy flow distribution
 * Determines how energy flows between solar, battery, load, and grid
 */
export function calculateEnergyFlow(
  production: number,
  consumption: number,
  batteryCharging: boolean,
  batteryPowerFlow: number
): EnergyFlow {
  let solarToBattery = 0;
  let solarToLoad = 0;
  let solarToGrid = 0;
  let batteryToLoad = 0;
  let gridToLoad = 0;

  const surplus = production - consumption;

  if (surplus > 0) {
    // Solar production exceeds consumption
    solarToLoad = consumption;

    if (batteryCharging && batteryPowerFlow > 0) {
      // Charge battery with surplus
      solarToBattery = Math.min(surplus, Math.abs(batteryPowerFlow));
      // Export remaining to grid
      solarToGrid = surplus - solarToBattery;
    } else {
      // Export all surplus to grid
      solarToGrid = surplus;
    }
  } else {
    // Consumption exceeds production
    solarToLoad = production;
    const deficit = Math.abs(surplus);

    if (!batteryCharging && batteryPowerFlow < 0) {
      // Discharge battery to cover deficit
      batteryToLoad = Math.min(deficit, Math.abs(batteryPowerFlow));
      // Import remaining from grid
      gridToLoad = deficit - batteryToLoad;
    } else {
      // Import all deficit from grid
      gridToLoad = deficit;
    }
  }

  return {
    solarToBattery: Math.round(solarToBattery * 100) / 100,
    solarToLoad: Math.round(solarToLoad * 100) / 100,
    solarToGrid: Math.round(solarToGrid * 100) / 100,
    batteryToLoad: Math.round(batteryToLoad * 100) / 100,
    gridToLoad: Math.round(gridToLoad * 100) / 100,
  };
}

/**
 * Calculate system efficiency based on multiple factors
 */
export function calculateEfficiency(
  actualProduction: number,
  theoreticalProduction: number,
  temperature: number,
  age: number = 0 // years
): number {
  // Base efficiency ratio
  const baseEfficiency = (actualProduction / theoreticalProduction) * 100;

  // Temperature coefficient: -0.4% per degree above 25°C
  const tempReference = 25; // °C
  const tempCoefficient = -0.4; // % per °C
  const tempLoss = Math.max(0, (temperature - tempReference) * tempCoefficient);

  // Age degradation: -0.5% per year
  const ageDegradation = age * 0.5;

  // Calculate final efficiency
  const efficiency = baseEfficiency - tempLoss - ageDegradation;

  return Math.max(0, Math.min(100, efficiency));
}

/**
 * Calculate theoretical maximum production based on solar radiation
 */
export function calculateTheoreticalProduction(
  solarRadiation: number,    // W/m²
  panelArea: number,         // m²
  panelEfficiency: number = 0.20 // 20% typical for modern panels
): number {
  // Power (kW) = Radiation (W/m²) × Area (m²) × Efficiency / 1000
  const power = (solarRadiation * panelArea * panelEfficiency) / 1000;
  return Math.round(power * 100) / 100;
}

/**
 * Calculate return on investment metrics
 */
export function calculateROI(
  dailyProduction: number,      // kWh
  electricityPrice: number = 0.15, // USD per kWh
  systemCost: number = 30000,   // USD total system cost
  annualMaintenance: number = 500 // USD per year
): {
  dailySavings: number;
  annualSavings: number;
  paybackYears: number;
  roi25Years: number;
} {
  const dailySavings = dailyProduction * electricityPrice;
  const annualSavings = dailySavings * 365;
  const netAnnualSavings = annualSavings - annualMaintenance;
  const paybackYears = systemCost / netAnnualSavings;
  const roi25Years = ((netAnnualSavings * 25 - systemCost) / systemCost) * 100;

  return {
    dailySavings: Math.round(dailySavings * 100) / 100,
    annualSavings: Math.round(annualSavings * 100) / 100,
    paybackYears: Math.round(paybackYears * 10) / 10,
    roi25Years: Math.round(roi25Years * 10) / 10,
  };
}

/**
 * Calculate optimal battery charge/discharge strategy
 */
export function calculateBatteryStrategy(
  currentLevel: number,       // % current charge
  production: number,         // kW current production
  consumption: number,        // kW current consumption
  predictedProduction: number, // kW predicted next hour
  predictedConsumption: number // kW predicted next hour
): {
  action: 'charge' | 'discharge' | 'hold';
  power: number; // kW
  reason: string;
} {
  const surplus = production - consumption;
  const predictedSurplus = predictedProduction - predictedConsumption;

  // Critical low battery
  if (currentLevel < 20 && surplus > 0) {
    return {
      action: 'charge',
      power: Math.abs(surplus),
      reason: 'Batería crítica - carga prioritaria',
    };
  }

  // Battery full
  if (currentLevel > 95) {
    return {
      action: 'hold',
      power: 0,
      reason: 'Batería completa',
    };
  }

  // Surplus available - charge battery
  if (surplus > 0 && currentLevel < 90) {
    return {
      action: 'charge',
      power: Math.abs(surplus) * 0.8, // 80% of surplus
      reason: 'Excedente solar disponible',
    };
  }

  // Deficit and battery available - discharge
  if (surplus < 0 && currentLevel > 30) {
    return {
      action: 'discharge',
      power: Math.min(Math.abs(surplus), currentLevel * 0.5),
      reason: 'Suplir déficit de consumo',
    };
  }

  // Predicted deficit - save battery
  if (predictedSurplus < 0 && currentLevel < 60) {
    return {
      action: 'hold',
      power: 0,
      reason: 'Reservar para déficit predicho',
    };
  }

  return {
    action: 'hold',
    power: 0,
    reason: 'Operación normal',
  };
}

/**
 * Calculate performance ratio (PR) - industry standard metric
 */
export function calculatePerformanceRatio(
  actualEnergy: number,      // kWh actual production
  theoreticalEnergy: number  // kWh theoretical at STC
): number {
  if (theoreticalEnergy === 0) return 0;
  const pr = (actualEnergy / theoreticalEnergy) * 100;
  return Math.round(pr * 100) / 100;
}
