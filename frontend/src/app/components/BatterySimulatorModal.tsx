'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { X, Zap, Battery, Info } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes de incertidumbre (fuente: backend/notebooks/validacion_modelos_ml.ipynb)
// ──────────────────────────────────────────────────────────────────────────────
const PROD_ERROR_PCT = 7;
const CONS_ERROR_PCT = 20;
const CHARGE_EFFICIENCY = 0.9;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface Prediction {
  timestamp: string;
  hour: number;
  expectedProduction: number;
  expectedConsumption: number;
  confidence: number;
}

interface SimPoint {
  label: string;
  batteryPct: number;
  batteryPctHigh: number;
  batteryPctLow: number;
  production: number;
  consumption: number;
  balance: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  capacityKwh: number;
  predictions: Prediction[];
  initialChargeLevel?: number;
  moduleCount?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Simulación
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
    kwh = Math.min(
      capacityKwh,
      Math.max(0, kwh + (balance > 0 ? balance * CHARGE_EFFICIENCY : balance)),
    );
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

function batteryStatus(pct: number) {
  if (pct >= 80) return { label: 'Óptima',  dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (pct >= 50) return { label: 'Normal',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50' };
  if (pct >= 20) return { label: 'Baja',    dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' };
  return            { label: 'Crítica', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tooltip del chart
// ──────────────────────────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SimPoint }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = d.batteryPct < 20 ? '#ef4444' : d.batteryPct < 50 ? '#f59e0b' : '#10b981';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl px-4 py-3 text-sm min-w-[220px]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-bold text-base" style={{ color }}>{d.batteryPct.toFixed(0)}%</span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Rango posible</span>
          <span className="tabular-nums">{d.batteryPctLow.toFixed(0)}% – {d.batteryPctHigh.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between"><span className="text-gray-500">Producción</span><span className="tabular-nums text-emerald-600">+{d.production.toFixed(1)} kWh</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Consumo</span><span className="tabular-nums text-red-500">−{d.consumption.toFixed(1)} kWh</span></div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────────────────────────────────────
export default function BatterySimulatorModal({
  isOpen, onClose, capacityKwh, predictions, initialChargeLevel = 60, moduleCount,
}: Props) {
  const [chargeLevel, setChargeLevel] = useState(
    Math.min(100, Math.max(0, Math.round(initialChargeLevel))),
  );
  const [consumptionReduction, setConsumptionReduction] = useState(0);
  const [productionBoost, setProductionBoost] = useState(0);

  useEffect(() => {
    if (isOpen) setChargeLevel(Math.min(100, Math.max(0, Math.round(initialChargeLevel))));
  }, [isOpen, initialChargeLevel]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const slicedPredictions = useMemo(() => predictions.slice(0, 12), [predictions]);
  const simPoints = useMemo(
    () => simulate(chargeLevel, capacityKwh, slicedPredictions, consumptionReduction, productionBoost),
    [chargeLevel, capacityKwh, slicedPredictions, consumptionReduction, productionBoost],
  );
  const status = batteryStatus(chargeLevel);

  const depletion = useMemo(() => {
    const i = simPoints.findIndex((p) => p.batteryPct <= 1);
    const iOpt = simPoints.findIndex((p) => p.batteryPctHigh <= 1);
    const iPes = simPoints.findIndex((p) => p.batteryPctLow <= 1);
    return {
      base: i === -1 ? null : simPoints[i]?.label ?? null,
      opt:  iOpt === -1 ? null : simPoints[iOpt]?.label ?? null,
      pes:  iPes === -1 ? null : simPoints[iPes]?.label ?? null,
    };
  }, [simPoints]);

  const critical = useMemo(() => {
    const i = simPoints.findIndex((p) => p.batteryPct < 20);
    return i === -1 ? null : simPoints[i]?.label ?? null;
  }, [simPoints]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Simulador de batería</h2>
              <p className="text-sm text-gray-500 mt-0.5">¿Cuánto durará tu batería en las próximas horas?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ── Body scrollable ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-7">

          {/* ── 1. Nivel actual ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Nivel actual de la batería</h3>
              <span className={`inline-flex items-center gap-2 ${status.bg} ${status.text} rounded-full px-3 py-1 text-sm font-semibold`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div className="flex items-end gap-2 mb-4">
                <span className="text-6xl font-black tabular-nums text-gray-900 leading-none">{chargeLevel}</span>
                <span className="text-3xl font-bold text-gray-400 pb-1">%</span>
                <span className="text-sm text-gray-500 pb-2 ml-2">
                  ≈ {((chargeLevel / 100) * capacityKwh).toFixed(1)} kWh disponibles
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={chargeLevel}
                onChange={(e) => setChargeLevel(Number(e.target.value))}
                className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-gray-200"
              />
              <p className="text-sm text-gray-500 mt-2">
                Arrastra para indicar cuánta carga tiene la batería ahora mismo.
              </p>
            </div>
          </section>

          {/* ── 2. Escenario ─────────────────────────────────────────────── */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Simula un escenario</h3>
            <p className="text-sm text-gray-500 mb-4">
              ¿Qué pasaría si bajas el consumo o cambian las condiciones del sol? Ajusta los controles y verás el efecto en el gráfico al instante.
            </p>

            <div className="space-y-5">
              {/* Reducción consumo */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-base font-medium text-gray-800">Apagar electrodomésticos</label>
                  <span className="text-2xl font-bold tabular-nums text-blue-600">−{consumptionReduction}%</span>
                </div>
                <input
                  type="range" min={0} max={50} step={5}
                  value={consumptionReduction}
                  onChange={(e) => setConsumptionReduction(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500 bg-gray-200"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Reduce el consumo total apagando equipos no esenciales (aire, luces, etc.).
                </p>
              </div>

              {/* Ajuste producción */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-base font-medium text-gray-800">Condición de los paneles</label>
                  <span className={`text-2xl font-bold tabular-nums ${productionBoost >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {productionBoost >= 0 ? '+' : ''}{productionBoost}%
                  </span>
                </div>
                <input
                  type="range" min={-20} max={20} step={5}
                  value={productionBoost}
                  onChange={(e) => setProductionBoost(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500 bg-gray-200"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Negativo si los paneles están sucios o sombreados. Positivo en condiciones ideales.
                </p>
              </div>
            </div>
          </section>

          {/* ── 3. Resultado en lenguaje claro ───────────────────────────── */}
          <section className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Battery className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 mb-2">Pronóstico</h3>
                <p className="text-base text-gray-800 leading-relaxed">
                  {depletion.base ? (
                    <>
                      Con este escenario, la batería se <span className="font-bold text-red-600">agotará alrededor de las {depletion.base}</span>.
                      {depletion.pes && depletion.opt && (
                        <> El rango realista está entre las <span className="font-semibold">{depletion.pes}</span> (pesimista) y las <span className="font-semibold">{depletion.opt}</span> (optimista).</>
                      )}
                    </>
                  ) : (
                    <>
                      La batería <span className="font-bold text-emerald-700">no se agotará</span> en las próximas 12 horas con este escenario.
                    </>
                  )}
                  {critical && (
                    <> Llegará al <span className="font-semibold text-amber-700">nivel crítico (20%) a las {critical}</span>.</>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* ── 4. Gráfico ───────────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Evolución hora a hora</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <Legend color="#10b981" solid label="Más probable" />
                <Legend color="#10b981" label="Optimista" />
                <Legend color="#ef4444" label="Pesimista" />
              </div>
            </div>

            {slicedPredictions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] rounded-xl bg-gray-50 border border-dashed border-gray-200 text-sm text-gray-400">
                <Battery className="w-8 h-8 mb-2 text-gray-300" />
                Sin datos de predicción disponibles
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={simPoints} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="battFillM" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <ReferenceLine
                      y={20}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{ value: 'Crítico 20%', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
                    />
                    <Area type="monotone" dataKey="batteryPctHigh" stroke="#10b981" strokeWidth={1.4} strokeDasharray="4 3" strokeOpacity={0.55} fill="none" dot={false} />
                    <Area type="monotone" dataKey="batteryPctLow"  stroke="#ef4444" strokeWidth={1.4} strokeDasharray="4 3" strokeOpacity={0.55} fill="none" dot={false} />
                    <Area type="monotone" dataKey="batteryPct" stroke="#10b981" strokeWidth={3} fill="url(#battFillM)" dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: '#10b981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── 5. Info de incertidumbre ─────────────────────────────────── */}
          <section className="flex items-start gap-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <Info className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <p className="mb-1">
                <span className="font-semibold text-gray-800">Las predicciones tienen margen de error:</span> producción ±{PROD_ERROR_PCT}% y consumo ±{CONS_ERROR_PCT}%.
              </p>
              <p className="text-gray-500">
                Por eso el gráfico muestra dos líneas punteadas — el rango realista en el que estará la batería.
                Fuentes: modelo Random Forest de producción solar (R²=0.854) y de consumo (MAE=8.13 kW) validados en el notebook del backend.
              </p>
            </div>
          </section>

          {/* ── Datos del sistema ───────────────────────────────────────── */}
          <section className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <Stat label="Capacidad total" value={`${capacityKwh.toFixed(1)} kWh`} />
            <Stat label="Módulos" value={moduleCount != null ? String(moduleCount) : '—'} />
            <Stat label="Eficiencia" value={`${CHARGE_EFFICIENCY * 100}%`} />
          </section>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="px-6 py-3 border-t border-gray-200 bg-gray-50/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function Legend({ color, solid, label }: { color: string; solid?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-4"
        style={{
          height: solid ? '3px' : '0px',
          borderTop: solid ? `3px solid ${color}` : `2px dashed ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-base font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
