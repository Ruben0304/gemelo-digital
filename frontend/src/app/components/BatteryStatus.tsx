'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BatteryConfig } from '@/types';
import { Battery, FlaskConical } from 'lucide-react';

interface BatteryStatusProps {
  batteries: BatteryConfig[];
}

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

      <div className="mt-5">
        <button
          type="button"
          onClick={() => router.push('/simulador-bateria')}
          disabled={breakdown.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FlaskConical className="w-4 h-4" />
          Simular escenario de batería
        </button>
      </div>
    </div>
  );
}
