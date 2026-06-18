/**
 * GraphQL queries and mutations for the Digital Twin API
 */

// ============================================================================
// Queries
// ============================================================================

export const HELLO_QUERY = `
  query Hello {
    hello
  }
`

export const SOLAR_DATA_QUERY = `
  query SolarData {
    solarData {
      current {
        production
        consumption
        batteryLevel
        efficiency
        timestamp
      }
      battery {
        level
        capacityKwh
        charging
        powerKw
        autonomyHours
      }
      timeline {
        hour
        production
        consumption
        batteryLevel
      }
      metrics {
        productionKwh
        consumptionKwh
        co2AvoidedKg
        gridImportKwh
        gridExportKwh
      }
      energyFlow {
        solarToLoad
        solarToBattery
        solarToGrid
        batteryToLoad
        gridToLoad
      }
    }
  }
`

export const WEATHER_QUERY = `
  query Weather {
    weather {
      current {
        temperature
        humidity
        cloudCover
        solarRadiation
        windSpeed
        condition
        timestamp
      }
      forecast {
        date
        tempMax
        tempMin
        condition
        solarRadiationAvg
        precipitationProb
      }
    }
  }
`

export const PREDICTIONS_QUERY = `
  query Predictions {
    predictions {
      predictions {
        hour
        productionKwh
        consumptionKwh
        batteryLevel
        confidence
        hasBlackout
        weatherCondition
      }
      alerts {
        severity
        message
        type
        timestamp
      }
      summary
    }
  }
`

export const PANELS_QUERY = `
  query Panels {
    panels {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      efficiencyPercent
      areaM2
      createdAt
      updatedAt
    }
  }
`

export const PANEL_QUERY = `
  query Panel($id: String!) {
    panel(id: $id) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      efficiencyPercent
      areaM2
      createdAt
      updatedAt
    }
  }
`

export const BATTERIES_QUERY = `
  query Batteries {
    batteries {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      maxDepthOfDischargePercent
      chargeRateKw
      dischargeRateKw
      efficiencyPercent
      createdAt
      updatedAt
    }
  }
`

export const BATTERY_DISCHARGE_ESTIMATE_QUERY = `
  query BatteryDischargeEstimate($startHour: Int!) {
    batteryDischargeEstimate(startHour: $startHour) {
      minutesToEmpty
      startHour
      batteryCapacityKwh
    }
  }
`

export const BATTERY_QUERY = `
  query Battery($id: String!) {
    battery(id: $id) {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      maxDepthOfDischargePercent
      chargeRateKw
      dischargeRateKw
      efficiencyPercent
      createdAt
      updatedAt
    }
  }
`

export const INVERTERS_QUERY = `
  query Inverters {
    inverters {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      createdAt
      updatedAt
    }
  }
`

export const INVERTER_QUERY = `
  query Inverter($id: String!) {
    inverter(id: $id) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      createdAt
      updatedAt
    }
  }
`

export const APPLIANCES_QUERY = `
  query Appliances {
    appliances {
      _id
      name
      category
      averagePowerW
      maxPowerW
      measuredPowerW
      quantity
      activeHours
      selectedModeIndex
      modes {
        name
        averagePowerW
        maxPowerW
      }
      createdAt
      updatedAt
    }
  }
`

export const APPLIANCE_QUERY = `
  query Appliance($id: String!) {
    appliance(id: $id) {
      _id
      name
      category
      averagePowerW
      maxPowerW
      measuredPowerW
      quantity
      activeHours
      selectedModeIndex
      modes {
        name
        averagePowerW
        maxPowerW
      }
      createdAt
      updatedAt
    }
  }
`

export const BLACKOUTS_QUERY = `
  query Blackouts($startDate: String, $endDate: String) {
    blackouts(startDate: $startDate, endDate: $endDate) {
      _id
      date
      intervals {
        start
        end
        durationMinutes
      }
      province
      municipality
      notes
      createdAt
      updatedAt
    }
  }
`

// ============================================================================
// Mutations
// ============================================================================

export const CREATE_PANEL_MUTATION = `
  mutation CreatePanel($input: PanelInput!) {
    createPanel(input: $input) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      efficiencyPercent
      areaM2
      createdAt
    }
  }
`

export const UPDATE_PANEL_MUTATION = `
  mutation UpdatePanel($id: String!, $input: PanelInput!) {
    updatePanel(id: $id, input: $input) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      efficiencyPercent
      areaM2
      updatedAt
    }
  }
`

export const DELETE_PANEL_MUTATION = `
  mutation DeletePanel($id: String!) {
    deletePanel(id: $id)
  }
`

export const CREATE_BATTERY_MUTATION = `
  mutation CreateBattery($input: BatteryInput!) {
    createBattery(input: $input) {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      maxDepthOfDischargePercent
      chargeRateKw
      dischargeRateKw
      efficiencyPercent
      createdAt
    }
  }
`

export const UPDATE_BATTERY_MUTATION = `
  mutation UpdateBattery($id: String!, $input: BatteryInput!) {
    updateBattery(id: $id, input: $input) {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      maxDepthOfDischargePercent
      chargeRateKw
      dischargeRateKw
      efficiencyPercent
      updatedAt
    }
  }
`

export const DELETE_BATTERY_MUTATION = `
  mutation DeleteBattery($id: String!) {
    deleteBattery(id: $id)
  }
`

export const CREATE_INVERTER_MUTATION = `
  mutation CreateInverter($input: InverterInput!) {
    createInverter(input: $input) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      createdAt
    }
  }
`

export const UPDATE_INVERTER_MUTATION = `
  mutation UpdateInverter($id: String!, $input: InverterInput!) {
    updateInverter(id: $id, input: $input) {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      updatedAt
    }
  }
`

export const DELETE_INVERTER_MUTATION = `
  mutation DeleteInverter($id: String!) {
    deleteInverter(id: $id)
  }
`

export const CREATE_APPLIANCE_MUTATION = `
  mutation CreateAppliance($input: ApplianceInput!) {
    createAppliance(input: $input) {
      _id
      name
      averagePowerW
      maxPowerW
      quantity
      createdAt
    }
  }
`

export const UPDATE_APPLIANCE_MUTATION = `
  mutation UpdateAppliance($id: String!, $input: ApplianceInput!) {
    updateAppliance(id: $id, input: $input) {
      _id
      name
      averagePowerW
      maxPowerW
      quantity
      updatedAt
    }
  }
`

export const DELETE_APPLIANCE_MUTATION = `
  mutation DeleteAppliance($id: String!) {
    deleteAppliance(id: $id)
  }
`

export const CREATE_BLACKOUT_MUTATION = `
  mutation CreateBlackout($input: BlackoutInput!) {
    createBlackout(input: $input) {
      _id
      date
      intervals {
        start
        end
        durationMinutes
      }
      createdAt
    }
  }
`

export const UPDATE_BLACKOUT_MUTATION = `
  mutation UpdateBlackout($id: String!, $input: BlackoutInput!) {
    updateBlackout(id: $id, input: $input) {
      _id
      date
      intervals {
        start
        end
        durationMinutes
      }
      updatedAt
    }
  }
`

export const DELETE_BLACKOUT_MUTATION = `
  mutation DeleteBlackout($id: String!) {
    deleteBlackout(id: $id)
  }
`

// ── Perfil de sombras ────────────────────────────────────────────────────────

export const SHADOW_PROFILE_QUERY = `
  query ShadowProfile {
    shadowProfile {
      slots {
        hour
        shadowPct
        prodOverride
      }
      avgShadow
      avgProd
      updatedAt
    }
  }
`

export const SAVE_SHADOW_PROFILE_MUTATION = `
  mutation SaveShadowProfile($slots: [ShadowSlotInput!]!) {
    saveShadowProfile(slots: $slots) {
      avgShadow
      avgProd
      updatedAt
    }
  }
`
