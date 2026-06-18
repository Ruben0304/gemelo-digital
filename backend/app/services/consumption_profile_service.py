"""
Consumption Profile Service
===========================
Manages user-defined hourly consumption profiles stored in MongoDB and
generates predictions with dynamic confidence scoring.

Cold-start strategy (Phase 1):
  - No historical data required at deployment
  - User configures typical kW consumption per hour for weekdays / weekends
  - Confidence model penalises transition hours, night-time, and weekends
  - As real readings accumulate this service can be superseded by an ML model
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.database import get_database

COLLECTION = "consumption_profiles"

# ---------------------------------------------------------------------------
# Default profile – typical small Cuban university microgrid (kW per hour)
# Values are illustrative; the user should configure these for their site.
# ---------------------------------------------------------------------------
_DEFAULT_WEEKDAY: List[float] = [
    8.0,  # 00
    7.0,  # 01
    6.5,  # 02
    6.0,  # 03
    6.0,  # 04
    7.0,  # 05
    12.0, # 06  early activity
    22.0, # 07  morning peak
    28.0, # 08  peak
    30.0, # 09  peak
    28.0, # 10
    26.0, # 11
    25.0, # 12
    27.0, # 13  after-lunch peak
    26.0, # 14
    24.0, # 15
    22.0, # 16
    25.0, # 17  afternoon transition
    28.0, # 18  evening peak
    26.0, # 19
    22.0, # 20
    18.0, # 21
    14.0, # 22
    10.0, # 23
]

_DEFAULT_WEEKEND: List[float] = [
    7.0,  # 00
    6.5,  # 01
    6.0,  # 02
    5.5,  # 03
    5.5,  # 04
    6.5,  # 05
    10.0, # 06
    14.0, # 07
    18.0, # 08
    20.0, # 09
    20.0, # 10
    19.0, # 11
    18.0, # 12
    19.0, # 13
    18.0, # 14
    17.0, # 15
    17.0, # 16
    20.0, # 17
    22.0, # 18  evening peak
    20.0, # 19
    17.0, # 20
    14.0, # 21
    11.0, # 22
    8.0,  # 23
]

# ---------------------------------------------------------------------------
# Confidence model constants
# ---------------------------------------------------------------------------

# Base confidence: a manually configured profile is an informed estimate,
# but real consumption varies ±15-25 % due to occupancy, weather, etc.
_BASE_CONFIDENCE = 0.70

# Hours with higher natural variability (transition periods)
_TRANSITION_HOURS = {7, 8, 9, 17, 18, 19, 20}
_NIGHT_HOURS = {0, 1, 2, 3, 4, 5}

# Cuban summer months (higher AC variability)
_SUMMER_MONTHS = {6, 7, 8}


def _compute_confidence(hour: int, is_weekend: bool, month: int) -> float:
    """
    Compute prediction confidence (0–1) for a given hour / day-type.

    Factors that reduce confidence vs. the 70 % baseline:
      • Night hours (0-5):       −8 pp  – usage highly irregular
      • Transition hours (7-9,  −5 pp  – people arriving/leaving
        17-20):
      • Weekend:                 −5 pp  – less-predictable routines
      • Summer months (Jun-Aug): −3 pp  – AC load harder to estimate

    Clipped to [0.50, 0.88] – we never claim perfect certainty or
    complete ignorance.
    """
    confidence = _BASE_CONFIDENCE

    if hour in _NIGHT_HOURS:
        confidence -= 0.08
    elif hour in _TRANSITION_HOURS:
        confidence -= 0.05

    if is_weekend:
        confidence -= 0.05

    if month in _SUMMER_MONTHS:
        confidence -= 0.03

    return round(max(0.50, min(0.88, confidence)), 4)


def _confidence_explanation(hour: int, is_weekend: bool, month: int) -> str:
    """Human-readable explanation of why confidence is not 100 %."""
    reasons: List[str] = [
        "Perfil configurado manualmente: variabilidad natural de consumo ±15-25 %."
    ]
    if hour in _NIGHT_HOURS:
        reasons.append(
            f"Hora nocturna ({hour}:00): uso irregular, menor repetibilidad estadística (−8 pp)."
        )
    elif hour in _TRANSITION_HOURS:
        reasons.append(
            f"Hora de transición ({hour}:00): llegada/salida de usuarios, mayor dispersión (−5 pp)."
        )
    if is_weekend:
        reasons.append("Fin de semana: rutinas de consumo menos regulares (−5 pp).")
    if month in _SUMMER_MONTHS:
        reasons.append("Mes de verano: carga de climatización más variable (−3 pp).")
    return " ".join(reasons)


def _source_label(hour: int, is_weekend: bool) -> str:
    """Short label describing the data source for this prediction."""
    day = "fin de semana" if is_weekend else "día laboral"
    return f"Perfil de usuario · {day} · hora {hour:02d}:00"


# ---------------------------------------------------------------------------
# MongoDB helpers
# ---------------------------------------------------------------------------

def get_active_profile() -> Dict[str, Any]:
    """Return the active consumption profile, falling back to defaults."""
    try:
        col = get_database()[COLLECTION]
        doc = col.find_one({"isActive": True})
        if doc:
            def _iso(v: Any) -> Optional[str]:
                if hasattr(v, "isoformat"):
                    return v.isoformat()
                return str(v) if v else None
            return {
                "_id": str(doc["_id"]),
                "name": doc.get("name", "Perfil activo"),
                "weekday": doc.get("weekday", _DEFAULT_WEEKDAY),
                "weekend": doc.get("weekend", _DEFAULT_WEEKEND),
                "isActive": True,
                "createdAt": _iso(doc.get("createdAt")),
                "updatedAt": _iso(doc.get("updatedAt")),
            }
    except Exception:
        pass
    return _default_profile_dict()


def save_profile(
    weekday: List[float],
    weekend: List[float],
    name: str = "Perfil principal",
) -> Dict[str, Any]:
    """
    Persist a new consumption profile and mark it as active.
    Previous active profiles are deactivated.
    """
    _validate_profile(weekday, "weekday")
    _validate_profile(weekend, "weekend")

    col = get_database()[COLLECTION]
    now = datetime.utcnow()

    # Deactivate all previous profiles
    col.update_many({"isActive": True}, {"$set": {"isActive": False}})

    doc = {
        "name": name,
        "weekday": [round(float(v), 2) for v in weekday],
        "weekend": [round(float(v), 2) for v in weekend],
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }
    result = col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["createdAt"] = now.isoformat()
    doc["updatedAt"] = now.isoformat()
    return doc


def _validate_profile(values: List[float], label: str) -> None:
    if len(values) != 24:
        raise ValueError(f"El perfil '{label}' debe tener exactamente 24 valores (uno por hora).")
    if any(v < 0 for v in values):
        raise ValueError(f"Los valores del perfil '{label}' deben ser ≥ 0.")


# Pico de carga por defecto como fracción de la capacidad solar instalada.
# Mantiene el perfil coherente con el tamaño del sistema (consumo ~ producción)
# en vez de valores fijos de un sistema de otro tamaño.
_DEFAULT_PEAK_LOAD_FRACTION = 0.18
_REFERENCE_PEAK_KW = max(_DEFAULT_WEEKDAY)  # pico de la forma de referencia (30 kW)


def _scale_shape(values: List[float], peak_kw: float) -> List[float]:
    """Escala la forma horaria de referencia a un pico dado (kW)."""
    return [round(v / _REFERENCE_PEAK_KW * peak_kw, 2) for v in values]


def _default_profile_dict() -> Dict[str, Any]:
    # Escalar el perfil por defecto a la capacidad solar instalada para que el
    # consumo sea proporcional al sistema (evita déficits irreales en sistemas
    # pequeños). Si no hay config, usa un sistema de 10 kW como referencia.
    try:
        from .system_config import get_system_config
        capacity_kw = float(get_system_config()["solar"]["capacityKw"])
    except Exception:
        capacity_kw = 10.0
    peak_kw = max(0.5, capacity_kw * _DEFAULT_PEAK_LOAD_FRACTION)
    return {
        "_id": None,
        "name": "Perfil por defecto",
        "weekday": _scale_shape(_DEFAULT_WEEKDAY, peak_kw),
        "weekend": _scale_shape(_DEFAULT_WEEKEND, peak_kw),
        "isActive": False,
        "createdAt": None,
        "updatedAt": None,
    }


# ---------------------------------------------------------------------------
# Prediction engine
# ---------------------------------------------------------------------------

def predict_from_profile(
    profile: Dict[str, Any],
    dt: datetime,
) -> Dict[str, Any]:
    """
    Generate a single-hour consumption prediction from a profile.

    Returns a dict with:
      datetime      – ISO string for the predicted hour
      consumption_kw – predicted consumption in kW
      confidence    – confidence score in [0, 1]
      confidence_pct – confidence as 0–100 integer
      source_label  – short description of the data source
      explanation   – why confidence is not 100 %
      hour          – hour of day (0-23)
      is_weekend    – boolean
    """
    hour = dt.hour
    is_weekend = dt.weekday() >= 5  # Saturday=5, Sunday=6
    month = dt.month

    profile_values: List[float] = (
        profile["weekend"] if is_weekend else profile["weekday"]
    )
    consumption_kw = round(float(profile_values[hour]), 2)

    confidence = _compute_confidence(hour, is_weekend, month)
    explanation = _confidence_explanation(hour, is_weekend, month)
    source = _source_label(hour, is_weekend)

    return {
        "datetime": dt.strftime("%Y-%m-%dT%H:00:00"),
        "consumption_kw": consumption_kw,
        "confidence": confidence,
        "confidence_pct": math.floor(confidence * 100),
        "source_label": source,
        "explanation": explanation,
        "hour": hour,
        "is_weekend": is_weekend,
    }


def predict_next_hours(hours: int = 24) -> List[Dict[str, Any]]:
    """Predict consumption for the next N hours using the active profile."""
    profile = get_active_profile()
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    return [predict_from_profile(profile, now + timedelta(hours=i)) for i in range(hours)]


def predict_for_date(date_str: str, hours: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    """
    Predict consumption for specific hours (or all 24) of a given date.

    date_str: 'YYYY-MM-DD'
    hours: list of integers 0-23, or None for all hours
    """
    profile = get_active_profile()
    base = datetime.strptime(date_str, "%Y-%m-%d")
    target_hours = hours if hours is not None else list(range(24))
    return [predict_from_profile(profile, base.replace(hour=h)) for h in target_hours]


def predict_date_range(start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """
    Predict consumption for all hours between start_date and end_date (inclusive).
    """
    profile = get_active_profile()
    start = datetime.strptime(start_date[:10], "%Y-%m-%d")
    end = datetime.strptime(end_date[:10], "%Y-%m-%d")

    results: List[Dict[str, Any]] = []
    current = start
    while current <= end:
        for h in range(24):
            results.append(predict_from_profile(profile, current.replace(hour=h)))
        current += timedelta(days=1)
    return results
