'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Activity, Clock3, Layers, LineChart, Pencil, PenLine, Plus, Trash, Upload, X, Zap } from 'lucide-react';
import type { ApplianceConfig, ApplianceBatch, ApplianceMode, BatchPreview, InverterConfig, SystemConfig } from '@/types';
import { executeMutation, executeQuery } from '@/lib/graphql-client';
import {
  APPLIANCE_BATCHES_QUERY,
  PREVIEW_APPLIANCE_BATCH_MUTATION,
  UPLOAD_APPLIANCE_BATCH_MUTATION,
  DELETE_APPLIANCE_BATCH_MUTATION,
} from '@/lib/graphql-queries';
import ConfirmDialog from './ConfirmDialog';

interface AppliancesManagerProps {
  appliances: ApplianceConfig[];
  inverters: InverterConfig[];
  systemConfig: SystemConfig;
  onRefresh?: () => Promise<void> | void;
}

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

interface ApplianceFormState {
  _id?: string;
  name: string;
  category: string;
  averagePowerW: string;
  maxPowerW: string;
  measuredPowerW: string;
  quantity: string;
  activeHours: string;
  selectedModeIndex: string;
  modes: ApplianceMode[];
}

const CREATE_APPLIANCE_MUTATION = `
  mutation CreateAppliance($input: ApplianceInput!) {
    createAppliance(input: $input) { _id }
  }
`;

const UPDATE_APPLIANCE_MUTATION = `
  mutation UpdateAppliance($id: String!, $input: ApplianceInput!) {
    updateAppliance(id: $id, input: $input) { _id }
  }
`;

const DELETE_APPLIANCE_MUTATION = `
  mutation DeleteAppliance($id: String!) {
    deleteAppliance(id: $id)
  }
`;


const emptyForm: ApplianceFormState = {
  name: '',
  category: '',
  averagePowerW: '',
  maxPowerW: '',
  measuredPowerW: '',
  quantity: '1',
  activeHours: '',
  selectedModeIndex: '',
  modes: [],
};

const parseNumber = (value: string): number | undefined => {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanPayload = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T;

const formatHours = (hours: number | null) => {
  if (hours === null || !Number.isFinite(hours)) return 'Sin carga activa';
  if (hours >= 24) return `${(hours / 24).toFixed(1)} días`;
  return `${hours.toFixed(1)} h`;
};

const toFormState = (appliance: ApplianceConfig): ApplianceFormState => ({
  _id: appliance._id,
  name: appliance.name ?? '',
  category: appliance.category ?? '',
  averagePowerW: appliance.averagePowerW?.toString() ?? '',
  maxPowerW: appliance.maxPowerW?.toString() ?? '',
  measuredPowerW: appliance.measuredPowerW?.toString() ?? '',
  quantity: appliance.quantity?.toString() ?? '1',
  activeHours: appliance.activeHours?.toString() ?? '',
  selectedModeIndex:
    appliance.selectedModeIndex !== undefined ? appliance.selectedModeIndex.toString() : '',
  modes: appliance.modes ?? [],
});

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo archivo'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });


function applianceKey(appliance: ApplianceConfig, index: number): string {
  return appliance._id ?? `${appliance.name}-${index}`;
}

function resolveMode(appliance: ApplianceConfig, selectedIndex: number | undefined) {
  const modes = appliance.modes ?? [];
  if (selectedIndex === undefined || selectedIndex < 0 || selectedIndex >= modes.length) return null;
  return modes[selectedIndex] ?? null;
}

export default function AppliancesManager({
  appliances,
  inverters,
  systemConfig,
  onRefresh,
}: AppliancesManagerProps) {
  const [message, setMessage] = useState<StatusMessage>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [modalMessage, setModalMessage] = useState<StatusMessage>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [dataMode, setDataMode] = useState<'manual' | 'mediciones'>('manual');
  const [form, setForm] = useState<ApplianceFormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  // Batch state
  const [batches, setBatches] = useState<ApplianceBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchPreview | null>(null);
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<StatusMessage>(null);

  const loadBatches = async (applianceId: string) => {
    setBatchesLoading(true);
    try {
      const result = await executeQuery<{ applianceBatches: ApplianceBatch[] }>(
        APPLIANCE_BATCHES_QUERY,
        { applianceId }
      );
      setBatches(result?.applianceBatches ?? []);
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const [newModeName, setNewModeName] = useState('');
  const [newModeAveragePowerW, setNewModeAveragePowerW] = useState('');
  const [newModeMaxPowerW, setNewModeMaxPowerW] = useState('');

  const [runtimeHoursByKey, setRuntimeHoursByKey] = useState<Record<string, number>>({});
  const [selectedModeByKey, setSelectedModeByKey] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const nextRuntime: Record<string, number> = {};
    const nextModes: Record<string, number | undefined> = {};

    appliances.forEach((appliance, index) => {
      const key = applianceKey(appliance, index);
      nextRuntime[key] = appliance.activeHours ?? 0;
      nextModes[key] = appliance.selectedModeIndex;
    });

    setRuntimeHoursByKey(nextRuntime);
    setSelectedModeByKey(nextModes);
  }, [appliances]);

  const inverterCapacityW = useMemo(
    () =>
      inverters.reduce(
        (sum, inverter) => sum + inverter.ratedPowerKw * 1000 * (inverter.quantity ?? 1),
        0
      ),
    [inverters]
  );

  const batteryCapacityWh = useMemo(
    () => (systemConfig.battery.capacityKwh ?? 0) * 1000,
    [systemConfig.battery.capacityKwh]
  );

  const summary = useMemo(() => {
    let averageLoadW = 0;
    let maxLoadW = 0;
    let plannedConsumptionWh = 0;

    appliances.forEach((appliance, index) => {
      const key = applianceKey(appliance, index);
      const mode = resolveMode(appliance, selectedModeByKey[key]);
      const quantity = appliance.quantity ?? 1;
      const effectiveAverage = mode?.averagePowerW ?? appliance.averagePowerW;
      const effectiveMax = appliance.measuredPowerW ?? mode?.maxPowerW ?? appliance.maxPowerW;
      const runtimeHours = runtimeHoursByKey[key] ?? appliance.activeHours ?? 0;

      averageLoadW += effectiveAverage * quantity;
      maxLoadW += effectiveMax * quantity;
      plannedConsumptionWh += effectiveAverage * quantity * runtimeHours;
    });

    const autonomyAvgH = averageLoadW > 0 ? batteryCapacityWh / averageLoadW : null;
    const autonomyMaxH = maxLoadW > 0 ? batteryCapacityWh / maxLoadW : null;
    const remainingWh = Math.max(0, batteryCapacityWh - plannedConsumptionWh);

    return {
      averageLoadW,
      maxLoadW,
      plannedConsumptionWh,
      autonomyAvgH,
      autonomyMaxH,
      remainingWh,
      withinInverterAvg: inverterCapacityW <= 0 ? null : averageLoadW <= inverterCapacityW,
      withinInverterMax: inverterCapacityW <= 0 ? null : maxLoadW <= inverterCapacityW,
    };
  }, [appliances, batteryCapacityWh, inverterCapacityW, runtimeHoursByKey, selectedModeByKey]);

  const openModal = (mode: 'create' | 'edit', appliance?: ApplianceConfig) => {
    setModalMode(mode);
    setModalMessage(null);
    setForm(appliance ? toFormState(appliance) : emptyForm);
    setNewModeName('');
    setNewModeAveragePowerW('');
    setNewModeMaxPowerW('');
    // Detect data mode from existing appliance
    setDataMode(appliance?.measurementMeta ? 'mediciones' : 'manual');
    // Reset batch state
    setBatches([]);
    setBatchAddOpen(false);
    setBatchFile(null);
    setBatchPreview(null);
    setBatchStartDate('');
    setBatchEndDate('');
    setBatchMessage(null);
    if (mode === 'edit' && appliance?._id) {
      loadBatches(appliance._id);
    }
    setModalOpen(true);
  };

  const handleInput =
    (field: keyof ApplianceFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const addMode = () => {
    const average = parseNumber(newModeAveragePowerW);
    const max = parseNumber(newModeMaxPowerW);
    if (!newModeName.trim() || average === undefined) return;
    setForm((prev) => ({
      ...prev,
      modes: [
        ...prev.modes,
        {
          name: newModeName.trim(),
          averagePowerW: average,
          maxPowerW: max,
        },
      ],
    }));
    setNewModeName('');
    setNewModeAveragePowerW('');
    setNewModeMaxPowerW('');
  };

  const removeMode = (index: number) => {
    setForm((prev) => ({
      ...prev,
      modes: prev.modes.filter((_, idx) => idx !== index),
    }));
  };

  const buildPayload = (state: ApplianceFormState) => {
    return cleanPayload({
      name: state.name.trim(),
      category: state.category.trim() || undefined,
      averagePowerW: parseNumber(state.averagePowerW),
      maxPowerW: parseNumber(state.maxPowerW),
      measuredPowerW: parseNumber(state.measuredPowerW),
      quantity: parseNumber(state.quantity),
      activeHours: parseNumber(state.activeHours),
      selectedModeIndex:
        state.selectedModeIndex === '' ? undefined : parseNumber(state.selectedModeIndex),
      modes: state.modes.map((mode) =>
        cleanPayload({
          name: mode.name.trim(),
          averagePowerW: mode.averagePowerW,
          maxPowerW: mode.maxPowerW,
        })
      ),
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setModalMessage(null);

    const payload = buildPayload(form);

    try {
      let applianceId = form._id;
      if (applianceId) {
        await executeMutation(UPDATE_APPLIANCE_MUTATION, { id: applianceId, input: payload });
      } else {
        const created = await executeMutation<{ createAppliance: { _id: string } }>(
          CREATE_APPLIANCE_MUTATION,
          { input: payload }
        );
        applianceId = created?.createAppliance?._id;
      }

      setMessage({
        type: 'success',
        text: form._id
          ? 'Electrodoméstico actualizado correctamente.'
          : 'Electrodoméstico creado correctamente.',
      });
      setModalOpen(false);
      setForm(emptyForm);
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      setModalMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Error inesperado al guardar el electrodoméstico.',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAppliance = async (appliance: ApplianceConfig) => {
    if (!appliance._id) {
      setMessage({
        type: 'error',
        text: 'No se pudo identificar el electrodoméstico para eliminarlo.',
      });
      return;
    }
    setConfirmState({
      message: '¿Desea eliminar este electrodoméstico? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        try {
          await executeMutation(DELETE_APPLIANCE_MUTATION, { id: appliance._id });
          setMessage({ type: 'success', text: 'Electrodoméstico eliminado correctamente.' });
          await onRefresh?.();
        } catch (error) {
          console.error(error);
          setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'No se pudo eliminar el electrodoméstico.',
          });
        }
      },
    });
  };

  const saveQuickConfig = async (appliance: ApplianceConfig, key: string) => {
    if (!appliance._id) return;
    const payload = buildPayload({
      ...toFormState(appliance),
      activeHours: (runtimeHoursByKey[key] ?? appliance.activeHours ?? 0).toString(),
      selectedModeIndex:
        selectedModeByKey[key] !== undefined ? `${selectedModeByKey[key]}` : '',
    });

    try {
      await executeMutation(UPDATE_APPLIANCE_MUTATION, { id: appliance._id, input: payload });
      setMessage({ type: 'success', text: `Configuración guardada para ${appliance.name}.` });
      await onRefresh?.();
    } catch (error) {
      console.error(error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar la configuración rápida.',
      });
    }
  };

  return (
    <>
      <ConfirmDialog
        open={!!confirmState}
        destructive
        confirmLabel="Eliminar"
        message={confirmState?.message ?? ''}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
        onCancel={() => setConfirmState(null)}
      />
      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_30px_70px_-50px_rgba(15,23,42,0.65)]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Electrodomésticos</h2>
            <p className="text-sm text-slate-500">
              Modele consumos por equipo, tiempo encendido y modos opcionales para estimar autonomía
              en batería e impacto sobre inversores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal('create')}
            className="inline-flex items-center gap-2 rounded-full !bg-amber-600 px-4 py-2 text-sm font-semibold !text-white shadow-lg shadow-amber-500/25 transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Agregar equipo
          </button>
        </header>

        {message && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Carga promedio activa" value={`${summary.averageLoadW.toFixed(0)} W`} />
          <StatCard label="Carga máxima activa" value={`${summary.maxLoadW.toFixed(0)} W`} />
          <StatCard label="Consumo planificado" value={`${summary.plannedConsumptionWh.toFixed(0)} Wh`} />
          <StatCard label="Autonomía batería (promedio)" value={formatHours(summary.autonomyAvgH)} />
          <StatCard label="Autonomía batería (máximo)" value={formatHours(summary.autonomyMaxH)} />
          <StatCard
            label="Capacidad inversores"
            value={inverterCapacityW > 0 ? `${inverterCapacityW.toFixed(0)} W` : 'Sin inversores'}
            hint={
              summary.withinInverterAvg === null
                ? undefined
                : summary.withinInverterAvg && summary.withinInverterMax
                ? 'Carga promedio y máxima dentro del límite'
                : 'Atención: la carga puede sobrepasar el inversor'
            }
          />
        </div>

        {appliances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
            <Zap className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-semibold text-slate-600">
              No hay electrodomésticos registrados
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Cree equipos para simular combinación de consumos por promedio y máximo.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {appliances.map((appliance, index) => {
              const key = applianceKey(appliance, index);
              const mode = resolveMode(appliance, selectedModeByKey[key]);
              const averagePowerW = mode?.averagePowerW ?? appliance.averagePowerW;
              const maxPowerW = appliance.measuredPowerW ?? mode?.maxPowerW ?? appliance.maxPowerW;
              const runtimeHours = runtimeHoursByKey[key] ?? appliance.activeHours ?? 0;
              const plannedWh = averagePowerW * (appliance.quantity ?? 1) * runtimeHours;

              return (
                <article
                  key={key}
                  className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.45)]"
                >
                  <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{appliance.name}</h3>
                      <p className="text-sm text-slate-500">
                        {appliance.category || 'General'} • Cantidad: {appliance.quantity}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {!!appliance.measurementMeta && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            <LineChart className="h-3 w-3" />
                            Perfil medido (archivo)
                            {appliance.measurementMeta?.avgKw
                              ? ` • ${appliance.measurementMeta.avgKw.toFixed(2)} kW prom.`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </header>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SmallMetric label="Promedio" value={`${averagePowerW.toFixed(0)} W`} />
                    <SmallMetric label="Máximo" value={`${maxPowerW.toFixed(0)} W`} />
                    <SmallMetric label="Consumo planificado" value={`${plannedWh.toFixed(0)} Wh`} />
                    <SmallMetric label="Potencia medida" value={appliance.measuredPowerW ? `${appliance.measuredPowerW.toFixed(0)} W` : 'No definida'} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(appliance.modes?.length ?? 0) > 0 && (
                      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Modo
                        <select
                          value={selectedModeByKey[key] ?? ''}
                          onChange={(event) =>
                            setSelectedModeByKey((prev) => ({
                              ...prev,
                              [key]:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          <option value="">Base</option>
                          {(appliance.modes ?? []).map((item, modeIndex) => (
                            <option key={`${key}-mode-${modeIndex}`} value={modeIndex}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Horas encendido
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={runtimeHours}
                        onChange={(event) =>
                          setRuntimeHoursByKey((prev) => ({
                            ...prev,
                            [key]: Number(event.target.value) || 0,
                          }))
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                      />
                    </label>
                  </div>

                  <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => saveQuickConfig(appliance, key)}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      Guardar tiempo/modo
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openModal('edit', appliance)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAppliance(appliance)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {modalMode === 'edit' ? 'Editar equipo' : 'Nuevo equipo'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {modalMode === 'edit' ? form.name : 'Selecciona cómo se registrará el consumo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {modalMessage && (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    modalMessage.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {modalMessage.text}
                </div>
              )}

              {/* ── Selector de modo ─────────────────────────────────────── */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDataMode('manual')}
                  className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                    dataMode === 'manual'
                      ? 'border-amber-400 bg-amber-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-xl p-2 ${dataMode === 'manual' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <PenLine className={`h-4 w-4 ${dataMode === 'manual' ? 'text-amber-600' : 'text-slate-500'}`} />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${dataMode === 'manual' ? 'text-amber-900' : 'text-slate-700'}`}>
                      Manual
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug">
                      Potencia estimada y horas de uso
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDataMode('mediciones')}
                  className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                    dataMode === 'mediciones'
                      ? 'border-sky-400 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-xl p-2 ${dataMode === 'mediciones' ? 'bg-sky-100' : 'bg-slate-100'}`}>
                    <Activity className={`h-4 w-4 ${dataMode === 'mediciones' ? 'text-sky-600' : 'text-slate-500'}`} />
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${dataMode === 'mediciones' ? 'text-sky-900' : 'text-slate-700'}`}>
                      Mediciones reales
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-snug">
                      Datos del analizador de red
                    </p>
                  </div>
                </button>
              </div>

              {/* ── Badge de compatibilidad ───────────────────────────────── */}
              {dataMode === 'mediciones' && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  <span>Compatible con <strong>Hioki PW3360</strong> y analizadores de red con exportación TSV / XLS / CSV</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── Campos comunes ─────────────────────────────────────── */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Nombre" required>
                    <input
                      required
                      value={form.name}
                      onChange={handleInput('name')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  <FormField label="Categoría">
                    <input
                      value={form.category}
                      onChange={handleInput('category')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  <FormField label="Cantidad" required>
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={form.quantity}
                      onChange={handleInput('quantity')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>

                  {/* ── Solo en modo manual ──────────────────────────────── */}
                  {dataMode === 'manual' && (
                    <>
                      <FormField label="Potencia promedio (W)" required>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.averagePowerW}
                          onChange={handleInput('averagePowerW')}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </FormField>
                      <FormField label="Horas activas al día">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.25"
                          value={form.activeHours}
                          onChange={handleInput('activeHours')}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </FormField>
                    </>
                  )}
                </div>

                {/* Sección de lotes de medición — solo modo mediciones */}
                {dataMode === 'mediciones' && <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-sky-700" />
                    <h4 className="text-sm font-semibold text-sky-900">
                      Mediciones Hioki (lotes acumulativos)
                    </h4>
                  </div>

                  {modalMode === 'create' ? (
                    <p className="text-xs text-sky-900/70">
                      Guarda el equipo primero para poder adjuntar mediciones.
                    </p>
                  ) : (
                    <>
                      {batchMessage && (
                        <div
                          className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
                            batchMessage.type === 'success'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          }`}
                        >
                          {batchMessage.text}
                        </div>
                      )}

                      {batchesLoading ? (
                        <p className="text-xs text-sky-800">Cargando lotes…</p>
                      ) : batches.length === 0 ? (
                        <p className="mb-3 text-xs text-sky-900/60">No hay lotes cargados aún.</p>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {batches.map((batch) => (
                            <div
                              key={batch.batchId}
                              className="flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700"
                            >
                              <div className="space-y-0.5">
                                <div className="font-medium">
                                  {new Date(batch.startDate).toLocaleDateString('es-ES')} –{' '}
                                  {new Date(batch.endDate).toLocaleDateString('es-ES')}
                                </div>
                                <div className="text-slate-500">
                                  {batch.samples} muestras •{' '}
                                  {batch.kwhDayEstimatedThis.toFixed(2)} kWh/día
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!form._id) return;
                                  try {
                                    await executeMutation(DELETE_APPLIANCE_BATCH_MUTATION, {
                                      batchId: batch.batchId,
                                    });
                                    setBatchMessage({ type: 'success', text: 'Lote eliminado.' });
                                    await loadBatches(form._id);
                                    await onRefresh?.();
                                  } catch (error) {
                                    setBatchMessage({
                                      type: 'error',
                                      text:
                                        error instanceof Error
                                          ? error.message
                                          : 'No se pudo eliminar el lote.',
                                    });
                                  }
                                }}
                                className="ml-3 inline-flex items-center gap-1 rounded-full border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                <Trash className="h-3 w-3" />
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!batchAddOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBatchAddOpen(true);
                            setBatchFile(null);
                            setBatchPreview(null);
                            setBatchStartDate('');
                            setBatchEndDate('');
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Agregar mediciones
                        </button>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-sky-200 bg-white p-3">
                          <p className="text-xs font-semibold text-sky-900">Nuevo lote de mediciones</p>

                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                            <Upload className="h-3.5 w-3.5" />
                            {batchFile ? batchFile.name : 'Seleccionar archivo (.xls/.xlsx/.csv/.tsv/.txt)'}
                            <input
                              type="file"
                              accept=".xls,.xlsx,.csv,.tsv,.txt"
                              className="hidden"
                              onChange={async (event) => {
                                const file = event.target.files?.[0] ?? null;
                                setBatchFile(file);
                                setBatchPreview(null);
                                setBatchStartDate('');
                                setBatchEndDate('');
                                if (!file) return;
                                try {
                                  const fileContent = await readFileAsText(file);
                                  const result = await executeMutation<{
                                    previewApplianceBatch: BatchPreview;
                                  }>(PREVIEW_APPLIANCE_BATCH_MUTATION, { fileContent });
                                  const preview = result?.previewApplianceBatch ?? null;
                                  setBatchPreview(preview);
                                  if (preview?.startDate) {
                                    setBatchStartDate(preview.startDate.slice(0, 10));
                                  }
                                  if (preview?.endDate) {
                                    setBatchEndDate(preview.endDate.slice(0, 10));
                                  }
                                } catch (error) {
                                  setBatchMessage({
                                    type: 'error',
                                    text:
                                      error instanceof Error
                                        ? error.message
                                        : 'No se pudo generar la vista previa.',
                                  });
                                }
                              }}
                            />
                          </label>

                          {batchPreview && (
                            <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-700">
                              <span className="font-semibold">Vista previa:</span>{' '}
                              {batchPreview.samples} muestras
                              {batchPreview.startDate && batchPreview.endDate && (
                                <>
                                  {' '}•{' '}
                                  {new Date(batchPreview.startDate).toLocaleDateString('es-ES')} –{' '}
                                  {new Date(batchPreview.endDate).toLocaleDateString('es-ES')}
                                </>
                              )}
                            </div>
                          )}

                          {batchFile && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                Desde (opcional)
                                <input
                                  type="date"
                                  value={batchStartDate}
                                  onChange={(e) => setBatchStartDate(e.target.value)}
                                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                Hasta (opcional)
                                <input
                                  type="date"
                                  value={batchEndDate}
                                  onChange={(e) => setBatchEndDate(e.target.value)}
                                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                                />
                              </label>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!batchFile || batchUploading}
                              onClick={async () => {
                                if (!batchFile || !form._id) return;
                                setBatchUploading(true);
                                setBatchMessage(null);
                                try {
                                  const fileContent = await readFileAsText(batchFile);
                                  await executeMutation(UPLOAD_APPLIANCE_BATCH_MUTATION, {
                                    id: form._id,
                                    fileContent,
                                    startDate: batchStartDate || undefined,
                                    endDate: batchEndDate || undefined,
                                  });
                                  setBatchMessage({
                                    type: 'success',
                                    text: 'Lote subido correctamente.',
                                  });
                                  setBatchAddOpen(false);
                                  setBatchFile(null);
                                  setBatchPreview(null);
                                  await loadBatches(form._id);
                                  await onRefresh?.();
                                } catch (error) {
                                  setBatchMessage({
                                    type: 'error',
                                    text:
                                      error instanceof Error
                                        ? error.message
                                        : 'No se pudo subir el lote.',
                                  });
                                } finally {
                                  setBatchUploading(false);
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-sky-700"
                            >
                              {batchUploading ? (
                                <>
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  Subiendo…
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  Subir mediciones
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchAddOpen(false);
                                setBatchFile(null);
                                setBatchPreview(null);
                                setBatchMessage(null);
                              }}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>}

                {/* Modos de consumo — solo modo manual */}
                {dataMode === 'manual' && <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-800">Modos de consumo (opcional)</h4>
                  {form.modes.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {form.modes.map((mode, index) => (
                        <div
                          key={`mode-line-${index}`}
                          className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {mode.name} • {mode.averagePowerW}W prom.
                            {mode.maxPowerW ? ` • ${mode.maxPowerW}W máx.` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMode(index)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={newModeName}
                      onChange={(event) => setNewModeName(event.target.value)}
                      placeholder="Nombre del modo"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newModeAveragePowerW}
                      onChange={(event) => setNewModeAveragePowerW(event.target.value)}
                      placeholder="Promedio (W)"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newModeMaxPowerW}
                      onChange={(event) => setNewModeMaxPowerW(event.target.value)}
                      placeholder="Máximo (W, opcional)"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addMode}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar modo
                  </button>
                </div>}

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-full !bg-amber-600 px-5 py-2 text-sm font-semibold !text-white shadow-lg shadow-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? 'Guardando...'
                      : modalMode === 'edit'
                      ? 'Actualizar equipo'
                      : 'Crear equipo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50/70 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}
