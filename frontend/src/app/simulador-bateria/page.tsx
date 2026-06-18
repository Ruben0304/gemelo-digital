'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Battery, Info, Loader2, Zap,
  TrendingDown, AlertTriangle, Activity, HelpCircle,
} from 'lucide-react';
import { executeQuery } from '@/lib/graphql-client';
import type { Prediction, BatteryConfig } from '@/types';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes (fuente: backend/notebooks/validacion_modelos_ml.ipynb)
// ──────────────────────────────────────────────────────────────────────────────
const PROD_ERROR_PCT = 7;
const CONS_ERROR_PCT = 20;
const CHARGE_EFFICIENCY = 0.9;

const SIMULATOR_QUERY = `
  query SimulatorData {
    predictions {
      predictions {
        timestamp hour expectedProduction expectedConsumption confidence
      }
    }
    mlPredictNextHours(hours: 24) {
      datetime
      productionKw
    }
    batteries { _id manufacturer model capacityKwh quantity }
    solar {
      battery { chargeLevel }
      config { battery { capacityKwh } }
    }
  }
`;

interface SimPoint {
  label: string;
  batteryPct: number;
  batteryPctHigh: number;
  batteryPctLow: number;
  production: number;
  consumption: number;
  balance: number;
}

interface QueryResult {
  predictions: { predictions: Prediction[] };
  mlPredictNextHours?: { datetime: string; productionKw: number }[];
  batteries: BatteryConfig[];
  solar: {
    battery: { chargeLevel: number };
    config: { battery: { capacityKwh: number } };
  };
}

// ──────────────────────────────────────────────────────────────────────────────
function runSim(
  startPct: number, capacityKwh: number, predictions: Prediction[],
  consReduction: number, prodBoost: number,
) {
  let kwh = (startPct / 100) * capacityKwh;
  return predictions.map((p) => {
    const prod = p.expectedProduction * (1 + prodBoost / 100);
    const cons = p.expectedConsumption * (1 - consReduction / 100);
    const balance = prod - cons;
    kwh = Math.min(capacityKwh, Math.max(0, kwh + (balance > 0 ? balance * CHARGE_EFFICIENCY : balance)));
    return { pct: Math.round((kwh / capacityKwh) * 1000) / 10, prod, cons, balance };
  });
}

function simulate(
  startPct: number, capacityKwh: number, predictions: Prediction[],
  consReduction: number, prodBoost: number,
): SimPoint[] {
  const base = runSim(startPct, capacityKwh, predictions, consReduction, prodBoost);
  const opt = runSim(startPct, capacityKwh, predictions,
    Math.max(0, consReduction + CONS_ERROR_PCT), prodBoost + PROD_ERROR_PCT);
  const pes = runSim(startPct, capacityKwh, predictions,
    Math.max(0, consReduction - CONS_ERROR_PCT), prodBoost - PROD_ERROR_PCT);

  return predictions.map((p, i) => ({
    label: `${String(p.hour).padStart(2, '0')}:00`,
    batteryPct: base[i].pct,
    batteryPctHigh: opt[i].pct,
    batteryPctLow: pes[i].pct,
    production: Math.round(base[i].prod * 100) / 100,
    consumption: Math.round(base[i].cons * 100) / 100,
    balance: Math.round(base[i].balance * 100) / 100,
  }));
}

function statusOf(pct: number) {
  if (pct >= 80) return { label: 'Óptima',  dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (pct >= 50) return { label: 'Normal',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' };
  if (pct >= 20) return { label: 'Baja',    dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' };
  return            { label: 'Crítica', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' };
}

// ──────────────────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ payload: SimPoint }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = d.batteryPct < 20 ? '#ef4444' : d.batteryPct < 50 ? '#f59e0b' : '#10b981';
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl px-3 py-2 text-xs min-w-[180px]">
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-bold" style={{ color }}>{d.batteryPct.toFixed(0)}%</span>
      </div>
      <div className="space-y-1 tabular-nums">
        <Row label="Rango" value={`${d.batteryPctLow.toFixed(0)}–${d.batteryPctHigh.toFixed(0)}%`} muted />
        <Row label="Producción" value={`+${d.production.toFixed(2)} kWh`} color="text-emerald-600" />
        <Row label="Consumo"    value={`−${d.consumption.toFixed(2)} kWh`} color="text-red-500" />
        <Row label="Balance"    value={`${d.balance >= 0 ? '+' : ''}${d.balance.toFixed(2)} kWh`}
             color={d.balance >= 0 ? 'text-emerald-600' : 'text-red-500'} />
      </div>
    </div>
  );
}

function Row({ label, value, color = 'text-gray-700', muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={muted ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}

function Panel({ title, icon, children, className = '' }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Slider({
  label, value, onChange, min, max, step = 1, format, accent = 'emerald', hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  format?: (v: number) => string; accent?: 'emerald' | 'blue' | 'amber'; hint?: string;
}) {
  const accentMap = { emerald: 'accent-emerald-500', blue: 'accent-blue-500', amber: 'accent-amber-500' } as const;
  const colorMap  = { emerald: 'text-emerald-600',  blue: 'text-blue-600',    amber: 'text-amber-600' } as const;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className={`text-base font-bold tabular-nums ${colorMap[accent]}`}>
          {format ? format(value) : `${value}%`}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 ${accentMap[accent]}`}
      />
      {hint && <p className="text-[11px] text-gray-400 leading-tight">{hint}</p>}
    </div>
  );
}

function KpiRow({ icon, label, value, sub, accent = 'gray' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  accent?: 'gray' | 'red' | 'emerald' | 'amber';
}) {
  const colorMap = {
    gray: 'text-gray-900', red: 'text-red-600',
    emerald: 'text-emerald-600', amber: 'text-amber-600',
  } as const;
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="w-7 h-7 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
        <div className={`text-base font-bold tabular-nums leading-tight ${colorMap[accent]}`}>{value}</div>
        {sub && <div className="text-[11px] text-gray-400 leading-tight mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
export default function SimuladorBateriaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chargeLevel, setChargeLevel] = useState(60);
  const [consumptionReduction, setConsumptionReduction] = useState(0);
  const [productionBoost, setProductionBoost] = useState(0);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    executeQuery<QueryResult>(SIMULATOR_QUERY, {}, 'network-only')
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const lvl = res?.solar?.battery?.chargeLevel ?? 60;
        setChargeLevel(Math.min(100, Math.max(0, Math.round(lvl))));
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Error al cargar datos'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const capacityKwh = data?.solar?.config?.battery?.capacityKwh ?? 0;
  const moduleCount = data?.batteries?.reduce((a, b) => a + (b.quantity ?? 0), 0) ?? 0;
  // Producción del modelo ML (kW, ya escalada) sobre el consumo del pronóstico.
  const predictions = useMemo(() => {
    const base = data?.predictions?.predictions ?? [];
    const ml = data?.mlPredictNextHours ?? [];
    if (ml.length === 0) return base;
    const byHour = new Map<number, number>();
    ml.forEach((m) => byHour.set(new Date(m.datetime).getHours(), m.productionKw));
    return base.map((p) => ({
      ...p,
      expectedProduction: byHour.get(p.hour) ?? p.expectedProduction,
    }));
  }, [data]);
  const slicedPredictions = useMemo(() => predictions.slice(0, 12), [predictions]);

  const simPoints = useMemo(
    () => simulate(chargeLevel, capacityKwh, slicedPredictions, consumptionReduction, productionBoost),
    [chargeLevel, capacityKwh, slicedPredictions, consumptionReduction, productionBoost],
  );

  const status = statusOf(chargeLevel);

  const depletion = useMemo(() => {
    const find = (k: 'batteryPct' | 'batteryPctHigh' | 'batteryPctLow') => {
      const i = simPoints.findIndex((p) => p[k] <= 1);
      return i === -1 ? null : simPoints[i]?.label ?? null;
    };
    return { base: find('batteryPct'), opt: find('batteryPctHigh'), pes: find('batteryPctLow') };
  }, [simPoints]);

  const critical = useMemo(() => {
    const i = simPoints.findIndex((p) => p.batteryPct < 20);
    return i === -1 ? null : simPoints[i]?.label ?? null;
  }, [simPoints]);

  const totalBalance = useMemo(
    () => Math.round(simPoints.reduce((s, p) => s + p.balance, 0) * 100) / 100,
    [simPoints],
  );

  const totalProd = useMemo(() => simPoints.reduce((s, p) => s + p.production, 0), [simPoints]);
  const totalCons = useMemo(() => simPoints.reduce((s, p) => s + p.consumption, 0), [simPoints]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
            <h1 className="text-sm font-semibold text-gray-900 truncate">Simulador de batería</h1>
            <span className="text-xs text-gray-400 truncate">· proyección horaria de carga</span>
          </div>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100"
            title="¿Cómo se calcula?"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            ¿Cómo funciona?
          </button>
        </div>

        {/* Help banner */}
        {showHelp && (
          <div className="bg-blue-50 border-t border-blue-100">
            <div className="max-w-[1400px] mx-auto px-4 py-3 text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold mb-1">¿Cómo se calcula el gráfico?</p>
              <p>
                Cada hora, el sistema suma la <span className="font-semibold">producción solar predicha</span> y resta el <span className="font-semibold">consumo predicho</span>.
                El resultado (balance) se aplica al nivel anterior de la batería:{' '}
                <code className="bg-white border border-blue-200 px-1.5 py-0.5 rounded font-mono">nivel(h) = nivel(h−1) + (producción − consumo) × 90%</code>.
                Las predicciones vienen de los modelos Random Forest del backend, con margen de error de ±{PROD_ERROR_PCT}% (producción) y ±{CONS_ERROR_PCT}% (consumo) —
                por eso ves tres líneas: la <span className="text-emerald-600 font-medium">más probable</span> y los escenarios <span className="text-emerald-600 font-medium">optimista</span> / <span className="text-red-600 font-medium">pesimista</span>.
              </p>
            </div>
          </div>
        )}
      </header>

      {loading && (
        <div className="flex items-center justify-center py-32 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-emerald-500" />
          <span className="text-sm">Cargando datos…</span>
        </div>
      )}

      {error && !loading && (
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <strong>Error: </strong>{error}
          </div>
        </div>
      )}

      {!loading && !error && capacityKwh <= 0 && (
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            No hay baterías configuradas. Añade al menos una desde <strong>Ajustes → Baterías</strong>.
          </div>
        </div>
      )}

      {!loading && !error && capacityKwh > 0 && (
        <main className="mx-auto px-4 py-4" style={{ maxWidth: 1500 }}>
          {/* ── 3-column flex con inline styles ─────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>

            {/* ── LEFT: Controls ────────────────────────────────────────── */}
            <aside style={{ width: 260, flexShrink: 0 }} className="space-y-4">
              <Panel
                title="Estado de la batería"
                icon={<Battery className="w-3.5 h-3.5 text-gray-400" />}
              >
                <div className="flex items-end justify-between mb-3">
                  <span className="text-3xl font-black tabular-nums text-gray-900 leading-none">
                    {chargeLevel}<span className="text-xl text-gray-400 font-bold">%</span>
                  </span>
                  <span className={`inline-flex items-center gap-1.5 ${status.bg} ${status.text} ${status.border} border rounded-full px-2 py-0.5 text-[10px] font-semibold`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <input
                  type="range" min={0} max={100} value={chargeLevel}
                  onChange={(e) => setChargeLevel(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-gray-200"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {((chargeLevel / 100) * capacityKwh).toFixed(1)} / {capacityKwh.toFixed(0)} kWh disponibles
                </p>
              </Panel>

              <Panel
                title="Ajustes de escenario"
                icon={<Activity className="w-3.5 h-3.5 text-gray-400" />}
              >
                <div className="space-y-4">
                  <Slider
                    label="Reducción de consumo"
                    value={consumptionReduction}
                    onChange={setConsumptionReduction}
                    min={0} max={50} step={5}
                    format={(v) => `−${v}%`}
                    accent="blue"
                    hint="Reduce el consumo total del sistema"
                  />
                  <div className="border-t border-gray-100" />
                  <Slider
                    label="Condición de paneles"
                    value={productionBoost}
                    onChange={setProductionBoost}
                    min={-20} max={20} step={5}
                    format={(v) => (v >= 0 ? `+${v}%` : `${v}%`)}
                    accent="amber"
                    hint="Negativo: sucios/sombreados. Positivo: ideales"
                  />
                </div>
              </Panel>

              <Panel title="Sistema" icon={<Info className="w-3.5 h-3.5 text-gray-400" />}>
                <dl className="text-xs space-y-1.5">
                  <Item dt="Capacidad" dd={`${capacityKwh.toFixed(1)} kWh`} />
                  <Item dt="Módulos" dd={String(moduleCount)} />
                  <Item dt="Eficiencia" dd={`${CHARGE_EFFICIENCY * 100}%`} />
                  <Item dt="Horizonte" dd={`${slicedPredictions.length} horas`} />
                </dl>
              </Panel>
            </aside>

            {/* ── CENTER: Chart / Table ────────────────────────────────── */}
            <div
              className="bg-white border border-gray-200 rounded-lg flex flex-col min-h-[460px]"
              style={{ flex: 1, minWidth: 0 }}
            >
              {/* Tabs + legend */}
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="flex bg-gray-100 rounded-md p-0.5">
                  <button
                    onClick={() => setView('chart')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      view === 'chart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Gráfico
                  </button>
                  <button
                    onClick={() => setView('table')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      view === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Tabla
                  </button>
                </div>
                {view === 'chart' && (
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <LegendDot color="#10b981" solid label="Más probable" />
                    <LegendDot color="#10b981" label="Optimista" />
                    <LegendDot color="#ef4444" label="Pesimista" />
                  </div>
                )}
              </div>

              {/* Chart or Table */}
              <div className="flex-1 p-3">
                {slicedPredictions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-sm text-gray-400">
                    <Battery className="w-8 h-8 mb-2 text-gray-300" />
                    Sin datos de predicción disponibles
                  </div>
                ) : view === 'chart' ? (
                  <ResponsiveContainer width="100%" height={420}>
                    <AreaChart data={simPoints} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="battFillG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`}
                        tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                      <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5}
                        label={{ value: 'Crítico 20%', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
                      <Area type="monotone" dataKey="batteryPctHigh" stroke="#10b981" strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.5} fill="none" dot={false} />
                      <Area type="monotone" dataKey="batteryPctLow"  stroke="#ef4444" strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.5} fill="none" dot={false} />
                      <Area type="monotone" dataKey="batteryPct" stroke="#10b981" strokeWidth={2.5} fill="url(#battFillG)" dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#10b981' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                          <th className="text-left font-semibold py-2 pl-1">Hora</th>
                          <th className="text-right font-semibold py-2">Producción</th>
                          <th className="text-right font-semibold py-2">Consumo</th>
                          <th className="text-right font-semibold py-2">Balance</th>
                          <th className="text-right font-semibold py-2 pr-1">Batería</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simPoints.map((p) => (
                          <tr key={p.label} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 pl-1 font-mono text-gray-700">{p.label}</td>
                            <td className="text-right tabular-nums text-emerald-600">+{p.production.toFixed(2)}</td>
                            <td className="text-right tabular-nums text-red-500">−{p.consumption.toFixed(2)}</td>
                            <td className={`text-right tabular-nums font-medium ${p.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {p.balance >= 0 ? '+' : ''}{p.balance.toFixed(2)}
                            </td>
                            <td className={`text-right tabular-nums font-semibold pr-1 ${
                              p.batteryPct < 20 ? 'text-red-500' : p.batteryPct < 50 ? 'text-amber-600' : 'text-gray-900'
                            }`}>
                              {p.batteryPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 font-semibold">
                          <td className="py-2 pl-1 text-gray-500 text-[10px] uppercase">Total</td>
                          <td className="text-right tabular-nums text-emerald-600">+{totalProd.toFixed(2)}</td>
                          <td className="text-right tabular-nums text-red-500">−{totalCons.toFixed(2)}</td>
                          <td className={`text-right tabular-nums ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {totalBalance >= 0 ? '+' : ''}{totalBalance.toFixed(2)}
                          </td>
                          <td className="text-right pr-1 text-gray-400">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: KPIs ──────────────────────────────────────────── */}
            <aside style={{ width: 280, flexShrink: 0 }} className="space-y-4">
              <Panel title="Pronóstico" icon={<TrendingDown className="w-3.5 h-3.5 text-gray-400" />}>
                <div className="-mt-1">
                  <KpiRow
                    icon={<Battery className="w-3.5 h-3.5 text-gray-500" />}
                    label="Se agota a las"
                    value={depletion.base ?? 'No se agota'}
                    sub={
                      depletion.base
                        ? `Rango: ${depletion.pes ?? '—'} – ${depletion.opt ?? 'no se agota'}`
                        : 'En las próximas 12 horas'
                    }
                    accent={depletion.base ? 'red' : 'emerald'}
                  />
                  <KpiRow
                    icon={<AlertTriangle className="w-3.5 h-3.5 text-gray-500" />}
                    label="Crítico <20%"
                    value={critical ?? 'Sin riesgo'}
                    sub={critical ? 'Considera reducir consumo' : 'Carga estable en el período'}
                    accent={critical ? 'amber' : 'emerald'}
                  />
                  <KpiRow
                    icon={<Activity className="w-3.5 h-3.5 text-gray-500" />}
                    label="Balance neto 12h"
                    value={`${totalBalance >= 0 ? '+' : ''}${totalBalance.toFixed(1)} kWh`}
                    sub="Producción − consumo"
                    accent={totalBalance >= 0 ? 'emerald' : 'red'}
                  />
                </div>
              </Panel>

              <Panel title="Margen de error" icon={<Info className="w-3.5 h-3.5 text-gray-400" />}>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Producción</span>
                    <span className="font-semibold text-gray-900 tabular-nums">±{PROD_ERROR_PCT}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Consumo</span>
                    <span className="font-semibold text-gray-900 tabular-nums">±{CONS_ERROR_PCT}%</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug pt-2 border-t border-gray-100">
                    Datos del notebook <code className="font-mono bg-gray-100 px-1 rounded">validacion_modelos_ml.ipynb</code> (Random Forest, R²=0.854).
                  </p>
                </div>
              </Panel>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}

function LegendDot({ color, solid, label }: { color: string; solid?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3.5"
        style={{
          height: solid ? '2.5px' : '0px',
          borderTop: solid ? `2.5px solid ${color}` : `1.5px dashed ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function Item({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{dt}</dt>
      <dd className="font-semibold text-gray-900 tabular-nums">{dd}</dd>
    </div>
  );
}
