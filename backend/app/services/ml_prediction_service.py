"""
ML Prediction Service - Uses the trained model and Open-Meteo data to predict solar production.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
import pandas as pd

from .ml_model_service import ml_model_service
from .solar_features import build_features
from .weather_source_service import get_active_weather_source
from .shadow_profile_service import get_shadow_profile


OPENMETEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_LAT = 23.1136  # La Habana, Cuba
DEFAULT_LON = -82.3666
# Convención: los datetimes naive que entran a este servicio se interpretan como
# hora local de La Habana (es como el frontend pide "las 7am-10pm"). El modelo
# trabaja internamente en UTC; aquí se hace la conversión.
LOCAL_TZ = ZoneInfo("America/Havana")


async def fetch_open_meteo_hourly(
    lat: float,
    lon: float,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """
    Fetch hourly weather data from Open-Meteo API.

    Args:
        lat: Latitude
        lon: Longitude
        start_date: Start datetime
        end_date: End datetime

    Returns:
        Dictionary with hourly weather data
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "cloud_cover",
            "shortwave_radiation",
        ]),
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        # UTC so that timestamps align unambiguously with the target datetimes
        # and with how the model was trained (features module handles local time).
        "timezone": "UTC",
    }

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(OPENMETEO_BASE_URL, params=params)

    response.raise_for_status()
    return response.json()


def prepare_features_dataframe(
    weather_data: Dict[str, Any],
    target_datetimes: List[datetime],
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON,
) -> pd.DataFrame:
    """
    Build the model feature matrix from Open-Meteo data for the requested hours.

    Uses the shared ``build_features`` so the transformation is byte-for-byte
    identical to the one applied during training (no train/serve skew).

    Args:
        weather_data: Hourly weather data from Open-Meteo (timezone=UTC)
        target_datetimes: List of target datetimes to predict
        lat, lon: Coordinates (for the pvlib solar-geometry features)

    Returns:
        DataFrame with columns == solar_features.FEATURE_COLUMNS
    """
    hourly = weather_data.get("hourly", {})

    # Open-Meteo (timezone=UTC) timestamps -> tz-aware UTC index.
    api_times = pd.to_datetime(hourly.get("time", []), utc=True)
    weather_df = pd.DataFrame(
        {
            "temperature_2m": hourly["temperature_2m"],
            "relative_humidity_2m": hourly["relative_humidity_2m"],
            "wind_speed_10m": hourly["wind_speed_10m"],
            "cloud_cover": hourly["cloud_cover"],
            "shortwave_radiation": hourly["shortwave_radiation"],
        },
        index=api_times,
    )

    # Normalize the requested datetimes to tz-aware UTC, snapped to the hour.
    # Naive datetimes are treated as La Habana local time (see LOCAL_TZ note).
    targets = pd.DatetimeIndex([pd.Timestamp(dt) for dt in target_datetimes])
    targets = (
        targets.tz_localize(LOCAL_TZ) if targets.tz is None else targets
    ).tz_convert("UTC").floor("h")

    # Align weather to the requested hours (nearest hour as a safety net).
    weather_at_targets = weather_df.reindex(targets, method="nearest")

    return build_features(weather_at_targets, lat, lon)


async def predict_solar_production(
    datetimes: List[str],
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for given datetimes using the ML model and Open-Meteo data.

    Args:
        datetimes: List of ISO datetime strings to predict for
        lat: Latitude (default: La Habana, Cuba)
        lon: Longitude (default: La Habana, Cuba)

    Returns:
        List of predictions with datetime, production_kw, and weather features

    Raises:
        RuntimeError: If model is not loaded or prediction fails
        ValueError: If invalid datetime format
    """
    # Check if model is loaded
    if not ml_model_service.model_loaded:
        raise RuntimeError(
            "ML model not loaded. Please ensure the model is trained and loaded at startup."
        )

    # Parse target datetimes
    try:
        target_datetimes = [datetime.fromisoformat(dt.replace('Z', '+00:00')) for dt in datetimes]
    except Exception as e:
        raise ValueError(f"Invalid datetime format. Expected ISO format (e.g., '2025-01-15T13:00:00'): {e}")

    if not target_datetimes:
        return []

    # Determine date range for Open-Meteo API.
    # Pad ±1 day so the UTC instants of local-time targets are always covered
    # (local→UTC can shift into the previous/next calendar day).
    min_date = (min(target_datetimes) - timedelta(days=1)).date()
    max_date = (max(target_datetimes) + timedelta(days=1)).date()

    # Fetch weather data from Open-Meteo
    try:
        weather_data = await fetch_open_meteo_hourly(lat, lon, min_date, max_date)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch weather data from Open-Meteo: {e}")

    # Prepare features
    features_df = prepare_features_dataframe(weather_data, target_datetimes, lat, lon)

    # Make predictions
    try:
        predictions_kw = ml_model_service.predict(features_df)
    except Exception as e:
        raise RuntimeError(f"Model prediction failed: {e}")

    # El modelo está entrenado contra Open-Meteo: si el usuario configuró otra
    # fuente, lo declaramos en la respuesta en lugar de aparentar que se honró.
    warning: Optional[str] = None
    try:
        active = get_active_weather_source()
    except Exception:
        active = None
    if active:
        active_name = (active.get("name") or "").lower()
        active_provider = (active.get("provider") or "").lower()
        if "open" not in active_name and "open" not in active_provider:
            warning = (
                f"La fuente configurada ('{active.get('name')}') se ignoró: el "
                "modelo ML de producción se entrenó con datos de Open-Meteo."
            )

    # Cargar perfil de sombras una sola vez (sincrónico, singleton en BD).
    # Si no existe perfil o la BD no está disponible, no se aplica corrección.
    shadow_slots: Dict[int, Dict[str, Any]] = {}
    try:
        profile = get_shadow_profile()
        if profile:
            shadow_slots = {s["hour"]: s for s in profile.get("slots", [])}
    except Exception:
        pass

    # Format results
    results = []
    for i, (dt, pred_kw) in enumerate(zip(target_datetimes, predictions_kw)):
        # Convertir a hora local de La Habana para buscar la franja de sombra.
        local_hour = dt.astimezone(LOCAL_TZ).hour if dt.tzinfo else dt.hour

        shadow_factor = 1.0
        slot = shadow_slots.get(local_hour)
        if slot:
            if slot.get("prodOverride") is not None:
                shadow_factor = slot["prodOverride"] / 100.0
            else:
                shadow_factor = 1.0 - (slot["shadowPct"] / 100.0)

        results.append({
            "datetime": dt.isoformat(),
            "production_kw": round(float(pred_kw) * shadow_factor, 2),
            "weather": {
                "temperature_2m": round(float(features_df.iloc[i]["temperature_2m"]), 1),
                "relative_humidity_2m": round(float(features_df.iloc[i]["relative_humidity_2m"]), 1),
                "wind_speed_10m": round(float(features_df.iloc[i]["wind_speed_10m"]), 1),
                "cloud_cover": round(float(features_df.iloc[i]["cloud_cover"]), 1),
                "shortwave_radiation": round(float(features_df.iloc[i]["shortwave_radiation"]), 1),
            },
            "weather_source": "Open-Meteo",
            "weather_source_warning": warning,
        })

    return results


async def predict_next_hours(
    hours: int = 24,
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for the next N hours.

    Args:
        hours: Number of hours to predict (default: 24)
        lat: Latitude (default: La Habana, Cuba)
        lon: Longitude (default: La Habana, Cuba)

    Returns:
        List of hourly predictions
    """
    # Local (La Habana) "now" so the hourly labels match the user's wall clock.
    now = datetime.now(LOCAL_TZ)
    target_datetimes = [
        (now + timedelta(hours=h)).isoformat()
        for h in range(hours)
    ]

    return await predict_solar_production(target_datetimes, lat, lon)


async def predict_for_date_range(
    start_date: str,
    end_date: str,
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for all hours in a date range.

    Args:
        start_date: Start date (ISO format: 'YYYY-MM-DD')
        end_date: End date (ISO format: 'YYYY-MM-DD')
        lat: Latitude
        lon: Longitude

    Returns:
        List of hourly predictions for the entire date range
    """
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except Exception as e:
        raise ValueError(f"Invalid date format. Expected 'YYYY-MM-DD': {e}")

    # Generate hourly timestamps
    current = start
    target_datetimes = []

    while current <= end:
        target_datetimes.append(current.isoformat())
        current += timedelta(hours=1)

    return await predict_solar_production(target_datetimes, lat, lon)


async def predict_for_specific_hours(
    date: str,
    hours: List[int],
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for specific hours of a given day.

    Args:
        date: Date in ISO format ('YYYY-MM-DD')
        hours: List of hours (0-23) to predict for
        lat: Latitude
        lon: Longitude

    Returns:
        List of predictions for the specified hours
    """
    try:
        base_date = datetime.fromisoformat(date)
    except Exception as e:
        raise ValueError(f"Invalid date format. Expected 'YYYY-MM-DD': {e}")

    # Generate timestamps for specific hours
    target_datetimes = []
    for hour in sorted(set(hours)):  # Remove duplicates and sort
        if 0 <= hour <= 23:
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            target_datetimes.append(dt.isoformat())

    if not target_datetimes:
        return []

    return await predict_solar_production(target_datetimes, lat, lon)
