"""
GraphQL schema exposing the migrated Digital Twin functionality.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import strawberry
from strawberry.scalars import JSON

from app.services.battery_service import (
    create_battery,
    delete_battery,
    get_battery,
    list_batteries,
    update_battery,
)
from app.services.appliance_service import (
    attach_measurement,
    clear_measurement,
    create_appliance,
    delete_appliance,
    get_appliance,
    list_appliances,
    update_appliance,
)
from app.services.inverter_service import (
    create_inverter,
    delete_inverter,
    get_inverter,
    list_inverters,
    update_inverter,
)
from app.services.blackout_service import (
    delete_blackout,
    get_blackout,
    list_blackouts,
    save_blackout_schedule,
    update_blackout_schedule,
)
from app.services.panel_service import (
    create_panel,
    delete_panel,
    get_panel,
    list_panels,
    update_panel,
)
from app.services.prediction_service import get_predictions_bundle
from app.services.solar_service import get_solar_snapshot
from app.services.system_config import get_system_config
from app.services.user_service import (
    authenticate_user,
    authenticate_or_provision_ldap,
    change_password,
    register_user,
    list_users,
    is_admin,
    delete_user,
)
from app.services.session_service import (
    create_session,
    list_active_sessions,
    revoke_session,
    revoke_sessions_by_email,
)
from app.services.weather_service import get_weather_with_fallback
from app.services.weather_source_service import (
    delete_weather_source,
    get_active_weather_source,
    list_weather_sources,
    save_weather_source,
    set_active_weather_source,
    test_weather_source,
)
from app.services.location_config_service import (
    get_location_config,
    save_location_config,
)
from app.services.shadow_profile_service import (
    get_shadow_profile,
    save_shadow_profile,
)
from app.services.ml_prediction_service import (
    predict_solar_production,
    predict_next_hours,
    predict_for_date_range,
)
from app.services.ml_model_service import ml_model_service
from app.services.consumption_prediction_service import (
    predict_consumption,
    predict_consumption_next_hours,
    predict_consumption_for_date_range,
    predict_consumption_for_specific_hours,
)
from app.services.ml_consumption_service import ml_consumption_service
from app.services.consumption_profile_service import (
    get_active_profile,
    save_profile,
    predict_for_date,
    predict_date_range,
    predict_next_hours as predict_profile_next_hours,
)
from app.services.battery_discharge_service import calculate_battery_discharge_time
from app.services.invitation_service import create_invitation_code, list_invitation_codes
import strawberry.types
from app.auth import create_token, require_admin, require_auth
from app.services.lectura_service import (
    get_readings,
    get_daily_summaries,
    save_reading,
    seed_historical_data,
)


# ============================================================================
# Types
# ============================================================================


@strawberry.type
class SolarPoint:
    timestamp: str
    production: float
    consumption: float
    batteryLevel: float
    gridExport: float
    gridImport: float
    efficiency: float
    batteryDelta: Optional[float]


@strawberry.type
class BatteryStatusType:
    chargeLevel: float
    capacity: float
    current: float
    autonomyHours: float
    charging: bool
    powerFlow: float
    projectedMinLevel: Optional[float]
    projectedMaxLevel: Optional[float]
    note: Optional[str]


@strawberry.type
class SystemMetricsType:
    currentProduction: float
    currentConsumption: float
    energyBalance: float
    systemEfficiency: float
    dailyProduction: float
    dailyConsumption: float
    co2Avoided: float


@strawberry.type
class EnergyFlowType:
    solarToBattery: float
    solarToLoad: float
    solarToGrid: float
    batteryToLoad: float
    gridToLoad: float


@strawberry.type
class WeatherForecastDay:
    date: str
    dayOfWeek: str
    maxTemp: float
    minTemp: float
    solarRadiation: float
    cloudCover: float
    predictedProduction: float
    condition: str


@strawberry.type
class WeatherDataType:
    temperature: float
    solarRadiation: float
    cloudCover: float
    humidity: float
    windSpeed: float
    forecast: List[WeatherForecastDay]
    provider: Optional[str]
    locationName: Optional[str]
    lastUpdated: Optional[str]
    description: Optional[str]


@strawberry.type
class LocationConfigType:
    lat: float
    lon: float
    name: str


@strawberry.type
class LocationConfigExtType:
    lat: float
    lon: float
    name: str
    updatedAt: Optional[str]


@strawberry.type
class ShadowSlotType:
    hour: int
    shadow_pct: float = strawberry.field(name="shadowPct")
    prod_override: Optional[float] = strawberry.field(name="prodOverride")


@strawberry.type
class ShadowProfileType:
    slots: List[ShadowSlotType]
    avg_shadow: float = strawberry.field(name="avgShadow")
    avg_prod: float = strawberry.field(name="avgProd")
    updated_at: Optional[str] = strawberry.field(name="updatedAt")


@strawberry.input
class ShadowSlotInput:
    hour: int
    shadow_pct: float = strawberry.field(name="shadowPct")
    prod_override: Optional[float] = strawberry.field(name="prodOverride", default=None)


@strawberry.type
class PanelConfigSpec:
    id_: Optional[str] = strawberry.field(name="_id")
    manufacturer: Optional[str]
    model: Optional[str]
    ratedPowerKw: Optional[float]
    quantity: Optional[int]
    tiltDegrees: Optional[float]
    orientation: Optional[str]
    efficiencyPercent: Optional[float] = None
    areaM2: Optional[float] = None
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class SolarConfigType:
    capacityKw: float
    panelRatedKw: Optional[float]
    panelCount: int
    strings: Optional[int]
    panelEfficiencyPercent: Optional[float]
    panelAreaM2: Optional[float]
    spec: Optional[PanelConfigSpec]


@strawberry.type
class BatteryConfigSpec:
    id_: Optional[str] = strawberry.field(name="_id")
    manufacturer: Optional[str]
    model: Optional[str]
    capacityKwh: Optional[float]
    quantity: Optional[int]
    maxDepthOfDischargePercent: Optional[float] = None
    chargeRateKw: Optional[float] = None
    dischargeRateKw: Optional[float] = None
    efficiencyPercent: Optional[float] = None
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class BatteryConfigType:
    capacityKwh: float
    moduleCapacityKwh: Optional[float]
    moduleCount: Optional[int]
    maxDepthOfDischargePercent: Optional[float]
    chargeRateKw: Optional[float]
    dischargeRateKw: Optional[float]
    efficiencyPercent: Optional[float]
    spec: Optional[BatteryConfigSpec]


@strawberry.type
class SystemConfigType:
    location: LocationConfigType
    solar: SolarConfigType
    battery: BatteryConfigType


@strawberry.type
class SolarSnapshot:
    current: SolarPoint
    historical: List[SolarPoint]
    battery: BatteryStatusType
    metrics: SystemMetricsType
    energyFlow: EnergyFlowType
    weather: WeatherDataType
    config: SystemConfigType
    timestamp: str
    mode: str


@strawberry.type
class BlackoutImpactType:
    intervalStart: str
    intervalEnd: str
    loadFactor: float
    productionFactor: float
    intensity: str
    note: Optional[str]


@strawberry.type
class PredictionType:
    timestamp: str
    hour: int
    expectedProduction: float
    expectedConsumption: float
    confidence: float
    blackoutImpact: Optional[BlackoutImpactType]


@strawberry.type
class AlertType:
    id: str
    type: str
    title: str
    message: str
    timestamp: str


@strawberry.type
class BlackoutIntervalType:
    start: str
    end: str
    durationMinutes: Optional[int]


@strawberry.type
class BlackoutType:
    id_: str = strawberry.field(name="_id")
    date: str
    intervals: List[BlackoutIntervalType]
    province: Optional[str]
    municipality: Optional[str]
    notes: Optional[str]
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class PredictionsPayload:
    predictions: List[PredictionType]
    alerts: List[AlertType]
    recommendations: List[str]
    battery: BatteryStatusType
    timeline: List[SolarPoint]
    weather: WeatherDataType
    timestamp: str
    config: SystemConfigType
    blackouts: List[BlackoutType]


@strawberry.type
class PanelType:
    id_: str = strawberry.field(name="_id")
    manufacturer: str
    model: Optional[str]
    ratedPowerKw: float
    quantity: int
    tiltDegrees: Optional[float]
    orientation: Optional[str]
    efficiencyPercent: Optional[float] = None
    areaM2: Optional[float] = None
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class BatteryType:
    id_: str = strawberry.field(name="_id")
    manufacturer: str
    model: Optional[str]
    capacityKwh: float
    quantity: int
    maxDepthOfDischargePercent: Optional[float] = None
    chargeRateKw: Optional[float] = None
    dischargeRateKw: Optional[float] = None
    efficiencyPercent: Optional[float] = None
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class ApplianceModeType:
    name: str
    averagePowerW: float
    maxPowerW: Optional[float]


@strawberry.type
class ApplianceMeasurementMetaType:
    samples: int
    firstDate: Optional[str]
    lastDate: Optional[str]
    avgKw: float
    minKw: float
    maxKw: float
    stdKw: float
    hoursCovered: int


@strawberry.type
class ApplianceType:
    id_: str = strawberry.field(name="_id")
    name: str
    category: Optional[str]
    averagePowerW: float
    maxPowerW: float
    measuredPowerW: Optional[float]
    quantity: int
    activeHours: Optional[float]
    selectedModeIndex: Optional[int]
    modes: List[ApplianceModeType]
    alwaysOn: bool = True
    hourlyProfileKw: List[float] = strawberry.field(default_factory=list)
    measurementMeta: Optional[ApplianceMeasurementMetaType] = None
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class HourlyForecastPoint:
    datetime: str
    consumptionKw: float


@strawberry.type
class ApplianceForecastSummary:
    totalConsumptionKw: float
    appliancesWithProfile: int
    appliancesAlwaysOn: int
    points: List[HourlyForecastPoint]


@strawberry.type
class InverterType:
    id_: str = strawberry.field(name="_id")
    manufacturer: str
    model: Optional[str]
    ratedPowerKw: float
    quantity: int
    efficiencyPercent: Optional[float]
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class UserType:
    id_: str = strawberry.field(name="_id")
    email: str
    name: Optional[str]
    role: str
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class SessionType:
    id_: str = strawberry.field(name="_id")
    email: str
    ip: str
    userAgent: str
    deviceType: str
    createdAt: Optional[str]
    expiresAt: Optional[str]


@strawberry.type
class AuthPayloadType:
    user: UserType
    token: str


@strawberry.type
class HistoricalReadingType:
    id_: str = strawberry.field(name="_id")
    timestamp: str
    production: float
    consumption: float
    batteryLevel: float
    gridExport: float
    gridImport: float
    efficiency: float


@strawberry.type
class DailySummaryType:
    date: str
    totalProduction: float
    totalConsumption: float
    avgBatteryLevel: float
    maxProduction: float
    maxConsumption: float
    avgEfficiency: float
    readingCount: int


@strawberry.type
class MLWeatherFeaturesType:
    temperature_2m: float
    relative_humidity_2m: float
    wind_speed_10m: float
    cloud_cover: float
    shortwave_radiation: float


@strawberry.type
class MLPredictionType:
    datetime: str
    production_kw: float
    weather: MLWeatherFeaturesType
    # Fuente de datos meteorológicos usada por el modelo. El ML está entrenado
    # contra Open-Meteo, así que este campo siempre vale "Open-Meteo".
    weather_source: str = strawberry.field(name="weatherSource", default="Open-Meteo")
    # Si la fuente configurada por el usuario es distinta, aquí se devuelve un
    # aviso para que el frontend lo muestre y no se vea como inconsistencia.
    weather_source_warning: Optional[str] = strawberry.field(
        name="weatherSourceWarning", default=None
    )


@strawberry.type
class MLModelInfoType:
    loaded: bool
    model_name: Optional[str]
    test_rmse: Optional[float]
    test_r2: Optional[float]
    test_mae: Optional[float]
    features: List[str]
    training_date: Optional[str]
    requires_scaling: Optional[bool]
    reference_capacity_kw: Optional[float]
    message: Optional[str]


@strawberry.type
class MLConsumptionPredictionType:
    datetime: str
    consumption_kw: float


@strawberry.type
class MLConsumptionModelInfoType:
    loaded: bool
    model_name: Optional[str]
    test_rmse: Optional[float]
    test_r2: Optional[float]
    test_mae: Optional[float]
    features: List[str]
    training_date: Optional[str]
    campus_id_default: Optional[int]
    meter_id_default: Optional[int]
    message: Optional[str]
    # Procedencia del modelo y escalado aplicado a la salida. Permite al frontend
    # avisar al usuario que la predicción ML proviene de un edificio del CUJAE
    # y que se reescala por configuración, en lugar de presentarla como un
    # modelo entrenado para el sistema que está viendo.
    training_dataset: Optional[str] = strawberry.field(name="trainingDataset")
    scale_divisor: Optional[float] = strawberry.field(name="scaleDivisor")
    is_demo: bool = strawberry.field(name="isDemo")


@strawberry.type
class ConsumptionProfileType:
    id_: Optional[str] = strawberry.field(name="_id")
    name: str
    weekday: List[float]
    weekend: List[float]
    is_active: bool = strawberry.field(name="isActive")
    created_at: Optional[str] = strawberry.field(name="createdAt")
    updated_at: Optional[str] = strawberry.field(name="updatedAt")


@strawberry.type
class ConsumptionPredictionType:
    datetime: str
    consumption_kw: float = strawberry.field(name="consumptionKw")
    confidence: float
    confidence_pct: int = strawberry.field(name="confidencePct")
    source_label: str = strawberry.field(name="sourceLabel")
    explanation: str
    hour: int
    is_weekend: bool = strawberry.field(name="isWeekend")


@strawberry.type
class BatteryDischargeEstimateType:
    minutesToEmpty: Optional[int]
    startHour: int
    batteryCapacityKwh: float


@strawberry.type
class InvitationCodeType:
    id_: str = strawberry.field(name="_id")
    code: str
    role: str
    isUsed: bool
    createdBy: Optional[str]
    usedBy: Optional[str]
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class WeatherSourceType:
    id_: str = strawberry.field(name="_id")
    name: str
    baseUrl: Optional[str]
    authType: str
    authHeaderName: Optional[str]
    authQueryName: Optional[str]
    authValue: Optional[str]
    queryParams: JSON
    fieldMapping: JSON
    locationName: Optional[str]
    enabled: bool
    isActive: bool
    createdAt: Optional[str]
    updatedAt: Optional[str]


@strawberry.type
class WeatherFieldCandidateType:
    path: str
    valueType: str
    sampleValue: str


@strawberry.type
class WeatherSourceTestResultType:
    success: bool
    message: str
    fields: List[WeatherFieldCandidateType]
    rawJson: str


# ============================================================================
# Helpers
# ============================================================================


def _map_consumption_prediction(p: dict) -> ConsumptionPredictionType:
    return ConsumptionPredictionType(
        datetime=p["datetime"],
        consumption_kw=p["consumption_kw"],
        confidence=p["confidence"],
        confidence_pct=p["confidence_pct"],
        source_label=p["source_label"],
        explanation=p["explanation"],
        hour=p["hour"],
        is_weekend=p["is_weekend"],
    )


def _map_solar_point(item: dict) -> SolarPoint:
    return SolarPoint(**item)


def _map_weather(data: dict) -> WeatherDataType:
    return WeatherDataType(
        temperature=data["temperature"],
        solarRadiation=data["solarRadiation"],
        cloudCover=data["cloudCover"],
        humidity=data["humidity"],
        windSpeed=data["windSpeed"],
        forecast=[WeatherForecastDay(**day) for day in data.get("forecast", [])],
        provider=data.get("provider"),
        locationName=data.get("locationName"),
        lastUpdated=data.get("lastUpdated"),
        description=data.get("description"),
    )


def _map_battery_status(data: dict) -> BatteryStatusType:
    return BatteryStatusType(**data)


def _map_metrics(data: dict) -> SystemMetricsType:
    return SystemMetricsType(**data)


def _map_energy_flow(data: dict) -> EnergyFlowType:
    return EnergyFlowType(**data)


def _map_panel(data: dict) -> PanelType:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return PanelType(**data_copy)


def _map_battery(data: dict) -> BatteryType:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return BatteryType(**data_copy)


def _map_appliance_mode(data: dict) -> ApplianceModeType:
    return ApplianceModeType(
        name=data.get("name", ""),
        averagePowerW=data.get("averagePowerW", 0),
        maxPowerW=data.get("maxPowerW"),
    )


def _map_appliance(data: dict) -> ApplianceType:
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    data_copy["modes"] = [_map_appliance_mode(mode) for mode in data.get("modes", [])]
    data_copy["alwaysOn"] = True if data.get("alwaysOn") is None else bool(data.get("alwaysOn"))
    data_copy["hourlyProfileKw"] = list(data.get("hourlyProfileKw") or [])
    meta = data.get("measurementMeta")
    data_copy["measurementMeta"] = (
        ApplianceMeasurementMetaType(
            samples=int(meta.get("samples", 0)),
            firstDate=meta.get("firstDate"),
            lastDate=meta.get("lastDate"),
            avgKw=float(meta.get("avgKw", 0.0)),
            minKw=float(meta.get("minKw", 0.0)),
            maxKw=float(meta.get("maxKw", 0.0)),
            stdKw=float(meta.get("stdKw", 0.0)),
            hoursCovered=int(meta.get("hoursCovered", 0)),
        )
        if isinstance(meta, dict)
        else None
    )
    return ApplianceType(**data_copy)


def _map_inverter(data: dict) -> InverterType:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return InverterType(**data_copy)


def _map_panel_spec(data: dict) -> PanelConfigSpec:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return PanelConfigSpec(**data_copy)


def _map_battery_spec(data: dict) -> BatteryConfigSpec:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return BatteryConfigSpec(**data_copy)


def _map_system_config(config: dict) -> SystemConfigType:
    loc = config["location"]
    location = LocationConfigType(lat=loc["lat"], lon=loc["lon"], name=loc["name"])
    solar_spec = _map_panel_spec(config["solar"]["spec"]) if config["solar"].get("spec") else None
    battery_spec = _map_battery_spec(config["battery"]["spec"]) if config["battery"].get("spec") else None
    solar = SolarConfigType(
        capacityKw=config["solar"]["capacityKw"],
        panelRatedKw=config["solar"].get("panelRatedKw"),
        panelCount=config["solar"].get("panelCount") or 0,
        strings=config["solar"].get("strings"),
        panelEfficiencyPercent=config["solar"].get("panelEfficiencyPercent"),
        panelAreaM2=config["solar"].get("panelAreaM2"),
        spec=solar_spec,
    )
    battery = BatteryConfigType(
        capacityKwh=config["battery"]["capacityKwh"],
        moduleCapacityKwh=config["battery"].get("moduleCapacityKwh"),
        moduleCount=config["battery"].get("moduleCount"),
        maxDepthOfDischargePercent=config["battery"].get("maxDepthOfDischargePercent"),
        chargeRateKw=config["battery"].get("chargeRateKw"),
        dischargeRateKw=config["battery"].get("dischargeRateKw"),
        efficiencyPercent=config["battery"].get("efficiencyPercent"),
        spec=battery_spec,
    )
    return SystemConfigType(location=location, solar=solar, battery=battery)


def _map_blackout(data: dict) -> BlackoutType:
    return BlackoutType(
        id_=data["_id"],
        date=data["date"],
        intervals=[BlackoutIntervalType(**interval) for interval in data.get("intervals", [])],
        province=data.get("province"),
        municipality=data.get("municipality"),
        notes=data.get("notes"),
        createdAt=data.get("createdAt"),
        updatedAt=data.get("updatedAt"),
    )


def _map_user(data: dict) -> UserType:
    # Rename _id to id_ for Strawberry field mapping
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    return UserType(**data_copy)


def _map_weather_source(data: dict) -> WeatherSourceType:
    data_copy = {**data}
    if "_id" in data_copy:
        data_copy["id_"] = data_copy.pop("_id")
    data_copy["queryParams"] = data_copy.get("queryParams") or {}
    data_copy["fieldMapping"] = data_copy.get("fieldMapping") or {}
    return WeatherSourceType(**data_copy)


def _get_real_capacity_kw_from_config(config: Optional[dict]) -> Optional[float]:
    if not config:
        return None
    solar_cfg = config.get("solar") or {}
    capacity = solar_cfg.get("capacityKw")
    try:
        return float(capacity) if capacity is not None else None
    except (TypeError, ValueError):
        return None


def _scale_ml_predictions(
    predictions: List[Dict[str, Any]],
    capacity_kw: Optional[float] = None,
) -> List[Dict[str, Any]]:
    reference_capacity_kw = ml_model_service.get_reference_capacity_kw()
    if not reference_capacity_kw or reference_capacity_kw <= 0:
        return predictions

    target_capacity_kw = capacity_kw
    if target_capacity_kw is None:
        try:
            config = get_system_config()
        except Exception:
            config = None
        target_capacity_kw = _get_real_capacity_kw_from_config(config)

    if not target_capacity_kw or target_capacity_kw <= 0:
        return predictions

    scale_factor = target_capacity_kw / reference_capacity_kw
    scaled_predictions: List[Dict[str, Any]] = []
    for pred in predictions:
        scaled_predictions.append({
            **pred,
            "production_kw": round(float(pred["production_kw"]) * scale_factor, 2),
        })
    return scaled_predictions


def _to_ml_prediction_type(pred: Dict[str, Any]) -> "MLPredictionType":
    return MLPredictionType(
        datetime=pred["datetime"],
        production_kw=pred["production_kw"],
        weather=MLWeatherFeaturesType(**pred["weather"]),
        weather_source=pred.get("weather_source", "Open-Meteo"),
        weather_source_warning=pred.get("weather_source_warning"),
    )


def _scale_consumption_predictions(
    predictions: List[Dict[str, Any]],
    divisor: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    El modelo ML de consumo se entrenó con el medidor 55 del campus CUJAE (un
    edificio cuyo consumo nominal es ~10× el sistema base del gemelo). Para
    que la salida sea representativa del sistema simulado, dividimos por un
    factor de escala configurable (settings.ML_CONSUMPTION_SCALE_DIVISOR).
    Cuando se reentrena el modelo con datos del propio sitio, este divisor
    debe ponerse a 1.
    """
    if not predictions:
        return predictions

    if divisor is None:
        from app.config import settings
        divisor = settings.ML_CONSUMPTION_SCALE_DIVISOR

    if not divisor or divisor == 0:
        return predictions

    scaled_predictions: List[Dict[str, Any]] = []
    for pred in predictions:
        value = pred.get("consumption_kw")
        try:
            scaled_value = round(float(value) / divisor, 2)
        except (TypeError, ValueError):
            scaled_value = value

        scaled_predictions.append({
            **pred,
            "consumption_kw": scaled_value,
        })

    return scaled_predictions


# ============================================================================
# Queries
# ============================================================================


@strawberry.type
class Query:
    @strawberry.field
    async def solar(self) -> SolarSnapshot:
        data = await get_solar_snapshot()
        return SolarSnapshot(
            current=_map_solar_point(data["current"]),
            historical=[_map_solar_point(item) for item in data["historical"]],
            battery=_map_battery_status(data["battery"]),
            metrics=_map_metrics(data["metrics"]),
            energyFlow=_map_energy_flow(data["energyFlow"]),
            weather=_map_weather(data["weather"]),
            config=_map_system_config(data["config"]),
            timestamp=data["timestamp"],
            mode=data["mode"],
        )

    @strawberry.field
    async def weather(self) -> WeatherDataType:
        config = get_system_config()
        weather = await get_weather_with_fallback(
            config["location"]["lat"],
            config["location"]["lon"],
            config["solar"]["capacityKw"],
            config["location"]["name"],
        )
        return _map_weather(weather)

    @strawberry.field
    async def predictions(self) -> PredictionsPayload:
        data = await get_predictions_bundle()
        return PredictionsPayload(
            predictions=[
                PredictionType(
                    **prediction,
                    blackoutImpact=BlackoutImpactType(**prediction["blackoutImpact"])
                    if prediction.get("blackoutImpact")
                    else None,
                )
                for prediction in data["predictions"]
            ],
            alerts=[AlertType(**alert) for alert in data["alerts"]],
            recommendations=data["recommendations"],
            battery=_map_battery_status(data["battery"]),
            timeline=[_map_solar_point(item) for item in data["timeline"]],
            weather=_map_weather(data["weather"]),
            timestamp=data["timestamp"],
            config=_map_system_config(data["config"]),
            blackouts=[_map_blackout(item) for item in data["blackouts"]],
        )

    @strawberry.field
    def panels(self) -> List[PanelType]:
        return [_map_panel(panel) for panel in list_panels()]

    @strawberry.field
    def panel(self, id: str) -> Optional[PanelType]:
        panel = get_panel(id)
        return _map_panel(panel) if panel else None

    @strawberry.field
    def batteries(self) -> List[BatteryType]:
        return [_map_battery(battery) for battery in list_batteries()]

    @strawberry.field
    def battery(self, id: str) -> Optional[BatteryType]:
        battery = get_battery(id)
        return _map_battery(battery) if battery else None

    @strawberry.field
    def appliances(self) -> List[ApplianceType]:
        return [_map_appliance(appliance) for appliance in list_appliances()]

    @strawberry.field
    def appliance(self, id: str) -> Optional[ApplianceType]:
        appliance = get_appliance(id)
        return _map_appliance(appliance) if appliance else None

    @strawberry.field
    def appliancesConsumptionForecast(
        self,
        hours: int = 24,
        start: Optional[str] = None,
    ) -> ApplianceForecastSummary:
        """
        Sum the forecasted consumption (kW) of every appliance flagged as
        alwaysOn for the next `hours` starting at `start` (ISO datetime,
        defaults to the next full hour). Appliances with an uploaded
        measurement profile use their (weekday x hour) average; the rest
        contribute averagePowerW * quantity converted to kW.
        """
        from datetime import datetime as _dt, timedelta as _td

        from app.services.appliance_measurement_service import forecast_kw

        if start:
            try:
                begin = _dt.fromisoformat(start.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                begin = _dt.utcnow()
        else:
            now = _dt.utcnow()
            begin = (now + _td(hours=1)).replace(minute=0, second=0, microsecond=0)

        hours = max(1, min(int(hours), 24 * 14))
        items = list_appliances()

        points: List[HourlyForecastPoint] = []
        always_on_count = 0
        with_profile_count = 0
        for appliance in items:
            if not (True if appliance.get("alwaysOn") is None else bool(appliance.get("alwaysOn"))):
                continue
            always_on_count += 1
            if appliance.get("hourlyProfileKw"):
                with_profile_count += 1

        running_total = 0.0
        for i in range(hours):
            dt = begin + _td(hours=i)
            total_kw = 0.0
            for appliance in items:
                if not (True if appliance.get("alwaysOn") is None else bool(appliance.get("alwaysOn"))):
                    continue
                profile = appliance.get("hourlyProfileKw") or []
                if len(profile) == 168:
                    total_kw += forecast_kw(profile, dt)
                else:
                    avg_w = float(appliance.get("averagePowerW") or 0)
                    qty = int(appliance.get("quantity") or 1)
                    total_kw += (avg_w * qty) / 1000.0
            running_total += total_kw
            points.append(
                HourlyForecastPoint(datetime=dt.isoformat(), consumptionKw=round(total_kw, 4))
            )

        return ApplianceForecastSummary(
            totalConsumptionKw=round(running_total, 4),
            appliancesWithProfile=with_profile_count,
            appliancesAlwaysOn=always_on_count,
            points=points,
        )

    @strawberry.field
    def inverters(self) -> List[InverterType]:
        return [_map_inverter(inverter) for inverter in list_inverters()]

    @strawberry.field
    def inverter(self, id: str) -> Optional[InverterType]:
        inverter = get_inverter(id)
        return _map_inverter(inverter) if inverter else None

    @strawberry.field
    def blackouts(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[BlackoutType]:
        items = list_blackouts(start_date, end_date, limit)
        return [_map_blackout(item) for item in items]

    @strawberry.field
    async def ml_predict(
        self,
        datetimes: List[str],
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> List[MLPredictionType]:
        """
        Predict solar production using ML model for specific datetimes.

        Args:
            datetimes: List of ISO datetime strings (e.g., ["2025-01-15T13:00:00", "2025-01-15T14:00:00"])
            lat: Latitude (optional, defaults to system location)
            lon: Longitude (optional, defaults to system location)

        Returns:
            List of predictions with production_kw and weather features
        """
        # Get system config for location if not provided
        capacity_kw = None
        if lat is None or lon is None:
            config = get_system_config()
            lat = lat or config["location"]["lat"]
            lon = lon or config["location"]["lon"]
            capacity_kw = _get_real_capacity_kw_from_config(config)

        predictions = await predict_solar_production(datetimes, lat, lon)
        predictions = _scale_ml_predictions(predictions, capacity_kw)

        return [_to_ml_prediction_type(pred) for pred in predictions]

    @strawberry.field
    async def ml_predict_next_hours(
        self,
        hours: int = 24,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> List[MLPredictionType]:
        """
        Predict solar production for the next N hours.

        Args:
            hours: Number of hours to predict (default: 24)
            lat: Latitude (optional, defaults to system location)
            lon: Longitude (optional, defaults to system location)

        Returns:
            List of hourly predictions
        """
        # Get system config for location if not provided
        capacity_kw = None
        if lat is None or lon is None:
            config = get_system_config()
            lat = lat or config["location"]["lat"]
            lon = lon or config["location"]["lon"]
            capacity_kw = _get_real_capacity_kw_from_config(config)

        predictions = await predict_next_hours(hours, lat, lon)
        predictions = _scale_ml_predictions(predictions, capacity_kw)

        return [_to_ml_prediction_type(pred) for pred in predictions]

    @strawberry.field
    async def ml_predict_date_range(
        self,
        start_date: str,
        end_date: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> List[MLPredictionType]:
        """
        Predict solar production for all hours in a date range.

        Args:
            start_date: Start date (ISO format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')
            end_date: End date (ISO format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')
            lat: Latitude (optional, defaults to system location)
            lon: Longitude (optional, defaults to system location)

        Returns:
            List of hourly predictions for the entire date range
        """
        # Get system config for location if not provided
        capacity_kw = None
        if lat is None or lon is None:
            config = get_system_config()
            lat = lat or config["location"]["lat"]
            lon = lon or config["location"]["lon"]
            capacity_kw = _get_real_capacity_kw_from_config(config)

        predictions = await predict_for_date_range(start_date, end_date, lat, lon)
        predictions = _scale_ml_predictions(predictions, capacity_kw)

        return [_to_ml_prediction_type(pred) for pred in predictions]

    @strawberry.field
    async def ml_predict_for_hours(
        self,
        date: str,
        hours: List[int],
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> List[MLPredictionType]:
        """
        Predict solar production for specific hours of a given day.

        Args:
            date: Date in YYYY-MM-DD format
            hours: List of hours (0-23) to predict for (e.g., [7, 8, 9, ..., 22] for 7am-10pm)
            lat: Optional latitude (defaults to system location)
            lon: Optional longitude (defaults to system location)

        Returns:
            List of predictions with production_kw and weather features
        """
        from .services.ml_prediction_service import predict_for_specific_hours

        config = get_system_config()
        latitude = lat if lat is not None else config["location"]["lat"]
        longitude = lon if lon is not None else config["location"]["lon"]
        capacity_kw = _get_real_capacity_kw_from_config(config)

        predictions = await predict_for_specific_hours(date, hours, latitude, longitude)
        predictions = _scale_ml_predictions(predictions, capacity_kw)

        return [
            MLPredictionType(
                datetime=pred["datetime"],
                production_kw=pred["production_kw"],
                weather=MLWeatherFeaturesType(
                    temperature_2m=pred["weather"]["temperature_2m"],
                    relative_humidity_2m=pred["weather"]["relative_humidity_2m"],
                    wind_speed_10m=pred["weather"]["wind_speed_10m"],
                    cloud_cover=pred["weather"]["cloud_cover"],
                    shortwave_radiation=pred["weather"]["shortwave_radiation"],
                ),
            )
            for pred in predictions
        ]

    @strawberry.field
    def ml_model_info(self) -> MLModelInfoType:
        """
        Get information about the loaded ML model.

        Returns:
            Model metadata including accuracy metrics and status
        """
        info = ml_model_service.get_model_info()
        return MLModelInfoType(
            loaded=info.get("loaded", False),
            model_name=info.get("model_name"),
            test_rmse=info.get("test_rmse"),
            test_r2=info.get("test_r2"),
            test_mae=info.get("test_mae"),
            features=info.get("features", []),
            training_date=info.get("training_date"),
            requires_scaling=info.get("requires_scaling"),
            reference_capacity_kw=info.get("reference_capacity_kw"),
            message=info.get("message"),
        )

    @strawberry.field
    async def ml_predict_consumption(
        self,
        datetimes: List[str],
        campus_id: Optional[int] = None,
        meter_id: Optional[int] = None,
    ) -> List[MLConsumptionPredictionType]:
        """
        Predict energy consumption using ML model for specific datetimes.

        Args:
            datetimes: List of ISO datetime strings (e.g., ["2025-01-15T13:00:00", "2025-01-15T14:00:00"])
            campus_id: Campus ID (optional, defaults to model's default)
            meter_id: Meter ID (optional, defaults to model's default)

        Returns:
            List of consumption predictions in kW
        """
        predictions = await predict_consumption(datetimes, campus_id, meter_id)
        predictions = _scale_consumption_predictions(predictions)

        return [
            MLConsumptionPredictionType(
                datetime=pred["datetime"],
                consumption_kw=pred["consumption_kw"],
            )
            for pred in predictions
        ]

    @strawberry.field
    async def ml_predict_consumption_next_hours(
        self,
        hours: int = 24,
        campus_id: Optional[int] = None,
        meter_id: Optional[int] = None,
    ) -> List[MLConsumptionPredictionType]:
        """
        Predict energy consumption for the next N hours.

        Args:
            hours: Number of hours to predict (default: 24)
            campus_id: Campus ID (optional, defaults to model's default)
            meter_id: Meter ID (optional, defaults to model's default)

        Returns:
            List of hourly consumption predictions
        """
        predictions = await predict_consumption_next_hours(hours, campus_id, meter_id)
        predictions = _scale_consumption_predictions(predictions)

        return [
            MLConsumptionPredictionType(
                datetime=pred["datetime"],
                consumption_kw=pred["consumption_kw"],
            )
            for pred in predictions
        ]

    @strawberry.field
    async def ml_predict_consumption_date_range(
        self,
        start_date: str,
        end_date: str,
        campus_id: Optional[int] = None,
        meter_id: Optional[int] = None,
    ) -> List[MLConsumptionPredictionType]:
        """
        Predict energy consumption for all hours in a date range.

        Args:
            start_date: Start date (ISO format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')
            end_date: End date (ISO format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS')
            campus_id: Campus ID (optional, defaults to model's default)
            meter_id: Meter ID (optional, defaults to model's default)

        Returns:
            List of hourly consumption predictions for the entire date range
        """
        predictions = await predict_consumption_for_date_range(start_date, end_date, campus_id, meter_id)
        predictions = _scale_consumption_predictions(predictions)

        return [
            MLConsumptionPredictionType(
                datetime=pred["datetime"],
                consumption_kw=pred["consumption_kw"],
            )
            for pred in predictions
        ]

    @strawberry.field
    async def ml_predict_consumption_for_hours(
        self,
        date: str,
        hours: List[int],
        campus_id: Optional[int] = None,
        meter_id: Optional[int] = None,
    ) -> List[MLConsumptionPredictionType]:
        """
        Predict energy consumption for specific hours of a given day.

        Args:
            date: Date in YYYY-MM-DD format
            hours: List of hours (0-23) to predict for (e.g., [7, 8, 9, ..., 22] for 7am-10pm)
            campus_id: Campus ID (optional, defaults to model's default)
            meter_id: Meter ID (optional, defaults to model's default)

        Returns:
            List of consumption predictions for the specified hours
        """
        predictions = await predict_consumption_for_specific_hours(date, hours, campus_id, meter_id)
        predictions = _scale_consumption_predictions(predictions)

        return [
            MLConsumptionPredictionType(
                datetime=pred["datetime"],
                consumption_kw=pred["consumption_kw"],
            )
            for pred in predictions
        ]

    @strawberry.field
    def ml_consumption_model_info(self) -> MLConsumptionModelInfoType:
        """
        Get information about the loaded consumption ML model.

        Returns:
            Model metadata including accuracy metrics and status
        """
        info = ml_consumption_service.get_model_info()
        from app.config import settings
        scale = settings.ML_CONSUMPTION_SCALE_DIVISOR
        meter = ml_consumption_service.get_default_meter_id()
        campus = ml_consumption_service.get_default_campus_id()
        is_demo = (
            settings.ML_CONSUMPTION_METER_ID is None
            and settings.ML_CONSUMPTION_CAMPUS_ID is None
        )
        return MLConsumptionModelInfoType(
            loaded=info.get("loaded", False),
            model_name=info.get("model_name"),
            test_rmse=info.get("test_rmse"),
            test_r2=info.get("test_r2"),
            test_mae=info.get("test_mae"),
            features=info.get("features", []),
            training_date=info.get("training_date"),
            campus_id_default=campus,
            meter_id_default=meter,
            message=info.get("message"),
            training_dataset=f"CUJAE — campus {campus}, meter {meter}",
            scale_divisor=scale,
            is_demo=is_demo,
        )

    @strawberry.field
    async def battery_discharge_estimate(
        self,
        start_hour: int,
        date: Optional[str] = None,
    ) -> BatteryDischargeEstimateType:
        """
        Calculate time until battery reaches empty (0%) level.

        Simulates battery discharge/charge based on predicted production and consumption,
        starting from a given hour with batteries at 100% charge.

        Args:
            start_hour: Starting hour (0-23) to begin simulation
            date: Optional date in ISO format ('YYYY-MM-DD'). If not provided, uses today.

        Returns:
            Estimate with minutes until battery is fully discharged

        Example:
            query {
              batteryDischargeEstimate(startHour: 14) {
                minutesToEmpty
                startHour
                batteryCapacityKwh
              }
            }
        """
        result = await calculate_battery_discharge_time(start_hour, date)
        return BatteryDischargeEstimateType(
            minutesToEmpty=result["minutesToEmpty"],
            startHour=result["startHour"],
            batteryCapacityKwh=result["batteryCapacityKwh"],
        )

    @strawberry.field
    def invitation_codes(self, info: strawberry.types.Info) -> List[InvitationCodeType]:
        require_admin(info.context)
        codes = list_invitation_codes()
        return [
            InvitationCodeType(
                id_=code["_id"],
                code=code["code"],
                role=code["role"],
                isUsed=code["isUsed"],
                createdBy=code.get("createdBy"),
                usedBy=code.get("usedBy"),
                createdAt=code.get("createdAt"),
                updatedAt=code.get("updatedAt"),
            )
            for code in codes
        ]

    @strawberry.field
    def consumption_profile(self) -> ConsumptionProfileType:
        """Return the currently active consumption profile (falls back to defaults)."""
        p = get_active_profile()
        return ConsumptionProfileType(
            id_=p.get("_id"),
            name=p["name"],
            weekday=p["weekday"],
            weekend=p["weekend"],
            is_active=p["isActive"],
            created_at=p.get("createdAt"),
            updated_at=p.get("updatedAt"),
        )

    @strawberry.field
    def predict_consumption_profile(
        self,
        date: str,
        hours: Optional[List[int]] = None,
    ) -> List[ConsumptionPredictionType]:
        """
        Predict hourly consumption from the configured profile for a given date.

        Args:
            date:  Date in YYYY-MM-DD format.
            hours: Optional list of hours (0-23). If omitted all 24 hours are returned.
        """
        preds = predict_for_date(date, hours)
        return [_map_consumption_prediction(p) for p in preds]

    @strawberry.field
    def predict_consumption_profile_range(
        self,
        start_date: str,
        end_date: str,
    ) -> List[ConsumptionPredictionType]:
        """
        Predict consumption from the profile for every hour in [start_date, end_date].
        """
        preds = predict_date_range(start_date, end_date)
        return [_map_consumption_prediction(p) for p in preds]

    @strawberry.field
    def predict_consumption_profile_next_hours(
        self,
        hours: int = 24,
    ) -> List[ConsumptionPredictionType]:
        """Predict consumption from the profile for the next N hours."""
        preds = predict_profile_next_hours(hours)
        return [_map_consumption_prediction(p) for p in preds]

    @strawberry.field
    def users(self, info: strawberry.types.Info) -> List[UserType]:
        require_admin(info.context)
        return [_map_user(user) for user in list_users()]

    @strawberry.field
    def active_sessions(self, info: strawberry.types.Info) -> List[SessionType]:
        require_admin(info.context)
        sessions = list_active_sessions()
        return [
            SessionType(
                id_=s["_id"],
                email=s["email"],
                ip=s["ip"],
                userAgent=s["userAgent"],
                deviceType=s["deviceType"],
                createdAt=s.get("createdAt"),
                expiresAt=s.get("expiresAt"),
            )
            for s in sessions
        ]

    @strawberry.field
    def historical_readings(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 288,
    ) -> List[HistoricalReadingType]:
        """Query historical solar readings with optional date range filter."""
        readings = get_readings(start_date, end_date, limit)
        return [
            HistoricalReadingType(
                id_=r["_id"],
                timestamp=r["timestamp"],
                production=r["production"],
                consumption=r["consumption"],
                batteryLevel=r["batteryLevel"],
                gridExport=r["gridExport"],
                gridImport=r["gridImport"],
                efficiency=r["efficiency"],
            )
            for r in readings
        ]

    @strawberry.field
    def daily_summaries(self, days: int = 30) -> List[DailySummaryType]:
        """Get daily aggregated summaries for the last N days."""
        summaries = get_daily_summaries(days)
        return [DailySummaryType(**s) for s in summaries]

    @strawberry.field
    def weather_sources(self) -> List[WeatherSourceType]:
        return [_map_weather_source(item) for item in list_weather_sources()]

    @strawberry.field
    def active_weather_source(self) -> Optional[WeatherSourceType]:
        source = get_active_weather_source()
        return _map_weather_source(source) if source else None

    @strawberry.field
    def location_config(self) -> LocationConfigExtType:
        """Return the current location configuration."""
        data = get_location_config()
        return LocationConfigExtType(
            lat=data["lat"],
            lon=data["lon"],
            name=data["name"],
            updatedAt=data.get("updatedAt"),
        )

    @strawberry.field
    def shadow_profile(self) -> Optional[ShadowProfileType]:
        """Return the saved hourly shadow profile, or null if none has been stored."""
        data = get_shadow_profile()
        if data is None:
            return None
        return ShadowProfileType(
            slots=[
                ShadowSlotType(
                    hour=s["hour"],
                    shadow_pct=s["shadowPct"],
                    prod_override=s.get("prodOverride"),
                )
                for s in data["slots"]
            ],
            avg_shadow=data["avgShadow"],
            avg_prod=data["avgProd"],
            updated_at=data.get("updatedAt"),
        )


# ============================================================================
# Inputs
# ============================================================================


@strawberry.input
class PanelInput:
    manufacturer: str
    model: Optional[str] = None
    ratedPowerKw: float
    quantity: int
    tiltDegrees: Optional[float] = None
    orientation: Optional[str] = None
    efficiencyPercent: Optional[float] = None
    areaM2: Optional[float] = None


@strawberry.input
class BatteryInput:
    manufacturer: str
    model: Optional[str] = None
    capacityKwh: float
    quantity: int
    maxDepthOfDischargePercent: Optional[float] = None
    chargeRateKw: Optional[float] = None
    dischargeRateKw: Optional[float] = None
    efficiencyPercent: Optional[float] = None


@strawberry.input
class InverterInput:
    manufacturer: str
    model: Optional[str] = None
    ratedPowerKw: float
    quantity: int
    efficiencyPercent: Optional[float] = None


@strawberry.input
class ApplianceModeInput:
    name: str
    averagePowerW: float
    maxPowerW: Optional[float] = None


@strawberry.input
class ApplianceInput:
    name: str
    category: Optional[str] = None
    averagePowerW: float
    maxPowerW: float
    measuredPowerW: Optional[float] = None
    quantity: int
    activeHours: Optional[float] = None
    selectedModeIndex: Optional[int] = None
    modes: Optional[List[ApplianceModeInput]] = None
    alwaysOn: Optional[bool] = True


@strawberry.input
class BlackoutIntervalInput:
    start: str
    end: str


@strawberry.input
class BlackoutInput:
    date: str
    intervals: List[BlackoutIntervalInput]
    province: Optional[str] = None
    municipality: Optional[str] = None
    notes: Optional[str] = None


@strawberry.input
class RegisterInput:
    email: str
    password: str
    invitationCode: str
    name: Optional[str] = None
    # role removed, determined by code


@strawberry.input
class LoginInput:
    email: str
    password: str


@strawberry.input
class ChangePasswordInput:
    currentPassword: str
    newPassword: str


@strawberry.input
class LdapLoginInput:
    email: str
    password: str
    invitationCode: Optional[str] = None


@strawberry.input
class WeatherSourceInput:
    name: str
    baseUrl: Optional[str] = None
    authType: Optional[str] = "none"
    authHeaderName: Optional[str] = None
    authQueryName: Optional[str] = None
    authValue: Optional[str] = None
    queryParams: Optional[JSON] = None
    fieldMapping: Optional[JSON] = None
    locationName: Optional[str] = None
    enabled: Optional[bool] = True
    isActive: Optional[bool] = False


@strawberry.input
class LocationConfigInput:
    lat: float
    lon: float
    name: str


# ============================================================================
# Mutations
# ============================================================================


@strawberry.type
class Mutation:
    @strawberry.mutation(name="saveConsumptionProfile")
    def save_consumption_profile_mutation(
        self,
        info: strawberry.types.Info,
        weekday: List[float],
        weekend: List[float],
        name: Optional[str] = "Perfil principal",
    ) -> ConsumptionProfileType:
        """
        Persist a new consumption profile and activate it immediately.
        weekday and weekend must each contain exactly 24 non-negative float values.
        """
        require_admin(info.context)
        p = save_profile(weekday, weekend, name or "Perfil principal")
        return ConsumptionProfileType(
            id_=p.get("_id"),
            name=p["name"],
            weekday=p["weekday"],
            weekend=p["weekend"],
            is_active=p["isActive"],
            created_at=p.get("createdAt"),
            updated_at=p.get("updatedAt"),
        )

    @strawberry.mutation(name="createPanel")
    def create_panel_mutation(self, info: strawberry.types.Info, input: PanelInput) -> PanelType:
        require_admin(info.context)
        panel = create_panel(input.__dict__)
        return _map_panel(panel)

    @strawberry.mutation(name="updatePanel")
    def update_panel_mutation(self, info: strawberry.types.Info, id: str, input: PanelInput) -> PanelType:
        require_admin(info.context)
        panel = update_panel(id, input.__dict__)
        if not panel:
            raise ValueError("Panel no encontrado.")
        return _map_panel(panel)

    @strawberry.mutation(name="deletePanel")
    def delete_panel_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_panel(id)

    @strawberry.mutation(name="createBattery")
    def create_battery_mutation(self, info: strawberry.types.Info, input: BatteryInput) -> BatteryType:
        require_admin(info.context)
        battery = create_battery(input.__dict__)
        return _map_battery(battery)

    @strawberry.mutation(name="updateBattery")
    def update_battery_mutation(self, info: strawberry.types.Info, id: str, input: BatteryInput) -> BatteryType:
        require_admin(info.context)
        battery = update_battery(id, input.__dict__)
        if not battery:
            raise ValueError("Batería no encontrada.")
        return _map_battery(battery)

    @strawberry.mutation(name="deleteBattery")
    def delete_battery_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_battery(id)

    @strawberry.mutation(name="createAppliance")
    def create_appliance_mutation(self, info: strawberry.types.Info, input: ApplianceInput) -> ApplianceType:
        require_admin(info.context)
        payload = {
            **input.__dict__,
            "modes": [mode.__dict__ for mode in input.modes] if input.modes else [],
        }
        appliance = create_appliance(payload)
        return _map_appliance(appliance)

    @strawberry.mutation(name="updateAppliance")
    def update_appliance_mutation(self, info: strawberry.types.Info, id: str, input: ApplianceInput) -> ApplianceType:
        require_admin(info.context)
        payload = {
            **input.__dict__,
            "modes": [mode.__dict__ for mode in input.modes] if input.modes else [],
        }
        appliance = update_appliance(id, payload)
        if not appliance:
            raise ValueError("Electrodoméstico no encontrado.")
        return _map_appliance(appliance)

    @strawberry.mutation(name="deleteAppliance")
    def delete_appliance_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_appliance(id)

    @strawberry.mutation(name="uploadApplianceMeasurement")
    def upload_appliance_measurement_mutation(
        self, info: strawberry.types.Info, id: str, fileContent: str
    ) -> ApplianceType:
        """
        Attach a power-meter export (TSV/CSV) to an appliance. The file is
        parsed and converted into a 168-hour (weekday x hour) average kW
        profile used to forecast future consumption.
        """
        require_admin(info.context)
        appliance = attach_measurement(id, fileContent)
        return _map_appliance(appliance)

    @strawberry.mutation(name="clearApplianceMeasurement")
    def clear_appliance_measurement_mutation(self, info: strawberry.types.Info, id: str) -> ApplianceType:
        require_admin(info.context)
        appliance = clear_measurement(id)
        if not appliance:
            raise ValueError("Electrodoméstico no encontrado.")
        return _map_appliance(appliance)

    @strawberry.mutation(name="createInverter")
    def create_inverter_mutation(self, info: strawberry.types.Info, input: InverterInput) -> InverterType:
        require_admin(info.context)
        inverter = create_inverter(input.__dict__)
        return _map_inverter(inverter)

    @strawberry.mutation(name="updateInverter")
    def update_inverter_mutation(self, info: strawberry.types.Info, id: str, input: InverterInput) -> InverterType:
        require_admin(info.context)
        inverter = update_inverter(id, input.__dict__)
        if not inverter:
            raise ValueError("Inversor no encontrado.")
        return _map_inverter(inverter)

    @strawberry.mutation(name="deleteInverter")
    def delete_inverter_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_inverter(id)

    @strawberry.mutation(name="createBlackout")
    def create_blackout_mutation(self, info: strawberry.types.Info, input: BlackoutInput) -> BlackoutType:
        require_admin(info.context)
        payload = {
            "date": input.date,
            "intervals": [interval.__dict__ for interval in input.intervals],
            "province": input.province,
            "municipality": input.municipality,
            "notes": input.notes,
        }
        blackout = save_blackout_schedule(payload)
        return _map_blackout(blackout)

    @strawberry.mutation(name="updateBlackout")
    def update_blackout_mutation(self, info: strawberry.types.Info, id: str, input: BlackoutInput) -> BlackoutType:
        require_admin(info.context)
        payload = {
            "date": input.date,
            "intervals": [interval.__dict__ for interval in input.intervals],
            "province": input.province,
            "municipality": input.municipality,
            "notes": input.notes,
        }
        blackout = update_blackout_schedule(id, payload)
        return _map_blackout(blackout)

    @strawberry.mutation(name="deleteBlackout")
    def delete_blackout_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_blackout(id)

    @strawberry.mutation(name="registerUser")
    def register_user_mutation(self, info: strawberry.types.Info, input: RegisterInput) -> AuthPayloadType:
        import uuid
        from datetime import timedelta
        from app.config import settings as _s
        user = register_user(input.__dict__)
        jti = uuid.uuid4().hex
        token = create_token(user["email"], user["role"], jti)
        from datetime import datetime as _dt
        req = info.context.get("request")
        ip = (req.headers.get("x-forwarded-for") or (req.client.host if req.client else "")) if req else ""
        ua = req.headers.get("user-agent", "") if req else ""
        create_session(user["email"], ip, ua, jti, _dt.utcnow() + timedelta(days=_s.JWT_EXPIRE_DAYS))
        return AuthPayloadType(user=_map_user(user), token=token)

    @strawberry.mutation(name="loginUser")
    def login_user_mutation(self, info: strawberry.types.Info, input: LoginInput) -> AuthPayloadType:
        import uuid
        from datetime import timedelta, datetime as _dt
        from app.config import settings as _s
        user = authenticate_user(input.__dict__)
        jti = uuid.uuid4().hex
        token = create_token(user["email"], user["role"], jti)
        req = info.context.get("request")
        ip = (req.headers.get("x-forwarded-for") or (req.client.host if req.client else "")) if req else ""
        ua = req.headers.get("user-agent", "") if req else ""
        create_session(user["email"], ip, ua, jti, _dt.utcnow() + timedelta(days=_s.JWT_EXPIRE_DAYS))
        return AuthPayloadType(user=_map_user(user), token=token)

    @strawberry.mutation(name="changePassword")
    def change_password_mutation(self, info: strawberry.types.Info, input: ChangePasswordInput) -> bool:
        # The email comes from the verified JWT, never from the client payload.
        current_user = require_auth(info.context)
        return change_password(current_user["sub"], input.currentPassword, input.newPassword)

    @strawberry.mutation(name="loginLdap")
    def login_ldap_mutation(self, info: strawberry.types.Info, input: LdapLoginInput) -> AuthPayloadType:
        import uuid
        from datetime import timedelta, datetime as _dt
        from app.config import settings as _s
        user = authenticate_or_provision_ldap(input.__dict__)
        jti = uuid.uuid4().hex
        token = create_token(user["email"], user["role"], jti)
        req = info.context.get("request")
        ip = (req.headers.get("x-forwarded-for") or (req.client.host if req.client else "")) if req else ""
        ua = req.headers.get("user-agent", "") if req else ""
        create_session(user["email"], ip, ua, jti, _dt.utcnow() + timedelta(days=_s.JWT_EXPIRE_DAYS))
        return AuthPayloadType(user=_map_user(user), token=token)

    @strawberry.mutation(name="revokeSession")
    def revoke_session_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return revoke_session(id)

    @strawberry.mutation(name="deleteUser")
    def delete_user_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        current_admin = require_admin(info.context)
        target_users = [u for u in list_users() if u["_id"] == id]
        if not target_users:
            raise Exception("Usuario no encontrado.")
        if target_users[0]["email"] == current_admin["sub"]:
            raise Exception("No puedes eliminar tu propia cuenta.")
        revoke_sessions_by_email(target_users[0]["email"])
        return delete_user(id)

    @strawberry.mutation(name="generateInvitationCode")
    def generate_invitation_code_mutation(self, info: strawberry.types.Info, role: str, createdBy: str) -> InvitationCodeType:
        require_admin(info.context)
        code = create_invitation_code(role, createdBy)
        return InvitationCodeType(
            id_=code["_id"],
            code=code["code"],
            role=code["role"],
            isUsed=code["isUsed"],
            createdBy=code.get("createdBy"),
            usedBy=code.get("usedBy"),
            createdAt=code.get("createdAt"),
            updatedAt=code.get("updatedAt"),
        )

    @strawberry.mutation(name="saveWeatherSource")
    def save_weather_source_mutation(
        self,
        info: strawberry.types.Info,
        input: WeatherSourceInput,
        id: Optional[str] = None,
    ) -> WeatherSourceType:
        require_admin(info.context)
        payload = input.__dict__
        source = save_weather_source(payload, id)
        return _map_weather_source(source)

    @strawberry.mutation(name="deleteWeatherSource")
    def delete_weather_source_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return delete_weather_source(id)

    @strawberry.mutation(name="setActiveWeatherSource")
    def set_active_weather_source_mutation(self, info: strawberry.types.Info, id: str) -> bool:
        require_admin(info.context)
        return set_active_weather_source(id)

    @strawberry.mutation(name="testWeatherSource")
    async def test_weather_source_mutation(
        self,
        info: strawberry.types.Info,
        input: WeatherSourceInput,
        useMock: bool = False,
    ) -> WeatherSourceTestResultType:
        require_admin(info.context)
        config = get_system_config()
        result = await test_weather_source(
            source_payload=input.__dict__,
            lat=config["location"]["lat"],
            lon=config["location"]["lon"],
            location_name=config["location"]["name"],
            use_mock=useMock,
        )
        return WeatherSourceTestResultType(
            success=result.get("success", False),
            message=result.get("message") or "Sin respuesta",
            fields=[
                WeatherFieldCandidateType(
                    path=item.get("path", ""),
                    valueType=item.get("valueType", ""),
                    sampleValue=item.get("sampleValue", ""),
                )
                for item in result.get("fields", [])
            ],
            rawJson=result.get("rawJson") or "{}",
        )

    @strawberry.mutation(name="seedHistoricalData")
    def seed_historical_data_mutation(
        self,
        info: strawberry.types.Info,
        days: int = 30,
    ) -> int:
        """Seed historical readings for demo/thesis purposes. Admin only."""
        require_admin(info.context)
        return seed_historical_data(days)

    @strawberry.mutation(name="saveLocationConfig")
    def save_location_config_mutation(
        self,
        info: strawberry.types.Info,
        input: LocationConfigInput,
    ) -> LocationConfigExtType:
        """Update system location. Admin only."""
        require_admin(info.context)
        data = save_location_config(input.lat, input.lon, input.name)
        return LocationConfigExtType(
            lat=data["lat"],
            lon=data["lon"],
            name=data["name"],
            updatedAt=data.get("updatedAt"),
        )

    @strawberry.mutation(name="resetSystemData")
    def reset_system_data_mutation(self, info: strawberry.types.Info) -> bool:
        """
        Borra toda la configuración del sistema (paneles, baterías, inversores,
        electrodomésticos, apagones, ubicación y perfil de consumo) para permitir
        volver a ejecutar el asistente de configuración. Solo administradores.
        """
        require_admin(info.context)
        db = get_database()
        db["paneles"].delete_many({})
        db["baterias"].delete_many({})
        db["inversores"].delete_many({})
        db["electrodomesticos"].delete_many({})
        db["apagones"].delete_many({})
        db["ubicacion_config"].delete_many({})
        db["consumption_profiles"].delete_many({})
        db["shadow_profile"].delete_many({})
        return True

    @strawberry.mutation(name="saveShadowProfile")
    def save_shadow_profile_mutation(
        self,
        info: strawberry.types.Info,
        slots: List[ShadowSlotInput],
    ) -> ShadowProfileType:
        """
        Persist the hourly shadow profile for the installation.
        Only day-lit slots (elevation > 0) should be included.
        Admin only.
        """
        require_admin(info.context)
        raw = [
            {"hour": s.hour, "shadowPct": s.shadow_pct, "prodOverride": s.prod_override}
            for s in slots
        ]
        data = save_shadow_profile(raw)
        return ShadowProfileType(
            slots=[
                ShadowSlotType(
                    hour=sl["hour"],
                    shadow_pct=sl["shadowPct"],
                    prod_override=sl.get("prodOverride"),
                )
                for sl in data["slots"]
            ],
            avg_shadow=data["avgShadow"],
            avg_prod=data["avgProd"],
            updated_at=data.get("updatedAt"),
        )


# ============================================================================
# Schema
# ============================================================================

schema = strawberry.Schema(query=Query, mutation=Mutation)
