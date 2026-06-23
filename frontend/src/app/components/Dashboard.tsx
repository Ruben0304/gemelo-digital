'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import AdminPanel from './AdminPanel';
import { DashboardSkeleton } from './Skeleton';
import SolarProductionChart from './SolarProductionChart';
import BatteryStatus from './BatteryStatus';
import WeatherToday, { LottieAnimationType } from './WeatherToday';
import WeatherForecast from './WeatherForecast';
import PredictionsPanel from './PredictionsPanel';
import FloatingBottomNav from './FloatingBottomNav';
import UserMenu from './UserMenu';
import EstadisticasPanel from './EstadisticasPanel';
import StarsBackground from './StarsBackground';
import SystemDiagram from './SystemDiagram';
import {
  SolarData,
  BatteryStatus as BatteryStatusType,
  SystemMetrics,
  WeatherData,
  Prediction,
  Alert,
  SystemConfig,
  User,
  SolarPanelConfig,
  BatteryConfig,
  InverterConfig,
  ApplianceConfig,
  EnergyFlow,
} from '@/types';
import { ArrowPathIcon, ExclamationTriangleIcon, WifiIcon } from '@heroicons/react/24/outline';
import { executeQuery } from '@/lib/graphql-client';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/systemDefaults';
import { useRouter } from 'next/navigation';

const DASHBOARD_QUERY = `
  query DashboardData {
    solar {
      timestamp
      mode
      current {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      historical {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      battery {
        chargeLevel
        capacity
        current
        autonomyHours
        charging
        powerFlow
        projectedMinLevel
        projectedMaxLevel
        note
      }
      metrics {
        currentProduction
        currentConsumption
        energyBalance
        systemEfficiency
        dailyProduction
        dailyConsumption
        co2Avoided
      }
      energyFlow {
        solarToBattery
        solarToLoad
        solarToGrid
        batteryToLoad
        gridToLoad
      }
      weather {
        temperature
        solarRadiation
        cloudCover
        humidity
        windSpeed
        provider
        locationName
        lastUpdated
        description
        weatherCode
        forecast {
          date
          dayOfWeek
          maxTemp
          minTemp
          solarRadiation
          cloudCover
          predictedProduction
          condition
        }
      }
      config {
        location { lat lon name }
        solar {
          capacityKw
          panelRatedKw
          panelCount
          strings
          panelEfficiencyPercent
          panelAreaM2
          spec {
            _id
            manufacturer
            model
            ratedPowerKw
            quantity
            tiltDegrees
            orientation
            createdAt
            updatedAt
          }
        }
        battery {
          capacityKwh
          moduleCapacityKwh
          moduleCount
          maxDepthOfDischargePercent
          chargeRateKw
          dischargeRateKw
          efficiencyPercent
          spec {
            _id
            manufacturer
            model
            capacityKwh
            quantity
            createdAt
            updatedAt
          }
        }
      }
    }
    weather {
      temperature
      solarRadiation
      cloudCover
      humidity
      windSpeed
      provider
      locationName
      lastUpdated
      description
      forecast {
        date
        dayOfWeek
        maxTemp
        minTemp
        solarRadiation
        cloudCover
        predictedProduction
        condition
      }
    }
    predictions {
      predictions {
        timestamp
        hour
        expectedProduction
        expectedConsumption
        confidence
      }
      alerts {
        id
        type
        title
        message
        timestamp
      }
      recommendations
      battery {
        chargeLevel
        capacity
        current
        autonomyHours
        charging
        powerFlow
        projectedMinLevel
        projectedMaxLevel
        note
      }
      timeline {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      weather {
        temperature
        solarRadiation
        cloudCover
        humidity
        windSpeed
        provider
        locationName
        lastUpdated
        description
        weatherCode
        forecast {
          date
          dayOfWeek
          maxTemp
          minTemp
          solarRadiation
          cloudCover
          predictedProduction
          condition
        }
      }
      timestamp
      config {
        location { lat lon name }
        solar {
          capacityKw
          panelRatedKw
          panelCount
          strings
          panelEfficiencyPercent
          panelAreaM2
        }
        battery {
          capacityKwh
          moduleCapacityKwh
          moduleCount
          maxDepthOfDischargePercent
          chargeRateKw
          dischargeRateKw
          efficiencyPercent
        }
      }
    }
    panels {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      createdAt
      updatedAt
    }
    batteries {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      createdAt
      updatedAt
    }
    inverters {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      createdAt
      updatedAt
    }
    appliances {
      _id
      name
      category
      averagePowerW
      maxPowerW
      measuredPowerW
      quantity
      activeHours
      selectedModeIndex
      modes {
        name
        averagePowerW
        maxPowerW
      }
      createdAt
      updatedAt
    }
  }
`;

type MLPrediction = {
  datetime: string;
  productionKw: number;
  weather: {
    temperature2m: number;
    relativeHumidity2m: number;
    windSpeed10m: number;
    cloudCover: number;
    shortwaveRadiation: number;
  };
};

type DashboardQueryResult = {
  solar: {
    current: SolarData;
    historical: SolarData[];
    battery: BatteryStatusType;
    metrics: SystemMetrics;
    energyFlow: EnergyFlow;
    weather: WeatherData;
    config: SystemConfig;
    timestamp: string;
    mode: string;
  };
  weather: WeatherData;
  predictions: {
    predictions: Prediction[];
    alerts: Alert[];
    recommendations: string[];
    battery: BatteryStatusType;
    timeline: SolarData[];
    weather: WeatherData;
    timestamp: string;
    config: SystemConfig;

  };
  panels: SolarPanelConfig[];
  batteries: BatteryConfig[];
  inverters: InverterConfig[];
  appliances: ApplianceConfig[];
};

type MLPredictionsQueryResult = {
  mlPredictForHours: MLPrediction[];
};

// Query for ML predictions for a specific day
const ML_PREDICTIONS_QUERY = `
  query MLPredictions($date: String!, $hours: [Int!]!) {
    mlPredictForHours(date: $date, hours: $hours) {
      datetime
      productionKw
      weather {
        temperature2m
        relativeHumidity2m
        windSpeed10m
        cloudCover
        shortwaveRadiation
      }
    }
  }
`;

const APPLIANCES_FORECAST_QUERY = `
  query AppliancesForecast($hours: Int!, $start: String) {
    appliancesConsumptionForecast(hours: $hours, start: $start) {
      totalConsumptionKw
      appliancesWithProfile
      appliancesAlwaysOn
      points {
        datetime
        consumptionKw
      }
    }
  }
`;

const SOLAR_MODEL_INFO_QUERY = `
  query SolarModelInfo {
    mlModelInfo {
      loaded
      testR2
    }
  }
`;

const DEMO_DATA: DashboardQueryResult = {
  solar: {
    current: {
      timestamp: new Date().toISOString(),
      production: 3.5,
      consumption: 1.2,
      batteryLevel: 75,
      gridExport: 2.3,
      gridImport: 0,
      efficiency: 90,
      batteryDelta: 0,
    },
    historical: [],
    battery: {
      chargeLevel: 75,
      capacity: 10,
      current: 0,
      autonomyHours: 5,
      charging: false,
      powerFlow: 0,
      projectedMinLevel: 20,
      projectedMaxLevel: 90,
      note: 'Simulación',
    },
    metrics: {
      currentProduction: 3.5,
      currentConsumption: 1.2,
      energyBalance: 2.3,
      systemEfficiency: 90,
      dailyProduction: 20,
      dailyConsumption: 10,
      co2Avoided: 10,
    },
    energyFlow: {
      solarToBattery: 0,
      solarToLoad: 1.2,
      solarToGrid: 2.3,
      batteryToLoad: 0,
      gridToLoad: 0,
    },
    weather: {
      temperature: 26,
      solarRadiation: 800,
      cloudCover: 10,
      humidity: 60,
      windSpeed: 15,
      provider: 'Datos Demo',
      locationName: 'Ubicación Demo',
      lastUpdated: new Date().toISOString(),
      description: 'Soleado (Demo)',
      forecast: [],
    },
    config: DEFAULT_SYSTEM_CONFIG,
    timestamp: new Date().toISOString(),
    mode: 'demo',
  },
  weather: {
    temperature: 26,
    solarRadiation: 800,
    cloudCover: 10,
    humidity: 60,
    windSpeed: 15,
    provider: 'Datos Demo',
    locationName: 'Ubicación Demo',
    lastUpdated: new Date().toISOString(),
    description: 'Soleado (Demo)',
    forecast: [],
  },
  predictions: {
    predictions: [],
    alerts: [],
    recommendations: [],
    battery: {
      chargeLevel: 75,
      capacity: 10,
      current: 0,
      autonomyHours: 5,
      charging: false,
      powerFlow: 0,
      projectedMinLevel: 20,
      projectedMaxLevel: 90,
      note: 'Simulación',
    },
    timeline: [],
    weather: {
      temperature: 26,
      solarRadiation: 800,
      cloudCover: 10,
      humidity: 60,
      windSpeed: 15,
      provider: 'Datos Demo',
      locationName: 'Ubicación Demo',
      lastUpdated: new Date().toISOString(),
      description: 'Soleado (Demo)',
      forecast: [],
    },
    timestamp: new Date().toISOString(),
    config: DEFAULT_SYSTEM_CONFIG,
  },
  panels: [],
  batteries: [],
  inverters: [],
  appliances: [],
};

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Helper function to predict consumption based on hour (matching backend logic)
function predictConsumption(hour: number): number {
  const baseDay = 35;
  const baseNight = 18;
  if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) {
    return baseDay * 1.3;
  }
  if (hour >= 6 && hour < 18) {
    return baseDay;
  }
  return baseNight;
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

type AppliancesForecastResult = {
  appliancesConsumptionForecast: {
    totalConsumptionKw: number;
    appliancesWithProfile: number;
    appliancesAlwaysOn: number;
    points: { datetime: string; consumptionKw: number }[];
  };
};

function buildHourKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

// Transform ML predictions to SolarData format
function transformMLPredictionsToSolarData(
  mlPredictions: MLPrediction[],
  applianceForecast: { datetime: string; consumptionKw: number }[] = []
): SolarData[] {
  const applianceMap = applianceForecast.reduce<Map<string, number>>((map, entry) => {
    if (!entry?.datetime) return map;
    map.set(buildHourKey(entry.datetime), entry.consumptionKw);
    return map;
  }, new Map());

  return mlPredictions.map((mlPred) => {
    const timestamp = new Date(mlPred.datetime);
    const hour = Number.isNaN(timestamp.getTime()) ? 0 : timestamp.getHours();
    const consumption = applianceMap.get(buildHourKey(mlPred.datetime)) ?? predictConsumption(hour);

    return {
      timestamp: mlPred.datetime,
      production: mlPred.productionKw,
      consumption,
      batteryLevel: 0,
      gridExport: 0,
      gridImport: 0,
      efficiency: 85,
      batteryDelta: 0,
    };
  });
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const router = useRouter();
  const [solarData, setSolarData] = useState<{
    current: SolarData;
    historical: SolarData[];
    battery: BatteryStatusType;
    metrics: SystemMetrics;
    config: SystemConfig;
    energyFlow?: EnergyFlow;
  } | null>(null);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const [predictionsData, setPredictionsData] = useState<{
    predictions: Prediction[];
    alerts: Alert[];
    recommendations: string[];
    battery: BatteryStatusType;
    timeline: SolarData[];
    weather?: WeatherData;
    config: SystemConfig;
  } | null>(null);

  const [mlPredictions, setMlPredictions] = useState<SolarData[]>([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [solarModelR2, setSolarModelR2] = useState<number | null>(null);
  const [batteryConfigs, setBatteryConfigs] = useState<BatteryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'stats' | 'admin'>('overview');
  const [lastManualRefresh, setLastManualRefresh] = useState<number>(0);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  // Permite llegar a una sección concreta vía URL (p. ej. al volver desde /ajustes
  // con la barra inferior, o el redirect legado /configuracion → /?section=...).
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    // 'historial' se mantiene por compatibilidad con enlaces antiguos: ahora
    // forma parte de la sección unificada de estadísticas.
    if (section === 'stats' || section === 'historial') {
      setActiveSection('stats');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (section === 'admin') {
      setActiveSection('admin');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  const [isOffline, setIsOffline] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [bgGradient, setBgGradient] = useState('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
  const [weatherOverride, setWeatherOverride] = useState<LottieAnimationType | null>(null);

  const energyFlowData = useMemo<EnergyFlow | null>(() => {
    if (!solarData) {
      return null;
    }

    if (solarData.energyFlow) {
      return solarData.energyFlow;
    }

    const { production, consumption, gridExport, gridImport } = solarData.current;
    const batteryPower = solarData.battery.powerFlow;
    const solarToLoad = Math.min(production, consumption);
    const solarExcess = Math.max(0, production - solarToLoad);
    const batteryCharging = batteryPower > 0 ? batteryPower : 0;
    const batteryDischarging = batteryPower < 0 ? Math.abs(batteryPower) : 0;
    const solarToBattery = Math.min(solarExcess, batteryCharging);
    const solarToGrid = Math.max(gridExport, solarExcess - solarToBattery);
    const batteryToLoad = batteryDischarging;
    const gridToLoad = Math.max(
      gridImport,
      Math.max(0, consumption - solarToLoad - batteryToLoad)
    );

    return {
      solarToBattery,
      solarToLoad,
      solarToGrid,
      batteryToLoad,
      gridToLoad,
    };
  }, [solarData]);

  // Producción FV "ahora" según el modelo ML: la predicción para la hora local
  // actual. Si no hay predicciones cargadas, cae a la estimación del snapshot.
  // De noche (fuera del rango diurno de predicción) es 0, como debe ser.
  const currentSolarProduction = useMemo(() => {
    if (mlPredictions.length > 0) {
      const nowHour = new Date().getHours();
      const match = mlPredictions.find(
        (p) => new Date(p.timestamp).getHours() === nowHour
      );
      return match ? match.production : 0;
    }
    return solarData?.current.production ?? 0;
  }, [mlPredictions, solarData]);

  // Subtítulo del header con los valores reales del sistema (capacidad solar,
  // batería y ubicación). Solo se muestra cada parte si existe en la config.
  const headerSubtitle = useMemo(() => {
    const config = predictionsData?.config ?? solarData?.config;
    const parts: string[] = [];
    const capacityKw = config?.solar?.capacityKw;
    const capacityKwh = config?.battery?.capacityKwh;
    const locationName = config?.location?.name;
    if (capacityKw && capacityKw > 0) {
      parts.push(`${+capacityKw.toFixed(1)} kW`);
    }
    if (capacityKwh && capacityKwh > 0) {
      parts.push(`${+capacityKwh.toFixed(1)} kWh`);
    }
    if (locationName && locationName.trim()) {
      parts.push(locationName.trim());
    }
    return parts.join(' · ');
  }, [predictionsData, solarData]);

  // Consumo "ahora" desde la misma fuente que el gráfico (electrodomésticos/ML).
  // Si no hay electrodomésticos configurados el valor es 0, igual que el gráfico.
  const currentConsumption = useMemo(() => {
    if (mlPredictions.length > 0) {
      const nowHour = new Date().getHours();
      const match = mlPredictions.find(
        (p) => new Date(p.timestamp).getHours() === nowHour
      );
      return match ? match.consumption : 0;
    }
    return 0;
  }, [mlPredictions]);

  // Fetch ML predictions for a specific day (7am-10pm)
  const fetchMLPredictionsForDay = useCallback(async (dayOffset: number) => {
    setMlLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      // Usar la fecha LOCAL (no toISOString, que es UTC): de noche en husos
      // negativos como Cuba (UTC-4), toISOString ya está en el día siguiente y
      // el gráfico —que filtra por día local— descartaría todos los puntos.
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      // Hours from 7am to 10pm (7, 8, 9, ..., 22)
      const hours = Array.from({ length: 16 }, (_, i) => i + 7);

      const productionData = await executeQuery<MLPredictionsQueryResult>(
        ML_PREDICTIONS_QUERY,
        { date: dateStr, hours }
      );

      let appliancePoints: { datetime: string; consumptionKw: number }[] = [];
      try {
        const startISO = new Date(targetDate);
        startISO.setHours(0, 0, 0, 0);
        const forecastPromise = executeQuery<AppliancesForecastResult>(
          APPLIANCES_FORECAST_QUERY,
          { hours: 24, start: startISO.toISOString() }
        );
        const forecastTimeout = new Promise<AppliancesForecastResult>((_, reject) => {
          setTimeout(() => reject(new Error('forecast-timeout')), 4000);
        });
        const forecastData = await Promise.race([forecastPromise, forecastTimeout]);
        appliancePoints = forecastData.appliancesConsumptionForecast?.points ?? [];
      } catch (forecastError) {
        console.warn('Error fetching appliances consumption forecast:', forecastError);
      }

      if (productionData.mlPredictForHours && productionData.mlPredictForHours.length > 0) {
        const transformedPredictions = transformMLPredictionsToSolarData(
          productionData.mlPredictForHours,
          appliancePoints
        );
        setMlPredictions(transformedPredictions);
      } else {
        setMlPredictions([]);
      }
    } catch (error) {
      console.error('Error fetching ML predictions:', error);
      setMlPredictions([]);
    } finally {
      setMlLoading(false);
    }
  }, []);

  // Fetch all data
  const fetchData = async () => {
    // Check for offline status immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      // Load demo data if offline
      setSolarData(DEMO_DATA.solar);
      setWeatherData(DEMO_DATA.weather);
      setPredictionsData(DEMO_DATA.predictions);
      setBatteryConfigs(DEMO_DATA.batteries);
      setLoading(false);
      return;
    } else {
      setIsOffline(false);
    }

    try {
      // Create a promise that rejects after 12 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, 12000);
      });

      // Race between the fetch and the timeout
      const data = await Promise.race([
        executeQuery<DashboardQueryResult>(DASHBOARD_QUERY),
        timeoutPromise
      ]);

      setIsSlowNetwork(false); // Reset slow network if successful
      setFetchError(null);
      setSolarData(data.solar);
      setWeatherData(data.weather);
      setPredictionsData(data.predictions);
      setBatteryConfigs(data.batteries ?? []);

      setLastUpdate(new Date());
      setLoading(false);

      // Load solar model info (R²) once
      try {
        type ModelInfoResult = { mlModelInfo: { loaded: boolean; testR2?: number | null } };
        const modelInfo = await executeQuery<ModelInfoResult>(SOLAR_MODEL_INFO_QUERY);
        if (modelInfo.mlModelInfo?.loaded && modelInfo.mlModelInfo.testR2 != null) {
          setSolarModelR2(modelInfo.mlModelInfo.testR2);
        }
      } catch {
        // non-critical, skip silently
      }

      // Load ML predictions for today after main data is loaded
      await fetchMLPredictionsForDay(0);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);

      if (error.message === 'TIMEOUT') {
        setIsSlowNetwork(true);
        // Load demo data on timeout
        setSolarData(DEMO_DATA.solar);
        setWeatherData(DEMO_DATA.weather);
        setPredictionsData(DEMO_DATA.predictions);
        setBatteryConfigs(DEMO_DATA.batteries);
        setLoading(false);
      } else {
        // Error real (backend caído, GraphQL, etc.): registrar para mostrar un
        // estado de error con reintento en vez de dejar el spinner girando.
        setFetchError(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo conectar con el servidor.'
        );
        setLoading(false);
      }
    }
  };

  // Initial fetch and auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for manual refresh cooldown
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const t = setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refreshCooldown]);

  // Update background gradient based on weather and time
  useEffect(() => {
    // Priority to manual override
    if (weatherOverride) {
      if (weatherOverride === 'night') {
        // Night: Deep dark gradient simulating night sky
        setBgGradient('linear-gradient(to bottom right, #0f172a, #1e1b4b, #000000)');
      } else if (weatherOverride === 'rainy') {
        // Rainy: Use default gradient
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
      } else if (weatherOverride === 'cloudy') {
        setBgGradient('linear-gradient(to bottom right, #d1d5db, #e5e7eb, #9ca3af)');
      } else if (weatherOverride === 'partly-cloudy') {
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #f3f4f6, #bfdbfe)');
      } else {
        // sunny
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
      }
      return;
    }

    if (!weatherData || !solarData) return;

    // NO detectar noche automáticamente, solo basarse en nubosidad
    // La noche solo se activa mediante el override manual del Test
    const cloudCover = weatherData.cloudCover || 0;
    const isRainy = cloudCover > 80;
    const isCloudy = cloudCover > 50;

    if (isRainy) {
      // Rainy mode: Use default gradient
      setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
    } else if (isCloudy) {
      // Cloudy mode: Grayish gradient
      setBgGradient('linear-gradient(to bottom right, #d1d5db, #e5e7eb, #9ca3af)');
    } else {
      // Default/Sunny: Sky blue gradient
      setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
    }
  }, [weatherData, solarData, weatherOverride]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundImage: 'linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)' }}>
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pt-6 sm:px-6">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-green-500" />
          <p className="text-sm text-gray-500">Cargando Gemelo Digital…</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  // Estado de error: no hay datos y el fetch falló (backend caído, error GraphQL…).
  if (!solarData || !weatherData || !predictionsData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundImage: 'linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)' }}>
        <div className="max-w-md w-full rounded-3xl border border-red-100 bg-white/80 backdrop-blur p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <ExclamationTriangleIcon className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No se pudieron cargar los datos</h2>
          <p className="mt-2 text-sm text-gray-500">
            No hay conexión con el servidor del gemelo digital. Verifique que el backend esté en ejecución e inténtelo de nuevo.
          </p>
          {fetchError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 break-words">{fetchError}</p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reintentar
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-all duration-[2000ms] ease-in-out relative" style={{ backgroundImage: bgGradient }}>
      {/* Stars effect for night mode */}
      {(bgGradient.includes('#0f172a') || bgGradient.includes('#1e1b4b')) && <StarsBackground />}

      {/* Header Simplificado */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Gemelo Digital · Microrred Solar
              </h1>
              {headerSubtitle && (
                <p className="text-xs sm:text-sm text-gray-500">
                  {headerSubtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeSection === 'overview' && (
                <button
                  onClick={() => {
                    if (refreshCooldown > 0) return;
                    setLastManualRefresh(Date.now());
                    setRefreshCooldown(60);
                    setLoading(true);
                    fetchData();
                  }}
                  disabled={refreshCooldown > 0}
                  title={refreshCooldown > 0 ? `Disponible en ${refreshCooldown}s` : 'Actualizar datos'}
                  className={`
                    relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium
                    transition-all duration-200 select-none
                    ${refreshCooldown > 0
                      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                      : 'cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 shadow-sm hover:shadow'}
                  `}
                >
                  <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {refreshCooldown > 0 ? `${refreshCooldown}s` : 'Actualizar'}
                  </span>
                  {refreshCooldown > 0 && (
                    <svg className="absolute inset-0 w-full h-full rounded-xl" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                      <rect
                        x="0" y="0" width="100" height="100" rx="12" ry="12"
                        fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.25"
                        strokeDasharray={`${((60 - refreshCooldown) / 60) * 280} 280`}
                        style={{ transition: 'stroke-dasharray 1s linear' }}
                      />
                    </svg>
                  )}
                </button>
              )}
              <UserMenu user={user} onLogout={onLogout} />
            </div>
          </div>
        </div>
      </header>

      {/* Network Status Banners */}
      {isOffline && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-red-700 text-sm font-medium">
            <WifiIcon className="w-4 h-4" />
            <span>Sin conexión a internet. Mostrando datos de demostración.</span>
          </div>
        </div>
      )}

      {isSlowNetwork && !isOffline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-yellow-700 text-sm font-medium">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Red muy lenta detectada. Cargando datos demo del clima...</span>
          </div>
        </div>
      )}

      {/* Main Content - Simplificado */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-32">
        {activeSection === 'overview' && (
          <>
            {/* Diagrama del sistema y Resumen del Clima */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-2 sm:mb-3">
              <div className="lg:col-span-1 lg:pr-4 flex items-center justify-center">
                <SystemDiagram
                  solarKw={currentSolarProduction}
                  batteryKwh={batteryConfigs.reduce((sum, b) => sum + (b.capacityKwh ?? 0) * (b.quantity ?? 1), 0)}
                  consumptionKw={currentConsumption}
                  isAdmin={user.role === 'admin'}
                />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="flex-1">
                  <WeatherToday
                    weather={weatherData}
                    onWeatherOverride={setWeatherOverride}
                  />
                </div>
                <div className="flex-1">
                  <WeatherForecast weather={weatherData} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="lg:col-span-2">
                <SolarProductionChart
                  data={mlPredictions.length > 0 ? mlPredictions : solarData.historical}
                  useMLPredictions={mlPredictions.length > 0}
                  loading={mlLoading}
                  onDayChange={fetchMLPredictionsForDay}
                />
              </div>
              <div>
                <BatteryStatus batteries={batteryConfigs} />
              </div>
            </div>

            <div>
              <PredictionsPanel
                predictions={predictionsData.predictions}
                alerts={predictionsData.alerts}
                recommendations={predictionsData.recommendations}
                weather={weatherData}
                batteryProjection={predictionsData.battery}
                config={solarData.config}
                solarModelR2={solarModelR2}
              />
            </div>
          </>
        )}

        {activeSection === 'stats' && (
          <EstadisticasPanel weather={weatherData} config={solarData.config} />
        )}

        {activeSection === 'admin' && user.role === 'admin' && (
          <AdminPanel
            currentUser={user}
            onBack={() => setActiveSection('overview')}
            onLogout={onLogout}
          />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <FloatingBottomNav
        active={activeSection}
        onSelect={(section) => {
          if (section === 'devices') {
            router.push('/ajustes');
            return;
          }
          setActiveSection(section);
        }}
        isAdmin={user.role === 'admin'}
      />
    </div>
  );
}
