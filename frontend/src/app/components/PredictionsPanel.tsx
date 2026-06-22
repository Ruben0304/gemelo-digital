'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Prediction,
  WeatherData,
  BatteryStatus,
  SystemConfig,
} from '@/types';
import { Info, BrainCircuit, LineChart, ChevronDown, ChevronUp, AlertTriangle, AlertOctagon, Lightbulb } from 'lucide-react';

interface PredictionsPanelProps {
  predictions: Prediction[];
  alerts: Alert[];
  recommendations: string[];
  weather?: WeatherData | null;
  batteryProjection?: BatteryStatus;
  config?: SystemConfig;
  solarModelR2?: number | null;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const overflowRight = rect.right - window.innerWidth + 8;
    const overflowLeft = 8 - rect.left;
    if (overflowRight > 0) setShift(-overflowRight);
    else if (overflowLeft > 0) setShift(overflowLeft);
    else setShift(0);
  }, [visible]);

  return (
    <span
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => { setVisible(false); setShift(0); }}
    >
      {children}
      {visible && (
        <span
          ref={tooltipRef}
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
          className="absolute z-50 bottom-full left-1/2 mb-2
                     w-72 rounded-lg bg-gray-900 text-white text-xs px-3 py-2.5 shadow-xl
                     pointer-events-none leading-relaxed whitespace-pre-line">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confidence pill
// ---------------------------------------------------------------------------
function ConfidencePill({ pct, tooltip }: { pct: number; tooltip: React.ReactNode }) {
  const color =
    pct >= 75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 65 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <Tooltip content={tooltip}>
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1
                        rounded-full border ${color}`}>
        {pct}%
        <Info className="w-3 h-3 opacity-60" />
      </span>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDay(d: Date) {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ALERT_STYLES = {
  critical: { box: 'border-red-200 bg-red-50', text: 'text-red-700', icon: AlertOctagon },
  warning: { box: 'border-amber-200 bg-amber-50', text: 'text-amber-700', icon: AlertTriangle },
  info: { box: 'border-sky-200 bg-sky-50', text: 'text-sky-700', icon: Info },
} as const;

export default function PredictionsPanel({
  predictions,
  alerts = [],
  recommendations = [],
  solarModelR2,
}: PredictionsPanelProps) {
  const [methodOpen, setMethodOpen] = useState(false);

  // ── Confidence averages ──────────────────────────────────────────────────
  const avgSolarConf =
    predictions.length > 0
      ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length)
      : null;

  return (
    <div className="space-y-5">

      {/* ── Prediction confidence info card ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-4">

          {/* Solar confidence */}
          {avgSolarConf !== null && (
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-50 rounded-lg shrink-0">
                <BrainCircuit className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Predicción solar (estimación)</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ConfidencePill
                    pct={avgSolarConf}
                    tooltip={
                      <>
                        <span className="font-semibold block mb-1">Modelo Random Forest</span>
                        Entrenado con datos históricos de Open-Meteo.{'\n'}
                        Características: temperatura, humedad, viento, nubosidad, radiación, hora (sin/cos).
                        {solarModelR2 != null && (
                          <>{'\n'}R² en test: {(solarModelR2 * 100).toFixed(1)}% — el {(100 - solarModelR2 * 100).toFixed(1)}% restante es variabilidad no capturada.</>
                        )}
                        {'\n\n'}No llega al 100% porque: variabilidad sub-horaria, sombreado puntual, polvo en paneles y cambios bruscos de nubosidad no capturados por el pronóstico.
                      </>
                    }
                  />
                  <span className="text-xs text-gray-400">confianza media</span>
                </div>
              </div>
            </div>
          )}

          {/* Expand methodology */}
          <button
            onClick={() => setMethodOpen((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Metodología
            {methodOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Methodology detail (collapsible) */}
        {methodOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
            <div className="space-y-1.5">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-amber-500" /> Producción solar — Random Forest
              </p>
              <p>Fuente de datos: API Open-Meteo (pronóstico horario).</p>
              <p>9 características: temperatura, humedad, viento, nubosidad, radiación, hora (sin/cos), día del año.</p>
              {solarModelR2 != null && (
                <p>R² en conjunto de test: <span className="font-mono font-semibold">{(solarModelR2 * 100).toFixed(1)}%</span>.</p>
              )}
              <p>Confianza reducida cuando la nubosidad prevista es alta (mayor incertidumbre en radiación).</p>
              <p className="text-gray-400">Archivo: <span className="font-mono">solar_production_random_forest.pkl</span></p>
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <LineChart className="w-3.5 h-3.5 text-blue-500" /> Consumo — electrodomésticos configurados
              </p>
              <p>Basado en los electrodomésticos y sus perfiles horarios configurados en Ajustes.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Alertas del sistema ──────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.info;
            const Icon = style.icon;
            return (
              <div
                key={alert.id}
                role={alert.type === 'critical' ? 'alert' : 'status'}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style.box}`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} />
                <div>
                  <p className={`text-sm font-semibold ${style.text}`}>{alert.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Recomendaciones ──────────────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Recomendaciones operativas</h3>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
