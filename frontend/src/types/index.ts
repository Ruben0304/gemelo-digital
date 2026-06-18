// Core data types for Solar Digital Twin

export interface SolarData {
  timestamp: string;
  production: number;      // kW - Current solar production
  consumption: number;     // kW - Current consumption
  batteryLevel: number;    // % - Battery charge level (0-100)
  gridExport: number;      // kW - Power exported to grid
  gridImport: number;      // kW - Power imported from grid
  efficiency: number;      // % - System efficiency
  batteryDelta?: number;   // kW - Positive = charging, Negative = discharging (optional projections)
}

export interface WeatherData {
  temperature: number;     // °C - Current temperature
  solarRadiation: number;  // W/m² - Solar irradiance
  cloudCover: number;      // % - Cloud coverage (0-100)
  humidity: number;        // % - Relative humidity
  windSpeed: number;       // km/h - Wind speed
  forecast: DayForecast[]; // 7-day forecast
  provider?: string;       // Data provider description
  locationName?: string;   // Friendly location name
  lastUpdated?: string;    // ISO string for data timestamp
  description?: string;    // Textual weather summary
}

export interface DayForecast {
  date: string;            // ISO date string
  dayOfWeek: string;       // e.g., "Lunes", "Martes"
  maxTemp: number;         // °C - Maximum temperature
  minTemp: number;         // °C - Minimum temperature
  solarRadiation: number;  // W/m² - Average solar irradiance
  cloudCover: number;      // % - Average cloud coverage
  predictedProduction: number; // kWh - Predicted daily production
  condition: WeatherCondition;
}

export type WeatherCondition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy';

export interface BatteryStatus {
  chargeLevel: number;     // % - Current charge (0-100)
  capacity: number;        // kWh - Total battery capacity
  current: number;         // kWh - Current stored energy
  autonomyHours: number;   // Hours - Estimated autonomy time
  charging: boolean;       // Is battery currently charging
  powerFlow: number;       // kW - Positive = charging, Negative = discharging
  projectedMinLevel?: number; // % - Minimum projected level (optional)
  projectedMaxLevel?: number; // % - Maximum projected level (optional)
  note?: string;            // Additional context (optional)
}

export interface SystemMetrics {
  currentProduction: number;  // kW
  currentConsumption: number; // kW
  energyBalance: number;      // kW (production - consumption)
  systemEfficiency: number;   // %
  dailyProduction: number;    // kWh - Total produced today
  dailyConsumption: number;   // kWh - Total consumed today
  co2Avoided: number;         // kg - CO2 emissions avoided today
}

export interface EnergyFlow {
  solarToBattery: number;    // kW
  solarToLoad: number;       // kW
  solarToGrid: number;       // kW
  batteryToLoad: number;     // kW
  gridToLoad: number;        // kW
}

export interface Prediction {
  timestamp: string;
  hour: number;
  expectedProduction: number; // kWh
  expectedConsumption: number; // kWh
  confidence: number;        // % - Prediction confidence
  blackoutImpact?: BlackoutImpact;
}

export interface Alert {
  id: string;
  type: 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  timestamp: string;
}

// Configuration for the microgrid system
export interface SolarPanelConfig {
  _id?: string;
  manufacturer: string;
  model?: string;
  ratedPowerKw: number;         // kW por panel
  quantity: number;             // Número total de paneles instalados
  tiltDegrees?: number;         // Ángulo de inclinación
  orientation?: string;         // Orientación cardinal
  efficiencyPercent?: number;   // Eficiencia del módulo (%)
  areaM2?: number;              // Área del módulo (m²)
  createdAt?: string;
  updatedAt?: string;
}

export interface BatteryConfig {
  _id?: string;
  manufacturer: string;
  model?: string;
  capacityKwh: number;          // Capacidad por módulo
  quantity: number;             // Número de módulos instalados
  maxDepthOfDischargePercent?: number; // Profundidad de descarga máxima permitida (%)
  chargeRateKw?: number;        // Tasa máxima de carga (kW)
  dischargeRateKw?: number;     // Tasa máxima de descarga (kW)
  efficiencyPercent?: number;   // Eficiencia round-trip (%)
  createdAt?: string;
  updatedAt?: string;
}

export interface InverterConfig {
  _id?: string;
  manufacturer: string;
  model?: string;
  ratedPowerKw: number;         // Potencia nominal del inversor
  quantity: number;             // Número de inversores instalados
  efficiencyPercent?: number;   // Eficiencia de conversión DC/AC
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplianceMode {
  name: string;
  averagePowerW: number;        // Potencia promedio del modo
  maxPowerW?: number;           // Potencia máxima del modo (opcional)
}

export interface ApplianceMeasurementMeta {
  samples: number;
  firstDate?: string | null;
  lastDate?: string | null;
  avgKw: number;
  minKw: number;
  maxKw: number;
  stdKw: number;
  hoursCovered: number;
}

export interface ApplianceConfig {
  _id?: string;
  name: string;
  category?: string;
  averagePowerW: number;        // Potencia promedio base
  maxPowerW: number;            // Potencia máxima base
  measuredPowerW?: number;      // Potencia medida por inversor (opcional)
  quantity: number;             // Cantidad de equipos iguales
  activeHours?: number;         // Horas de uso planificadas
  selectedModeIndex?: number;   // Índice de modo activo (opcional)
  modes?: ApplianceMode[];      // Modos de consumo opcionales
  alwaysOn?: boolean;           // Permanece encendido salvo desactivación manual
  hourlyProfileKw?: number[];   // 168 valores (7 días x 24 h) generados desde archivo
  measurementMeta?: ApplianceMeasurementMeta | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemConfig {
  location: {
    lat: number;
    lon: number;
    name: string;
  };
  solar: {
    capacityKw: number;          // kW totales instalados
    panelRatedKw: number;        // kW por panel
    panelCount: number;          // Paneles activos
    strings?: number;            // Strings activos
    panelEfficiencyPercent?: number;
    panelAreaM2?: number;
    spec?: SolarPanelConfig | null;
  };
  battery: {
    capacityKwh: number;         // kWh totales instalados
    moduleCapacityKwh?: number;  // kWh por módulo
    moduleCount?: number;        // Módulos activos
    maxDepthOfDischargePercent?: number;
    chargeRateKw?: number;
    dischargeRateKw?: number;
    efficiencyPercent?: number;
    spec?: BatteryConfig | null;
  };
}

export type UserRole = 'admin' | 'user';

export interface User {
  _id?: string;
  email: string;
  name?: string;
  role: UserRole;
  token?: string;           // JWT token for authenticated requests
  createdAt?: string;
  updatedAt?: string;
}

export interface HistoricalReading {
  _id: string;
  timestamp: string;
  production: number;    // kW
  consumption: number;   // kW
  batteryLevel: number;  // %
  gridExport: number;    // kW
  gridImport: number;    // kW
  efficiency: number;    // %
}

export interface DailySummary {
  date: string;
  totalProduction: number;    // kWh
  totalConsumption: number;   // kWh
  avgBatteryLevel: number;    // %
  maxProduction: number;      // kW
  maxConsumption: number;     // kW
  avgEfficiency: number;      // %
  readingCount: number;
}

export interface BlackoutInterval {
  start: string;
  end: string;
  durationMinutes?: number;
}

export interface BlackoutSchedule {
  _id?: string;
  date: string; // ISO date (00:00:00 local)
  intervals: BlackoutInterval[];
  province?: string;
  municipality?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsumptionProfile {
  _id?: string | null;
  name: string;
  weekday: number[];   // 24 kW values, one per hour
  weekend: number[];   // 24 kW values, one per hour
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ConsumptionPrediction {
  datetime: string;
  consumptionKw: number;
  confidence: number;       // 0-1
  confidencePct: number;    // 0-100
  sourceLabel: string;      // e.g. "Perfil de usuario · día laboral · hora 09:00"
  explanation: string;      // why confidence is not 100%
  hour: number;
  isWeekend: boolean;
}

export interface BlackoutImpact {
  intervalStart: string;
  intervalEnd: string;
  loadFactor: number;
  productionFactor: number;
  intensity: 'moderado' | 'severo';
  note?: string;
}
