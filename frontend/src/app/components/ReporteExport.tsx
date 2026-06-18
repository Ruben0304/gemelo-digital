'use client';

import { useState, useCallback } from 'react';
import {
  DocumentArrowDownIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CalendarIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { executeQuery } from '@/lib/graphql-client';
import {
  exportReadingsCsv,
  exportSummariesCsv,
  exportReadingsPdf,
  exportSummariesPdf,
  type ReportMeta,
} from '@/lib/reportGenerator';
import type { HistoricalReading, DailySummary } from '@/types';

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const READINGS_QUERY = `
  query ExportReadings($startDate: String, $endDate: String, $limit: Int) {
    historicalReadings(startDate: $startDate, endDate: $endDate, limit: $limit) {
      _id timestamp production consumption batteryLevel gridExport gridImport efficiency
    }
  }
`;

const SUMMARIES_QUERY = `
  query ExportSummaries($days: Int) {
    dailySummaries(days: $days) {
      date totalProduction totalConsumption avgBatteryLevel maxProduction maxConsumption avgEfficiency readingCount
    }
  }
`;

const LOCATION_QUERY = `
  query LocationForReport {
    locationConfig { name lat lon }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'daily' | 'hourly';
type ExportFormat = 'csv' | 'pdf';
type Status = { type: 'idle' } | { type: 'loading'; msg: string } | { type: 'ok'; msg: string } | { type: 'error'; msg: string };

const PERIOD_OPTIONS = [
  { label: 'Últimos 7 días', days: 7 },
  { label: 'Últimos 14 días', days: 14 },
  { label: 'Último mes', days: 30 },
  { label: 'Últimos 3 meses', days: 90 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReporteExport() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<Status>({ type: 'idle' });

  const handleExport = useCallback(async (format: ExportFormat) => {
    setStatus({ type: 'loading', msg: format === 'pdf' ? 'Generando PDF…' : 'Preparando CSV…' });

    try {
      // Fetch location for report metadata
      let locationName = 'La Habana, Cuba';
      try {
        const locData = await executeQuery<{ locationConfig: { name: string } }>(
          LOCATION_QUERY, {}, 'network-only'
        );
        if (locData?.locationConfig?.name) locationName = locData.locationConfig.name;
      } catch { /* use default */ }

      const now = new Date();
      const meta: ReportMeta = {
        title: reportType === 'daily' ? 'Reporte de resumen diario' : 'Reporte de lecturas horarias',
        systemName: 'Gemelo Digital Fotovoltaico',
        location: locationName,
        period: `Últimos ${days} días — hasta ${now.toLocaleDateString('es-CU', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        generatedAt: now.toLocaleString('es-CU'),
      };

      if (reportType === 'daily') {
        const data = await executeQuery<{ dailySummaries: DailySummary[] }>(
          SUMMARIES_QUERY, { days }, 'network-only'
        );
        const summaries = data?.dailySummaries ?? [];
        if (summaries.length === 0) throw new Error('No hay datos para el período seleccionado.');
        if (format === 'csv') {
          exportSummariesCsv(summaries, 'GemeloDigital');
        } else {
          await exportSummariesPdf(summaries, meta);
        }
        setStatus({ type: 'ok', msg: `${format.toUpperCase()} generado con ${summaries.length} días de datos.` });
      } else {
        const start = new Date(now.getTime() - days * 86_400_000).toISOString();
        const data = await executeQuery<{ historicalReadings: HistoricalReading[] }>(
          READINGS_QUERY,
          { startDate: start, endDate: now.toISOString(), limit: days * 24 },
          'network-only'
        );
        const readings = data?.historicalReadings ?? [];
        if (readings.length === 0) throw new Error('No hay lecturas para el período seleccionado.');
        if (format === 'csv') {
          exportReadingsCsv(readings, 'GemeloDigital');
        } else {
          await exportReadingsPdf(readings, meta);
        }
        setStatus({ type: 'ok', msg: `${format.toUpperCase()} generado con ${readings.length} lecturas.` });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Error inesperado al generar el reporte.' });
    }
  }, [reportType, days]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <DocumentArrowDownIcon className="h-6 w-6 text-sky-500" />
          Exportar reportes
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Descarga los datos del sistema en formato CSV (datos brutos) o PDF (reporte profesional con gráficos y métricas).
        </p>
      </div>

      {/* Config grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Report type */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Tipo de reporte</h3>
          <div className="space-y-2">
            {([
              { id: 'daily' as ReportType, label: 'Resumen diario', desc: 'Totales por día: producción, consumo, CO₂, batería media' },
              { id: 'hourly' as ReportType, label: 'Lecturas horarias', desc: 'Cada medición individual con resolución de 1 hora' },
            ] as const).map(opt => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                  reportType === opt.id
                    ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  value={opt.id}
                  checked={reportType === opt.id}
                  onChange={() => setReportType(opt.id)}
                  className="mt-0.5 accent-sky-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Period */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-400" />
            Período de datos
          </h3>
          <div className="space-y-2">
            {PERIOD_OPTIONS.map(opt => (
              <label
                key={opt.days}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                  days === opt.days
                    ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="period"
                  value={opt.days}
                  checked={days === opt.days}
                  onChange={() => setDays(opt.days)}
                  className="accent-emerald-500"
                />
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-sm text-slate-900">{opt.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{opt.days}d</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* What's included */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Contenido del reporte</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* CSV */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <TableCellsIcon className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-900">CSV</span>
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">Datos brutos</span>
            </div>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Todos los campos numéricos</li>
              <li>• Compatible con Excel / Google Sheets</li>
              <li>• Ideal para análisis estadístico</li>
              {reportType === 'daily'
                ? <li>• Una fila por día con totales y promedios</li>
                : <li>• Una fila por lectura horaria</li>}
            </ul>
          </div>

          {/* PDF */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <DocumentTextIcon className="h-5 w-5 text-sky-500" />
              <span className="text-sm font-semibold text-slate-900">PDF</span>
              <span className="ml-auto text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">Reporte profesional</span>
            </div>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Portada con KPIs destacados</li>
              {reportType === 'daily' && <li>• Gráfico de barras producción vs consumo</li>}
              <li>• Tabla detallada paginada</li>
              <li>• Encabezado y pie de página con institución</li>
              <li>• Ideal para informes y presentaciones</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status message */}
      {status.type !== 'idle' && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          status.type === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : status.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          {status.type === 'loading' && <ArrowPathIcon className="h-4 w-4 animate-spin shrink-0" />}
          {status.type === 'ok' && <CheckCircleIcon className="h-4 w-4 shrink-0" />}
          {status.type === 'error' && <ExclamationCircleIcon className="h-4 w-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {/* Export buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleExport('csv')}
          disabled={status.type === 'loading'}
          className="flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-5 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-900/30 border border-emerald-600/50"
        >
          <TableCellsIcon className="h-5 w-5" />
          Exportar CSV
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={status.type === 'loading'}
          className="flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-5 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-sky-900/30 border border-sky-600/50"
        >
          {status.type === 'loading' ? (
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
          ) : (
            <DocumentTextIcon className="h-5 w-5" />
          )}
          Exportar PDF
        </button>

        {status.type !== 'idle' && (
          <button
            onClick={() => setStatus({ type: 'idle' })}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500 hover:text-slate-900 hover:border-slate-300 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Los reportes se generan localmente en el navegador. Los datos provienen de la colección{' '}
        <code className="bg-slate-100 text-slate-700 px-1 rounded">lecturas_historicas</code> de MongoDB.
      </p>
    </div>
  );
}
