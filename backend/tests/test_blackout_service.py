"""
Pruebas de integración para blackout_service.

Cubre la lógica compleja de validación de intervalos de apagón:
persistencia con upsert por fecha, solapamientos, límites de duración,
filtrado por rango de fechas y eliminación.
"""
import pytest
from datetime import datetime, timedelta
from bson import ObjectId

from app.services.blackout_service import (
    save_blackout_schedule,
    update_blackout_schedule,
    list_blackouts,
    get_blackout,
    get_blackout_by_date,
    get_blackouts_for_range,
    delete_blackout,
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_interval(start_h: int, end_h: int, date: str = "2024-06-15") -> dict:
    return {
        "start": f"{date}T{start_h:02d}:00:00",
        "end": f"{date}T{end_h:02d}:00:00",
    }


def _payload(date: str = "2024-06-15", intervals=None, province: str = "La Habana") -> dict:
    if intervals is None:
        intervals = [_make_interval(10, 12, date)]
    return {
        "date": date,
        "intervals": intervals,
        "province": province,
        "municipality": "Plaza",
        "notes": "Corte programado",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Creación / upsert
# ─────────────────────────────────────────────────────────────────────────────

class TestGuardarApagon:

    def test_guardar_retorna_documento_con_id(self, mongo_db):
        result = save_blackout_schedule(_payload())
        assert "_id" in result
        assert isinstance(result["_id"], str)

    def test_guardar_persiste_fecha(self, mongo_db):
        result = save_blackout_schedule(_payload())
        assert "2024-06-15" in result["date"]

    def test_guardar_persiste_provincia(self, mongo_db):
        result = save_blackout_schedule(_payload())
        assert result["province"] == "La Habana"

    def test_guardar_calcula_duracion_en_minutos(self, mongo_db):
        result = save_blackout_schedule(_payload())
        assert result["intervals"][0]["durationMinutes"] == 120  # 2 horas

    def test_guardar_upsert_misma_fecha_actualiza(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-15"))
        updated = save_blackout_schedule({
            "date": "2024-06-15",
            "intervals": [_make_interval(14, 16)],
            "province": "Matanzas",
        })
        assert updated["province"] == "Matanzas"
        # Solo un documento para esa fecha
        all_blackouts = list_blackouts()
        assert len(all_blackouts) == 1

    def test_guardar_fechas_distintas_crea_documentos_distintos(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-16"))
        assert len(list_blackouts()) == 2

    def test_guardar_sin_fecha_lanza_error(self, mongo_db):
        with pytest.raises(ValueError, match="fecha"):
            save_blackout_schedule({"date": None, "intervals": [_make_interval(10, 12)]})

    def test_guardar_sin_intervalos_lanza_error(self, mongo_db):
        with pytest.raises(ValueError):
            save_blackout_schedule({"date": "2024-06-15", "intervals": []})

    def test_guardar_intervalo_de_menos_de_15_min_lanza_error(self, mongo_db):
        interval = {
            "start": "2024-06-15T10:00:00",
            "end": "2024-06-15T10:10:00",
        }
        with pytest.raises(ValueError, match="15 minutos"):
            save_blackout_schedule({"date": "2024-06-15", "intervals": [interval]})

    def test_guardar_intervalo_fin_antes_de_inicio_lanza_error(self, mongo_db):
        interval = {
            "start": "2024-06-15T14:00:00",
            "end": "2024-06-15T10:00:00",
        }
        with pytest.raises(ValueError):
            save_blackout_schedule({"date": "2024-06-15", "intervals": [interval]})

    def test_guardar_intervalos_solapados_lanza_error(self, mongo_db):
        intervals = [
            _make_interval(10, 13),
            _make_interval(12, 15),  # solapado con el anterior
        ]
        with pytest.raises(ValueError, match="solapar"):
            save_blackout_schedule({"date": "2024-06-15", "intervals": intervals})

    def test_guardar_intervalo_fuera_del_dia_lanza_error(self, mongo_db):
        # Fin en otro día
        interval = {
            "start": "2024-06-15T23:00:00",
            "end": "2024-06-16T01:00:00",
        }
        with pytest.raises(ValueError):
            save_blackout_schedule({"date": "2024-06-15", "intervals": [interval]})

    def test_guardar_intervalos_multiples_validos(self, mongo_db):
        intervals = [
            _make_interval(8, 10),
            _make_interval(14, 16),
        ]
        result = save_blackout_schedule({"date": "2024-06-15", "intervals": intervals})
        assert len(result["intervals"]) == 2

    def test_guardar_intervalos_se_ordenan_por_hora(self, mongo_db):
        intervals = [
            _make_interval(14, 16),
            _make_interval(8, 10),
        ]
        result = save_blackout_schedule({"date": "2024-06-15", "intervals": intervals})
        starts = [r["start"] for r in result["intervals"]]
        assert starts == sorted(starts)


# ─────────────────────────────────────────────────────────────────────────────
# Listado y filtrado
# ─────────────────────────────────────────────────────────────────────────────

class TestListarApagones:

    def test_listar_vacio_retorna_lista_vacia(self, mongo_db):
        assert list_blackouts() == []

    def test_listar_devuelve_todos(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-14"))
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-16"))
        assert len(list_blackouts()) == 3

    def test_listar_filtrar_desde_fecha(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-13"))
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-17"))
        result = list_blackouts(from_date="2024-06-15")
        assert len(result) == 2

    def test_listar_filtrar_hasta_fecha(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-13"))
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-17"))
        result = list_blackouts(to_date="2024-06-15")
        assert len(result) == 2

    def test_listar_filtrar_rango(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-13"))
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-17"))
        result = list_blackouts(from_date="2024-06-14", to_date="2024-06-16")
        assert len(result) == 1

    def test_listar_con_limite(self, mongo_db):
        for day in range(1, 6):
            save_blackout_schedule(_payload(f"2024-06-{day:02d}"))
        result = list_blackouts(limit=2)
        assert len(result) == 2

    def test_listar_ordenado_por_fecha_ascendente(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-17"))
        save_blackout_schedule(_payload("2024-06-13"))
        result = list_blackouts()
        dates = [r["date"][:10] for r in result]
        assert dates == sorted(dates)


# ─────────────────────────────────────────────────────────────────────────────
# Obtención
# ─────────────────────────────────────────────────────────────────────────────

class TestObtenerApagon:

    def test_obtener_por_id_existente(self, mongo_db):
        created = save_blackout_schedule(_payload())
        found = get_blackout(created["_id"])
        assert found is not None
        assert found["_id"] == created["_id"]

    def test_obtener_id_inexistente_retorna_none(self, mongo_db):
        assert get_blackout(str(ObjectId())) is None

    def test_obtener_por_fecha(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-15"))
        found = get_blackout_by_date("2024-06-15")
        assert found is not None
        assert "2024-06-15" in found["date"]

    def test_obtener_por_fecha_inexistente_retorna_none(self, mongo_db):
        assert get_blackout_by_date("2024-01-01") is None

    def test_obtener_para_rango(self, mongo_db):
        save_blackout_schedule(_payload("2024-06-14"))
        save_blackout_schedule(_payload("2024-06-15"))
        save_blackout_schedule(_payload("2024-06-16"))
        start = datetime(2024, 6, 14)
        end = datetime(2024, 6, 15)
        result = get_blackouts_for_range(start, end)
        assert len(result) == 2


# ─────────────────────────────────────────────────────────────────────────────
# Actualización
# ─────────────────────────────────────────────────────────────────────────────

class TestActualizarApagon:

    def test_actualizar_cambia_provincia(self, mongo_db):
        created = save_blackout_schedule(_payload("2024-06-15"))
        updated = update_blackout_schedule(created["_id"], {
            "date": "2024-06-15",
            "intervals": [_make_interval(14, 16)],
            "province": "Matanzas",
        })
        assert updated["province"] == "Matanzas"

    def test_actualizar_cambia_intervalos(self, mongo_db):
        created = save_blackout_schedule(_payload("2024-06-15"))
        updated = update_blackout_schedule(created["_id"], {
            "date": "2024-06-15",
            "intervals": [_make_interval(14, 16), _make_interval(18, 20)],
        })
        assert len(updated["intervals"]) == 2

    def test_actualizar_id_inexistente_lanza_error(self, mongo_db):
        with pytest.raises(ValueError):
            update_blackout_schedule(str(ObjectId()), {
                "date": "2024-06-15",
                "intervals": [_make_interval(10, 12)],
            })


# ─────────────────────────────────────────────────────────────────────────────
# Eliminación
# ─────────────────────────────────────────────────────────────────────────────

class TestEliminarApagon:

    def test_eliminar_existente_retorna_true(self, mongo_db):
        created = save_blackout_schedule(_payload())
        assert delete_blackout(created["_id"]) is True

    def test_eliminar_quita_de_la_lista(self, mongo_db):
        created = save_blackout_schedule(_payload())
        delete_blackout(created["_id"])
        assert list_blackouts() == []

    def test_eliminar_id_inexistente_retorna_false(self, mongo_db):
        assert delete_blackout(str(ObjectId())) is False

    def test_eliminar_uno_no_afecta_otro(self, mongo_db):
        a = save_blackout_schedule(_payload("2024-06-14"))
        save_blackout_schedule(_payload("2024-06-15"))
        delete_blackout(a["_id"])
        remaining = list_blackouts()
        assert len(remaining) == 1
        assert "2024-06-15" in remaining[0]["date"]
