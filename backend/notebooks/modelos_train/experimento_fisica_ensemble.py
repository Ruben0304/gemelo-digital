"""
Experimento: ¿ayuda combinar el modelo ML con una fórmula física?

Cadena física estándar de ingeniería FV (la que usa PVGIS/PVWatts internamente):
  GHI (Open-Meteo)
    -> descomposición en directa/difusa (Erbs)
    -> transposición al plano del panel POA (Hay-Davies, tilt=20°, sur)
    -> temperatura de celda (Faiman, usa temp aire + viento)
    -> potencia DC (PVWatts: -0.4%/°C sobre 25°C) + pérdidas del sistema (14%)
  = factor de capacidad físico (0-1), sin entrenar nada.

Compara en el conjunto de prueba (separación cronológica, solo horas de día):
  (1) Física sola      (2) Random Forest      (3) Ensemble RF+física
  (4) RF + física como característica extra   (5) LightGBM (si está disponible)
"""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pvlib

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
from app.services.solar_features import FEATURE_COLUMNS, DEFAULT_LAT, DEFAULT_LON, monotone_constraints  # noqa: E402
from sklearn.ensemble import RandomForestRegressor  # noqa: E402
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score  # noqa: E402

CSV = BACKEND / "notebooks" / "datasets" / "havana_solar_training.csv"
TILT, AZIMUTH, LOSSES = 20.0, 180.0, 0.14   # mismos que PVGIS (sur, 20°, pérdidas 14%)


def physics_capacity_factor(df: pd.DataFrame) -> pd.Series:
    """Estimación física del factor de capacidad a partir de GHI + temp + viento."""
    loc = pvlib.location.Location(DEFAULT_LAT, DEFAULT_LON, tz="UTC", altitude=50)
    solpos = loc.get_solarposition(df.index)
    zenith = solpos["apparent_zenith"]
    azimuth = solpos["azimuth"]
    ghi = df["shortwave_radiation"].clip(lower=0)

    # GHI -> DNI/DHI
    erbs = pvlib.irradiance.erbs(ghi, zenith, df.index)
    dni, dhi = erbs["dni"].fillna(0), erbs["dhi"].fillna(0)
    dni_extra = pvlib.irradiance.get_extra_radiation(df.index)

    # Transposición al plano del panel (POA)
    poa = pvlib.irradiance.get_total_irradiance(
        TILT, AZIMUTH, zenith, azimuth, dni, ghi, dhi,
        dni_extra=dni_extra, model="haydavies",
    )["poa_global"].clip(lower=0).fillna(0)

    # Temperatura de celda y potencia DC (PVWatts, pdc0=1 -> factor de capacidad)
    tcell = pvlib.temperature.faiman(poa, df["temperature_2m"], df["wind_speed_10m"])
    pdc = pvlib.pvsystem.pvwatts_dc(poa, tcell, pdc0=1.0, gamma_pdc=-0.004)
    cf = (pdc * (1 - LOSSES)).clip(lower=0, upper=1).fillna(0)
    return cf


def m(yt, yp):
    return (float(np.sqrt(mean_squared_error(yt, yp))),
            float(mean_absolute_error(yt, yp)), float(r2_score(yt, yp)))


def main():
    df = pd.read_csv(CSV, index_col="time")
    df.index = pd.to_datetime(df.index, utc=True)
    df["cf_phys"] = physics_capacity_factor(df)
    y = df["capacity_factor"].clip(0, 1)

    split = int(len(df) * 0.8)
    tr, te = df.iloc[:split], df.iloc[split:]
    Xtr, ytr = tr[FEATURE_COLUMNS], y.iloc[:split]
    Xte, yte = te[FEATURE_COLUMNS], y.iloc[split:]
    day = te["solar_elevation"].values > 0
    phys_te = te["cf_phys"].values

    rf = RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_leaf=4,
                               max_features="sqrt", random_state=42, n_jobs=-1)
    rf.fit(Xtr, ytr)
    rf_te = np.clip(rf.predict(Xte), 0, 1)

    # Peso del ensemble afinado en una porción de validación DENTRO de train (sin tocar test)
    vsplit = int(len(tr) * 0.8)
    rf_v = RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_leaf=4,
                                 max_features="sqrt", random_state=42, n_jobs=-1)
    rf_v.fit(tr[FEATURE_COLUMNS].iloc[:vsplit], ytr.iloc[:vsplit])
    val = tr.iloc[vsplit:]
    vday = val["solar_elevation"].values > 0
    rf_val = np.clip(rf_v.predict(val[FEATURE_COLUMNS]), 0, 1)
    phys_val = val["cf_phys"].values
    yval = ytr.iloc[vsplit:].values
    ws = np.linspace(0, 1, 21)
    best_w = min(ws, key=lambda w: m(yval[vday], (w*rf_val + (1-w)*phys_val)[vday])[0])
    ens_te = np.clip(best_w*rf_te + (1-best_w)*phys_te, 0, 1)

    # RF + física como característica extra
    rf_f = RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_leaf=4,
                                 max_features="sqrt", random_state=42, n_jobs=-1)
    feat_plus = FEATURE_COLUMNS + ["cf_phys"]
    rf_f.fit(tr[feat_plus], ytr)
    rff_te = np.clip(rf_f.predict(te[feat_plus]), 0, 1)

    print(f"\n{'='*64}\nRESULTADOS (conjunto de prueba, SOLO horas de día)\n{'='*64}")
    print(f"{'Método':<34}{'RMSE':>8}{'MAE':>8}{'R²':>8}")
    for name, pred in [
        ("1. Física sola (PVWatts/pvlib)", phys_te),
        ("2. Random Forest (actual)", rf_te),
        (f"3. Ensemble RF+física (w={best_w:.2f})", ens_te),
        ("4. RF + física como feature", rff_te),
    ]:
        rmse, mae, r2 = m(yte.values[day], pred[day])
        print(f"{name:<34}{rmse:>8.4f}{mae:>8.4f}{r2:>8.4f}")

    # LightGBM (si libomp ya está instalado)
    try:
        import lightgbm as lgb
        lgbm = lgb.LGBMRegressor(n_estimators=800, learning_rate=0.05, num_leaves=63,
                                 min_child_samples=50, random_state=42, n_jobs=-1, verbose=-1,
                                 monotone_constraints=monotone_constraints())
        lgbm.fit(Xtr, ytr)
        lgb_te = np.clip(lgbm.predict(Xte), 0, 1)
        rmse, mae, r2 = m(yte.values[day], lgb_te[day])
        print(f"{'5. LightGBM (monótono)':<34}{rmse:>8.4f}{mae:>8.4f}{r2:>8.4f}")
    except Exception as e:
        print(f"5. LightGBM: no disponible ({type(e).__name__})")


if __name__ == "__main__":
    main()
