'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Clock3, FileSpreadsheet, LineChart, Pencil, Plus, Trash, Upload, X, Zap } from 'lucide-react';
import type { ApplianceConfig, ApplianceMode, InverterConfig, SystemConfig } from '@/types';
import { executeMutation } from '@/lib/graphql-client';
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
  alwaysOn: boolean;
  measurementFile: File | null;
  measurementMeta?: ApplianceConfig['measurementMeta'];
  hasProfile: boolean;
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

const UPLOAD_MEASUREMENT_MUTATION = `
  mutation UploadApplianceMeasurement($id: String!, $fileContent: String!) {
    uploadApplianceMeasurement(id: $id, fileContent: $fileContent) {
      _id
      measurementMeta { samples avgKw minKw maxKw hoursCovered firstDate lastDate }
    }
  }
`;

const CLEAR_MEASUREMENT_MUTATION = `
  mutation ClearApplianceMeasurement($id: String!) {
    clearApplianceMeasurement(id: $id) { _id }
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
  alwaysOn: true,
  measurementFile: null,
  measurementMeta: null,
  hasProfile: false,
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
  alwaysOn: appliance.alwaysOn ?? true,
  measurementFile: null,
  measurementMeta: appliance.measurementMeta ?? null,
  hasProfile: !!appliance.measurementMeta,
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
  const [form, setForm] = useState<ApplianceFormState>(emptyForm);
  const [loading, setLoading] = useState(false);

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
      // El sumario sólo considera equipos marcados como "siempre encendido"
      // (que es el estado real persistido). Los modales y la edición permiten
      // cambiarlo por electrodoméstico.
      if (!(appliance.alwaysOn ?? true)) return;

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
    const hasFileOrProfile = !!state.measurementFile || state.hasProfile;
    const fallbackPower = hasFileOrProfile ? 0.0001 : undefined;
    return cleanPayload({
      name: state.name.trim(),
      category: state.category.trim() || undefined,
      averagePowerW: parseNumber(state.averagePowerW) ?? fallbackPower,
      maxPowerW: parseNumber(state.maxPowerW) ?? fallbackPower,
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
      alwaysOn: state.alwaysOn,
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

      let measurementNote = '';
      if (form.measurementFile && applianceId) {
        const fileContent = await readFileAsText(form.measurementFile);
        await executeMutation(UPLOAD_MEASUREMENT_MUTATION, {
          id: applianceId,
          fileContent,
        });
        measurementNote = ' Perfil de consumo generado a partir del archivo.';
      }

      setMessage({
        type: 'success',
        text:
          (form._id
            ? 'Electrodoméstico actualizado correctamente.'
            : 'Electrodoméstico creado correctamente.') + measurementNote,
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
                        {(appliance.alwaysOn ?? true) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Siempre encendido
                          </span>
                        )}
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
                  {modalMode === 'edit' ? 'Editar electrodoméstico' : 'Nuevo electrodoméstico'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Defina consumo promedio/máximo y modos opcionales por equipo.
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

              <form onSubmit={handleSubmit} className="space-y-5">
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
                  <FormField
                    label={
                      form.measurementFile || form.hasProfile
                        ? 'Potencia promedio (W) — se calcula del archivo'
                        : 'Potencia promedio (W)'
                    }
                    required={!form.measurementFile && !form.hasProfile}
                  >
                    <input
                      required={!form.measurementFile && !form.hasProfile}
                      disabled={!!form.measurementFile}
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={form.measurementFile ? 'Se rellenará tras subir' : ''}
                      value={form.averagePowerW}
                      onChange={handleInput('averagePowerW')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </FormField>
                  <FormField
                    label={
                      form.measurementFile || form.hasProfile
                        ? 'Potencia máxima (W) — se calcula del archivo'
                        : 'Potencia máxima (W)'
                    }
                    required={!form.measurementFile && !form.hasProfile}
                  >
                    <input
                      required={!form.measurementFile && !form.hasProfile}
                      disabled={!!form.measurementFile}
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={form.measurementFile ? 'Se rellenará tras subir' : ''}
                      value={form.maxPowerW}
                      onChange={handleInput('maxPowerW')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </FormField>
                  <FormField label="Potencia medida (W)">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      disabled={!!form.measurementFile}
                      placeholder={form.measurementFile ? 'Se rellenará tras subir' : ''}
                      value={form.measuredPowerW}
                      onChange={handleInput('measuredPowerW')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
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
                  <FormField label="Horas activas (opcional)">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={form.activeHours}
                      onChange={handleInput('activeHours')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  {(form.modes.length ?? 0) > 0 && (
                    <FormField label="Modo seleccionado">
                      <select
                        value={form.selectedModeIndex}
                        onChange={handleInput('selectedModeIndex')}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Base</option>
                        {form.modes.map((mode, index) => (
                          <option key={`form-mode-${index}`} value={index}>
                            {mode.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                  <FormField label="Estado por defecto">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.alwaysOn}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, alwaysOn: event.target.checked }))
                        }
                      />
                      Siempre encendido (se incluye salvo desactivación manual)
                    </label>
                  </FormField>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-sky-700" />
                    <h4 className="text-sm font-semibold text-sky-900">
                      Perfil de consumo a partir de un archivo de mediciones
                    </h4>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-sky-900/80">
                    Adjunta un archivo TSV/CSV/XLS (formato analizador de red, p. ej. Hioki PW3360 con columnas
                    {' '}<code>Date</code>, <code>Time</code>, <code>P(SUM)</code>). El sistema construye un perfil
                    promedio por día de la semana y hora (168 valores) y lo usará para pronosticar el consumo
                    de este equipo en lugar del promedio manual.
                  </p>
                  {form.hasProfile && form.measurementMeta && (
                    <div className="mb-3 grid gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700 sm:grid-cols-2">
                      <div>
                        <span className="font-semibold">Muestras:</span> {form.measurementMeta.samples}
                      </div>
                      <div>
                        <span className="font-semibold">Promedio:</span>{' '}
                        {form.measurementMeta.avgKw.toFixed(2)} kW
                      </div>
                      <div>
                        <span className="font-semibold">Rango:</span>{' '}
                        {form.measurementMeta.minKw.toFixed(2)} – {form.measurementMeta.maxKw.toFixed(2)} kW
                      </div>
                      <div>
                        <span className="font-semibold">Horas cubiertas:</span>{' '}
                        {form.measurementMeta.hoursCovered}/168
                      </div>
                      {form._id && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!form._id) return;
                            try {
                              await executeMutation(CLEAR_MEASUREMENT_MUTATION, { id: form._id });
                              setForm((prev) => ({
                                ...prev,
                                hasProfile: false,
                                measurementMeta: null,
                                measurementFile: null,
                              }));
                              setModalMessage({
                                type: 'success',
                                text: 'Perfil de mediciones eliminado.',
                              });
                              await onRefresh?.();
                            } catch (error) {
                              setModalMessage({
                                type: 'error',
                                text:
                                  error instanceof Error
                                    ? error.message
                                    : 'No se pudo eliminar el perfil.',
                              });
                            }
                          }}
                          className="col-span-full inline-flex items-center gap-2 self-start rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Eliminar perfil cargado
                        </button>
                      )}
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                    <Upload className="h-3.5 w-3.5" />
                    {form.measurementFile ? form.measurementFile.name : 'Seleccionar archivo'}
                    <input
                      type="file"
                      accept=".xls,.xlsx,.csv,.tsv,.txt"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setForm((prev) => ({ ...prev, measurementFile: file }));
                      }}
                    />
                  </label>
                  {form.measurementFile && (
                    <p className="mt-2 text-xs text-sky-800">
                      Se subirá al guardar el equipo y se generará el perfil automáticamente.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
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
                </div>

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
