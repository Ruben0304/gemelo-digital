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
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChartBarIcon,
  CalendarIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  SunIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
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

const HISTORICAL_READINGS_QUERY = `
  query HistoricalReadings($startDate: String, $endDate: String, $limit: Int) {
    historicalReadings(startDate: $startDate, endDate: $endDate, limit: $limit) {
      _id
      timestamp
      production
      consumption
      batteryLevel
      gridExport
      gridImport
      efficiency
    }
  }
`;

const DAILY_SUMMARIES_QUERY = `
  query DailySummaries($days: Int) {
    dailySummaries(days: $days) {
      date
      totalProduction
      totalConsumption
      avgBatteryLevel
      maxProduction
      maxConsumption
      avgEfficiency
      readingCount
    }
  }
`;

const SEED_MUTATION = `
  mutation SeedHistoricalData($days: Int) {
    seedHistoricalData(days: $days)
  }
`;

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
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('gd_auth_user');
      if (stored) setIsAdmin(JSON.parse(stored)?.role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (histView === 'daily') {
        const data = await executeQuery<{ dailySummaries: DailySummary[] }>(
          DAILY_SUMMARIES_QUERY,
          { days },
          'network-only',
        );
        setSummaries(data?.dailySummaries ?? []);
      } else {
        const now = new Date();
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const data = await executeQuery<{ historicalReadings: HistoricalReading[] }>(
          HISTORICAL_READINGS_QUERY,
          { startDate: start.toISOString(), endDate: now.toISOString(), limit: days * 24 },
          'network-only',
        );
        setReadings(data?.historicalReadings ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos históricos.');
    } finally {
      setLoading(false);
    }
  }, [histView, days]);

  // El histórico se carga al entrar en modo histórico (o al cambiar vista/período).
  // Las predicciones derivan del pronóstico ya disponible: no requieren red.
  useEffect(() => {
    if (mode === 'historico') fetchData();
  }, [mode, fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const data = await executeMutation<{ seedHistoricalData: number }>(SEED_MUTATION, { days: 30 });
      const count = data?.seedHistoricalData ?? 0;
      setSeedMessage(
        count > 0
          ? { type: 'success', text: `Se generaron ${count} lecturas simuladas para los últimos 30 días.` }
          : { type: 'warning', text: 'Los datos ya existían. No se insertaron registros adicionales.' },
      );
      await fetchData();
    } catch (err) {
      setSeedMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al generar datos.' });
    } finally {
      setSeeding(false);
    }
  };

  const handleExportCsv = () => {
    if (histView === 'daily' && summaries.length > 0) exportSummariesCsv(summaries, 'GemeloDigital');
    else if (histView === 'hourly' && readings.length > 0) exportReadingsCsv(readings, 'GemeloDigital');
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const meta = {
        title: histView === 'daily' ? 'Reporte de resumen diario' : 'Reporte de lecturas horarias',
        systemName: 'Gemelo Digital Fotovoltaico',
        location: 'La Habana, Cuba',
        period: `Últimos ${days} días`,
        generatedAt: now.toLocaleString('es-CU'),
      };
      if (histView === 'daily' && summaries.length > 0) await exportSummariesPdf(summaries, meta);
      else if (histView === 'hourly' && readings.length > 0) await exportReadingsPdf(readings, meta);
    } finally {
      setExporting(false);
    }
  };

  // ── Historical derived data ──
  const histHasData = histView === 'daily' ? summaries.length > 0 : readings.length > 0;

  const totalProduction = summaries.reduce((s, d) => s + d.totalProduction, 0);
  const totalConsumption = summaries.reduce((s, d) => s + d.totalConsumption, 0);
  const totalCo2 = totalProduction * 0.5;
  const selfSufficiency = totalConsumption > 0 ? Math.min(100, (totalProduction / totalConsumption) * 100) : 0;

  const hourlyChartData = readings.map((r) => ({
    time: formatHour(r.timestamp),
    Producción: r.production,
    Consumo: r.consumption,
  }));

  const dailyChartData = summaries.map((s) => ({
    fecha: formatDate(s.date),
    Producción: s.totalProduction,
    Consumo: s.totalConsumption,
  }));

  // ── Prediction derived data ──
  // El pronóstico solo cubre la ventana real de Open-Meteo (7 días). Cada día
  // usa `predictedProduction`, que el backend calcula con un método físico:
  // irradiancia pronosticada × horas-sol pico × performance ratio (~0.75).
  // No extrapolamos más allá: sin datos meteorológicos no hay predicción fiable.
  const typicalConsumption = useMemo(() => {
    if (summaries.length === 0) return null;
    return summaries.reduce((s, d) => s + d.totalConsumption, 0) / summaries.length;
  }, [summaries]);

  const prediction = useMemo(() => {
    const forecast = weather?.forecast ?? [];

    const chart = forecast.map((d) => ({
      label: d.dayOfWeek ? d.dayOfWeek.slice(0, 3) : format(new Date(d.date), 'EEE', { locale: es }),
      Producción: Number(Math.max(d.predictedProduction || 0, 0).toFixed(1)),
      Consumo: typicalConsumption != null ? Number(typicalConsumption.toFixed(1)) : 0,
    }));

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
    };
  }, [weather, typicalConsumption]);

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
          days={days}
          setDays={setDays}
          loading={loading}
          error={error}
          isAdmin={isAdmin}
          seeding={seeding}
          exporting={exporting}
          seedMessage={seedMessage}
          histHasData={histHasData}
          totalProduction={totalProduction}
          totalConsumption={totalConsumption}
          totalCo2={totalCo2}
          selfSufficiency={selfSufficiency}
          dailyChartData={dailyChartData}
          hourlyChartData={hourlyChartData}
          onRefresh={fetchData}
          onSeed={handleSeed}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />
      ) : (
        <PredictionView prediction={prediction} />
      )}
    </section>
  );
}

// ─── Historical view ──────────────────────────────────────────────────────

function HistoricalView({
  histView,
  setHistView,
  days,
  setDays,
  loading,
  error,
  isAdmin,
  seeding,
  exporting,
  seedMessage,
  histHasData,
  totalProduction,
  totalConsumption,
  totalCo2,
  selfSufficiency,
  dailyChartData,
  hourlyChartData,
  onRefresh,
  onSeed,
  onExportCsv,
  onExportPdf,
}: {
  histView: HistView;
  setHistView: (v: HistView) => void;
  days: number;
  setDays: (d: number) => void;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  seeding: boolean;
  exporting: boolean;
  seedMessage: { type: 'success' | 'warning' | 'error'; text: string } | null;
  histHasData: boolean;
  totalProduction: number;
  totalConsumption: number;
  totalCo2: number;
  selfSufficiency: number;
  dailyChartData: Array<{ fecha: string; Producción: number; Consumo: number }>;
  hourlyChartData: Array<{ time: string; Producción: number; Consumo: number }>;
  onRefresh: () => void;
  onSeed: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  const noData = !histHasData;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto text-sm text-slate-500">
          Serie temporal de producción y consumo
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="cursor-pointer bg-transparent text-sm text-slate-700 outline-none"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
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

        {isAdmin && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="flex items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-700 px-3 py-2 text-sm text-white transition hover:bg-indigo-600 disabled:opacity-50"
            title="Generar datos simulados de demostración"
          >
            <CloudArrowDownIcon className={`h-4 w-4 ${seeding ? 'animate-bounce' : ''}`} />
            {seeding ? 'Generando…' : 'Generar datos de prueba'}
          </button>
        )}

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

      {seedMessage && (
        <div
          role={seedMessage.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            seedMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : seedMessage.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {seedMessage.type === 'success' && <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />}
          {seedMessage.type === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />}
          {seedMessage.type === 'error' && <XCircleIcon className="h-5 w-5 flex-shrink-0" />}
          <span>{seedMessage.text}</span>
        </div>
      )}

      {/* KPIs (daily view) */}
      {histView === 'daily' && histHasData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Producción total" value={`${totalProduction.toFixed(1)} kWh`} color="text-yellow-600" />
          <KpiCard label="Consumo total" value={`${totalConsumption.toFixed(1)} kWh`} color="text-blue-600" />
          <KpiCard label="CO₂ evitado" value={`${totalCo2.toFixed(1)} kg`} color="text-green-600" />
          <KpiCard label="Autosuficiencia" value={`${selfSufficiency.toFixed(0)} %`} color="text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && noData && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
          <ChartBarIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Sin datos históricos</p>
          <p className="mx-auto mt-1 mb-4 max-w-md text-sm text-slate-500">
            {isAdmin
              ? 'El sistema aún no ha acumulado lecturas. Use «Generar datos de prueba» para poblar la serie histórica.'
              : 'El sistema aún no ha acumulado lecturas para el período seleccionado.'}
          </p>
        </div>
      )}

      {!noData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {histView === 'daily' ? 'Producción y consumo diarios (kWh)' : 'Producción y consumo por hora (kW)'}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            {histView === 'daily' ? (
              <ComposedChart data={dailyChartData} barGap={4} barCategoryGap="28%">
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#fde68a" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" kWh" axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit=" kWh" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
                <Bar dataKey="Producción" fill="url(#gProd)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Bar dataKey="Consumo" fill="url(#gCons)" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </ComposedChart>
            ) : (
              <AreaChart data={hourlyChartData}>
                <defs>
                  <linearGradient id="gProdArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gConsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
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
                <Area type="monotone" dataKey="Consumo" stroke="#3b82f6" strokeWidth={2} fill="url(#gConsArea)" />
              </AreaChart>
            )}
          </ResponsiveContainer>

          <p className="mt-4 text-center text-xs text-slate-500">
            Los datos se almacenan automáticamente cada 5 minutos en MongoDB (colección{' '}
            <code className="rounded bg-slate-100 px-1 text-slate-700">lecturas_historicas</code>)
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Prediction view ──────────────────────────────────────────────────────

function PredictionView({
  prediction,
}: {
  prediction: {
    totalProd: number;
    avgDaily: number;
    sunnyDays: number;
    days: number;
    coverage: number | null;
    chart: Array<{ label: string; Producción: number; Consumo: number }>;
    hasConsumption: boolean;
  };
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
          Estimación basada en el pronóstico de irradiancia de Open-Meteo ({prediction.days} días),
          convertido a energía mediante horas-sol pico y un performance ratio de 0,75. No se proyecta
          más allá de la ventana del pronóstico por no existir datos meteorológicos fiables.
          {prediction.hasConsumption
            ? ' La línea de consumo típico es el promedio diario del período cargado en la vista Histórico.'
            : ' Carga la vista Histórico para comparar contra el consumo típico.'}
        </p>
      </div>
    </div>
  );
}
