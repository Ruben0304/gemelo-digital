'use client';

import { useState, useEffect } from 'react';
import { SolarData } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface SolarProductionChartProps {
  data: SolarData[];
  useMLPredictions?: boolean;
  loading?: boolean;
  onDayChange?: (dayOffset: number) => void;
}

export default function SolarProductionChart({
  data,
  useMLPredictions = false,
  loading = false,
  onDayChange
}: SolarProductionChartProps) {
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = today, 1 = tomorrow

  // Handle day change
  const handleDayChange = (newOffset: number) => {
    setSelectedDayOffset(newOffset);
    if (onDayChange) {
      onDayChange(newOffset);
    }
  };

  // Filter data for selected day (7am to 10pm)
  const selectedDate = addDays(startOfDay(new Date()), selectedDayOffset);

  const filteredData = data.filter((item) => {
    const itemDate = new Date(item.timestamp);
    const hour = itemDate.getHours();
    return isSameDay(itemDate, selectedDate) && hour >= 7 && hour <= 22;
  });

  // Transform data for chart
  const chartData = filteredData.map((item) => ({
    time: format(new Date(item.timestamp), 'HH:mm', { locale: es }),
    hour: new Date(item.timestamp).getHours(),
    producción: Number(item.production.toFixed(2)),
    consumo: Number(item.consumption.toFixed(2)),
    balance: Number((item.production - item.consumption).toFixed(2)),
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="text-gray-700 text-sm font-semibold mb-2">
          {payload[0]?.payload.time}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-xs text-gray-600">Producción:</span>
            <span className="text-sm font-bold text-green-500">
              {payload[0]?.value} kW
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span className="text-xs text-gray-600">Consumo:</span>
            <span className="text-sm font-bold text-blue-500">
              {payload[1]?.value} kW
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${payload[0]?.payload.balance >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-600">Balance:</span>
            <span className={`text-sm font-bold ${payload[0]?.payload.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {payload[0]?.payload.balance >= 0 ? '+' : ''}{payload[0]?.payload.balance} kW
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Allow navigation up to tomorrow (dayOffset 1) for ML predictions
  const maxDayOffset = useMLPredictions ? 1 : Math.max(0, Math.floor((data.length - 1) / 24));

  const canGoPrevious = selectedDayOffset > 0 && !loading;
  const canGoNext = selectedDayOffset < maxDayOffset && !loading;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {useMLPredictions ? 'Predicción ML de producción vs consumo' : 'Proyección de producción vs consumo'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDayChange(Math.max(0, selectedDayOffset - 1))}
              disabled={!canGoPrevious}
              className={`p-2 rounded-lg border transition-colors ${
                canGoPrevious
                  ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                  : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Día anterior"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
              {selectedDayOffset === 0
                ? 'Hoy'
                : selectedDayOffset === 1
                ? 'Mañana'
                : format(selectedDate, "dd 'de' MMMM", { locale: es })}
            </span>
            <button
              onClick={() => handleDayChange(selectedDayOffset + 1)}
              disabled={!canGoNext}
              className={`p-2 rounded-lg border transition-colors ${
                canGoNext
                  ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                  : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Día siguiente"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {useMLPredictions
            ? '7:00 AM - 10:00 PM usando modelo Random Forest entrenado (R²=0.854)'
            : '7:00 AM - 10:00 PM basadas en clima y especificaciones del sistema'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[350px] text-gray-500">
          <div className="text-center">
            <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Cargando predicciones...</p>
            <p className="text-sm">
              {selectedDayOffset === 0
                ? 'Obteniendo predicciones ML para hoy'
                : selectedDayOffset === 1
                ? 'Obteniendo predicciones ML para mañana'
                : `Obteniendo predicciones ML para ${format(selectedDate, "dd 'de' MMMM", { locale: es })}`}
            </p>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] text-gray-500">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">No hay datos disponibles</p>
            <p className="text-sm">
              {selectedDayOffset === 0
                ? 'Las predicciones para hoy aún no están disponibles'
                : 'Las predicciones para este día aún no están disponibles'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" opacity={0.6} />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#9ca3af' }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#9ca3af' }}
            label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => (
              <span className="text-gray-600 text-sm font-medium">{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="producción"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#colorProduction)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="consumo"
            stroke="#3b82f6"
            strokeWidth={3}
            fill="url(#colorConsumption)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-gray-600 mb-1">Producción estimada</p>
          <p className="text-lg font-bold text-green-500">
            ≈{chartData.reduce((sum, d) => sum + d.producción, 0).toFixed(1)} kWh
          </p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-gray-600 mb-1">Consumo estimado</p>
          <p className="text-lg font-bold text-blue-500">
            ≈{chartData.reduce((sum, d) => sum + d.consumo, 0).toFixed(1)} kWh
          </p>
        </div>
        <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <p className="text-xs text-gray-600 mb-1">Balance neto proyectado</p>
          <p className="text-lg font-bold text-emerald-500">
            ≈{chartData.reduce((sum, d) => sum + d.balance, 0).toFixed(1)} kWh
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-600">
        {useMLPredictions
          ? 'Predicciones generadas con modelo de Machine Learning entrenado con datos históricos de Open-Meteo. RMSE=537kW, MAE=229kW.'
          : 'Datos generados sin telemetría en vivo; el cálculo se alimenta únicamente de condiciones atmosféricas y características del arreglo.'}
      </p>
        </>
      )}
    </div>
  );
}
