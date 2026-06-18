'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BatteryConfig } from '@/types';
import { executeQuery } from '@/lib/graphql-client';
import { BATTERY_DISCHARGE_ESTIMATE_QUERY } from '@/lib/graphql-queries';
import {
  Battery,
  Calculator,
  Clock,
  Info,
  Loader2,
  X,
  FlaskConical,
} from 'lucide-react';

interface BatteryStatusProps {
  batteries: BatteryConfig[];
}

interface BatteryDischargeEstimateResponse {
  batteryDischargeEstimate: {
    minutesToEmpty: number | null;
    startHour: number;
    batteryCapacityKwh: number;
  };
}

const clampHour = (value: number) => Math.min(23, Math.max(0, Math.round(value)));

export default function BatteryStatus({ batteries }: BatteryStatusProps) {
  const router = useRouter();
  const breakdown = useMemo(() => {
    if (!batteries || batteries.length === 0) return [];

    return batteries
      .map((battery, index) => {
        const capacity = Number(battery.capacityKwh ?? 0);
        const quantityValue = Number(battery.quantity ?? 0);
        const quantity = Number.isFinite(quantityValue)
          ? Math.max(0, Math.round(quantityValue))
          : 0;
        const label = `${battery.manufacturer ?? 'Batería'}${battery.model ? ` ${battery.model}` : ''}`.trim();
        const total = capacity * quantity;

        return {
          id: battery._id ?? `${label || 'battery'}-${index}`,
          label: label || 'Batería sin datos',
          capacity,
          quantity,
          total,
        };
      })
      .filter((item) => item.capacity > 0 || item.quantity > 0);
  }, [batteries]);

  const { moduleCount, totalCapacity } = useMemo(() => {
    return breakdown.reduce(
      (acc, item) => {
        acc.moduleCount += item.quantity;
        acc.totalCapacity += item.total;
        return acc;
      },
      { moduleCount: 0, totalCapacity: 0 }
    );
  }, [breakdown]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [startHour, setStartHour] = useState(() => new Date().getHours());
  const [estimate, setEstimate] =
    useState<BatteryDischargeEstimateResponse['batteryDischargeEstimate'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setStartHour(new Date().getHours());
    setEstimate(null);
    setError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const handleEstimate = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await executeQuery<BatteryDischargeEstimateResponse>(
        BATTERY_DISCHARGE_ESTIMATE_QUERY,
        { startHour: clampHour(startHour) }
      );
      const estimateResult = result?.batteryDischargeEstimate;
      if (!estimateResult) {
        throw new Error('Respuesta vacía del servidor');
      }
      setEstimate(estimateResult);
    } catch (err) {
      console.error('Error fetching discharge estimate:', err);
      setError('No se pudo obtener la estimación. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatMinutesToText = (minutes: number | null) => {
    if (minutes === null || !Number.isFinite(minutes)) {
      return 'No se vacía en 48h';
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.max(0, Math.round(minutes - hours * 60));
    const hoursText = hours > 0 ? `${hours} h` : '';
    const minutesText = `${remainingMinutes} min`;
    return `${hoursText} ${minutesText}`.trim();
  };

  const formattedTotalCapacity =
    totalCapacity > 0 ? `${totalCapacity.toFixed(1)} kWh` : 'Sin registros';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Resumen de baterías
          </p>
          <h2 className="text-xl font-semibold text-gray-900">Capacidad instalada</h2>
        </div>
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <Battery className="w-6 h-6 text-emerald-600" />
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No hay baterías registradas aún. Utiliza la sección Dispositivos para añadirlas.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 mb-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Capacidad total
              </p>
              <p className="text-2xl font-semibold text-gray-900">{formattedTotalCapacity}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Cantidad de baterías
              </p>
              <p className="text-2xl font-semibold text-gray-900">{moduleCount}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Capacidad por batería
            </p>
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} unidades • {item.capacity} kWh c/u
                    </p>
                  </div>
                  <span className="text-base font-semibold text-gray-900">
                    {item.total.toFixed(1)} kWh
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={openDialog}
          disabled={breakdown.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <Clock className="w-4 h-4" />
          ¿Cuándo se descargará?
        </button>
        <button
          type="button"
          onClick={() => router.push('/simulador-bateria')}
          disabled={breakdown.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FlaskConical className="w-4 h-4" />
          Simular escenario
        </button>
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Consulta de descarga
                </p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  Estimar autonomía
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Selecciona la hora de inicio y obtén una proyección del tiempo restante antes de vaciar la batería.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="grid gap-6 md:grid-cols-[280px,1fr]">
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hora de inicio (0-23)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      step={1}
                      value={startHour}
                      onChange={(event) => setStartHour(clampHour(Number(event.target.value)))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <Calculator className="w-4 h-4" />
                      La hora actual se establece automáticamente para acelerar la consulta.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      <Info className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleEstimate}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-70"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calculando...
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4" />
                          Consultar estimación
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeDialog}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-inner">
                  {estimate ? (
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Resultado
                        </p>
                        <h4 className="text-lg font-semibold text-gray-900">
                          Proyección de descarga
                        </h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Hora inicial
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {estimate.startHour}:00 h
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Capacidad usada en el cálculo
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {estimate.batteryCapacityKwh.toFixed(1)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 px-4 py-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-emerald-600">
                              Tiempo hasta vaciarse
                            </p>
                            <p className="text-2xl font-bold text-emerald-700">
                              {formatMinutesToText(estimate.minutesToEmpty)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-500">
                      <Battery className="mb-3 h-10 w-10 text-emerald-400" />
                      <p className="font-medium text-gray-900">
                        Aún no se ha generado una estimación
                      </p>
                      <p className="mt-1">
                        Ajusta la hora y presiona &ldquo;Consultar estimación&rdquo; para obtener el tiempo restante.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
