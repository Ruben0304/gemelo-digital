'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MapPinIcon,
  MapIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { executeQuery, executeMutation } from '@/lib/graphql-client';

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const LOCATION_QUERY = `
  query GetLocationConfig {
    locationConfig {
      lat
      lon
      name
      updatedAt
    }
  }
`;

const SAVE_LOCATION_MUTATION = `
  mutation SaveLocationConfig($input: LocationConfigInput!) {
    saveLocationConfig(input: $input) {
      lat
      lon
      name
      updatedAt
    }
  }
`;

// ─── Preset locations ─────────────────────────────────────────────────────────

const PRESETS = [
  { name: 'La Habana, Cuba',     lat: 23.1136,  lon: -82.3666 },
  { name: 'Santiago de Cuba',    lat: 20.0174,  lon: -75.8171 },
  { name: 'Matanzas, Cuba',      lat: 23.0444,  lon: -81.5776 },
  { name: 'Santa Clara, Cuba',   lat: 22.4065,  lon: -79.9635 },
  { name: 'Camagüey, Cuba',      lat: 21.3809,  lon: -77.9172 },
  { name: 'Holguín, Cuba',       lat: 20.8874,  lon: -76.2674 },
  { name: 'Cienfuegos, Cuba',    lat: 22.1469,  lon: -80.4478 },
  { name: 'Pinar del Río, Cuba', lat: 22.4170,  lon: -83.6989 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationData {
  lat: number;
  lon: number;
  name: string;
  updatedAt?: string | null;
}

type Status =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ok'; msg: string }
  | { type: 'error'; msg: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationConfig() {
  const [current, setCurrent]     = useState<LocationData | null>(null);
  const [lat, setLat]             = useState('');
  const [lon, setLon]             = useState('');
  const [name, setName]           = useState('');
  const [preset, setPreset]       = useState('');
  const [fetching, setFetching]   = useState(true);
  const [status, setStatus]       = useState<Status>({ type: 'idle' });

  // ── Load current config ──────────────────────────────────────────────────

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const data = await executeQuery<{ locationConfig: LocationData }>(
        LOCATION_QUERY, {}, 'network-only'
      );
      const cfg = data?.locationConfig;
      if (cfg) {
        setCurrent(cfg);
        setLat(String(cfg.lat));
        setLon(String(cfg.lon));
        setName(cfg.name);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'No se pudo cargar la configuración de ubicación.' });
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Handle preset selection ──────────────────────────────────────────────

  const handlePreset = (val: string) => {
    setPreset(val);
    const p = PRESETS.find(p => p.name === val);
    if (p) {
      setLat(String(p.lat));
      setLon(String(p.lon));
      setName(p.name);
    }
  };

  // ── Handle map click — opens OSM nominatim on a detected click ───────────

  const openMapPicker = () => {
    const latN = parseFloat(lat) || 23.1136;
    const lonN = parseFloat(lon) || -82.3666;
    window.open(
      `https://www.openstreetmap.org/?mlat=${latN}&mlon=${lonN}#map=10/${latN}/${lonN}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // ── Validate ─────────────────────────────────────────────────────────────

  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  const latValid = !isNaN(latN) && latN >= -90 && latN <= 90;
  const lonValid = !isNaN(lonN) && lonN >= -180 && lonN <= 180;
  const nameValid = name.trim().length >= 2;
  const formValid = latValid && lonValid && nameValid;

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    setStatus({ type: 'loading' });
    try {
      const data = await executeMutation<{ saveLocationConfig: LocationData }>(
        SAVE_LOCATION_MUTATION,
        { input: { lat: latN, lon: lonN, name: name.trim() } }
      );
      const saved = data?.saveLocationConfig;
      if (saved) {
        setCurrent(saved);
        setStatus({ type: 'ok', msg: `Ubicación guardada: ${saved.name}.` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la ubicación.';
      setStatus({ type: 'error', msg: msg.includes('denegado') ? 'Acceso denegado. Se requieren permisos de administrador.' : msg });
    }
  };

  // ── Map preview URL ───────────────────────────────────────────────────────

  const mapSrc = latValid && lonValid
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lonN - 0.5},${latN - 0.4},${lonN + 0.5},${latN + 0.4}&layer=mapnik&marker=${latN},${lonN}`
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MapPinIcon className="h-6 w-6 text-rose-500" />
          Ubicación del sistema
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Define las coordenadas geográficas de la instalación. Se usan para cálculos solares y datos meteorológicos.
        </p>
      </div>

      {/* Current config badge */}
      {current && !fetching && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <GlobeAltIcon className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{current.name}</p>
            <p className="text-xs text-slate-500 font-mono">
              {Math.abs(current.lat).toFixed(4)}°{current.lat >= 0 ? 'N' : 'S'} · {Math.abs(current.lon).toFixed(4)}°{current.lon >= 0 ? 'E' : 'O'}
              {current.updatedAt && (
                <span className="ml-2 text-slate-500">
                  — actualizado {new Date(current.updatedAt).toLocaleString('es-CU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            className="ml-auto shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Recargar"
          >
            <ArrowPathIcon className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Preset selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <MagnifyingGlassIcon className="inline h-4 w-4 mr-1 text-slate-400" />
              Selección rápida — ciudades de Cuba
            </label>
            <select
              value={preset}
              onChange={e => handlePreset(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            >
              <option value="">Seleccionar ciudad…</option>
              {PRESETS.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
              <option value="__custom__">Coordenadas personalizadas</option>
            </select>
          </div>

          {/* Coords row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Latitud (−90 a 90)</label>
              <input
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={lat}
                onChange={e => { setLat(e.target.value); setPreset('__custom__'); }}
                className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-1 transition ${
                  lat && !latValid
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/50'
                }`}
                placeholder="23.1136"
              />
              {lat && !latValid && <p className="text-xs text-red-500 mt-1">Debe estar entre −90 y 90</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Longitud (−180 a 180)</label>
              <input
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={lon}
                onChange={e => { setLon(e.target.value); setPreset('__custom__'); }}
                className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-1 transition ${
                  lon && !lonValid
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/50'
                }`}
                placeholder="-82.3666"
              />
              {lon && !lonValid && <p className="text-xs text-red-500 mt-1">Debe estar entre −180 y 180</p>}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre descriptivo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 transition ${
                name && !nameValid
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/50'
              }`}
              placeholder="Ej. CUJAE — La Habana, Cuba"
            />
            <p className="text-xs text-slate-500 mt-1">
              Se muestra en reportes y en la interfaz del gemelo.
            </p>
          </div>

          {/* Status */}
          {status.type !== 'idle' && (
            <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              status.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : status.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}>
              {status.type === 'loading' && <ArrowPathIcon className="h-4 w-4 animate-spin shrink-0 mt-0.5" />}
              {status.type === 'ok' && <CheckCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />}
              {status.type === 'error' && <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{'msg' in status ? status.msg : ''}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!formValid || status.type === 'loading'}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition shadow-lg shadow-sky-900/20 border border-sky-600/50"
            >
              {status.type === 'loading' ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <MapPinIcon className="h-4 w-4" />
              )}
              Guardar ubicación
            </button>
            <button
              type="button"
              onClick={openMapPicker}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-sm text-slate-700 transition"
              title="Ver en OpenStreetMap"
            >
              <MapIcon className="h-4 w-4" />
              Ver mapa
            </button>
          </div>
        </form>

        {/* Map preview */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 min-h-[280px] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <GlobeAltIcon className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Vista previa del mapa</span>
            <span className="ml-auto text-xs text-slate-500">OpenStreetMap</span>
          </div>
          {mapSrc ? (
            <iframe
              src={mapSrc}
              className="flex-1 w-full border-0"
              style={{ minHeight: 240 }}
              loading="lazy"
              title="Mapa de ubicación del sistema"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              Introduce coordenadas válidas para ver el mapa
            </div>
          )}
        </div>
      </div>

      {/* Info note */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
        <strong>Nota:</strong> Cambiar la ubicación afecta los cálculos de radiación solar, las predicciones horarias y los datos meteorológicos obtenidos de Open-Meteo. Los datos históricos existentes no se recalculan.
      </div>
    </div>
  );
}
