'use client';

import { useEffect, useState } from 'react';
import ConsumptionProfileConfig from '@/app/components/ConsumptionProfileConfig';
import { ConsumptionProfile } from '@/types';
import { executeQuery } from '@/lib/graphql-client';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const PROFILE_QUERY = `
  query GetConsumptionProfile {
    consumptionProfile {
      _id
      name
      weekday
      weekend
      isActive
      createdAt
      updatedAt
    }
  }
`;

const ML_INFO_QUERY = `
  query MLConsumptionInfo {
    mlConsumptionModelInfo {
      loaded
      isDemo
      trainingDataset
      scaleDivisor
    }
  }
`;

type MLConsumptionInfo = {
  loaded: boolean;
  isDemo: boolean;
  trainingDataset?: string | null;
  scaleDivisor?: number | null;
};

export default function ConsumptionProfilePage() {
  const [profile, setProfile] = useState<ConsumptionProfile | null>(null);
  const [mlInfo, setMlInfo] = useState<MLConsumptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      executeQuery<{ consumptionProfile: ConsumptionProfile }>(PROFILE_QUERY).catch(() => null),
      executeQuery<{ mlConsumptionModelInfo: MLConsumptionInfo }>(ML_INFO_QUERY).catch(() => null),
    ])
      .then(([profileData, mlData]) => {
        setProfile(profileData?.consumptionProfile ?? null);
        setMlInfo(mlData?.mlConsumptionModelInfo ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Perfil de consumo</h2>
        <p className="text-sm text-slate-500 mt-1">
          Define el consumo eléctrico típico de la instalación por hora y tipo de día.
          Este perfil se usa para predecir la demanda mientras no haya suficientes datos históricos.
        </p>
      </div>

      {mlInfo?.isDemo && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">
              Modelo de consumo en modo demo
              {!mlInfo.loaded ? ' (modelo no cargado)' : ''}
            </p>
            <p className="mt-0.5">
              El modelo ML está calibrado con {mlInfo.trainingDataset ?? 'un dataset de referencia'}.
              {mlInfo.scaleDivisor && mlInfo.scaleDivisor !== 1
                ? ` La salida se reescala dividiendo por ${mlInfo.scaleDivisor} para acercarla al sistema configurado.`
                : ''}
              {' '}Las predicciones son orientativas; para uso productivo conviene reentrenar con datos del sitio
              o sobreescribir <code className="rounded bg-amber-100 px-1 text-xs">ML_CONSUMPTION_METER_ID</code> / <code className="rounded bg-amber-100 px-1 text-xs">CAMPUS_ID</code> en el backend.
            </p>
          </div>
        </div>
      )}

      <ConsumptionProfileConfig
        initialProfile={profile}
        onSaved={(p) => setProfile(p)}
      />
    </div>
  );
}
