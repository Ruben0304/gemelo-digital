"""
Blackout schedule service mirroring the original Next.js logic.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo.collection import Collection

from app.database import get_database

COLLECTION_NAME = "apagones"


def _collection() -> Collection:
    return get_database()[COLLECTION_NAME]


def _start_of_day(date: datetime) -> datetime:
    return date.replace(hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(date: datetime) -> datetime:
    return _start_of_day(date) + timedelta(days=1)


def _parse_iso(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def _ensure_valid_date(date_str: Optional[str]) -> datetime:
    if not date_str:
        raise ValueError("La fecha del día es obligatoria.")
    try:
        date = _parse_iso(date_str) if "T" in date_str else datetime.fromisoformat(date_str)
    except ValueError as exc:  # pragma: no cover - invalid iso
        raise ValueError("La fecha proporcionada es inválida.") from exc
    return _start_of_day(date)


def _map_interval(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "start": doc["start"].isoformat(),
        "end": doc["end"].isoformat(),
        "durationMinutes": doc.get("durationMinutes"),
    }


def _map_blackout(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": str(doc["_id"]),
        "date": doc["date"].isoformat(),
        "intervals": [_map_interval(interval) for interval in doc.get("intervals", [])],
        "province": doc.get("province"),
        "municipality": doc.get("municipality"),
        "notes": doc.get("notes"),
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
        "updatedAt": doc.get("updatedAt").isoformat() if doc.get("updatedAt") else None,
    }


def _ensure_valid_intervals(date: datetime, intervals: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not intervals:
        raise ValueError("Se requiere al menos un intervalo de apagón.")

    normalized: List[Dict[str, Any]] = []
    for idx, interval in enumerate(intervals):
        start_str = interval.get("start")
        end_str = interval.get("end")
        if not start_str or not end_str:
            raise ValueError(f"El intervalo #{idx + 1} debe incluir hora de inicio y fin.")
        try:
            start = _parse_iso(start_str)
            end = _parse_iso(end_str)
        except ValueError as exc:
            raise ValueError(f"El intervalo #{idx + 1} tiene fechas inválidas.") from exc

        if not start < end:
            raise ValueError(f"El intervalo #{idx + 1} debe tener fin posterior al inicio.")

        range_start = _start_of_day(date)
        range_end = _end_of_day(date)
        if not (range_start <= start < range_end and range_start < end <= range_end):
            raise ValueError(f"El intervalo #{idx + 1} debe pertenecer al mismo día indicado.")

        duration_minutes = int((end - start).total_seconds() / 60)
        if duration_minutes < 15:
            raise ValueError(f"El intervalo #{idx + 1} debe durar al menos 15 minutos.")

        normalized.append(
            {
                "start": start,
                "end": end,
                "durationMinutes": duration_minutes,
            }
        )

    normalized.sort(key=lambda item: item["start"])
    for prev, current in zip(normalized, normalized[1:]):
        if not prev["end"] < current["start"]:
            raise ValueError("Los intervalos de apagón no pueden solaparse.")

    return normalized


def _object_id(blackout_id: str) -> ObjectId:
    try:
        return ObjectId(blackout_id)
    except Exception as exc:  # pragma: no cover
        raise ValueError("Identificador de apagón inválido.") from exc


def save_blackout_schedule(payload: Dict[str, Any]) -> Dict[str, Any]:
    date = _ensure_valid_date(payload.get("date"))
    intervals = _ensure_valid_intervals(date, payload.get("intervals"))
    now = datetime.utcnow()

    result = _collection().find_one_and_update(
        {"date": date},
        {
            "$set": {
                "date": date,
                "intervals": intervals,
                "province": payload.get("province") or None,
                "municipality": payload.get("municipality") or None,
                "notes": payload.get("notes") or None,
                "updatedAt": now,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
        return_document=True,
    )

    if not result:
        raise RuntimeError("No se pudo guardar el horario de apagón.")
    return _map_blackout(result)


def update_blackout_schedule(blackout_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    date = _ensure_valid_date(payload.get("date"))
    intervals = _ensure_valid_intervals(date, payload.get("intervals"))
    now = datetime.utcnow()

    result = _collection().find_one_and_update(
        {"_id": _object_id(blackout_id)},
        {
            "$set": {
                "date": date,
                "intervals": intervals,
                "province": payload.get("province") or None,
                "municipality": payload.get("municipality") or None,
                "notes": payload.get("notes") or None,
                "updatedAt": now,
            }
        },
        return_document=True,
    )

    if not result:
        raise ValueError("No se encontró el horario de apagón solicitado.")
    return _map_blackout(result)


def list_blackouts(from_date: Optional[str] = None, to_date: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    filters: Dict[str, Any] = {}
    if from_date or to_date:
        filters["date"] = {}
        if from_date:
            filters["date"]["$gte"] = _start_of_day(_ensure_valid_date(from_date))
        if to_date:
            filters["date"]["$lte"] = _start_of_day(_ensure_valid_date(to_date))
        if not filters["date"]:
            filters.pop("date")

    cursor = _collection().find(filters).sort("date", 1)
    if limit and limit > 0:
        cursor = cursor.limit(limit)
    return [_map_blackout(doc) for doc in cursor]


def get_blackout(blackout_id: str) -> Optional[Dict[str, Any]]:
    doc = _collection().find_one({"_id": _object_id(blackout_id)})
    return _map_blackout(doc) if doc else None


def get_blackout_by_date(date_str: str) -> Optional[Dict[str, Any]]:
    date = _ensure_valid_date(date_str)
    doc = _collection().find_one({"date": date})
    return _map_blackout(doc) if doc else None


def get_blackouts_for_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    docs = (
        _collection()
        .find({"date": {"$gte": _start_of_day(start), "$lte": _start_of_day(end)}})
        .sort("date", 1)
    )
    return [_map_blackout(doc) for doc in docs]


def delete_blackout(blackout_id: str) -> bool:
    result = _collection().delete_one({"_id": _object_id(blackout_id)})
    return result.deleted_count == 1

