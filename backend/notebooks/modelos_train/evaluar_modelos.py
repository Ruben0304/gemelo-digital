"""
Comparación rigurosa de modelos de producción solar (factor de capacidad).

Responde, con estadística, a la pregunta de la tesis:
    "¿Es Random Forest realmente mejor que las alternativas, o están empatados?"

Compara cuatro enfoques sobre EXACTAMENTE el mismo dato (La Habana, 2010-2015):
    1. Regresión lineal            (línea base simple)
    2. Random Forest               (el modelo desplegado: havana_v1)
    3. HistGradientBoosting        (boosting, con restricciones monótonas)
    4. Física pura (pvlib)         (PVWatts/Hay-Davies, SIN entrenar nada)

Salidas:
    A. Tabla de validación cruzada temporal (media ± desviación) → varianza real.
    B. Métricas en hold-out cronológico (entrena en el pasado, prueba en el futuro).
    C. Test de Diebold-Mariano por pares + corrección de Holm → significancia.
    D. Intervalos de confianza por block-bootstrap → solapamiento = empate.
    E. Error estratificado por hora, mes y condición de cielo → dónde gana cada uno.
    F. Gráficos (si matplotlib está disponible) en ./eval_out/.

Uso:
    python evaluar_modelos.py
"""
from __future__ import annotations

import sys
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from solar_features import (  # noqa: E402
    FEATURE_COLUMNS,
    DEFAULT_LAT,
    DEFAULT_LON,
    DEFAULT_ALTITUDE_M,
    monotone_constraints,
)

CSV = HERE / "havana_solar_training.csv"
OUT_DIR = HERE / "eval_out"
REF_TILT, REF_AZIMUTH, SYSTEM_LOSSES = 20.0, 180.0, 0.14
SEED = 42


# --------------------------------------------------------------------------- #
# Modelos candidatos (mismos hiperparámetros razonables en todas las pruebas)
# --------------------------------------------------------------------------- #
def make_models() -> dict:
    return {
        "Lineal": LinearRegression(),
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=18, min_samples_leaf=2,
            max_features="sqrt", random_state=SEED, n_jobs=-1,
        ),
        "HistGBM": HistGradientBoostingRegressor(
            max_iter=800, learning_rate=0.05, max_leaf_nodes=63,
            min_samples_leaf=50, l2_regularization=0.1,
            monotonic_cst=monotone_constraints(), random_state=SEED,
        ),
    }


def physics_capacity_factor(df: pd.DataFrame) -> np.ndarray:
    """Factor de capacidad físico (pvlib), geometría de referencia 20°/sur."""
    import pvlib

    loc = pvlib.location.Location(DEFAULT_LAT, DEFAULT_LON, tz="UTC",
                                  altitude=DEFAULT_ALTITUDE_M)
    solpos = loc.get_solarposition(df.index)
    zenith = solpos["apparent_zenith"]
    ghi = df["shortwave_radiation"].clip(lower=0)
    erbs = pvlib.irradiance.erbs(ghi, zenith, df.index)
    dni, dhi = erbs["dni"].fillna(0), erbs["dhi"].fillna(0)
    dni_extra = pvlib.irradiance.get_extra_radiation(df.index)
    poa = (
        pvlib.irradiance.get_total_irradiance(
            REF_TILT, REF_AZIMUTH, zenith, solpos["azimuth"],
            dni, ghi, dhi, dni_extra=dni_extra, model="haydavies",
        )["poa_global"].clip(lower=0).fillna(0)
    )
    tcell = pvlib.temperature.faiman(poa, df["temperature_2m"], df["wind_speed_10m"])
    pdc = pvlib.pvsystem.pvwatts_dc(poa, tcell, pdc0=1.0, gamma_pdc=-0.004)
    return (pdc * (1 - SYSTEM_LOSSES)).clip(lower=0, upper=1).fillna(0).to_numpy()


# --------------------------------------------------------------------------- #
# Métricas y pruebas estadísticas
# --------------------------------------------------------------------------- #
def _rmse(yt, yp):
    return float(np.sqrt(mean_squared_error(yt, yp)))


def _hac_var(d: np.ndarray, lag: int) -> float:
    """Varianza de largo plazo (Newey-West, kernel de Bartlett)."""
    n = len(d)
    dm = d - d.mean()
    var = (dm @ dm) / n
    for k in range(1, lag + 1):
        w = 1.0 - k / (lag + 1)
        var += 2.0 * w * (dm[k:] @ dm[:-k]) / n
    return var


def diebold_mariano(e1: np.ndarray, e2: np.ndarray, power: int = 2):
    """Test de Diebold-Mariano. H0: ambos modelos predicen igual de bien.

    Usa pérdida cuadrática y varianza HAC (corrige la autocorrelación temporal
    que invalida un t-test pareado simple). Devuelve (estadístico, p-valor).
    Negativo ⇒ el modelo 1 es mejor (menor error).
    """
    d = np.abs(e1) ** power - np.abs(e2) ** power
    n = len(d)
    lag = max(1, int(np.floor(4 * (n / 100.0) ** (2.0 / 9.0))))  # regla Newey-West
    var = _hac_var(d, lag)
    if var <= 0:
        return 0.0, 1.0
    dm = d.mean() / np.sqrt(var / n)
    p = 2.0 * stats.norm.cdf(-abs(dm))
    return float(dm), float(p)


def holm_correction(pairs: list[tuple[str, float]]):
    """Corrección de Holm-Bonferroni para comparaciones múltiples."""
    order = sorted(range(len(pairs)), key=lambda i: pairs[i][1])
    m = len(pairs)
    adj = [None] * len(pairs)
    prev = 0.0
    for rank, i in enumerate(order):
        p = min(1.0, (m - rank) * pairs[i][1])
        p = max(p, prev)  # monotonicidad
        prev = p
        adj[i] = p
    return adj


def block_bootstrap_ci(err: np.ndarray, block: int = 24, B: int = 1000,
                       seed: int = SEED):
    """IC 95% del RMSE por block-bootstrap (respeta autocorrelación horaria)."""
    rng = np.random.default_rng(seed)
    n = len(err)
    nblocks = int(np.ceil(n / block))
    out = np.empty(B)
    for b in range(B):
        starts = rng.integers(0, n - block + 1, size=nblocks)
        idx = np.concatenate([np.arange(s, s + block) for s in starts])[:n]
        e = err[idx]
        out[b] = np.sqrt(np.mean(e ** 2))
    return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))


# --------------------------------------------------------------------------- #
# Bloques del experimento
# --------------------------------------------------------------------------- #
def cross_validation_table(X, y, daylight_all):
    """A. Validación cruzada temporal: RMSE de día, media ± desviación (5 folds)."""
    print("\n" + "=" * 70)
    print("A. VALIDACIÓN CRUZADA TEMPORAL  (TimeSeriesSplit, 5 folds)")
    print("   RMSE en horas de día — media ± desviación entre folds")
    print("=" * 70)
    tscv = TimeSeriesSplit(n_splits=5)
    rows = {name: [] for name in make_models()}
    for tr, te in tscv.split(X):
        day = daylight_all[te]
        for name, model in make_models().items():
            model.fit(X.iloc[tr], y.iloc[tr])
            pred = np.clip(model.predict(X.iloc[te]), 0, 1)
            rows[name].append(_rmse(y.iloc[te].values[day], pred[day]))
    print(f"\n{'Modelo':<16}{'RMSE medio':>12}{'± desv':>10}{'   folds'}")
    cv_summary = {}
    for name, vals in rows.items():
        v = np.array(vals)
        cv_summary[name] = (v.mean(), v.std())
        folds = " ".join(f"{x:.3f}" for x in v)
        print(f"{name:<16}{v.mean():>12.4f}{v.std():>10.4f}   {folds}")
    return cv_summary


def holdout_metrics(models_pred, y_test, daylight_test):
    """B. Métricas en el hold-out cronológico (incluida la física)."""
    print("\n" + "=" * 70)
    print("B. HOLD-OUT CRONOLÓGICO  (último 20%: entrena pasado, prueba futuro)")
    print("=" * 70)
    print(f"\n{'Modelo':<16}{'RMSE':>9}{'MAE':>9}{'R²':>9}{'nRMSE %cap':>12}")
    table = {}
    yt = y_test.values[daylight_test]
    for name, pred in models_pred.items():
        yp = pred[daylight_test]
        rmse = _rmse(yt, yp)
        mae = float(mean_absolute_error(yt, yp))
        r2 = float(r2_score(yt, yp))
        table[name] = {"rmse": rmse, "mae": mae, "r2": r2}
        print(f"{name:<16}{rmse:>9.4f}{mae:>9.4f}{r2:>9.4f}{rmse*100:>11.2f}%")
    return table


def dm_tests(models_pred, y_test, daylight_test):
    """C. Diebold-Mariano por pares + corrección de Holm."""
    print("\n" + "=" * 70)
    print("C. DIEBOLD-MARIANO  (H0: empatados;  p<0.05 ⇒ diferencia significativa)")
    print("=" * 70)
    yt = y_test.values[daylight_test]
    errs = {name: pred[daylight_test] - yt for name, pred in models_pred.items()}
    names = list(errs)
    raw = []
    labels = []
    for a, b in combinations(names, 2):
        dm, p = diebold_mariano(errs[a], errs[b])
        raw.append((f"{a} vs {b}", p))
        labels.append((a, b, dm, p))
    adj = holm_correction(raw)
    print(f"\n{'Comparación':<26}{'DM':>9}{'p (crudo)':>12}{'p (Holm)':>12}  veredicto")
    for (a, b, dm, p), pa in zip(labels, adj):
        better = a if dm < 0 else b
        verdict = f"mejor: {better}" if pa < 0.05 else "EMPATE (no signif.)"
        print(f"{a+' vs '+b:<26}{dm:>9.3f}{p:>12.4f}{pa:>12.4f}  {verdict}")


def bootstrap_cis(models_pred, y_test, daylight_test):
    """D. Intervalos de confianza del RMSE por block-bootstrap."""
    print("\n" + "=" * 70)
    print("D. IC 95% del RMSE  (block-bootstrap; si se solapan ⇒ empate)")
    print("=" * 70)
    yt = y_test.values[daylight_test]
    print(f"\n{'Modelo':<16}{'RMSE':>9}{'IC 95% inferior':>18}{'IC 95% superior':>18}")
    cis = {}
    for name, pred in models_pred.items():
        err = pred[daylight_test] - yt
        lo, hi = block_bootstrap_ci(err)
        cis[name] = (_rmse(yt, pred[daylight_test]), lo, hi)
        print(f"{name:<16}{cis[name][0]:>9.4f}{lo:>18.4f}{hi:>18.4f}")
    return cis


def stratified_error(models_pred, y_test, X_test, daylight_test):
    """E. Error (RMSE) estratificado por hora, mes y condición de cielo."""
    print("\n" + "=" * 70)
    print("E. ERROR ESTRATIFICADO  (RMSE de día por estrato)")
    print("=" * 70)
    yt = y_test.values
    df = pd.DataFrame({"y": yt}, index=X_test.index)
    for name, pred in models_pred.items():
        df[name] = pred
    df = df[daylight_test]
    local = df.index.tz_convert("America/Havana")

    def _by(group_key, title, fmt):
        print(f"\n  · por {title}:")
        header = "    " + "estrato".ljust(10) + "".join(f"{n:>13}" for n in models_pred)
        print(header)
        for key, g in df.groupby(group_key):
            line = "    " + fmt(key).ljust(10)
            for name in models_pred:
                line += f"{_rmse(g['y'], g[name]):>13.4f}"
            print(line)

    _by(local.hour, "hora local", lambda h: f"{h:02d}h")
    _by(local.month, "mes", lambda m: f"mes {m:02d}")
    ci = X_test["clearsky_index"][daylight_test]
    sky = pd.cut(ci, [-0.01, 0.3, 0.6, 1.21],
                 labels=["nublado", "parcial", "despejado"])
    _by(sky, "cielo", lambda s: str(s))


def make_plots(cv, holdout, cis, out_dir: Path):
    """F. Gráficos resumen (opcional)."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        print("\n(matplotlib no disponible: se omiten los gráficos)")
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    names = list(holdout)

    # IC del RMSE (hold-out)
    fig, ax = plt.subplots(figsize=(7, 4))
    xs = range(len(names))
    rmses = [cis[n][0] for n in names]
    lo = [cis[n][0] - cis[n][1] for n in names]
    hi = [cis[n][2] - cis[n][0] for n in names]
    ax.errorbar(xs, rmses, yerr=[lo, hi], fmt="o", capsize=6)
    ax.set_xticks(list(xs)); ax.set_xticklabels(names)
    ax.set_ylabel("RMSE (día)"); ax.set_title("RMSE con IC 95% (block-bootstrap)")
    fig.tight_layout(); fig.savefig(out_dir / "rmse_ic.png", dpi=120); plt.close(fig)

    # CV media ± desv
    ml = [n for n in cv]
    fig, ax = plt.subplots(figsize=(7, 4))
    means = [cv[n][0] for n in ml]; stds = [cv[n][1] for n in ml]
    ax.bar(range(len(ml)), means, yerr=stds, capsize=6)
    ax.set_xticks(range(len(ml))); ax.set_xticklabels(ml)
    ax.set_ylabel("RMSE (día)"); ax.set_title("Validación cruzada temporal (media ± desv)")
    fig.tight_layout(); fig.savefig(out_dir / "cv_rmse.png", dpi=120); plt.close(fig)
    print(f"\n✓ Gráficos guardados en {out_dir}/")


# --------------------------------------------------------------------------- #
def main():
    if not CSV.exists():
        raise SystemExit(f"No se encontró el dataset: {CSV}")
    print(f"Cargando dataset: {CSV}")
    df = pd.read_csv(CSV, index_col="time")
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.dropna(subset=FEATURE_COLUMNS + ["capacity_factor"])

    X = df[FEATURE_COLUMNS]
    y = df["capacity_factor"].clip(0, 1)
    daylight_all = (X["solar_elevation"].values > 0)
    print(f"Muestras: {len(df)}  (horas de día: {daylight_all.sum()})")

    # A. CV temporal
    cv = cross_validation_table(X, y, daylight_all)

    # Hold-out cronológico 80/20 (igual que el entrenamiento)
    split = int(len(df) * 0.8)
    X_tr, X_te = X.iloc[:split], X.iloc[split:]
    y_tr, y_te = y.iloc[:split], y.iloc[split:]
    daylight_te = (X_te["solar_elevation"].values > 0)

    models_pred = {}
    for name, model in make_models().items():
        model.fit(X_tr, y_tr)
        models_pred[name] = np.clip(model.predict(X_te), 0, 1)
    # Física: no se entrena; se evalúa sobre el mismo test
    models_pred["Física"] = np.clip(physics_capacity_factor(df.iloc[split:]), 0, 1)

    holdout = holdout_metrics(models_pred, y_te, daylight_te)
    dm_tests(models_pred, y_te, daylight_te)
    cis = bootstrap_cis(models_pred, y_te, daylight_te)
    stratified_error(models_pred, y_te, X_te, daylight_te)
    make_plots(cv, holdout, cis, OUT_DIR)

    print("\n" + "=" * 70)
    print("LECTURA: si los IC se solapan y Holm da p>0.05, los modelos están")
    print("empatados → elegir por robustez/interpretabilidad, no por RMSE.")
    print("=" * 70)


if __name__ == "__main__":
    main()
