"""
Historical readings service — persists solar snapshots for trend analysis.
Collection: lecturas_historicas
"""
from __future__ import annotations

import random
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database import get_database

COLLECTION_NAME = "lecturas_historicas"


def _col():
    return get_database()[COLLECTION_NAME]


def _ensure_indexes() -> None:
    col = _col()
    col.create_index("timestamp")
    col.create_index([("timestamp", -1)])


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def save_reading(snapshot: Dict[str, Any]) -> str:
    """Persist a solar snapshot. Returns the inserted id as string."""
    _ensure_indexes()
    now = datetime.now(timezone.utc)
    doc = {
        "timestamp": now,
        "production": round(float(snapshot.get("production", 0)), 3),
        "consumption": round(float(snapshot.get("consumption", 0)), 3),
        "batteryLevel": round(float(snapshot.get("batteryLevel", 0)), 1),
        "gridExport": round(float(snapshot.get("gridExport", 0)), 3),
        "gridImport": round(float(snapshot.get("gridImport", 0)), 3),
        "efficiency": round(float(snapshot.get("efficiency", 0)), 1),
        "weather": snapshot.get("weather"),
    }
    result = _col().insert_one(doc)
    return str(result.inserted_id)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_readings(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 288,
) -> List[Dict[str, Any]]:
    """Query historical readings with optional date range filter."""
    query: Dict[str, Any] = {}
    if start_date or end_date:
        ts_filter: Dict[str, Any] = {}
        if start_date:
            ts_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if end_date:
            ts_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        query["timestamp"] = ts_filter

    cursor = _col().find(query).sort("timestamp", 1).limit(max(1, min(limit, 10_000)))
    return [_serialize(doc) for doc in cursor]


def get_daily_summaries(days: int = 30) -> List[Dict[str, Any]]:
    """Aggregate readings into daily summary statistics."""
    from datetime import date

    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))

    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$timestamp"},
                    "month": {"$month": "$timestamp"},
                    "day": {"$dayOfMonth": "$timestamp"},
                },
                "date": {"$first": "$timestamp"},
                "totalProduction": {"$sum": "$production"},
                "totalConsumption": {"$sum": "$consumption"},
                "avgBatteryLevel": {"$avg": "$batteryLevel"},
                "maxProduction": {"$max": "$production"},
                "maxConsumption": {"$max": "$consumption"},
                "avgEfficiency": {"$avg": "$efficiency"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    results = list(_col().aggregate(pipeline))
    summaries = []
    for r in results:
        d = r["date"]
        date_str = d.strftime("%Y-%m-%d") if isinstance(d, datetime) else str(d)
        summaries.append({
            "date": date_str,
            "totalProduction": round(r["totalProduction"], 2),
            "totalConsumption": round(r["totalConsumption"], 2),
            "avgBatteryLevel": round(r["avgBatteryLevel"], 1),
            "maxProduction": round(r["maxProduction"], 2),
            "maxConsumption": round(r["maxConsumption"], 2),
            "avgEfficiency": round(r["avgEfficiency"], 1),
            "readingCount": r["count"],
        })
    return summaries


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    ts = doc.get("timestamp")
    return {
        "_id": str(doc["_id"]),
        "timestamp": ts.isoformat() if isinstance(ts, datetime) else str(ts),
        "production": doc.get("production", 0.0),
        "consumption": doc.get("consumption", 0.0),
        "batteryLevel": doc.get("batteryLevel", 0.0),
        "gridExport": doc.get("gridExport", 0.0),
        "gridImport": doc.get("gridImport", 0.0),
        "efficiency": doc.get("efficiency", 0.0),
    }


# ---------------------------------------------------------------------------
# Seed (demo / thesis data)
# ---------------------------------------------------------------------------

def seed_historical_data(days: int = 30) -> int:
    """
    Insert simulated hourly readings for the past `days` days.
    Returns number of documents inserted.
    Skips if data already exists for that period.
    """
    _ensure_indexes()
    col = _col()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    existing = col.count_documents({"timestamp": {"$gte": cutoff}})
    if existing > 0:
        return 0  # Already seeded

    docs = []
    capacity_kw = 50.0
    battery_capacity = 100.0
    battery_level = 60.0  # start at 60%

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(hours=days * 24)

    for i in range(days * 24):
        ts = start + timedelta(hours=i)
        hour = ts.hour
        day_of_year = ts.timetuple().tm_yday
        # Seasonal factor (Cuba, more production in summer)
        seasonal = 0.85 + 0.15 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
        # Time-of-day production curve
        if 6 <= hour <= 19:
            solar_factor = math.exp(-0.5 * ((hour - 13) / 3.5) ** 2)
        else:
            solar_factor = 0.0
        cloud_cover = random.uniform(0, 60)
        cloud_factor = 1 - cloud_cover * 0.006
        production = round(capacity_kw * solar_factor * seasonal * cloud_factor * random.uniform(0.85, 1.0), 2)

        # Consumption
        if 7 <= hour <= 9 or 18 <= hour <= 22:
            consumption = round(35 * 1.3 * random.uniform(0.9, 1.1), 2)
        elif 6 <= hour <= 17:
            consumption = round(35 * random.uniform(0.9, 1.1), 2)
        else:
            consumption = round(18 * random.uniform(0.85, 1.1), 2)

        net = production - consumption
        battery_level = max(5.0, min(100.0, battery_level + (net / battery_capacity) * 100 * 0.95))

        grid_export = max(0.0, net - (battery_capacity * 0.05)) if net > 0 and battery_level >= 95 else 0.0
        grid_import = max(0.0, -net - (battery_capacity * 0.05)) if net < 0 and battery_level <= 5 else 0.0
        efficiency = round(min(100.0, (production / max(0.1, consumption)) * 100), 1) if consumption > 0 else 0.0

        docs.append({
            "timestamp": ts,
            "production": production,
            "consumption": consumption,
            "batteryLevel": round(battery_level, 1),
            "gridExport": round(grid_export, 3),
            "gridImport": round(grid_import, 3),
            "efficiency": efficiency,
        })

    if docs:
        col.insert_many(docs)
    return len(docs)
