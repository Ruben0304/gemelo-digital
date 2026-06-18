"""
Pruebas de integración para lectura_service (lecturas_historicas).

Cubre: guardar lecturas, consultar con filtros de fecha, resúmenes diarios
y sembrado de datos de demostración.
"""
import pytest
from datetime import datetime, timezone, timedelta

from app.services.lectura_service import (
    save_reading,
    get_readings,
    get_daily_summaries,
    seed_historical_data,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _snapshot(**kwargs):
    base = {
        "production": 25.0,
        "consumption": 18.0,
        "batteryLevel": 65.0,
        "gridExport": 2.5,
        "gridImport": 0.0,
        "efficiency": 85.0,
    }
    base.update(kwargs)
    return base


# ─────────────────────────────────────────────────────────────────────────────
# Guardar lecturas
# ─────────────────────────────────────────────────────────────────────────────

class TestGuardarLectura:

    def test_guardar_retorna_id_string(self, mongo_db):
        id_ = save_reading(_snapshot())
        assert isinstance(id_, str) and len(id_) > 0

    def test_guardar_persiste_produccion(self, mongo_db):
        save_reading(_snapshot(production=30.5))
        readings = get_readings()
        assert readings[0]["production"] == pytest.approx(30.5, abs=0.01)

    def test_guardar_persiste_consumo(self, mongo_db):
        save_reading(_snapshot(consumption=22.3))
        readings = get_readings()
        assert readings[0]["consumption"] == pytest.approx(22.3, abs=0.01)

    def test_guardar_persiste_nivel_bateria(self, mongo_db):
        save_reading(_snapshot(batteryLevel=75.0))
        readings = get_readings()
        assert readings[0]["batteryLevel"] == pytest.approx(75.0, abs=0.1)

    def test_guardar_persiste_exportacion_red(self, mongo_db):
        save_reading(_snapshot(gridExport=5.0))
        readings = get_readings()
        assert readings[0]["gridExport"] == pytest.approx(5.0, abs=0.01)

    def test_guardar_persiste_importacion_red(self, mongo_db):
        save_reading(_snapshot(gridImport=3.2))
        readings = get_readings()
        assert readings[0]["gridImport"] == pytest.approx(3.2, abs=0.01)

    def test_guardar_varios_incrementa_count(self, mongo_db):
        for i in range(5):
            save_reading(_snapshot(production=float(i)))
        assert len(get_readings()) == 5

    def test_lectura_tiene_timestamp(self, mongo_db):
        save_reading(_snapshot())
        reading = get_readings()[0]
        assert "timestamp" in reading
        assert reading["timestamp"] is not None

    def test_lectura_estructura_correcta(self, mongo_db):
        save_reading(_snapshot())
        reading = get_readings()[0]
        for field in ["_id", "timestamp", "production", "consumption", "batteryLevel",
                      "gridExport", "gridImport", "efficiency"]:
            assert field in reading


# ─────────────────────────────────────────────────────────────────────────────
# Consultar lecturas
# ─────────────────────────────────────────────────────────────────────────────

class TestObtenerLecturas:

    def test_obtener_sin_datos_retorna_lista_vacia(self, mongo_db):
        assert get_readings() == []

    def test_limite_por_defecto(self, mongo_db):
        for i in range(10):
            save_reading(_snapshot())
        assert len(get_readings()) == 10

    def test_limite_personalizado(self, mongo_db):
        for i in range(10):
            save_reading(_snapshot())
        assert len(get_readings(limit=5)) == 5

    def test_filtro_start_date_excluye_anteriores(self, mongo_db):
        # Sembrar datos de demo con fechas pasadas
        seed_historical_data(days=5)
        future_ts = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        results = get_readings(start_date=future_ts)
        assert results == []

    def test_filtro_end_date_excluye_posteriores(self, mongo_db):
        seed_historical_data(days=3)
        past_ts = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        results = get_readings(end_date=past_ts)
        assert results == []

    def test_filtro_rango_valido_devuelve_datos(self, mongo_db):
        seed_historical_data(days=3)
        start = (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
        end = datetime.now(timezone.utc).isoformat()
        results = get_readings(start_date=start, end_date=end)
        assert len(results) > 0

    def test_lecturas_ordenadas_por_timestamp(self, mongo_db):
        seed_historical_data(days=2)
        results = get_readings()
        timestamps = [r["timestamp"] for r in results]
        assert timestamps == sorted(timestamps)


# ─────────────────────────────────────────────────────────────────────────────
# Resúmenes diarios
# ─────────────────────────────────────────────────────────────────────────────

class TestResumenesDiarios:

    def test_sin_datos_retorna_lista_vacia(self, mongo_db):
        assert get_daily_summaries() == []

    def test_con_datos_retorna_resumenes(self, mongo_db):
        seed_historical_data(days=3)
        summaries = get_daily_summaries(days=5)
        assert len(summaries) > 0

    def test_estructura_resumen(self, mongo_db):
        seed_historical_data(days=2)
        summary = get_daily_summaries(days=5)[0]
        for field in ["date", "totalProduction", "totalConsumption",
                      "avgBatteryLevel", "maxProduction", "maxConsumption",
                      "avgEfficiency", "readingCount"]:
            assert field in summary

    def test_produccion_total_no_negativa(self, mongo_db):
        seed_historical_data(days=3)
        for s in get_daily_summaries(days=5):
            assert s["totalProduction"] >= 0

    def test_consumo_total_positivo(self, mongo_db):
        seed_historical_data(days=3)
        for s in get_daily_summaries(days=5):
            assert s["totalConsumption"] >= 0

    def test_reading_count_positivo(self, mongo_db):
        seed_historical_data(days=2)
        for s in get_daily_summaries(days=5):
            assert s["readingCount"] > 0

    def test_dias_parametro_limita_ventana(self, mongo_db):
        seed_historical_data(days=10)
        summaries_7 = get_daily_summaries(days=7)
        summaries_1 = get_daily_summaries(days=1)
        assert len(summaries_7) >= len(summaries_1)


# ─────────────────────────────────────────────────────────────────────────────
# Sembrado de datos (seed)
# ─────────────────────────────────────────────────────────────────────────────

class TestSeedHistoricalData:

    def test_seed_inserta_registros(self, mongo_db):
        count = seed_historical_data(days=3)
        assert count == 3 * 24

    def test_seed_doble_no_duplica(self, mongo_db):
        seed_historical_data(days=3)
        count2 = seed_historical_data(days=3)
        assert count2 == 0  # ya sembrado

    def test_seed_datos_consultables(self, mongo_db):
        seed_historical_data(days=2)
        readings = get_readings(limit=10000)
        assert len(readings) == 2 * 24

    def test_seed_produccion_no_negativa(self, mongo_db):
        seed_historical_data(days=2)
        for r in get_readings(limit=10000):
            assert r["production"] >= 0

    def test_seed_bateria_entre_0_y_100(self, mongo_db):
        seed_historical_data(days=2)
        for r in get_readings(limit=10000):
            assert 0 <= r["batteryLevel"] <= 100
