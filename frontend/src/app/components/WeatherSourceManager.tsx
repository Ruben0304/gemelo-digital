'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudSun, Link2, WandSparkles } from 'lucide-react';
import { executeMutation, executeQuery } from '@/lib/graphql-client';
import ConfirmDialog from './ConfirmDialog';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

interface WeatherFieldCandidate {
  path: string;
  valueType: string;
  sampleValue: string;
}

interface WeatherSource {
  _id: string;
  name: string;
  baseUrl?: string | null;
  authType: 'none' | 'bearer' | 'api_key_header' | 'api_key_query' | 'mock';
  authHeaderName?: string | null;
  authQueryName?: string | null;
  authValue?: string | null;
  queryParams?: Record<string, unknown>;
  fieldMapping?: Record<string, unknown>;
  locationName?: string | null;
  enabled: boolean;
  isActive: boolean;
  updatedAt?: string | null;
}

interface WeatherSourcesQueryData {
  weatherSources: WeatherSource[];
  activeWeatherSource?: WeatherSource | null;
}

interface TestWeatherSourceData {
  testWeatherSource: {
    success: boolean;
    message: string;
    rawJson: string;
    fields: WeatherFieldCandidate[];
  };
}

interface SaveWeatherSourceData {
  saveWeatherSource: WeatherSource;
}

interface WeatherSourceManagerProps {
  onSaved?: () => Promise<void> | void;
}

interface SourceFormState {
  id?: string;
  name: string;
  baseUrl: string;
  authType: WeatherSource['authType'];
  authHeaderName: string;
  authQueryName: string;
  authValue: string;
  queryParamsText: string;
  locationName: string;
  enabled: boolean;
  isActive: boolean;
}

const LIST_QUERY = `
  query WeatherSources {
    weatherSources {
      _id
      name
      baseUrl
      authType
      authHeaderName
      authQueryName
      authValue
      queryParams
      fieldMapping
      locationName
      enabled
      isActive
      updatedAt
    }
    activeWeatherSource {
      _id
    }
  }
`;

const TEST_MUTATION = `
  mutation TestWeatherSource($input: WeatherSourceInput!, $useMock: Boolean!) {
    testWeatherSource(input: $input, useMock: $useMock) {
      success
      message
      rawJson
      fields {
        path
        valueType
        sampleValue
      }
    }
  }
`;

const SAVE_MUTATION = `
  mutation SaveWeatherSource($id: String, $input: WeatherSourceInput!) {
    saveWeatherSource(id: $id, input: $input) {
      _id
      name
      baseUrl
      authType
      authHeaderName
      authQueryName
      authValue
      queryParams
      fieldMapping
      locationName
      enabled
      isActive
      updatedAt
    }
  }
`;

const DELETE_MUTATION = `
  mutation DeleteWeatherSource($id: String!) {
    deleteWeatherSource(id: $id)
  }
`;

const ACTIVATE_MUTATION = `
  mutation SetActiveWeatherSource($id: String!) {
    setActiveWeatherSource(id: $id)
  }
`;

const TARGET_FIELDS = [
  { key: 'temperaturePath', label: 'Temperatura actual', required: true },
  { key: 'humidityPath', label: 'Humedad actual', required: true },
  { key: 'cloudCoverPath', label: 'Nubosidad actual', required: true },
  { key: 'windSpeedPath', label: 'Viento actual', required: true },
  { key: 'solarRadiationPath', label: 'Radiación solar actual', required: true },
  { key: 'descriptionPath', label: 'Descripción clima actual', required: false },
  { key: 'forecastArrayPath', label: 'Lista de pronóstico diario', required: true },
  { key: 'forecastDatePath', label: 'Fecha pronóstico', required: true, forecast: true },
  { key: 'forecastMaxTempPath', label: 'Máxima pronóstico', required: true, forecast: true },
  { key: 'forecastMinTempPath', label: 'Mínima pronóstico', required: true, forecast: true },
  {
    key: 'forecastSolarRadiationPath',
    label: 'Radiación pronóstico',
    required: true,
    forecast: true,
  },
  { key: 'forecastCloudCoverPath', label: 'Nubosidad pronóstico', required: true, forecast: true },
  {
    key: 'forecastConditionPath',
    label: 'Condición pronóstico (opcional)',
    required: false,
    forecast: true,
  },
] as const;

const emptyForm: SourceFormState = {
  name: '',
  baseUrl: '',
  authType: 'none',
  authHeaderName: '',
  authQueryName: '',
  authValue: '',
  queryParamsText: '{\n  "latitude": "{{lat}}",\n  "longitude": "{{lon}}",\n  "timezone": "{{timezone}}"\n}',
  locationName: '',
  enabled: true,
  isActive: true,
};

const parseJsonObject = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Los parámetros deben ser un objeto JSON.');
  }
  return parsed as Record<string, unknown>;
};

const normalizePath = (path: string) =>
  path.replace(/\[\d+\]/g, '').replace(/^\$\./, '').toLowerCase();

const suggestByKeywords = (candidates: string[], keywords: string[]) => {
  const normalizedCandidates = candidates.map((path) => ({
    raw: path,
    key: normalizePath(path),
  }));

  return (
    normalizedCandidates.find((candidate) => keywords.every((keyword) => candidate.key.includes(keyword)))
      ?.raw ?? ''
  );
};

const parsePathTokens = (path: string): Array<string | number> => {
  const tokens: Array<string | number> = [];
  let current = '';
  for (let i = 0; i < path.length; i += 1) {
    const ch = path[i];
    if (ch === '.') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    if (ch === '[') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      const end = path.indexOf(']', i);
      if (end < 0) break;
      const raw = path.slice(i + 1, end);
      const idx = Number(raw);
      if (Number.isFinite(idx)) tokens.push(idx);
      i = end;
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
};

const getByPath = (data: unknown, path: string): unknown => {
  const trimmed = path.trim().replace(/^\$\./, '');
  if (!trimmed) return null;
  const tokens = parsePathTokens(trimmed);
  let current: unknown = data;
  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token >= current.length) return null;
      current = current[token];
      continue;
    }
    if (!current || typeof current !== 'object' || !(token in current)) return null;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
};

const flattenRelativeLeafPaths = (data: unknown, prefix = ''): string[] => {
  if (Array.isArray(data)) {
    if (data.length === 0) return [prefix].filter(Boolean);
    return [prefix, ...flattenRelativeLeafPaths(data[0], `${prefix}[0]`)].filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return [prefix].filter(Boolean);
    return entries.flatMap(([key, value]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return flattenRelativeLeafPaths(value, next);
    });
  }
  return prefix ? [prefix] : [];
};

const collectDetectedFields = (data: unknown, prefix = ''): WeatherFieldCandidate[] => {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return prefix
        ? [{ path: prefix, valueType: 'array', sampleValue: '[]' }]
        : [];
    }

    const base: WeatherFieldCandidate[] = prefix
      ? [{ path: prefix, valueType: 'array', sampleValue: `array[${data.length}]` }]
      : [];
    const children = data.slice(0, 2).flatMap((item, idx) =>
      collectDetectedFields(item, `${prefix}[${idx}]`)
    );
    return [...base, ...children];
  }

  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return collectDetectedFields(value, next);
    });
  }

  if (!prefix) return [];

  const type = data === null ? 'null' : typeof data;
  const asText = String(data);
  return [
    {
      path: prefix,
      valueType: type,
      sampleValue: asText.length > 120 ? `${asText.slice(0, 117)}...` : asText,
    },
  ];
};

const createInterfaceMockPayload = () => {
  const now = new Date();
  const daily = Array.from({ length: 7 }).map((_, dayIndex) => {
    const date = new Date(now);
    date.setDate(now.getDate() + dayIndex);
    const cloud = Math.max(8, Math.min(92, 20 + dayIndex * 9));
    return {
      date_iso: date.toISOString().slice(0, 10),
      temp: {
        max_c: Number((31 - dayIndex * 0.3).toFixed(1)),
        min_c: Number((23 - dayIndex * 0.2).toFixed(1)),
      },
      sky: {
        cloud_pct: cloud,
        condition_label: cloud < 30 ? 'sunny' : cloud < 60 ? 'partly-cloudy' : 'cloudy',
      },
      solar: {
        avg_wm2: Math.max(180, 760 - dayIndex * 55),
      },
    };
  });

  return {
    meta: {
      provider: 'UI Mock Weather',
      generated_at: now.toISOString(),
      station_id: 'UI-MOCK-001',
    },
    measurements: {
      current: {
        temperature_c: 29.1,
        humidity_pct: 71,
        wind_kmh: 15.4,
        cloud_pct: 33,
        irradiance_wm2: 598,
        summary: 'Parcialmente nublado',
      },
      alerts: [
        { code: 'UV_MED', description: 'Índice UV moderado' },
        { code: 'BREEZE', description: 'Brisa ligera' },
      ],
    },
    forecast: {
      daily,
      horizon_hours: 168,
      engine: 'ui-mock-engine',
    },
    extra: {
      region: 'La Habana',
      country: 'Cuba',
      debug: {
        response_ms: 12,
        request_id: 'ui-mock-request',
      },
    },
  };
};

const sourceToForm = (source: WeatherSource): SourceFormState => ({
  id: source._id,
  name: source.name,
  baseUrl: source.baseUrl ?? '',
  authType: source.authType,
  authHeaderName: source.authHeaderName ?? '',
  authQueryName: source.authQueryName ?? '',
  authValue: source.authValue ?? '',
  queryParamsText: JSON.stringify(source.queryParams ?? {}, null, 2),
  locationName: source.locationName ?? '',
  enabled: source.enabled,
  isActive: source.isActive,
});

export default function WeatherSourceManager({ onSaved }: WeatherSourceManagerProps) {
  const [form, setForm] = useState<SourceFormState>(emptyForm);
  const [sources, setSources] = useState<WeatherSource[]>([]);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [testing, setTesting] = useState(false);
  const [detectedFields, setDetectedFields] = useState<WeatherFieldCandidate[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rawPayload, setRawPayload] = useState<string>('');
  const [parsedPayload, setParsedPayload] = useState<unknown>(null);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await executeQuery<WeatherSourcesQueryData>(LIST_QUERY, {}, 'network-only');
      setSources(data.weatherSources ?? []);
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudieron cargar las fuentes de clima.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSources();
  }, []);

  const fieldPathOptions = useMemo(() => detectedFields.map((item) => item.path), [detectedFields]);

  const forecastRelativeOptions = useMemo(() => {
    const selectedArrayPath = mapping.forecastArrayPath;
    if (!selectedArrayPath || !parsedPayload) return [];
    const data = getByPath(parsedPayload, selectedArrayPath);
    if (!Array.isArray(data) || data.length === 0) return [];
    return Array.from(new Set(flattenRelativeLeafPaths(data[0]))).sort((a, b) => a.localeCompare(b));
  }, [mapping.forecastArrayPath, parsedPayload]);

  const requiredMissing = useMemo(
    () => TARGET_FIELDS.filter((item) => item.required && !mapping[item.key]),
    [mapping]
  );

  const runTest = async (useMock: boolean) => {
    setTesting(true);
    setStatus(null);
    try {
      if (useMock) {
        const payload = createInterfaceMockPayload();
        const fields = collectDetectedFields(payload).sort((a, b) => a.path.localeCompare(b.path));
        setDetectedFields(fields);
        setRawPayload(JSON.stringify(payload, null, 2));
        setParsedPayload(payload);

        const options = fields.map((item) => item.path);
        const forecastArraySuggestion = suggestByKeywords(options, ['forecast', 'daily']) ||
          suggestByKeywords(options, ['daily']) ||
          suggestByKeywords(options, ['forecast']);

        const nextMapping: Record<string, string> = {
          ...mapping,
          temperaturePath:
            mapping.temperaturePath ||
            suggestByKeywords(options, ['temp']) ||
            suggestByKeywords(options, ['temperature']),
          humidityPath:
            mapping.humidityPath ||
            suggestByKeywords(options, ['humidity']) ||
            suggestByKeywords(options, ['humedad']),
          cloudCoverPath:
            mapping.cloudCoverPath ||
            suggestByKeywords(options, ['cloud']) ||
            suggestByKeywords(options, ['nube']),
          windSpeedPath:
            mapping.windSpeedPath ||
            suggestByKeywords(options, ['wind']) ||
            suggestByKeywords(options, ['viento']),
          solarRadiationPath:
            mapping.solarRadiationPath ||
            suggestByKeywords(options, ['irradiance']) ||
            suggestByKeywords(options, ['radiation']) ||
            suggestByKeywords(options, ['solar']),
          descriptionPath:
            mapping.descriptionPath ||
            suggestByKeywords(options, ['summary']) ||
            suggestByKeywords(options, ['description']),
          forecastArrayPath: mapping.forecastArrayPath || forecastArraySuggestion,
        };

        if (forecastArraySuggestion && !mapping.forecastArrayPath) {
          const firstItem = getByPath(payload, forecastArraySuggestion);
          if (Array.isArray(firstItem) && firstItem[0]) {
            const relative = flattenRelativeLeafPaths(firstItem[0]);
            nextMapping.forecastDatePath = suggestByKeywords(relative, ['date']) || '';
            nextMapping.forecastMaxTempPath =
              suggestByKeywords(relative, ['temp', 'max']) || suggestByKeywords(relative, ['max']);
            nextMapping.forecastMinTempPath =
              suggestByKeywords(relative, ['temp', 'min']) || suggestByKeywords(relative, ['min']);
            nextMapping.forecastSolarRadiationPath =
              suggestByKeywords(relative, ['solar']) || suggestByKeywords(relative, ['radiation']);
            nextMapping.forecastCloudCoverPath =
              suggestByKeywords(relative, ['cloud']) || suggestByKeywords(relative, ['nube']);
            nextMapping.forecastConditionPath =
              suggestByKeywords(relative, ['condition']) || suggestByKeywords(relative, ['estado']);
          }
        }

        setMapping(nextMapping);
        setStatus({
          type: 'success',
          text: 'Se generó una respuesta de ejemplo local (sin llamadas a servicios externos).',
        });
        return;
      }

      const input = {
        name: form.name.trim() || 'Fuente nueva',
        baseUrl: form.baseUrl.trim() || null,
        authType: form.authType,
        authHeaderName: form.authHeaderName.trim() || null,
        authQueryName: form.authQueryName.trim() || null,
        authValue: form.authValue.trim() || null,
        queryParams: parseJsonObject(form.queryParamsText),
        locationName: form.locationName.trim() || null,
        enabled: form.enabled,
        isActive: form.isActive,
        fieldMapping: {},
      };

      const data = await executeMutation<TestWeatherSourceData>(TEST_MUTATION, { input, useMock });
      const result = data.testWeatherSource;
      const fields = result.fields ?? [];
      setDetectedFields(fields);
      setRawPayload(result.rawJson);
      try {
        setParsedPayload(JSON.parse(result.rawJson));
      } catch {
        setParsedPayload(null);
      }

      const options = fields.map((item) => item.path);
      const forecastArraySuggestion = suggestByKeywords(options, ['forecast', 'daily']) ||
        suggestByKeywords(options, ['daily']) ||
        suggestByKeywords(options, ['forecast']);

      const nextMapping: Record<string, string> = {
        ...mapping,
        temperaturePath:
          mapping.temperaturePath ||
          suggestByKeywords(options, ['temp']) ||
          suggestByKeywords(options, ['temperature']),
        humidityPath:
          mapping.humidityPath ||
          suggestByKeywords(options, ['humidity']) ||
          suggestByKeywords(options, ['humedad']),
        cloudCoverPath:
          mapping.cloudCoverPath ||
          suggestByKeywords(options, ['cloud']) ||
          suggestByKeywords(options, ['nube']),
        windSpeedPath:
          mapping.windSpeedPath ||
          suggestByKeywords(options, ['wind']) ||
          suggestByKeywords(options, ['viento']),
        solarRadiationPath:
          mapping.solarRadiationPath ||
          suggestByKeywords(options, ['irradiance']) ||
          suggestByKeywords(options, ['radiation']) ||
          suggestByKeywords(options, ['solar']),
        descriptionPath:
          mapping.descriptionPath ||
          suggestByKeywords(options, ['summary']) ||
          suggestByKeywords(options, ['description']),
        forecastArrayPath: mapping.forecastArrayPath || forecastArraySuggestion,
      };

      if (forecastArraySuggestion && !mapping.forecastArrayPath) {
        const firstItem = getByPath(JSON.parse(result.rawJson), forecastArraySuggestion);
        if (Array.isArray(firstItem) && firstItem[0]) {
          const relative = flattenRelativeLeafPaths(firstItem[0]);
          nextMapping.forecastDatePath = suggestByKeywords(relative, ['date']) || '';
          nextMapping.forecastMaxTempPath =
            suggestByKeywords(relative, ['temp', 'max']) || suggestByKeywords(relative, ['max']);
          nextMapping.forecastMinTempPath =
            suggestByKeywords(relative, ['temp', 'min']) || suggestByKeywords(relative, ['min']);
          nextMapping.forecastSolarRadiationPath =
            suggestByKeywords(relative, ['solar']) || suggestByKeywords(relative, ['radiation']);
          nextMapping.forecastCloudCoverPath =
            suggestByKeywords(relative, ['cloud']) || suggestByKeywords(relative, ['nube']);
          nextMapping.forecastConditionPath =
            suggestByKeywords(relative, ['condition']) || suggestByKeywords(relative, ['estado']);
        }
      }

      setMapping(nextMapping);
      setStatus({ type: 'success', text: result.message });
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo probar la fuente meteorológica.',
      });
    } finally {
      setTesting(false);
    }
  };

  const saveSource = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const input = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim() || null,
        authType: form.authType,
        authHeaderName: form.authHeaderName.trim() || null,
        authQueryName: form.authQueryName.trim() || null,
        authValue: form.authValue.trim() || null,
        queryParams: parseJsonObject(form.queryParamsText),
        fieldMapping: Object.fromEntries(
          Object.entries(mapping).filter(([, value]) => Boolean(value && value.trim()))
        ),
        locationName: form.locationName.trim() || null,
        enabled: form.enabled,
        isActive: form.isActive,
      };

      const data = await executeMutation<SaveWeatherSourceData>(SAVE_MUTATION, {
        id: form.id ?? null,
        input,
      });

      setStatus({ type: 'success', text: `Fuente guardada: ${data.saveWeatherSource.name}` });
      await loadSources();
      await onSaved?.();
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar la fuente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const activateSource = async (id: string) => {
    setLoading(true);
    setStatus(null);
    try {
      await executeMutation(ACTIVATE_MUTATION, { id });
      await loadSources();
      await onSaved?.();
      setStatus({ type: 'success', text: 'Fuente activada.' });
    } catch (error) {
      setStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo activar la fuente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSource = (id: string) => {
    setConfirmState({
      message: '¿Desea eliminar esta fuente meteorológica? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setLoading(true);
        setStatus(null);
        try {
          await executeMutation(DELETE_MUTATION, { id });
          await loadSources();
          setStatus({ type: 'success', text: 'Fuente eliminada.' });
        } catch (error) {
          setStatus({
            type: 'error',
            text: error instanceof Error ? error.message : 'No se pudo eliminar la fuente.',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_30px_70px_-50px_rgba(15,23,42,0.65)]">
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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Fuente de clima configurable</h2>
          <p className="text-sm text-slate-500">
            Conecte cualquier API meteorológica, pruebe autenticación y enlace campos por interfaz
            sin tocar código.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setMapping({});
            setDetectedFields([]);
            setRawPayload('');
            setParsedPayload(null);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Nueva fuente
        </button>
      </header>

      {status && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nombre de la fuente
          </label>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ej: Open-Meteo Campus"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Base URL
          </label>
          <input
            value={form.baseUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
            placeholder="https://api.example.com/weather"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Autenticación
              </label>
              <select
                value={form.authType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    authType: event.target.value as SourceFormState['authType'],
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="none">Sin autenticación</option>
                <option value="bearer">Bearer token</option>
                <option value="api_key_header">API key por header</option>
                <option value="api_key_query">API key por query</option>
                <option value="mock">Datos de ejemplo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre ubicación opcional
              </label>
              <input
                value={form.locationName}
                onChange={(event) => setForm((prev) => ({ ...prev, locationName: event.target.value }))}
                placeholder="La Habana"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {form.authType === 'bearer' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Token
              </label>
              <input
                value={form.authValue}
                onChange={(event) => setForm((prev) => ({ ...prev, authValue: event.target.value }))}
                placeholder="eyJ..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {form.authType === 'api_key_header' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.authHeaderName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, authHeaderName: event.target.value }))
                }
                placeholder="X-API-Key"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={form.authValue}
                onChange={(event) => setForm((prev) => ({ ...prev, authValue: event.target.value }))}
                placeholder="apikey-123"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {form.authType === 'api_key_query' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.authQueryName}
                onChange={(event) => setForm((prev) => ({ ...prev, authQueryName: event.target.value }))}
                placeholder="api_key"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                value={form.authValue}
                onChange={(event) => setForm((prev) => ({ ...prev, authValue: event.target.value }))}
                placeholder="apikey-123"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Query params (JSON)
            </label>
            <textarea
              value={form.queryParamsText}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, queryParamsText: event.target.value }))
              }
              rows={6}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runTest(false)}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloudSun className="h-4 w-4" />
              {testing ? 'Probando…' : 'Probar conexión'}
            </button>
            <button
              type="button"
              onClick={() => void runTest(true)}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <WandSparkles className="h-4 w-4" />
              Probar con datos de ejemplo
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Campos detectados
          </h3>
          {detectedFields.length === 0 ? (
            <p className="text-sm text-slate-500">Ejecute un test para listar los campos de respuesta.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
              {detectedFields.map((field) => (
                <div key={field.path} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="font-mono text-xs text-slate-700">{field.path}</p>
                  <p className="text-[11px] text-slate-500">
                    {field.valueType} · {field.sampleValue}
                  </p>
                </div>
              ))}
            </div>
          )}

          {rawPayload && (
            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ver respuesta JSON
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
                {rawPayload}
              </pre>
            </details>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Enlace visual de campos
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {TARGET_FIELDS.map((target) => {
            const options = ('forecast' in target && target.forecast)
              ? forecastRelativeOptions
              : fieldPathOptions;
            return (
              <div key={target.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>{target.label}</span>
                  {target.required && <span className="text-xs text-rose-600">obligatorio</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  <select
                    value={mapping[target.key] ?? ''}
                    onChange={(event) =>
                      setMapping((prev) => ({
                        ...prev,
                        [target.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Seleccione un campo...</option>
                    {options.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            {requiredMissing.length === 0
              ? 'Listo para guardar y activar la fuente.'
              : `Faltan ${requiredMissing.length} enlaces obligatorios por seleccionar.`}
          </p>
          <button
            type="button"
            onClick={() => void saveSource()}
            disabled={loading || requiredMissing.length > 0 || !form.name.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar fuente
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Fuentes registradas
        </h3>
        {sources.length === 0 ? (
          <p className="text-sm text-slate-500">No hay fuentes guardadas aún.</p>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-800">{source.name}</p>
                  <p className="text-xs text-slate-500">
                    {source.baseUrl || 'Datos de ejemplo'} · {source.authType}
                    {source.isActive ? ' · Activa' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(sourceToForm(source));
                      setMapping((source.fieldMapping ?? {}) as Record<string, string>);
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Editar
                  </button>
                  {!source.isActive && (
                    <button
                      type="button"
                      onClick={() => void activateSource(source._id)}
                      className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeSource(source._id)}
                    className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
