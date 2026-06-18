"""
Mock Weather Station Server
============================
Servidor FastAPI independiente que simula una estación meteorológica externa.

Propósito: probar la integración de fuentes de clima externas en el gemelo digital.

Datos: clima intencionalmente adverso para generación fotovoltaica
       (alta nubosidad, lluvia, baja irradiancia).

Autenticación: Bearer JWT mockeado.

Puerto: 8001 (el backend principal usa 8000)

Uso rápido:
    cd mock_weather_server
    uvicorn main:app --reload --port 8001

Configurar en el gemelo digital (Ajustes → Fuente de clima):
    URL base:   http://localhost:8001/weather
    Auth type:  bearer
    Token:      mock-jwt-cujae-2024-secret
    Query params: {}
    Field mapping: ver README.md o usar el botón "Probar y detectar campos"
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mock Weather Station API",
    description="Estación meteorológica simulada con datos adversos para FV. Uso académico.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Mock JWT Auth
# ---------------------------------------------------------------------------
VALID_TOKENS = {
    "mock-jwt-cujae-2024-secret",
    "Bearer mock-jwt-cujae-2024-secret",  # in case someone sends it wrong
}

MOCK_TOKEN = "mock-jwt-cujae-2024-secret"

bearer_scheme = HTTPBearer(auto_error=False)


def require_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if credentials is None or credentials.credentials not in VALID_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o ausente. Usa Authorization: Bearer mock-jwt-cujae-2024-secret",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


# ---------------------------------------------------------------------------
# Auth endpoint
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    issued_at: str
    station_id: str
    scope: str


@app.post(
    "/auth/token",
    response_model=TokenResponse,
    summary="Obtener token de acceso",
    tags=["Autenticación"],
)
def login(body: LoginRequest):
    """
    Devuelve un JWT mockeado.

    Credenciales válidas:
    - usuario: **admin** · contraseña: **cujae2024**
    - usuario: **gemelo** · contraseña: **digital**

    El token devuelto se usa como `Authorization: Bearer <token>` en todos
    los endpoints protegidos.
    """
    valid_credentials = {
        "admin": "cujae2024",
        "gemelo": "digital",
        "user": "weather123",
    }
    if valid_credentials.get(body.username) != body.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
        )
    return TokenResponse(
        access_token=MOCK_TOKEN,
        token_type="bearer",
        expires_in=3600,
        issued_at=datetime.now(timezone.utc).isoformat(),
        station_id="CU-HAV-CUJAE-001",
        scope="weather:read forecast:read",
    )


# ---------------------------------------------------------------------------
# Weather data generators  (datos malos para FV)
# ---------------------------------------------------------------------------
# La Habana, Cuba
LAT = 23.1136
LON = -82.3666

# Escenarios adversos — se rotan de forma determinista por hora del día
_BAD_SCENARIOS = [
    {
        "label": "Tormenta eléctrica",
        "cloud_cover_pct": 97,
        "solar_irradiance_wm2": 12,
        "precipitation_mm_h": 22.4,
        "condition": "rainy",
        "description": "Tormenta eléctrica con chubascos intensos",
        "wind_speed_kmh": 54.2,
        "humidity_pct": 96,
        "temperature_delta": -3.1,
    },
    {
        "label": "Lluvia moderada",
        "cloud_cover_pct": 89,
        "solar_irradiance_wm2": 48,
        "precipitation_mm_h": 9.8,
        "condition": "rainy",
        "description": "Lluvia moderada continua con cielo muy cubierto",
        "wind_speed_kmh": 29.6,
        "humidity_pct": 92,
        "temperature_delta": -1.8,
    },
    {
        "label": "Nublado total",
        "cloud_cover_pct": 93,
        "solar_irradiance_wm2": 72,
        "precipitation_mm_h": 2.1,
        "condition": "cloudy",
        "description": "Cobertura nubosa casi total, llovizna intermitente",
        "wind_speed_kmh": 22.1,
        "humidity_pct": 88,
        "temperature_delta": -0.9,
    },
    {
        "label": "Muy nublado",
        "cloud_cover_pct": 84,
        "solar_irradiance_wm2": 115,
        "precipitation_mm_h": 0.4,
        "condition": "cloudy",
        "description": "Cielo muy nublado con posibilidad de chubascos",
        "wind_speed_kmh": 18.7,
        "humidity_pct": 84,
        "temperature_delta": 0.0,
    },
]

# Pronóstico de 7 días — todos malos
_FORECAST_SCENARIOS = [
    {"cloud": 97, "radiation": 18,  "precip": 24.1, "cond": "rainy",   "desc": "Tormenta con granizo ligero"},
    {"cloud": 91, "radiation": 44,  "precip": 14.6, "cond": "rainy",   "desc": "Lluvia fuerte todo el día"},
    {"cloud": 86, "radiation": 78,  "precip": 6.2,  "cond": "rainy",   "desc": "Lluvia moderada, cielo gris"},
    {"cloud": 92, "radiation": 31,  "precip": 19.8, "cond": "rainy",   "desc": "Chubascos fuertes y viento"},
    {"cloud": 79, "radiation": 135, "precip": 1.4,  "cond": "cloudy",  "desc": "Muy nublado con llovizna"},
    {"cloud": 88, "radiation": 62,  "precip": 11.3, "cond": "rainy",   "desc": "Lluvia persistente"},
    {"cloud": 83, "radiation": 95,  "precip": 3.7,  "cond": "cloudy",  "desc": "Nublado, posibles chubascos"},
]

_BASE_TEMP = 26.5   # °C
_BASE_PRESSURE = 1006.4  # hPa


def _scenario_for_now() -> Dict[str, Any]:
    """Rota el escenario cada 15 minutos para que los datos cambien."""
    slot = (datetime.now().minute // 15) % len(_BAD_SCENARIOS)
    return _BAD_SCENARIOS[slot]


def _jitter(value: float, pct: float = 0.04) -> float:
    """Añade ruido aleatorio ±pct% al valor."""
    return round(value * (1 + random.uniform(-pct, pct)), 2)


def _build_current(scenario: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    temp = round(_BASE_TEMP + scenario["temperature_delta"] + random.uniform(-0.3, 0.3), 1)
    return {
        "temperature_c": temp,
        "humidity_pct": min(100, _jitter(scenario["humidity_pct"], 0.03)),
        "wind_speed_kmh": _jitter(scenario["wind_speed_kmh"], 0.08),
        "wind_direction_deg": round(random.uniform(0, 360), 1),
        "cloud_cover_pct": min(100, _jitter(scenario["cloud_cover_pct"], 0.02)),
        "solar_irradiance_wm2": max(0, _jitter(scenario["solar_irradiance_wm2"], 0.10)),
        "precipitation_mm_h": max(0, _jitter(scenario["precipitation_mm_h"], 0.15)),
        "pressure_hpa": round(_BASE_PRESSURE + random.uniform(-2, 2), 1),
        "dew_point_c": round(temp - random.uniform(1.5, 3.5), 1),
        "visibility_km": round(max(0.5, 8 - scenario["precipitation_mm_h"] * 0.3), 1),
        "uv_index": max(0, round(scenario["solar_irradiance_wm2"] / 250, 1)),
        "feels_like_c": round(temp + random.uniform(-1.5, 1.5), 1),
        "condition": scenario["condition"],
        "description": scenario["description"],
        "observation_time": now.isoformat(),
    }


def _build_forecast() -> List[Dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    days = []
    day_names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    for i, sc in enumerate(_FORECAST_SCENARIOS):
        d = today + timedelta(days=i + 1)
        base_temp = _BASE_TEMP - 1 + random.uniform(-1, 2)
        days.append({
            "date": d.isoformat(),
            "day_name": day_names[d.weekday()],
            "temp_max_c": round(base_temp + random.uniform(1, 3), 1),
            "temp_min_c": round(base_temp - random.uniform(2, 4), 1),
            "cloud_cover_pct": _jitter(sc["cloud"], 0.05),
            "solar_radiation_wm2": max(5, _jitter(sc["radiation"], 0.12)),
            "precipitation_mm": _jitter(sc["precip"], 0.15),
            "wind_speed_kmh": _jitter(26.0, 0.20),
            "humidity_pct": _jitter(89.0, 0.05),
            "condition": sc["cond"],
            "description": sc["desc"],
            "uv_index_max": max(0, round(sc["radiation"] / 200, 1)),
            "sunrise": "06:15",
            "sunset": "19:42",
        })
    return days


def _build_station_meta(scenario: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "station_id": "CU-HAV-CUJAE-001",
        "station_name": "Estación Meteorológica CUJAE",
        "provider": "Red Meteorológica CUJAE — Mock Server v1.0",
        "latitude": LAT,
        "longitude": LON,
        "altitude_m": 59,
        "location_name": "La Habana, Cuba",
        "timezone": "America/Havana",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scenario_active": scenario["label"],
        "data_quality": "simulated",
        "note": "Datos simulados con condiciones adversas para pruebas de integración FV.",
    }


def _build_solar_impact(scenario: Dict[str, Any]) -> Dict[str, Any]:
    irr = scenario["solar_irradiance_wm2"]
    reduction_pct = round((1 - irr / 1000) * 100, 1)
    return {
        "current_irradiance_wm2": irr,
        "peak_irradiance_wm2": 1000,
        "production_reduction_pct": reduction_pct,
        "estimated_capacity_factor": round(irr / 1000, 3),
        "alert": "ADVERSO" if irr < 200 else "REDUCIDO",
        "message": (
            f"Irradiancia actual {irr} W/m² representa solo el "
            f"{round(irr/10, 1)}% del valor STC (1000 W/m²). "
            f"Generación fotovoltaica reducida ~{reduction_pct}%."
        ),
    }


def _build_full_payload() -> Dict[str, Any]:
    scenario = _scenario_for_now()
    return {
        "meta": _build_station_meta(scenario),
        "conditions": _build_current(scenario),
        "forecast": {
            "days": _build_forecast(),
        },
        "solar_impact": _build_solar_impact(scenario),
        "air_quality": {
            "aqi": random.randint(42, 78),
            "pm25_ugm3": round(random.uniform(12, 28), 1),
            "pm10_ugm3": round(random.uniform(22, 45), 1),
            "category": "Moderado",
        },
        "alerts": [
            {
                "id": "ALT-001",
                "severity": "warning",
                "type": "weather",
                "title": "Condiciones adversas para generación solar",
                "message": scenario["description"],
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
            }
        ],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/weather",
    summary="Datos completos de clima",
    tags=["Clima"],
    dependencies=[Depends(require_auth)],
)
def get_weather_full():
    """
    Retorna el conjunto completo de datos meteorológicos.

    **Requiere** `Authorization: Bearer mock-jwt-cujae-2024-secret`

    Este es el endpoint principal para configurar en el gemelo digital.

    ### Field Mapping recomendado

    ```json
    {
      "temperaturePath":           "conditions.temperature_c",
      "humidityPath":              "conditions.humidity_pct",
      "cloudCoverPath":            "conditions.cloud_cover_pct",
      "windSpeedPath":             "conditions.wind_speed_kmh",
      "solarRadiationPath":        "conditions.solar_irradiance_wm2",
      "descriptionPath":           "conditions.description",
      "forecastArrayPath":         "forecast.days",
      "forecastDatePath":          "date",
      "forecastMaxTempPath":       "temp_max_c",
      "forecastMinTempPath":       "temp_min_c",
      "forecastSolarRadiationPath":"solar_radiation_wm2",
      "forecastCloudCoverPath":    "cloud_cover_pct",
      "forecastConditionPath":     "condition"
    }
    ```
    """
    return _build_full_payload()


@app.get(
    "/weather/current",
    summary="Solo condiciones actuales",
    tags=["Clima"],
    dependencies=[Depends(require_auth)],
)
def get_current_conditions():
    """Condiciones meteorológicas actuales sin pronóstico."""
    scenario = _scenario_for_now()
    return {
        "meta": _build_station_meta(scenario),
        "conditions": _build_current(scenario),
        "solar_impact": _build_solar_impact(scenario),
    }


@app.get(
    "/weather/forecast",
    summary="Solo pronóstico 7 días",
    tags=["Clima"],
    dependencies=[Depends(require_auth)],
)
def get_forecast():
    """Pronóstico extendido de 7 días."""
    return {
        "meta": {
            "station_id": "CU-HAV-CUJAE-001",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "forecast": {
            "days": _build_forecast(),
        },
    }


@app.get(
    "/weather/history",
    summary="Histórico últimas 24 horas",
    tags=["Clima"],
    dependencies=[Depends(require_auth)],
)
def get_history():
    """Lecturas horarias de las últimas 24 horas."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    readings = []
    for i in range(24, 0, -1):
        t = now - timedelta(hours=i)
        hour = t.hour
        # Producción solar nula de noche, muy baja de día
        is_day = 6 <= hour <= 18
        irr = max(0, _jitter(80 if is_day else 0, 0.3)) if is_day else 0
        readings.append({
            "timestamp": t.isoformat(),
            "temperature_c": round(_BASE_TEMP + math.sin(hour / 12 * math.pi) * 2, 1),
            "humidity_pct": round(90 - math.sin(hour / 12 * math.pi) * 6, 1),
            "cloud_cover_pct": min(100, _jitter(88, 0.06)),
            "solar_irradiance_wm2": irr,
            "precipitation_mm": max(0, _jitter(5.2, 0.30)),
            "wind_speed_kmh": _jitter(25.0, 0.15),
        })
    return {"meta": {"station_id": "CU-HAV-CUJAE-001"}, "history": readings}


@app.get(
    "/weather/alerts",
    summary="Alertas meteorológicas activas",
    tags=["Clima"],
    dependencies=[Depends(require_auth)],
)
def get_alerts():
    """Lista de alertas y avisos meteorológicos activos."""
    scenario = _scenario_for_now()
    return {
        "station_id": "CU-HAV-CUJAE-001",
        "alerts": [
            {
                "id": "ALT-001",
                "severity": "warning",
                "type": "solar_generation",
                "title": "Generación fotovoltaica severamente reducida",
                "message": (
                    f"{scenario['description']}. "
                    f"Irradiancia actual: {scenario['solar_irradiance_wm2']} W/m² "
                    f"({round(scenario['solar_irradiance_wm2']/10, 1)}% del valor nominal STC)."
                ),
                "reduction_pct": round((1 - scenario["solar_irradiance_wm2"] / 1000) * 100, 1),
                "issued_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": "ALT-002",
                "severity": "info",
                "type": "precipitation",
                "title": "Precipitación activa",
                "message": f"Precipitación actual: {scenario['precipitation_mm_h']} mm/h.",
                "issued_at": datetime.now(timezone.utc).isoformat(),
            },
        ],
    }


@app.get("/health", summary="Estado del servidor", tags=["Sistema"])
def health():
    return {
        "status": "ok",
        "server": "Mock Weather Station API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "Servidor de pruebas — datos simulados adversos para FV",
    }


@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "Mock Weather Station API",
        "docs": "/docs",
        "health": "/health",
        "token_hint": MOCK_TOKEN,
        "main_endpoint": "/weather",
    }
