'use client';

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *  ESCENA 3D — COMENTADA (disponible para reactivar en futuras versiones)
 * ═══════════════════════════════════════════════════════════════════════════════
 * La implementación completa usa react-three-fiber + drei para visualizar
 * obstáculos (árboles, edificios) y calcular sombras 3D sobre el panel.
 * Scene.tsx sigue intacto. Para reactivar: restaurar las importaciones y el
 * bloque <Scene> que se indica al final de este bloque de comentarios.
 *
 * import dynamic from 'next/dynamic';
 * import { computeShadow, type Obstacle, type ObstacleType, type PanelRect } from '@/lib/shadowCalc';
 * import type { InstallationType, InstallationState, TransformMode } from './Scene';
 * import { INSTALLATION_ID } from './Scene';
 * import { Move3d, RotateCcw as RotateCcw3D, TreePine, Building2, Trash2, Plus, Compass, Home, Grid3x3 } from 'lucide-react';
 * import { sunDirection } from '@/lib/sunPosition';
 * const Scene = dynamic(() => import('./Scene'), { ssr: false });
 *
 * const PANEL_BY_INSTALL: Record<InstallationType, PanelRect> = {
 *   house: { center: { x: -0.6, y: 2.1, z: 0 }, width: 1.6, depth: 2, tiltDeg: 30, azimuthDeg: 180 },
 *   park:  { center: { x: 0,   y: 0.7, z: 0 }, width: 4,   depth: 3, tiltDeg: 15, azimuthDeg: 180 },
 * };
 * const OBSTACLE_DEFAULTS = {
 *   tree:     { height: 6, radius: 2, label: 'Árbol' },
 *   building: { height: 6, radius: 2, label: 'Edificio' },
 * };
 * let nextObstacleId = 0;
 * const newId = () => `obs-${++nextObstacleId}`;
 * const DEFAULT_OBSTACLES: Obstacle[] = [
 *   { id: newId(), type: 'tree',     position: { x: -7, y: 0, z: -2 }, height: 6, radius: 2 },
 *   { id: newId(), type: 'building', position: { x: 9,  y: 0, z: 5  }, height: 6, radius: 2 },
 * ];
 *
 * // Estado 3D (dentro del componente):
 * // const [obstacles, setObstacles]             = useState<Obstacle[]>(DEFAULT_OBSTACLES);
 * // const [selectedId, setSelectedId]           = useState<string | null>(null);
 * // const [installation, setInstallation]       = useState<InstallationType>('house');
 * // const [installationState, setInstallationState] = useState<InstallationState>({ position:{x:0,y:0,z:0}, scale:1, rotationY:0 });
 * // const [transformMode, setTransformMode]     = useState<TransformMode>('translate');
 * // const panel = useMemo(() => { ... }, [installation, installationState]);
 * // const sunDir = useMemo(() => sunDirection(sunPos), [sunPos]);
 * // const shadow = useMemo(() => computeShadow(panel, sunDir, obstacles, sunPos.elevationDeg), [...]);
 * // const productionMultiplier = useMemo(() => { ... }, [shadow.shadowPct, sunPos.elevationDeg]);
 * // function addObstacle(type: ObstacleType) { ... }
 * // function removeSelected() { ... }
 * // function moveObstacle(id: string, x: number, z: number) { ... }
 * // function rotateObstacle(id: string, yRad: number) { ... }
 * // function updateSelected(patch: Partial<Obstacle>) { ... }
 *
 * // Bloque <Scene> (sustituye al selector de franjas en el layout):
 * // <Scene
 * //   obstacles={obstacles} selectedId={selectedId}
 * //   sunDirection={sunDir} sunElevDeg={sunPos.elevationDeg}
 * //   panel={panel} shadowResult={shadow}
 * //   installation={installation} installationState={installationState}
 * //   transformMode={transformMode}
 * //   onSelectObstacle={setSelectedId}
 * //   onMoveObstacle={moveObstacle}
 * //   onRotateObstacle={rotateObstacle}
 * // />
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Sun, Info, HelpCircle, Activity, BarChart3, Edit3, RotateCcw,
  Save, CheckCircle, CloudOff,
} from 'lucide-react';
import { sunPosition } from '@/lib/sunPosition';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
import { SHADOW_PROFILE_QUERY, SAVE_SHADOW_PROFILE_MUTATION } from '@/lib/graphql-queries';

const LAT = 23.1136;
const LON = -82.3666;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 5); // 05:00 → 19:00

interface TimeSlot {
  hour: number;
  shadowPct: number;
  prodOverride: number | null; // null = automático (100 − shadowPct)
}

function shadowColor(pct: number): string {
  if (pct === 0) return '#10b981';
  if (pct < 25)  return '#f59e0b';
  if (pct < 50)  return '#f97316';
  return '#ef4444';
}

function autoProd(shadowPct: number): number {
  return Math.max(0, 100 - shadowPct);
}

function fmt(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SimuladorSombrasPage() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [showHelp, setShowHelp] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>(
    HOURS.map(h => ({ hour: h, shadowPct: 0, prodOverride: null })),
  );
  const [editingHour, setEditingHour] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Cargar perfil guardado al montar
  useEffect(() => {
    executeQuery<{ shadowProfile: { slots: { hour: number; shadowPct: number; prodOverride: number | null }[]; updatedAt: string | null } | null }>(
      SHADOW_PROFILE_QUERY,
      {},
      'network-only',
    ).then(data => {
      const profile = data?.shadowProfile;
      if (!profile?.slots?.length) return;
      setSlots(prev => prev.map(s => {
        const saved = profile.slots.find(p => p.hour === s.hour);
        return saved ? { ...s, shadowPct: saved.shadowPct, prodOverride: saved.prodOverride } : s;
      }));
      if (profile.updatedAt) setLastSaved(profile.updatedAt);
    }).catch(() => { /* sin BD conectada — silencioso */ });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const slotsToSave = slots.map(s => ({
        hour: s.hour,
        shadowPct: s.shadowPct,
        prodOverride: s.prodOverride ?? null,
      }));
      const data = await executeMutation<{ saveShadowProfile: { updatedAt: string } }>(
        SAVE_SHADOW_PROFILE_MUTATION,
        { slots: slotsToSave },
      );
      setLastSaved(data?.saveShadowProfile?.updatedAt ?? new Date().toISOString());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  }, [slots]);

  // Elevación solar por hora (para saber qué franjas son diurnas)
  const sunElevations = useMemo(() => HOURS.map(h => {
    const d = new Date();
    d.setMonth(month - 1, 15); // día 15 representativo del mes
    d.setHours(h, 30, 0, 0);
    return { hour: h, elev: sunPosition(d, LAT, LON).elevationDeg };
  }), [month]);

  const isDayHour = (h: number) =>
    (sunElevations.find(e => e.hour === h)?.elev ?? -1) > 0;

  const updateSlot = (hour: number, patch: Partial<TimeSlot>) =>
    setSlots(prev => prev.map(s => s.hour === hour ? { ...s, ...patch } : s));

  const daySlots = useMemo(
    () => slots.filter(s => isDayHour(s.hour)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots, sunElevations],
  );

  const stats = useMemo(() => {
    if (!daySlots.length) return { avgShadow: 0, avgProd: 100, withShadow: 0, total: 0, manualCount: 0 };
    const avgShadow = daySlots.reduce((a, s) => a + s.shadowPct, 0) / daySlots.length;
    const avgProd   = daySlots.reduce((a, s) => a + (s.prodOverride ?? autoProd(s.shadowPct)), 0) / daySlots.length;
    return {
      avgShadow,
      avgProd,
      withShadow: daySlots.filter(s => s.shadowPct > 0).length,
      total: daySlots.length,
      manualCount: slots.filter(s => s.prodOverride !== null).length,
    };
  }, [daySlots, slots]);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            <h1 className="text-sm font-semibold text-gray-900 truncate">Simulador de sombras</h1>
            <span className="text-xs text-gray-400 hidden sm:inline truncate">
              · estimación de impacto por franja horaria
            </span>
          </div>
          <button
            onClick={() => setShowHelp(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" /> ¿Cómo funciona?
          </button>

          <div className="w-px h-5 bg-gray-200" />

          {/* Botón guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              saveStatus === 'saved'
                ? 'bg-emerald-100 text-emerald-700'
                : saveStatus === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
            }`}
          >
            {saveStatus === 'saved' ? (
              <><CheckCircle className="w-3.5 h-3.5" /> Guardado</>
            ) : saveStatus === 'error' ? (
              <><CloudOff className="w-3.5 h-3.5" /> Error al guardar</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar perfil'}</>
            )}
          </button>
        </div>

        {showHelp && (
          <div className="bg-blue-50 border-t border-blue-100">
            <div className="max-w-[1400px] mx-auto px-4 py-3 text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold mb-1">Estimación de sombras por franja horaria</p>
              <p>
                Define el porcentaje de superficie del panel que estará sombreada en cada hora del día.
                La reducción de producción se calcula automáticamente como (100% − % sombra), pero
                puedes ajustarla manualmente por franja si dispones de datos de irradiancia más precisos.
                Solo se contabilizan las franjas con elevación solar {'>'} 0° (La Habana, {LAT}°N).
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">

          {/* ── LEFT: Editor ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Mes */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-800">Mes de análisis</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6 }}>
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setMonth(i + 1)}
                    className={`text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                      month === i + 1
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Gráfico */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">Perfil de sombra diario</span>
                <span className="ml-auto text-xs text-gray-400">{MONTHS[month - 1]}, día representativo</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-5">
                Porcentaje de sombra sobre el panel por hora solar
              </p>

              {/* Barras */}
              <div className="flex items-end gap-px" style={{ height: 96 }}>
                {slots.map(slot => {
                  const isDay = isDayHour(slot.hour);
                  const barPx = isDay
                    ? slot.shadowPct > 0
                      ? Math.max(4, (slot.shadowPct / 100) * 78)
                      : 0
                    : 0;
                  const color = shadowColor(slot.shadowPct);
                  return (
                    <div
                      key={slot.hour}
                      className="flex-1 flex flex-col items-center justify-end"
                      style={{ height: '100%' }}
                    >
                      <div
                        className="w-full flex flex-col items-center justify-end border-b border-gray-100"
                        style={{ height: 78 }}
                      >
                        {isDay ? (
                          <div
                            className="w-full rounded-t transition-all duration-200"
                            style={{
                              height: slot.shadowPct === 0 ? 2 : barPx,
                              backgroundColor: slot.shadowPct === 0 ? '#d1fae5' : color,
                            }}
                          />
                        ) : (
                          <div className="w-full" style={{ height: 2, backgroundColor: '#f1f5f9' }} />
                        )}
                      </div>
                      <span className="text-[8px] text-gray-300 tabular-nums mt-1 leading-none">
                        {slot.hour}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
                {[
                  { bg: '#d1fae5', label: 'Sin sombra (0%)' },
                  { bg: '#f59e0b', label: 'Leve (1–24%)' },
                  { bg: '#f97316', label: 'Moderada (25–49%)' },
                  { bg: '#ef4444', label: 'Alta (≥ 50%)' },
                  { bg: '#f1f5f9', label: 'Sin sol' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.bg }} />
                    <span className="text-[10px] text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla de franjas */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Header tabla */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <Activity className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Configuración por franja horaria
                </h2>
                <span className="ml-auto text-[11px] text-gray-400">
                  {stats.total} franjas diurnas · {MONTHS[month - 1]}
                </span>
              </div>

              {/* Cabecera columnas */}
              <div
                className="grid items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400"
                style={{ gridTemplateColumns: '110px 1fr 220px' }}
              >
                <span>Franja horaria</span>
                <span>% de sombra sobre el panel</span>
                <span>Reducción de producción</span>
              </div>

              {/* Filas */}
              <div className="divide-y divide-gray-50">
                {slots.map(slot => {
                  const isDay   = isDayHour(slot.hour);
                  const prod    = slot.prodOverride ?? autoProd(slot.shadowPct);
                  const isEditing = editingHour === slot.hour;
                  const color   = shadowColor(slot.shadowPct);

                  return (
                    <div
                      key={slot.hour}
                      className={`grid items-center gap-4 px-5 py-3 transition-colors ${
                        !isDay ? 'opacity-30 bg-gray-50/50' : 'hover:bg-slate-50/60'
                      }`}
                      style={{ gridTemplateColumns: '110px 1fr 220px' }}
                    >
                      {/* Hora */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isDay ? '#fbbf24' : '#e2e8f0' }}
                        />
                        <span className="text-[13px] font-mono font-bold text-gray-700 tabular-nums">
                          {fmt(slot.hour)}
                        </span>
                        <span className="text-[10px] text-gray-300">–</span>
                        <span className="text-[11px] font-mono text-gray-400 tabular-nums">
                          {fmt(slot.hour + 1)}
                        </span>
                      </div>

                      {/* Slider sombra */}
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0} max={100} step={5}
                          value={slot.shadowPct}
                          disabled={!isDay}
                          onChange={e => updateSlot(slot.hour, { shadowPct: Number(e.target.value) })}
                          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                          style={{ accentColor: isDay ? color : '#e2e8f0' }}
                        />
                        <span
                          className="w-10 text-right text-sm font-black tabular-nums"
                          style={{ color: isDay ? color : '#cbd5e1' }}
                        >
                          {slot.shadowPct}%
                        </span>
                      </div>

                      {/* Producción */}
                      <div className="flex items-center gap-2">
                        {isEditing && isDay ? (
                          <input
                            type="number"
                            min={0} max={100}
                            value={slot.prodOverride ?? prod}
                            autoFocus
                            onChange={e =>
                              updateSlot(slot.hour, {
                                prodOverride: Math.min(100, Math.max(0, Number(e.target.value))),
                              })
                            }
                            onBlur={() => setEditingHour(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditingHour(null)}
                            className="w-20 text-sm font-bold text-right border-2 border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 tabular-nums bg-white"
                          />
                        ) : (
                          <span
                            className="text-sm font-black tabular-nums"
                            style={{
                              color: !isDay ? '#cbd5e1'
                                : prod >= 80 ? '#059669'
                                : prod >= 60 ? '#d97706'
                                : prod >= 40 ? '#ea580c'
                                : '#dc2626',
                            }}
                          >
                            {prod.toFixed(0)}%
                          </span>
                        )}

                        {slot.prodOverride !== null && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                            manual
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-1">
                          {isDay && (
                            <button
                              onClick={() => setEditingHour(isEditing ? null : slot.hour)}
                              title={isEditing ? 'Confirmar' : 'Editar producción manualmente'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isEditing
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'text-gray-300 hover:text-blue-500 hover:bg-gray-100'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          {slot.prodOverride !== null && (
                            <button
                              onClick={() => updateSlot(slot.hour, { prodOverride: null })}
                              title="Restaurar cálculo automático"
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-gray-100 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer tabla */}
              <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 text-[11px] text-gray-400 leading-snug flex items-center gap-1.5">
                <Edit3 className="w-3 h-3 flex-shrink-0" />
                Ajusta el slider para definir la fracción sombreada · usa el ícono para introducir
                una reducción de producción específica distinta del valor automático.
              </div>
            </div>
          </div>

          {/* ── RIGHT: Resumen ───────────────────────────────────────────── */}
          <aside className="w-72 flex-shrink-0 space-y-4">

            {/* Estadísticas */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">Resumen del día</h2>
              </div>

              {/* Indicador principal */}
              <div className="text-center py-5 mb-4 bg-gray-50 rounded-xl">
                <div
                  className="text-5xl font-black tabular-nums leading-none"
                  style={{
                    color: stats.avgShadow === 0 ? '#10b981'
                      : stats.avgShadow < 20   ? '#f59e0b'
                      : stats.avgShadow < 40   ? '#f97316'
                      : '#ef4444',
                  }}
                >
                  {stats.avgShadow.toFixed(0)}
                  <span className="text-3xl font-bold text-gray-300">%</span>
                </div>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-2 font-semibold">
                  Sombra promedio diurna
                </p>
              </div>

              {/* Barra producción */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500 font-medium">Producción media estimada</span>
                  <span
                    className="font-black tabular-nums"
                    style={{
                      color: stats.avgProd >= 80 ? '#059669'
                        : stats.avgProd >= 60    ? '#d97706'
                        : '#dc2626',
                    }}
                  >
                    {stats.avgProd.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stats.avgProd}%`,
                      backgroundColor: stats.avgProd >= 80 ? '#10b981'
                        : stats.avgProd >= 60 ? '#f59e0b'
                        : '#ef4444',
                    }}
                  />
                </div>
              </div>

              {/* Detalles */}
              <dl className="space-y-2.5 border-t border-gray-100 pt-3">
                {[
                  { dt: 'Pérdida estimada',           dd: `−${(100 - stats.avgProd).toFixed(0)}%`, red: true },
                  { dt: 'Franjas con sombra',          dd: `${stats.withShadow} de ${stats.total}` },
                  { dt: 'Producciones editadas',       dd: `${stats.manualCount}`, blue: true },
                ].map(({ dt, dd, red, blue }) => (
                  <div key={dt} className="flex justify-between text-xs">
                    <span className="text-gray-500">{dt}</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: red ? '#dc2626' : blue ? '#2563eb' : '#111827' }}
                    >
                      {dd}
                    </span>
                  </div>
                ))}
              </dl>
            </div>

            {/* Parámetros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">Parámetros del sistema</h2>
              </div>
              <dl className="space-y-2 text-xs">
                {[
                  { dt: 'Ubicación',        dd: 'La Habana, Cuba' },
                  { dt: 'Latitud',          dd: `${LAT}°N` },
                  { dt: 'Longitud',         dd: `${LON}°` },
                  { dt: 'Mes seleccionado', dd: MONTHS[month - 1] },
                  { dt: 'Franjas diurnas',  dd: `${stats.total} horas` },
                  { dt: 'Método',           dd: 'Estimación manual' },
                ].map(({ dt, dd }) => (
                  <div key={dt} className="flex justify-between">
                    <span className="text-gray-400">{dt}</span>
                    <span className="font-semibold text-gray-800">{dd}</span>
                  </div>
                ))}
              </dl>
            </div>

            {/* Nota */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[11px] text-amber-900 leading-relaxed">
              <p className="font-bold mb-1.5">Integración con el simulador de batería</p>
              <p>
                El promedio de sombra diurna ({stats.avgShadow.toFixed(0)}%) puede emplearse como
                parámetro de <em>condición de paneles</em> en el Simulador de batería para estimar
                la autonomía real del sistema bajo estas condiciones de sombreo.
              </p>
            </div>

            {/* Última vez guardado */}
            {lastSaved && (
              <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span>
                  Perfil guardado ·{' '}
                  {new Date(lastSaved).toLocaleString('es-CU', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Reset */}
            <button
              onClick={() => setSlots(HOURS.map(h => ({ hour: h, shadowPct: 0, prodOverride: null })))}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 py-2.5 rounded-xl hover:bg-gray-100 border border-gray-200 bg-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reiniciar todo a 0%
            </button>
          </aside>

        </div>
      </main>
    </div>
  );
}
