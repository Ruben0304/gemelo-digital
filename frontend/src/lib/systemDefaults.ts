import { SystemConfig } from '@/types';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  location: {
    lat: 23.1136,
    lon: -82.3666,
    name: 'La Habana, Cuba',
  },
  solar: {
    capacityKw: 50,
    panelRatedKw: 0.55,
    panelCount: 10,
    strings: 10,
    panelEfficiencyPercent: 21.8,
    panelAreaM2: 2.6,
    spec: null,
  },
  battery: {
    capacityKwh: 100,
    moduleCapacityKwh: 100,
    moduleCount: 1,
    maxDepthOfDischargePercent: 80,
    efficiencyPercent: 92,
    chargeRateKw: 25,
    dischargeRateKw: 25,
    spec: null,
  },
};

