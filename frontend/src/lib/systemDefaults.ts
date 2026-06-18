import { SystemConfig } from '@/types';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  location: {
    lat: 23.1136,
    lon: -82.3666,
    name: 'La Habana, Cuba',
  },
  solar: {
    capacityKw: 0,
    panelRatedKw: 0,
    panelCount: 0,
    strings: 0,
    panelEfficiencyPercent: undefined,
    panelAreaM2: undefined,
    spec: null,
  },
  battery: {
    capacityKwh: 0,
    moduleCapacityKwh: undefined,
    moduleCount: 0,
    maxDepthOfDischargePercent: undefined,
    efficiencyPercent: undefined,
    chargeRateKw: undefined,
    dischargeRateKw: undefined,
    spec: null,
  },
};

