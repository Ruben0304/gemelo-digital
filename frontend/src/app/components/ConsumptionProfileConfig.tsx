'use client';

import { useState, useCallback } from 'react';
import { ConsumptionProfile } from '@/types';
import { executeMutation } from '@/lib/graphql-client';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
type PresetKey = 'universidad' | 'residencial' | 'comercial' | 'industrial';

const PRESETS: Record<PresetKey, { label: string; description: string; weekday: number[]; weekend: number[] }> = {
  universidad: {
    label: 'Microrred universitaria',
    description: 'Picos en horario docente (8-17 h), mínimo nocturno.',
    weekday: [8,7,6.5,6,6,7,12,22,28,30,28,26,25,27,26,24,22,25,28,26,22,18,14,10],
    weekend: [7,6.5,6,5.5,5.5,6.5,10,14,18,20,20,19,18,19,18,17,17,20,22,20,17,14,11,8],
  },
  residencial: {
    label: 'Edificio residencial',
    description: 'Picos mañana y noche, valle durante el día.',
    weekday: [6,5,4.5,4,4,5,10,18,20,16,14,13,14,13,12,12,14,18,22,20,17,14,10,7],
    weekend: [7,6,5,4.5,4.5,6,12,16,18,18,18,17,16,17,16,16,17,20,22,20,17,14,11,8],
  },
  comercial: {
    label: 'Comercial / Oficinas',
    description: 'Consumo concentrado en horario laboral, mínimo nocturno.',
    weekday: [3,2.5,2,2,2,3,6,14,22,24,24,22,20,22,24,22,18,14,10,7,5,4,3,3],
    weekend: [3,2.5,2,2,2,3,5,8,10,11,11,10,10,10,10,9,8,7,6,5,4,3,3,3],
  },
  industrial: {
    label: 'Industria ligera',
    description: 'Dos turnos de trabajo, carga casi plana durante el día.',
    weekday: [12,12,12,12,12,14,18,28,32,32,32,30,28,30,32,32,30,28,24,20,16,14,12,12],
    weekend: [10,10,10,10,10,10,12,16,18,18,18,18,16,16,16,16,14,12,10,10,10,10,10,10],
  },
};

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------
const SAVE_MUTATION = `
  mutation SaveConsumptionProfile(
    $weekday: [Float!]!
    $weekend: [Float!]!
    $name: String
  ) {
    saveConsumptionProfile(weekday: $weekday, weekend: $weekend, name: $name) {
      _id
      name
      isActive
    }
  }
`;

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, '0')}:00`
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function confidenceForHour(hour: number, isWeekend: boolean): number {
  let c = 70;
  if ([0,1,2,3,4,5].includes(hour)) c -= 8;
  else if ([7,8,9,17,18,19,20].includes(hour)) c -= 5;
  if (isWeekend) c -= 5;
  return Math.max(50, Math.min(88, c));
}

function confidenceColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-600';
  if (pct >= 65) return 'text-amber-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ConsumptionProfileConfigProps {
  initialProfile?: ConsumptionProfile | null;
  onSaved?: (profile: ConsumptionProfile) => void;
}

export default function ConsumptionProfileConfig({
  initialProfile,
  onSaved,
}: ConsumptionProfileConfigProps) {
  const getInitial = (type: 'weekday' | 'weekend') =>
    initialProfile?.[type]?.length === 24
      ? [...initialProfile[type]]
      : [...PRESETS.universidad[type]];

  const [tab, setTab] = useState<'weekday' | 'weekend'>('weekday');
  const [weekday, setWeekday] = useState<number[]>(getInitial('weekday'));
  const [weekend, setWeekend] = useState<number[]>(getInitial('weekend'));
  const [name, setName] = useState(initialProfile?.name ?? 'Perfil principal');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const values = tab === 'weekday' ? weekday : weekend;
  const setValues = tab === 'weekday' ? setWeekday : setWeekend;
  const isWeekend = tab === 'weekend';

  const applyPreset = useCallback((key: PresetKey) => {
    setWeekday([...PRESETS[key].weekday]);
    setWeekend([...PRESETS[key].weekend]);
    setName(PRESETS[key].label);
  }, []);

  const handleChange = (index: number, raw: string) => {
    const val = parseFloat(raw);
    if (Number.isNaN(val) || val < 0) return;
    const updated = [...values];
    updated[index] = Math.min(9999, val);
    setValues(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await executeMutation(SAVE_MUTATION, { weekday, weekend, name });
      setSaveStatus('ok');
      onSaved?.({
        name,
        weekday,
        weekend,
        isActive: true,
      });
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: unknown) {
      setSaveStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const maxVal = Math.max(...weekday, ...weekend, 1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">
            Perfil de consumo horario
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Define el consumo típico (kW) para cada hora del día. Se usa para predecir
            la demanda mientras no existan suficientes datos históricos.
          </p>
        </div>
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              title={p.description}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600
                         hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Profile name */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600 w-24 shrink-0">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Nombre del perfil"
          />
        </div>

        {/* Day-type tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['weekday', 'weekend'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-4 py-1.5 rounded-md font-medium transition-all ${
                tab === t
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'weekday' ? 'Días laborales' : 'Fin de semana'}
            </button>
          ))}
        </div>

        {/* Bar chart + inputs */}
        <div className="space-y-2">
          {/* Mini bar chart */}
          <div className="flex items-end gap-0.5 h-16 px-1">
            {values.map((v, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end group"
                onMouseEnter={() => setHoveredHour(i)}
                onMouseLeave={() => setHoveredHour(null)}
              >
                <div
                  className="w-full rounded-t-sm transition-all duration-150"
                  style={{
                    height: `${Math.max(4, (v / maxVal) * 56)}px`,
                    background:
                      hoveredHour === i
                        ? '#3b82f6'
                        : confidenceForHour(i, isWeekend) >= 75
                        ? '#10b981'
                        : confidenceForHour(i, isWeekend) >= 65
                        ? '#f59e0b'
                        : '#ef4444',
                    opacity: hoveredHour !== null && hoveredHour !== i ? 0.5 : 1,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 px-1 text-[9px] text-gray-400">
            {[0,3,6,9,12,15,18,21].map((h) => (
              <div key={h} className="flex-[3] text-center">{h}h</div>
            ))}
          </div>

          {/* Tooltip on hover */}
          {hoveredHour !== null && (
            <div className="text-xs bg-gray-900 text-white rounded-lg px-3 py-2 flex gap-4">
              <span className="font-mono">{HOUR_LABELS[hoveredHour]}</span>
              <span>{values[hoveredHour].toFixed(1)} kW</span>
              <span className={confidenceColor(confidenceForHour(hoveredHour, isWeekend))}>
                Confianza estimada: {confidenceForHour(hoveredHour, isWeekend)}%
              </span>
              <span className="text-gray-400">
                {[0,1,2,3,4,5].includes(hoveredHour)
                  ? 'Hora nocturna — uso irregular'
                  : [7,8,9,17,18,19,20].includes(hoveredHour)
                  ? 'Hora de transición — mayor variabilidad'
                  : 'Hora estable'}
              </span>
            </div>
          )}

          {/* Input grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5 pt-1">
            {values.map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-gray-400">{HOUR_LABELS[i]}</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={v}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onMouseEnter={() => setHoveredHour(i)}
                  onMouseLeave={() => setHoveredHour(null)}
                  className="w-full text-center text-xs border border-gray-200 rounded-md py-1
                             focus:outline-none focus:ring-1 focus:ring-blue-400
                             hover:border-blue-300 transition-colors"
                />
                <span
                  className={`text-[9px] font-semibold ${confidenceColor(
                    confidenceForHour(i, isWeekend)
                  )}`}
                  title={`Confianza de predicción para esta hora: ${confidenceForHour(i, isWeekend)}%`}
                >
                  {confidenceForHour(i, isWeekend)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            ≥75% — Alta confianza (horas estables)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            65-74% — Confianza media (transición)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
            &lt;65% — Confianza baja (noche / fin de semana)
          </div>
          <div className="ml-auto text-gray-400 italic">
            La confianza nunca llega al 100%: los perfiles son estimaciones
            con variabilidad natural ±15-25%.
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                       rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </button>
          {saveStatus === 'ok' && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircleIcon className="w-4 h-4" />
              Perfil guardado correctamente
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <ExclamationCircleIcon className="w-4 h-4" />
              {errorMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
