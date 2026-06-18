"""
Consumption Prediction Service - Uses the trained model to predict energy consumption.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from .ml_consumption_service import ml_consumption_service


def prepare_consumption_features(
    target_datetimes: List[datetime],
    campus_id: int = None,
    meter_id: int = None
) -> pd.DataFrame:
    """
    Prepare features DataFrame from datetimes for consumption prediction.

    Args:
        target_datetimes: List of target datetimes to predict
        campus_id: Campus ID (optional, uses default from model config)
        meter_id: Meter ID (optional, uses default from model config)

    Returns:
        DataFrame with features ready for model prediction
    """
    # Use default IDs from model config if not provided
    if campus_id is None:
        campus_id = ml_consumption_service.get_default_campus_id()
    if meter_id is None:
        meter_id = ml_consumption_service.get_default_meter_id()

    features_list = []

    for target_dt in target_datetimes:
        # Extract temporal features
        hora = target_dt.hour
        dia_semana = target_dt.weekday()  # 0=Monday, 6=Sunday
        mes = target_dt.month
        dia_del_mes = target_dt.day
        semana_del_anio = target_dt.isocalendar()[1]

        # Binary features
        es_fin_de_semana = 1 if dia_semana >= 5 else 0
        es_dia_habil = 1 if dia_semana < 5 else 0
        es_hora_pico = 1 if 7 <= hora <= 22 else 0
        es_hora_nocturna = 1 if hora < 6 or hora > 20 else 0
        es_hora_laboral = 1 if 8 <= hora <= 17 else 0

        # Cyclic features (sin/cos encoding for hour, month, day of week)
        hora_sin = np.sin(2 * np.pi * hora / 24)
        hora_cos = np.cos(2 * np.pi * hora / 24)
        mes_sin = np.sin(2 * np.pi * mes / 12)
        mes_cos = np.cos(2 * np.pi * mes / 12)
        dia_semana_sin = np.sin(2 * np.pi * dia_semana / 7)
        dia_semana_cos = np.cos(2 * np.pi * dia_semana / 7)

        features_list.append({
            "hora": hora,
            "diaSemana": dia_semana,
            "mes": mes,
            "diaDelMes": dia_del_mes,
            "semanaDelAnio": semana_del_anio,
            "esFinDeSemana": es_fin_de_semana,
            "esDiaHabil": es_dia_habil,
            "esHoraPico": es_hora_pico,
            "esHoraNocturna": es_hora_nocturna,
            "esHoraLaboral": es_hora_laboral,
            "hora_sin": hora_sin,
            "hora_cos": hora_cos,
            "mes_sin": mes_sin,
            "mes_cos": mes_cos,
            "diaSemana_sin": dia_semana_sin,
            "diaSemana_cos": dia_semana_cos,
            "campus_id": campus_id,
            "meter_id": meter_id,
        })

    return pd.DataFrame(features_list)


async def predict_consumption(
    datetimes: List[str],
    campus_id: int = None,
    meter_id: int = None
) -> List[Dict[str, Any]]:
    """
    Predict energy consumption for given datetimes using the ML model.

    Args:
        datetimes: List of ISO datetime strings to predict for
        campus_id: Campus ID (optional, uses default from model config)
        meter_id: Meter ID (optional, uses default from model config)

    Returns:
        List of predictions with datetime and consumption_kw

    Raises:
        RuntimeError: If model is not loaded or prediction fails
        ValueError: If invalid datetime format
    """
    if not ml_consumption_service.model_loaded:
        return []

    # Parse target datetimes
    try:
        target_datetimes = [datetime.fromisoformat(dt.replace('Z', '+00:00')) for dt in datetimes]
    except Exception as e:
        raise ValueError(f"Invalid datetime format. Expected ISO format (e.g., '2025-01-15T13:00:00'): {e}")

    if not target_datetimes:
        return []

    # Prepare features
    features_df = prepare_consumption_features(target_datetimes, campus_id, meter_id)

    # Make predictions
    try:
        predictions_kw = ml_consumption_service.predict(features_df)
    except Exception as e:
        raise RuntimeError(f"Consumption model prediction failed: {e}")

    # Format results
    results = []
    for dt, pred_kw in zip(target_datetimes, predictions_kw):
        results.append({
            "datetime": dt.isoformat(),
            "consumption_kw": round(float(pred_kw), 2),
        })

    return results


async def predict_consumption_next_hours(
    hours: int = 24,
    campus_id: int = None,
    meter_id: int = None
) -> List[Dict[str, Any]]:
    """
    Predict energy consumption for the next N hours.

    Args:
        hours: Number of hours to predict (default: 24)
        campus_id: Campus ID (optional, uses default from model config)
        meter_id: Meter ID (optional, uses default from model config)

    Returns:
        List of hourly consumption predictions
    """
    now = datetime.utcnow()
    target_datetimes = [
        (now + timedelta(hours=h)).isoformat()
        for h in range(hours)
    ]

    return await predict_consumption(target_datetimes, campus_id, meter_id)


async def predict_consumption_for_date_range(
    start_date: str,
    end_date: str,
    campus_id: int = None,
    meter_id: int = None
) -> List[Dict[str, Any]]:
    """
    Predict energy consumption for all hours in a date range.

    Args:
        start_date: Start date (ISO format: 'YYYY-MM-DD')
        end_date: End date (ISO format: 'YYYY-MM-DD')
        campus_id: Campus ID (optional)
        meter_id: Meter ID (optional)

    Returns:
        List of hourly consumption predictions for the entire date range
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

    return await predict_consumption(target_datetimes, campus_id, meter_id)


async def predict_consumption_for_specific_hours(
    date: str,
    hours: List[int],
    campus_id: int = None,
    meter_id: int = None
) -> List[Dict[str, Any]]:
    """
    Predict energy consumption for specific hours of a given day.

    Args:
        date: Date in ISO format ('YYYY-MM-DD')
        hours: List of hours (0-23) to predict for
        campus_id: Campus ID (optional)
        meter_id: Meter ID (optional)

    Returns:
        List of consumption predictions for the specified hours
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

    return await predict_consumption(target_datetimes, campus_id, meter_id)
