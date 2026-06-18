"""
Pruebas de integración para consumption_profile_service.

Cubre: guardar y obtener perfiles de consumo, validaciones, el modelo
de confianza horaria, predicciones para fechas concretas y rangos.
"""
import pytest
from datetime import datetime

from app.services.consumption_profile_service import (
    get_active_profile,
    save_profile,
    predict_from_profile,
    predict_next_hours,
    predict_for_date,
    predict_date_range,
    _compute_confidence,
    _DEFAULT_WEEKDAY,
    _DEFAULT_WEEKEND,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _flat(value: float = 5.0) -> list:
    return [value] * 24


# ─────────────────────────────────────────────────────────────────────────────
# Obtención con fallback
# ─────────────────────────────────────────────────────────────────────────────

class TestObtenerPerfilActivo:

    def test_sin_datos_devuelve_perfil_por_defecto(self, mongo_db):
        profile = get_active_profile()
        assert profile is not None
        assert "weekday" in profile
        assert "weekend" in profile

    def test_perfil_por_defecto_tiene_24_valores_weekday(self, mongo_db):
        profile = get_active_profile()
        assert len(profile["weekday"]) == 24

    def test_perfil_por_defecto_tiene_24_valores_weekend(self, mongo_db):
        profile = get_active_profile()
        assert len(profile["weekend"]) == 24

    def test_perfil_guardado_sobreescribe_defecto(self, mongo_db):
        save_profile(_flat(10.0), _flat(8.0), "Mi perfil")
        profile = get_active_profile()
        assert profile["weekday"][0] == pytest.approx(10.0)


# ─────────────────────────────────────────────────────────────────────────────
# Guardar perfil
# ─────────────────────────────────────────────────────────────────────────────

class TestGuardarPerfil:

    def test_guardar_retorna_nombre(self, mongo_db):
        result = save_profile(_flat(5.0), _flat(4.0), "Perfil CUJAE")
        assert result["name"] == "Perfil CUJAE"

    def test_guardar_persiste_weekday(self, mongo_db):
        result = save_profile(_flat(7.5), _flat(4.0))
        assert result["weekday"][0] == pytest.approx(7.5)

    def test_guardar_persiste_weekend(self, mongo_db):
        result = save_profile(_flat(5.0), _flat(4.2))
        assert result["weekend"][0] == pytest.approx(4.2)

    def test_guardar_marca_como_activo(self, mongo_db):
        result = save_profile(_flat(), _flat())
        assert result["isActive"] is True

    def test_guardar_desactiva_perfil_anterior(self, mongo_db):
        save_profile(_flat(5.0), _flat(5.0), "Primero")
        save_profile(_flat(8.0), _flat(8.0), "Segundo")
        profile = get_active_profile()
        assert profile["name"] == "Segundo"

    def test_guardar_redondea_a_2_decimales(self, mongo_db):
        weekday = [3.14159] * 24
        result = save_profile(weekday, _flat())
        assert result["weekday"][0] == pytest.approx(3.14, abs=0.005)

    def test_guardar_createdAt_presente(self, mongo_db):
        result = save_profile(_flat(), _flat())
        assert result["createdAt"] is not None

    # ── Validaciones ──────────────────────────────────────────────────────────

    def test_weekday_con_23_valores_lanza_error(self, mongo_db):
        with pytest.raises(ValueError, match="24"):
            save_profile([5.0] * 23, _flat())

    def test_weekday_con_25_valores_lanza_error(self, mongo_db):
        with pytest.raises(ValueError, match="24"):
            save_profile([5.0] * 25, _flat())

    def test_weekend_con_menos_valores_lanza_error(self, mongo_db):
        with pytest.raises(ValueError, match="24"):
            save_profile(_flat(), [5.0] * 10)

    def test_valor_negativo_en_weekday_lanza_error(self, mongo_db):
        weekday = _flat()
        weekday[5] = -1.0
        with pytest.raises(ValueError):
            save_profile(weekday, _flat())

    def test_valor_negativo_en_weekend_lanza_error(self, mongo_db):
        weekend = _flat()
        weekend[12] = -0.5
        with pytest.raises(ValueError):
            save_profile(_flat(), weekend)

    def test_cero_es_valido(self, mongo_db):
        weekday = _flat(0.0)
        result = save_profile(weekday, _flat())
        assert result["weekday"][0] == pytest.approx(0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Modelo de confianza
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeConfianza:

    def test_hora_pico_dia_laboral_tiene_confianza_base(self):
        c = _compute_confidence(10, is_weekend=False, month=3)
        assert c == pytest.approx(0.70, abs=0.01)

    def test_hora_nocturna_reduce_confianza(self):
        base = _compute_confidence(10, False, 3)
        night = _compute_confidence(2, False, 3)
        assert night < base

    def test_hora_transicion_reduce_confianza(self):
        base = _compute_confidence(11, False, 3)
        transition = _compute_confidence(8, False, 3)
        assert transition < base

    def test_fin_de_semana_reduce_confianza(self):
        weekday = _compute_confidence(10, False, 3)
        weekend = _compute_confidence(10, True, 3)
        assert weekend < weekday

    def test_mes_verano_reduce_confianza(self):
        winter = _compute_confidence(10, False, 1)
        summer = _compute_confidence(10, False, 7)
        assert summer < winter

    def test_confianza_no_baja_de_0_50(self):
        c = _compute_confidence(3, True, 7)  # noche + finde + verano
        assert c >= 0.50

    def test_confianza_no_sube_de_0_88(self):
        c = _compute_confidence(10, False, 3)
        assert c <= 0.88


# ─────────────────────────────────────────────────────────────────────────────
# Predicción desde perfil
# ─────────────────────────────────────────────────────────────────────────────

class TestPredictFromProfile:

    def _make_profile(self, value=10.0):
        return {
            "weekday": [value] * 24,
            "weekend": [value / 2] * 24,
        }

    def test_prediccion_contiene_campos_requeridos(self):
        profile = self._make_profile()
        dt = datetime(2024, 6, 17, 14)  # Monday
        result = predict_from_profile(profile, dt)
        for field in ["datetime", "consumption_kw", "confidence", "confidence_pct", "hour", "is_weekend"]:
            assert field in result

    def test_prediccion_weekday_usa_perfil_laboral(self):
        profile = self._make_profile(10.0)
        dt = datetime(2024, 6, 17, 12)  # Monday
        result = predict_from_profile(profile, dt)
        assert result["consumption_kw"] == pytest.approx(10.0)
        assert result["is_weekend"] is False

    def test_prediccion_weekend_usa_perfil_finde(self):
        profile = self._make_profile(10.0)
        dt = datetime(2024, 6, 15, 12)  # Saturday
        result = predict_from_profile(profile, dt)
        assert result["consumption_kw"] == pytest.approx(5.0)
        assert result["is_weekend"] is True

    def test_prediccion_hora_correcta(self):
        profile = self._make_profile()
        dt = datetime(2024, 6, 17, 9)
        result = predict_from_profile(profile, dt)
        assert result["hour"] == 9

    def test_confidence_pct_es_floor_de_confidence(self):
        profile = self._make_profile()
        dt = datetime(2024, 6, 17, 10)
        result = predict_from_profile(profile, dt)
        import math
        assert result["confidence_pct"] == math.floor(result["confidence"] * 100)


# ─────────────────────────────────────────────────────────────────────────────
# Predicciones para fechas concretas y rangos
# ─────────────────────────────────────────────────────────────────────────────

class TestPredictForDate:

    def test_predict_for_date_devuelve_24_predicciones_por_defecto(self, mongo_db):
        results = predict_for_date("2024-06-17")
        assert len(results) == 24

    def test_predict_for_date_horas_especificas(self, mongo_db):
        results = predict_for_date("2024-06-17", hours=[8, 12, 18])
        assert len(results) == 3
        assert {r["hour"] for r in results} == {8, 12, 18}

    def test_predict_for_date_lunes_es_dia_laboral(self, mongo_db):
        results = predict_for_date("2024-06-17", hours=[10])  # Monday
        assert results[0]["is_weekend"] is False

    def test_predict_for_date_sabado_es_finde(self, mongo_db):
        results = predict_for_date("2024-06-15", hours=[10])  # Saturday
        assert results[0]["is_weekend"] is True


class TestPredictDateRange:

    def test_predict_date_range_un_dia_devuelve_24(self, mongo_db):
        results = predict_date_range("2024-06-17", "2024-06-17")
        assert len(results) == 24

    def test_predict_date_range_dos_dias_devuelve_48(self, mongo_db):
        results = predict_date_range("2024-06-17", "2024-06-18")
        assert len(results) == 48

    def test_predict_date_range_semana_devuelve_168(self, mongo_db):
        results = predict_date_range("2024-06-17", "2024-06-23")
        assert len(results) == 7 * 24


class TestPredictNextHours:

    def test_predict_next_hours_devuelve_24_por_defecto(self, mongo_db):
        results = predict_next_hours()
        assert len(results) == 24

    def test_predict_next_hours_parametro_n(self, mongo_db):
        results = predict_next_hours(hours=6)
        assert len(results) == 6

    def test_todos_los_consumos_son_no_negativos(self, mongo_db):
        results = predict_next_hours()
        for r in results:
            assert r["consumption_kw"] >= 0.0
