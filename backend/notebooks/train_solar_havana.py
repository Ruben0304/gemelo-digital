"""
Train the solar production model for La Habana (Option B).

Data sources (both free, no API key):
  - TARGET  : PVGIS hourly PV production for La Habana (satellite NSRDB DB).
              peakpower = 1 kWp  ->  target = capacity factor in [0, 1].
  - FEATURES: Open-Meteo historical archive for the same coordinates/hours,
              the SAME variables the backend serves at inference time.

The two are joined on the UTC timestamp, so features and target refer to the
same physical hour. Feature engineering is delegated to the shared module
app/services/solar_features.py (identical at train and serve time).

Run:  python notebooks/train_solar_havana.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import httpx
import joblib
import numpy as np
import pandas as pd

# Make app.services importable when run from the notebooks/ dir.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.services.solar_features import (  # noqa: E402
    FEATURE_COLUMNS,
    DEFAULT_LAT,
    DEFAULT_LON,
    build_features,
    monotone_constraints,
)

from sklearn.linear_model import LinearRegression  # noqa: E402
from sklearn.ensemble import (  # noqa: E402
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.model_selection import TimeSeriesSplit, RandomizedSearchCV  # noqa: E402
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score  # noqa: E402

LAT, LON = DEFAULT_LAT, DEFAULT_LON
START_YEAR, END_YEAR = 2010, 2015          # NSRDB coverage is 2005-2015
PEAK_POWER_KWP = 1.0                        # -> target is capacity factor
DATA_CSV = BACKEND_DIR / "notebooks" / "datasets" / "havana_solar_training.csv"
MODELS_DIR = BACKEND_DIR / "models"
MODEL_NAME = "havana_v1"


# --------------------------------------------------------------------------- #
# 1. Data acquisition
# --------------------------------------------------------------------------- #
def fetch_pvgis_production() -> pd.DataFrame:
    """Hourly PV capacity factor for La Habana from PVGIS (UTC index)."""
    print(f"→ PVGIS production {START_YEAR}-{END_YEAR} ...")
    resp = httpx.get(
        "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc",
        params={
            "lat": LAT, "lon": LON,
            "startyear": START_YEAR, "endyear": END_YEAR,
            "pvcalculation": 1, "peakpower": PEAK_POWER_KWP, "loss": 14,
            "angle": 20, "aspect": 0, "outputformat": "json",
        },
        timeout=180,
    )
    resp.raise_for_status()
    rows = resp.json()["outputs"]["hourly"]
    df = pd.DataFrame(rows)
    idx = pd.to_datetime(df["time"], format="%Y%m%d:%H%M", utc=True)
    # P is in W for a 1 kWp system -> divide by 1000 W to get capacity factor.
    out = pd.DataFrame({"capacity_factor": (df["P"].values / (PEAK_POWER_KWP * 1000.0))},
                       index=idx)
    out.index.name = "time"
    print(f"  {len(out)} hours, cf range [{out.capacity_factor.min():.3f}, "
          f"{out.capacity_factor.max():.3f}]")
    return out


def fetch_open_meteo_weather() -> pd.DataFrame:
    """Hourly Open-Meteo archive weather for La Habana (UTC index)."""
    print(f"→ Open-Meteo archive {START_YEAR}-{END_YEAR} ...")
    resp = httpx.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={
            "latitude": LAT, "longitude": LON,
            "start_date": f"{START_YEAR}-01-01", "end_date": f"{END_YEAR}-12-31",
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,"
                      "cloud_cover,shortwave_radiation",
            "timezone": "UTC",
        },
        timeout=180,
    )
    resp.raise_for_status()
    h = resp.json()["hourly"]
    idx = pd.to_datetime(h["time"], utc=True)
    df = pd.DataFrame({k: h[k] for k in h if k != "time"}, index=idx)
    df.index.name = "time"
    print(f"  {len(df)} hours")
    return df


def build_dataset() -> pd.DataFrame:
    target = fetch_pvgis_production()
    weather = fetch_open_meteo_weather()

    # Inner-join on the shared UTC hours.
    merged = weather.join(target, how="inner").dropna()
    print(f"→ merged: {len(merged)} hours "
          f"({merged.index.min()} .. {merged.index.max()})")

    feats = build_features(merged, LAT, LON)
    out = feats.copy()
    out["capacity_factor"] = merged["capacity_factor"].values
    out = out.dropna()

    DATA_CSV.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(DATA_CSV)
    print(f"→ saved dataset to {DATA_CSV}")
    return out


# --------------------------------------------------------------------------- #
# 2. Evaluation helpers
# --------------------------------------------------------------------------- #
def report(name: str, y_true, y_pred, daylight_mask) -> dict:
    """Print and return metrics, overall and conditioned on daylight hours."""
    def _m(yt, yp):
        rmse = float(np.sqrt(mean_squared_error(yt, yp)))
        return rmse, float(mean_absolute_error(yt, yp)), float(r2_score(yt, yp))

    rmse, mae, r2 = _m(y_true, y_pred)
    drmse, dmae, dr2 = _m(y_true[daylight_mask], y_pred[daylight_mask])
    print(f"\n{name}")
    print(f"  overall : RMSE={rmse:.4f}  MAE={mae:.4f}  R²={r2:.4f}  "
          f"(nRMSE={rmse*100:.2f}% of capacity)")
    print(f"  daylight: RMSE={drmse:.4f}  MAE={dmae:.4f}  R²={dr2:.4f}")
    return {"rmse": rmse, "mae": mae, "r2": r2,
            "daylight_rmse": drmse, "daylight_mae": dmae, "daylight_r2": dr2}


# --------------------------------------------------------------------------- #
# 3. Main
# --------------------------------------------------------------------------- #
def main():
    data = build_dataset()

    X = data[FEATURE_COLUMNS]
    y = data["capacity_factor"].clip(0, 1)

    # Chronological split (NO shuffle): train on the past, test on the future.
    split = int(len(data) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]
    daylight_test = (X_test["solar_elevation"].values > 0)
    print(f"\nTrain: {len(X_train)}  Test: {len(X_test)}  "
          f"(daylight test hours: {daylight_test.sum()})")

    tscv = TimeSeriesSplit(n_splits=5)
    results = {}
    models = {}

    # --- Baseline: Linear Regression ---
    lr = LinearRegression().fit(X_train, y_train)
    results["linear"] = report("Linear Regression",
                               y_test.values, np.clip(lr.predict(X_test), 0, 1),
                               daylight_test)
    models["linear"] = lr

    # --- Random Forest (light tuning via randomized search) ---
    print("\n→ tuning Random Forest (TimeSeriesSplit CV) ...")
    rf_search = RandomizedSearchCV(
        RandomForestRegressor(random_state=42, n_jobs=-1),
        {
            "n_estimators": [200, 400],
            "max_depth": [12, 18, 24, None],
            "min_samples_leaf": [1, 2, 4],
            "max_features": ["sqrt", 0.5, 1.0],
        },
        n_iter=12, cv=tscv, scoring="neg_root_mean_squared_error",
        random_state=42, n_jobs=-1,
    ).fit(X_train, y_train)
    rf = rf_search.best_estimator_
    print(f"  best RF params: {rf_search.best_params_}")
    results["random_forest"] = report("Random Forest",
                                       y_test.values, np.clip(rf.predict(X_test), 0, 1),
                                       daylight_test)
    models["random_forest"] = rf

    # --- Histogram Gradient Boosting with monotonic constraints ---
    # (sklearn-native, LightGBM-like; production forced monotonic in irradiance.)
    print("\n→ tuning HistGradientBoosting (monotone, TimeSeriesSplit CV) ...")
    hgb_search = RandomizedSearchCV(
        HistGradientBoostingRegressor(
            random_state=42,
            monotonic_cst=monotone_constraints(),
            early_stopping=False,
        ),
        {
            "max_iter": [400, 800, 1200],
            "learning_rate": [0.02, 0.05, 0.1],
            "max_leaf_nodes": [31, 63, 127],
            "min_samples_leaf": [20, 50, 100],
            "l2_regularization": [0.0, 0.1, 1.0],
        },
        n_iter=15, cv=tscv, scoring="neg_root_mean_squared_error",
        random_state=42, n_jobs=-1,
    ).fit(X_train, y_train)
    hgb = hgb_search.best_estimator_
    print(f"  best HGB params: {hgb_search.best_params_}")
    results["hist_gbm"] = report("HistGradientBoosting",
                                  y_test.values, np.clip(hgb.predict(X_test), 0, 1),
                                  daylight_test)
    models["hist_gbm"] = hgb

    # --- Pick best by daylight RMSE (the metric that matters) ---
    best_key = min(results, key=lambda k: results[k]["daylight_rmse"])
    best_model = models[best_key]
    print(f"\n{'='*60}\nBEST MODEL: {best_key}  "
          f"(daylight RMSE={results[best_key]['daylight_rmse']:.4f})\n{'='*60}")

    # --- Save model + metadata ---
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"solar_production_{MODEL_NAME}.pkl"
    joblib.dump(best_model, model_path)

    metadata = {
        "model_name": f"Havana {best_key} (capacity factor)",
        "algorithm": best_key,
        "train_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "features": FEATURE_COLUMNS,
        "target": "capacity_factor",
        "output_is_capacity_factor": True,
        # cf in [0,1] * real nameplate kW = production kW. reference=1 makes the
        # backend's scale_factor = target_capacity_kw / 1.0 = target_capacity_kw.
        "reference_capacity_kw": 1.0,
        "requires_scaling": False,
        "data_source": "PVGIS (NSRDB) production + Open-Meteo archive weather, La Habana",
        "training_years": f"{START_YEAR}-{END_YEAR}",
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        # Top-level headline metrics (daylight = the meaningful ones) for
        # backward compatibility with get_model_info() / the GraphQL schema.
        "test_rmse": results[best_key]["daylight_rmse"],
        "test_mae": results[best_key]["daylight_mae"],
        "test_r2": results[best_key]["daylight_r2"],
        "metrics": results[best_key],
        "all_models": results,
    }
    meta_path = MODELS_DIR / f"metadata_{MODEL_NAME}.json"
    meta_path.write_text(json.dumps(metadata, indent=2))
    print(f"✓ model    -> {model_path}")
    print(f"✓ metadata -> {meta_path}")


if __name__ == "__main__":
    main()
