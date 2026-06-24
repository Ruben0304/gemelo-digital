'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChartBarIcon,
  CalendarIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  TableCellsIcon,
  DocumentTextIcon,
  SunIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { executeQuery } from '@/lib/graphql-client';
import {
  exportReadingsCsv,
  exportSummariesCsv,
  exportReadingsPdf,
  exportSummariesPdf,
} from '@/lib/reportGenerator';
import type {
  HistoricalReading,
  DailySummary,
  WeatherData,
  SystemConfig,
} from '@/types';

// ─── GraphQL queries ────────────────────────────────────────────────────────

// Predicción de producción del backend: el MISMO modelo ML que alimenta el gráfico
// de producción vs consumo del Dashboard (ProductionForecastService → Random Forest
// + motor strategy + sombras + orientación + escalado por capacidad). Su hermana de
// un solo día es `mlPredictForHours`; aquí usamos la variante multi-día para cubrir
// la ventana del pronóstico. El frontend NO calcula física: solo totaliza por día.
const ML_PREDICT_DATE_RANGE_QUERY = `
  query MLPredictDateRange($startDate: String!, $endDate: String!) {
    mlPredictDateRange(startDate: $startDate, endDate: $endDate) {
      datetime
      productionKw
    }
  }
`;

type MlPredictionRow = { datetime: string; productionKw: number };

// Producción por mes del año (pastel): el backend mezcla histórico real de los
// meses pasados con climatología (mismo mes del año anterior) para lo que falta.
const MONTHLY_PRODUCTION_QUERY = `
  query MonthlyProduction {
    monthlyProduction {
      month
      monthName
      productionKwh
      source
    }
  }
`;

type MonthlySource = 'historico' | 'prediccion' | 'mixto';
type MonthlyProduction = {
  month: number;
  monthName: string;
  productionKwh: number;
  source: MonthlySource;
};

// Color del gajo según su origen, para que la mezcla sea visible de un vistazo.
const MONTHLY_COLORS: Record<MonthlySource, string> = {
  historico: '#f59e0b', // ámbar — dato real
  mixto: '#10b981', // esmeralda — mes en curso
  prediccion: '#38bdf8', // celeste — estimación futura
};
const MONTHLY_SOURCE_LABEL: Record<MonthlySource, string> = {
  historico: 'Histórico',
  mixto: 'Mes en curso',
  prediccion: 'Predicción',
};

// Paleta estacional (Ene→Dic): recorre la rueda de color de invierno a verano y
// vuelve, para que el pastel se lea bonito y cada mes tenga su tono propio.
const MONTH_COLORS = [
  '#60a5fa', // Ene — azul invierno
  '#38bdf8', // Feb — celeste
  '#22d3ee', // Mar — cian
  '#2dd4bf', // Abr — turquesa
  '#34d399', // May — verde
  '#a3e635', // Jun — lima
  '#facc15', // Jul — amarillo (pico de verano)
  '#fbbf24', // Ago — ámbar
  '#fb923c', // Sep — naranja
  '#f472b6', // Oct — rosa otoño
  '#c084fc', // Nov — púrpura
  '#818cf8', // Dic — índigo
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatHour(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

const formatEnergy = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} GWh`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} MWh`;
  return `${value.toFixed(1)} kWh`;
};

const todayStr = (): string => format(new Date(), 'yyyy-MM-dd');

// Reconstruye las estructuras del histórico (lecturas horarias + resumen diario)
// a partir de la predicción horaria del backend. NO hay física en el frontend:
// solo se totaliza por día (kW · 1 h = kWh) y se calcula el pico, igual que hacía
// el backend con las lecturas reales — pero ahora la fuente es el modelo.
function buildHistFromMl(rows: MlPredictionRow[]): {
  readings: HistoricalReading[];
  summaries: DailySummary[];
} {
  const readings: HistoricalReading[] = rows.map((r) => ({
    _id: r.datetime,
    timestamp: r.datetime,
    productionKw: r.productionKw,
  }));

  const byDay = new Map<string, { total: number; max: number; count: number }>();
  for (const r of rows) {
    const day = r.datetime.slice(0, 10);
    const acc = byDay.get(day) ?? { total: 0, max: 0, count: 0 };
    acc.total += r.productionKw;
    acc.max = Math.max(acc.max, r.productionKw);
    acc.count += 1;
    byDay.set(day, acc);
  }
  const summaries: DailySummary[] = [...byDay.entries()].map(([date, a]) => ({
    date,
    totalProductionKwh: Number(a.total.toFixed(2)),
    maxProductionKw: Number(a.max.toFixed(2)),
    readingCount: a.count,
  }));

  return { readings, summaries };
}

type Mode = 'historico' | 'prediccion';
type HistView = 'daily' | 'hourly';

interface EstadisticasPanelProps {
  weather?: WeatherData | null;
  config: SystemConfig;
}

// ─── Tooltip ────────────────────────────────────────────────────────────────

interface TooltipEntry { dataKey: string; name: string; value: number; color: string }

function ChartTooltip({
  active,
  payload,
  label,
  unit = '',
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="mb-1.5 text-xs font-semibold text-slate-500">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-900">
            {Number(p.value).toFixed(1)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EstadisticasPanel({ weather, config }: EstadisticasPanelProps) {
  const [mode, setMode] = useState<Mode>('historico');

  // ── Historical state ──
  const [histView, setHistView] = useState<HistView>('daily');
  const [readings, setReadings] = useState<HistoricalReading[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  // 'reciente' = últimos N días hasta hoy (Open-Meteo /forecast).
  // 'historico' = un período pasado a elegir (Open-Meteo Archive API, hasta 1940).
  const [histSource, setHistSource] = useState<'reciente' | 'historico'>('reciente');
  const [endDate, setEndDate] = useState<string>(() => todayStr());

  // ── Prediction (ML) state ──
  // Producción diaria (kWh) agregada desde la predicción horaria del backend,
  // indexada por fecha YYYY-MM-DD. Vacío ⇒ se respalda con el valor del pronóstico.
  const [mlDaily, setMlDaily] = useState<Map<string, number>>(new Map());
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState<string | null>(null);

  // ── Monthly pie (annual) state ──
  const [monthly, setMonthly] = useState<MonthlyProduction[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // El histórico se RECONSTRUYE con el modelo del backend sobre el clima de
      // Open-Meteo del período pedido. 'reciente' termina hoy (el backend usa
      // /forecast); 'historico' termina en una fecha pasada (el backend enruta al
      // Archive API). El frontend solo pide y totaliza, sin tocar lecturas_historicas.
      const end = histSource === 'reciente' ? todayStr() : endDate;
      const endMs = new Date(`${end}T00:00:00`).getTime();
      const startStr = format(new Date(endMs - (days - 1) * 86_400_000), 'yyyy-MM-dd');
      const data = await executeQuery<{ mlPredictDateRange: MlPredictionRow[] }>(
        ML_PREDICT_DATE_RANGE_QUERY,
        { startDate: `${startStr}T00:00:00`, endDate: `${end}T23:00:00` },
        'network-only',
      );
      const { readings: r, summaries: s } = buildHistFromMl(data?.mlPredictDateRange ?? []);
      setReadings(r);
      setSummaries(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reconstruyendo el histórico con el modelo.');
      setReadings([]);
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [days, endDate, histSource]);

  // El histórico se carga al entrar en modo histórico (o al cambiar vista/período).
  // Las predicciones derivan del pronóstico ya disponible: no requieren red.
  useEffect(() => {
    if (mode === 'historico') fetchData();
  }, [mode, fetchData]);

  // El pastel anual es independiente del período: se pide una vez al entrar en
  // Histórico. El backend mezcla histórico real + climatología; el front solo pinta.
  useEffect(() => {
    if (mode !== 'historico' || monthly.length > 0) return;
    let cancelled = false;
    (async () => {
      setMonthlyLoading(true);
      try {
        const data = await executeQuery<{ monthlyProduction: MonthlyProduction[] }>(
          MONTHLY_PRODUCTION_QUERY,
          {},
          'network-only',
        );
        if (!cancelled) setMonthly(data?.monthlyProduction ?? []);
      } catch {
        if (!cancelled) setMonthly([]);
      } finally {
        if (!cancelled) setMonthlyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, monthly.length]);

  // La predicción se pide al mismo modelo ML del backend que usa el Dashboard.
  // Se totalizan las horas devueltas a kWh/día (kW · 1 h = kWh): el frontend no
  // ejecuta ningún cálculo de física ni de modelo, solo suma lo ya predicho.
  const forecastDates = useMemo(
    () => (weather?.forecast ?? []).map((d) => d.date),
    [weather],
  );

  useEffect(() => {
    if (mode !== 'prediccion' || forecastDates.length === 0) return;
    let cancelled = false;
    (async () => {
      setPredLoading(true);
      setPredError(null);
      try {
        const startIso = `${forecastDates[0]}T00:00:00`;
        const endIso = `${forecastDates[forecastDates.length - 1]}T23:00:00`;
        const data = await executeQuery<{ mlPredictDateRange: MlPredictionRow[] }>(
          ML_PREDICT_DATE_RANGE_QUERY,
          { startDate: startIso, endDate: endIso },
          'network-only',
        );
        if (cancelled) return;
        const byDay = new Map<string, number>();
        for (const row of data?.mlPredictDateRange ?? []) {
          const day = row.datetime.slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + row.productionKw);
        }
        setMlDaily(byDay);
      } catch (err) {
        if (cancelled) return;
        setPredError(err instanceof Error ? err.message : 'No se pudo obtener la predicción del modelo.');
        setMlDaily(new Map());
      } finally {
        if (!cancelled) setPredLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, forecastDates]);

  const handleExportCsv = () => {
    if (histView === 'daily' && summaries.length > 0) exportSummariesCsv(summaries, 'GemeloDigital');
    else if (histView === 'hourly' && readings.length > 0) exportReadingsCsv(readings, 'GemeloDigital');
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setError(null);
    try {
      const now = new Date();
      const meta = {
        title: histView === 'daily' ? 'Reporte de resumen diario' : 'Reporte de lecturas horarias',
        systemName: 'Gemelo Digital Fotovoltaico',
        location: 'La Habana, Cuba',
        period:
          histSource === 'reciente'
            ? `Últimos ${days} días`
            : `${days} días hasta ${endDate}`,
        generatedAt: now.toLocaleString('es-CU'),
      };
      if (histView === 'daily' && summaries.length > 0) {
        await exportSummariesPdf(summaries, meta);
      } else if (histView === 'hourly' && readings.length > 0) {
        await exportReadingsPdf(readings, meta);
      }
    } catch (err) {
      // Antes esto fallaba en silencio (try/finally sin catch); ahora se avisa.
      setError(err instanceof Error ? `No se pudo generar el PDF: ${err.message}` : 'No se pudo generar el PDF.');
    } finally {
      setExporting(false);
    }
  };

  // ── Historical derived data ──
  const histHasData = histView === 'daily' ? summaries.length > 0 : readings.length > 0;

  const totalProduction = summaries.reduce((s, d) => s + d.totalProductionKwh, 0);
  const totalCo2 = totalProduction * 0.5;
  const maxProductionKw = summaries.length > 0 ? Math.max(...summaries.map((d) => d.maxProductionKw)) : 0;

  const hourlyChartData = readings.map((r) => ({
    time: formatHour(r.timestamp),
    Producción: r.productionKw,
  }));

  const dailyChartData = summaries.map((s) => ({
    fecha: formatDate(s.date),
    Producción: s.totalProductionKwh,
  }));

  // ── Prediction derived data ──
  // El pronóstico solo cubre la ventana real de Open-Meteo (7 días). Cada día
  // usa `predictedProduction`, que el backend calcula con un método físico:
  // irradiancia pronosticada × horas-sol pico × performance ratio (~0.75).
  // No extrapolamos más allá: sin datos meteorológicos no hay predicción fiable.
  const typicalConsumption = useMemo(() => {
    if (summaries.length === 0) return null;
    return summaries.reduce((s, d) => s + d.totalProductionKwh, 0) / summaries.length;
  }, [summaries]);

  const prediction = useMemo(() => {
    const forecast = weather?.forecast ?? [];
    const usesMl = mlDaily.size > 0;

    const chart = forecast.map((d) => {
      // Producción del modelo ML del backend (kWh/día). Si no llegó el dato para
      // ese día concreto, se respalda con el valor del pronóstico meteorológico.
      const mlKwh = mlDaily.get(d.date);
      const produccion = mlKwh != null ? mlKwh : Math.max(d.predictedProduction || 0, 0);
      return {
        label: d.dayOfWeek ? d.dayOfWeek.slice(0, 3) : format(new Date(d.date), 'EEE', { locale: es }),
        Producción: Number(Math.max(produccion, 0).toFixed(1)),
        Consumo: typicalConsumption != null ? Number(typicalConsumption.toFixed(1)) : 0,
      };
    });

    const totalProd = chart.reduce((s, d) => s + d.Producción, 0);
    const avgDaily = chart.length > 0 ? totalProd / chart.length : 0;
    const sunnyDays = forecast.filter(
      (d) => d.condition === 'sunny' || d.condition === 'partly-cloudy',
    ).length;
    const totalCons = typicalConsumption != null ? typicalConsumption * chart.length : 0;
    const coverage = totalCons > 0 ? Math.min(999, (totalProd / totalCons) * 100) : null;

    return {
      totalProd,
      avgDaily,
      sunnyDays,
      days: chart.length,
      coverage,
      chart,
      hasConsumption: typicalConsumption != null,
      source: (usesMl ? 'ml' : 'formula') as 'ml' | 'formula',
    };
  }, [weather, typicalConsumption, mlDaily]);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">
      {/* Header + mode toggle */}
      <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-sky-100/60 backdrop-blur-xl sm:p-8">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <ChartBarIcon className="h-7 w-7 text-emerald-500" />
            Estadísticas de producción
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Analiza datos históricos reales o proyecta la producción futura
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-1.5">
          <button
            type="button"
            onClick={() => setMode('historico')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              mode === 'historico'
                ? 'bg-white text-slate-900 shadow-lg shadow-slate-300/40'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChartBarIcon className="h-5 w-5" />
            Histórico
          </button>
          <button
            type="button"
            onClick={() => setMode('prediccion')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              mode === 'prediccion'
                ? 'bg-white text-slate-900 shadow-lg shadow-slate-300/40'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SparklesIcon className="h-5 w-5" />
            Predicción
          </button>
        </div>
      </div>

      {mode === 'historico' ? (
        <HistoricalView
          histView={histView}
          setHistView={setHistView}
          histSource={histSource}
          setHistSource={setHistSource}
          endDate={endDate}
          setEndDate={setEndDate}
          maxDate={todayStr()}
          days={days}
          setDays={setDays}
          loading={loading}
          error={error}
          exporting={exporting}
          histHasData={histHasData}
          totalProduction={totalProduction}
          totalCo2={totalCo2}
          maxProductionKw={maxProductionKw}
          dailyChartData={dailyChartData}
          hourlyChartData={hourlyChartData}
          monthly={monthly}
          monthlyLoading={monthlyLoading}
          onRefresh={fetchData}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />
      ) : (
        <PredictionView prediction={prediction} loading={predLoading} error={predError} />
      )}
    </section>
  );
}

// ─── Historical view ──────────────────────────────────────────────────────

function HistoricalView({
  histView,
  setHistView,
  histSource,
  setHistSource,
  endDate,
  setEndDate,
  maxDate,
  days,
  setDays,
  loading,
  error,
  exporting,
  histHasData,
  totalProduction,
  totalCo2,
  maxProductionKw,
  dailyChartData,
  hourlyChartData,
  monthly,
  monthlyLoading,
  onRefresh,
  onExportCsv,
  onExportPdf,
}: {
  histView: HistView;
  setHistView: (v: HistView) => void;
  histSource: 'reciente' | 'historico';
  setHistSource: (v: 'reciente' | 'historico') => void;
  endDate: string;
  setEndDate: (v: string) => void;
  maxDate: string;
  days: number;
  setDays: (d: number) => void;
  loading: boolean;
  error: string | null;
  exporting: boolean;
  histHasData: boolean;
  totalProduction: number;
  totalCo2: number;
  maxProductionKw: number;
  dailyChartData: Array<{ fecha: string; Producción: number }>;
  hourlyChartData: Array<{ time: string; Producción: number }>;
  monthly: MonthlyProduction[];
  monthlyLoading: boolean;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  const noData = !histHasData;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto text-sm text-slate-500">
          Serie temporal de producción solar
        </div>

        {/* Origen: reciente (hasta hoy) vs histórico (período pasado) */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(['reciente', 'historico'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setHistSource(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                histSource === s ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {s === 'reciente' ? 'Reciente' : 'Histórico'}
            </button>
          ))}
        </div>

        {/* Fecha final: solo en modo histórico (en reciente siempre es hoy) */}
        {histSource === 'historico' && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <CalendarIcon className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={endDate}
              max={maxDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
              title="Fecha final del período histórico"
            />
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(['daily', 'hourly'] as HistView[]).map((m) => (
            <button
              key={m}
              onClick={() => setHistView(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                histView === m ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {m === 'daily' ? 'Diario' : 'Por hora'}
            </button>
          ))}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>

        {histHasData && (
          <>
            <button
              onClick={onExportCsv}
              className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-700 px-3 py-2 text-sm text-white transition hover:bg-emerald-600"
              title="Exportar datos visibles como CSV"
            >
              <TableCellsIcon className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-sky-600 bg-sky-700 px-3 py-2 text-sm text-white transition hover:bg-sky-600 disabled:opacity-50"
              title="Exportar reporte PDF profesional"
            >
              {exporting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <DocumentTextIcon className="h-4 w-4" />}
              PDF
            </button>
          </>
        )}
      </div>

      {/* KPIs (daily view) */}
      {histView === 'daily' && histHasData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard label="Producción total" value={`${totalProduction.toFixed(1)} kWh`} color="text-yellow-600" />
          <KpiCard label="CO₂ evitado" value={`${totalCo2.toFixed(1)} kg`} color="text-green-600" />
          <KpiCard label="Máx. producción" value={`${maxProductionKw.toFixed(1)} kW`} color="text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && noData && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
          <ChartBarIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Sin datos para el período</p>
          <p className="mx-auto mt-1 mb-4 max-w-md text-sm text-slate-500">
            El modelo no devolvió producción para el rango seleccionado. Prueba otra fecha o
            comprueba la conexión con Open-Meteo.
          </p>
        </div>
      )}

      {!noData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {histView === 'daily' ? 'Producción solar diaria (kWh)' : 'Producción solar por hora (kW)'}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            {histView === 'daily' ? (
              <ComposedChart data={dailyChartData} barGap={4} barCategoryGap="28%">
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#fde68a" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" kWh" axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit=" kWh" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
                <Bar dataKey="Producción" fill="url(#gProd)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </ComposedChart>
            ) : (
              <AreaChart data={hourlyChartData}>
                <defs>
                  <linearGradient id="gProdArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval={Math.max(0, Math.floor(hourlyChartData.length / 10))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" kW" axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit=" kW" />} />
                <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
                <Area type="monotone" dataKey="Producción" stroke="#eab308" strokeWidth={2} fill="url(#gProdArea)" />
              </AreaChart>
            )}
          </ResponsiveContainer>

          <p className="mt-4 text-center text-xs text-slate-500">
            Serie reconstruida por el modelo de producción del backend a partir del clima horario de
            Open-Meteo del período ({histSource === 'reciente' ? 'pronóstico reciente' : 'archivo histórico ERA5'}).
          </p>
        </div>
      )}

      {/* Pastel anual: producción por mes (histórico pasado + predicción futura) */}
      <MonthlyPie monthly={monthly} loading={monthlyLoading} />
    </div>
  );
}

// ─── Monthly pie (annual production by month) ─────────────────────────────────

// Etiqueta dentro del gajo: nombre del mes + kWh, en blanco con sombra suave para
// que se lea sobre cualquier color. Solo se dibujan los kWh si el gajo es grande.
// recharts tipa el render de label de forma laxa (PieLabelRenderProps), así que
// recibimos `any` y desestructuramos los campos de geometría que sí llegan.
function renderMonthLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const payload = props.payload as MonthlyProduction;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const shadow = { textShadow: '0 1px 3px rgba(15,23,42,0.55)' } as const;
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" pointerEvents="none">
      <tspan x={x} dy={percent > 0.06 ? '-0.35em' : '0'} fill="#fff" fontSize={13} fontWeight={700} style={shadow}>
        {payload.monthName}
      </tspan>
      {percent > 0.06 && (
        <tspan x={x} dy="1.25em" fill="#ffffff" fontSize={10} fontWeight={500} opacity={0.95} style={shadow}>
          {Math.round(payload.productionKwh)} kWh
        </tspan>
      )}
    </text>
  );
}

function MonthlyPie({ monthly, loading }: { monthly: MonthlyProduction[]; loading: boolean }) {
  const data = monthly.filter((m) => m.productionKwh > 0);
  const total = monthly.reduce((s, m) => s + m.productionKwh, 0);
  const best = data.reduce<MonthlyProduction | null>(
    (top, m) => (!top || m.productionKwh > top.productionKwh ? m : top),
    null,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <CalendarDaysIcon className="h-5 w-5 text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-700">Producción por mes del año</h3>
        {loading && <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      <p className="mb-2 text-xs text-slate-500">Histórico de lo transcurrido + estimación de lo que falta</p>

      {data.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          {loading ? 'Calculando el balance anual…' : 'Sin datos anuales disponibles.'}
        </div>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={380}>
              <PieChart>
                <defs>
                  <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.14" />
                  </filter>
                </defs>

                {/* Anillo exterior fino: origen del dato (histórico/mixto/predicción) */}
                <Pie
                  data={data}
                  dataKey="productionKwh"
                  nameKey="monthName"
                  cx="50%"
                  cy="50%"
                  innerRadius={138}
                  outerRadius={150}
                  paddingAngle={1}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((m) => (
                    <Cell key={`ring-${m.month}`} fill={MONTHLY_COLORS[m.source]} />
                  ))}
                </Pie>

                {/* Donut principal: un color por mes, con el mes y los kWh dentro */}
                <Pie
                  data={data}
                  dataKey="productionKwh"
                  nameKey="monthName"
                  cx="50%"
                  cy="50%"
                  innerRadius={78}
                  outerRadius={130}
                  paddingAngle={1.5}
                  cornerRadius={6}
                  stroke="#fff"
                  strokeWidth={2}
                  labelLine={false}
                  label={renderMonthLabel}
                  filter="url(#pieShadow)"
                  animationDuration={700}
                >
                  {data.map((m) => (
                    <Cell key={`slice-${m.month}`} fill={MONTH_COLORS[m.month - 1]} />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value: number, _name, item: { payload?: MonthlyProduction }) => [
                    `${Number(value).toFixed(1)} kWh`,
                    item?.payload ? MONTHLY_SOURCE_LABEL[item.payload.source] : '',
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centro del donut: total del año */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total año</span>
              <span className="text-2xl font-extrabold text-slate-800">{formatEnergy(total)}</span>
              {best && (
                <span className="mt-0.5 text-[11px] text-slate-500">
                  Mejor mes · {best.monthName}
                </span>
              )}
            </div>
          </div>

          {/* Leyenda del anillo de origen */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
            <span className="text-slate-400">Anillo exterior:</span>
            {(['historico', 'mixto', 'prediccion'] as MonthlySource[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: MONTHLY_COLORS[s] }} />
                {MONTHLY_SOURCE_LABEL[s]}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Cada gajo es un mes. Los ya transcurridos usan el clima real de Open-Meteo; los futuros se
            estiman con la climatología del mismo mes del año anterior (no hay pronóstico a meses
            vista). El mes en curso combina ambos.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Prediction view ──────────────────────────────────────────────────────

function PredictionView({
  prediction,
  loading = false,
  error = null,
}: {
  prediction: {
    totalProd: number;
    avgDaily: number;
    sunnyDays: number;
    days: number;
    coverage: number | null;
    chart: Array<{ label: string; Producción: number; Consumo: number }>;
    hasConsumption: boolean;
    source: 'ml' | 'formula';
  };
  loading?: boolean;
  error?: string | null;
}) {
  // Sin pronóstico no inventamos nada: estado vacío explícito.
  if (prediction.days === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
        <SunIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="font-medium text-slate-600">Pronóstico no disponible</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          No se recibió pronóstico meteorológico del backend. Comprueba la fuente de clima en
          Ajustes › Clima.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-emerald-700">
          <SunIcon className="h-6 w-6" />
          <p className="text-sm font-semibold uppercase tracking-wider">
            Producción estimada · próximos {prediction.days} días
          </p>
        </div>
        <p className="text-5xl font-extrabold text-emerald-900">{formatEnergy(prediction.totalProd)}</p>
        <p className="mt-2 text-sm text-emerald-700">Ventana del pronóstico meteorológico</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Media diaria" value={`${prediction.avgDaily.toFixed(1)} kWh`} color="text-emerald-600" />
        <KpiCard
          label="Días de buen sol"
          value={`${prediction.sunnyDays} / ${prediction.days}`}
          color="text-yellow-600"
        />
        <KpiCard
          label="Cobertura del consumo"
          value={prediction.coverage != null ? `${prediction.coverage.toFixed(0)} %` : '—'}
          color="text-blue-600"
        />
        <KpiCard label="Horizonte" value={`${prediction.days} días`} color="text-slate-700" />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-700">Producción diaria estimada (kWh)</h3>
          {loading && <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={prediction.chart} barCategoryGap="30%">
            <defs>
              <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              unit=" kWh"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip unit=" kWh" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
            <Bar dataKey="Producción" fill="url(#gPred)" radius={[4, 4, 0, 0]} maxBarSize={48} />
            {prediction.hasConsumption && (
              <Line
                type="monotone"
                dataKey="Consumo"
                name="Consumo típico"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {prediction.source === 'ml' ? (
            <>
              Producción estimada por el modelo de Machine Learning del backend (Random Forest
              entrenado para La Habana) — el mismo que alimenta el gráfico de producción vs consumo
              del panel principal. Combina el pronóstico horario de Open-Meteo ({prediction.days} días)
              con la sombra y la orientación de tu instalación, y totaliza las horas de cada día a kWh.
              No se proyecta más allá de la ventana del pronóstico por no existir datos meteorológicos
              fiables.
            </>
          ) : (
            <>
              {error
                ? `No se pudo contactar el modelo de Machine Learning del backend (${error}); `
                : 'Modelo de Machine Learning del backend no disponible; '}
              se muestra la estimación física de respaldo a partir del pronóstico de irradiancia de
              Open-Meteo ({prediction.days} días).
            </>
          )}
          {prediction.hasConsumption
            ? ' La línea de consumo típico es el promedio diario del período cargado en la vista Histórico.'
            : ' Carga la vista Histórico para comparar contra el consumo típico.'}
        </p>
      </div>
    </div>
  );
}
