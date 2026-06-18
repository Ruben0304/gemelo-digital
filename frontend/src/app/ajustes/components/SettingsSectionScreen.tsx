'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import DevicesView, { type SettingsSectionView } from '@/app/components/DevicesView';
import LocationConfig from '@/app/components/LocationConfig';
import ReporteExport from '@/app/components/ReporteExport';
import { executeQuery } from '@/lib/graphql-client';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/systemDefaults';
import type {
  ApplianceConfig,
  BatteryConfig,
  InverterConfig,
  SolarPanelConfig,
  SystemConfig,
} from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtendedSection = SettingsSectionView | 'ubicacion' | 'reportes';

interface SettingsSectionScreenProps {
  section: ExtendedSection;
}

// ─── Devices section (loads data, renders DevicesView) ────────────────────────

interface SettingsDataResponse {
  solar?: { config?: SystemConfig } | null;
  panels?: SolarPanelConfig[];
  batteries?: BatteryConfig[];
  inverters?: InverterConfig[];
  appliances?: ApplianceConfig[];
}

const SETTINGS_DATA_QUERY = `
  query SettingsScreenData {
    solar {
      config {
        location { lat lon name }
        solar {
          capacityKw panelRatedKw panelCount strings panelEfficiencyPercent panelAreaM2
          spec { _id manufacturer model ratedPowerKw quantity tiltDegrees orientation createdAt updatedAt }
        }
        battery {
          capacityKwh moduleCapacityKwh moduleCount maxDepthOfDischargePercent chargeRateKw dischargeRateKw efficiencyPercent
          spec { _id manufacturer model capacityKwh quantity createdAt updatedAt }
        }
      }
    }
    panels { _id manufacturer model ratedPowerKw quantity tiltDegrees orientation createdAt updatedAt }
    batteries { _id manufacturer model capacityKwh quantity createdAt updatedAt }
    inverters { _id manufacturer model ratedPowerKw quantity efficiencyPercent createdAt updatedAt }
    appliances {
      _id name category averagePowerW maxPowerW measuredPowerW quantity activeHours selectedModeIndex
      modes { name averagePowerW maxPowerW }
      alwaysOn
      measurementMeta { samples avgKw minKw maxKw hoursCovered firstDate lastDate }
      createdAt updatedAt
    }
  }
`;

function DevicesSectionScreen({ section }: { section: SettingsSectionView }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panels, setPanels] = useState<SolarPanelConfig[]>([]);
  const [batteries, setBatteries] = useState<BatteryConfig[]>([]);
  const [inverters, setInverters] = useState<InverterConfig[]>([]);
  const [appliances, setAppliances] = useState<ApplianceConfig[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  const fetchSettingsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await executeQuery<SettingsDataResponse>(SETTINGS_DATA_QUERY, {}, 'network-only');
      setPanels(data.panels ?? []);
      setBatteries(data.batteries ?? []);
      setInverters(data.inverters ?? []);
      setAppliances(data.appliances ?? []);
      setSystemConfig(data.solar?.config ?? DEFAULT_SYSTEM_CONFIG);
    } catch (err) {
      console.error('Error loading settings data:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos de ajustes.');
      setSystemConfig(DEFAULT_SYSTEM_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSettingsData(); }, [fetchSettingsData]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/60 bg-white/80 p-10 text-center backdrop-blur-xl">
        <ArrowPathIcon className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-600">Cargando sección de ajustes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p className="text-sm font-semibold">No se pudo cargar la sección.</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => void fetchSettingsData()}
          className="mt-3 inline-flex items-center rounded-full border border-rose-300 bg-white px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <DevicesView
      panels={panels}
      batteries={batteries}
      inverters={inverters}
      appliances={appliances}
      systemConfig={systemConfig}
      onRefresh={fetchSettingsData}
      forcedSettingsView={section}
    />
  );
}

// ─── Standalone section wrapper ───────────────────────────────────────────────

function StandaloneSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_30px_70px_-50px_rgba(15,23,42,0.65)]">
      {children}
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function SettingsSectionScreen({ section }: SettingsSectionScreenProps) {
  if (section === 'ubicacion') {
    return <StandaloneSection><LocationConfig /></StandaloneSection>;
  }
  if (section === 'reportes') {
    return <StandaloneSection><ReporteExport /></StandaloneSection>;
  }
  return <DevicesSectionScreen section={section as SettingsSectionView} />;
}
