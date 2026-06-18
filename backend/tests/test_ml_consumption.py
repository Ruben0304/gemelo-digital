"""
Pruebas unitarias para los resolvers GraphQL de predicción de consumo energético ML.

Cubre:
- mlConsumptionModelInfo: estado del modelo (cargado / no cargado)
- mlPredictConsumption: predicciones para datetimes específicos
- mlPredictConsumptionNextHours: predicciones para las próximas N horas
- mlPredictConsumptionDateRange: predicciones para un rango de fechas
- mlPredictConsumptionForHours: predicciones para horas específicas de un día
"""
import asyncio
import pytest

from app.schema import schema
from app.services.ml_consumption_service import ml_consumption_service


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def gql_async(query, variables=None, context=None):
    ctx = context or {"current_user": None, "request": None}

    async def _run():
        result = await schema.execute(
            query,
            variable_values=variables or {},
            context_value=ctx,
        )
        return {
            "data": result.data or {},
            "errors": [{"message": str(e)} for e in (result.errors or [])],
        }

    return asyncio.run(_run())


def _make_prediction(dt: str, kw: float = 3.5) -> dict:
    return {"datetime": dt, "consumption_kw": kw}


def _async_mock(return_value):
    async def _mock(*args, **kwargs):
        return return_value
    return _mock


# ─────────────────────────────────────────────────────────────────────────────
# mlConsumptionModelInfo
# ─────────────────────────────────────────────────────────────────────────────

class TestMlConsumptionModelInfo:

    QUERY = """
        query {
            mlConsumptionModelInfo {
                loaded
                modelName
                testRmse
                testR2
                testMae
                features
                trainingDate
                campusIdDefault
                meterIdDefault
                message
                trainingDataset
                scaleDivisor
                isDemo
            }
        }
    """

    def test_modelo_no_cargado(self, monkeypatch):
        monkeypatch.setattr(
            ml_consumption_service,
            "get_model_info",
            lambda: {"loaded": False, "message": "Consumption model not loaded"},
        )
        monkeypatch.setattr(ml_consumption_service, "get_default_campus_id", lambda: 1)
        monkeypatch.setattr(ml_consumption_service, "get_default_meter_id", lambda: 55)

        result = gql_async(self.QUERY)

        assert result["errors"] == []
        info = result["data"]["mlConsumptionModelInfo"]
        assert info["loaded"] is False
        assert info["message"] == "Consumption model not loaded"

    def test_modelo_cargado(self, monkeypatch):
        monkeypatch.setattr(
            ml_consumption_service,
            "get_model_info",
            lambda: {
                "loaded": True,
                "model_name": "consumo_rf_v1",
                "test_r2": 0.89,
                "test_mae": 1.2,
                "test_rmse": 2.1,
                "features": ["hora", "diaSemana"],
                "training_date": "2025-03-01",
                "campus_id_default": 1,
                "meter_id_default": 55,
            },
        )
        monkeypatch.setattr(ml_consumption_service, "get_default_campus_id", lambda: 1)
        monkeypatch.setattr(ml_consumption_service, "get_default_meter_id", lambda: 55)

        result = gql_async(self.QUERY)

        assert result["errors"] == []
        info = result["data"]["mlConsumptionModelInfo"]
        assert info["loaded"] is True
        assert info["modelName"] == "consumo_rf_v1"
        assert info["testR2"] == pytest.approx(0.89)
        assert info["testMae"] == pytest.approx(1.2)
        assert info["testRmse"] == pytest.approx(2.1)
        assert "hora" in info["features"]
        assert "diaSemana" in info["features"]
        assert info["campusIdDefault"] == 1
        assert info["meterIdDefault"] == 55


# ─────────────────────────────────────────────────────────────────────────────
# mlPredictConsumption
# ─────────────────────────────────────────────────────────────────────────────

class TestMlPredictConsumption:

    QUERY = """
        query($datetimes: [String!]!) {
            mlPredictConsumption(datetimes: $datetimes) {
                datetime
                consumptionKw
            }
        }
    """

    def test_retorna_predicciones(self, monkeypatch):
        fake = [_make_prediction("2026-06-18T12:00:00", 3.5)]
        monkeypatch.setattr("app.schema.predict_consumption", _async_mock(fake))

        result = gql_async(self.QUERY, {"datetimes": ["2026-06-18T12:00:00"]})

        assert result["errors"] == []
        preds = result["data"]["mlPredictConsumption"]
        assert len(preds) == 1

    def test_campos_correctos(self, monkeypatch):
        fake = [_make_prediction("2026-06-18T12:00:00", 3.5)]
        monkeypatch.setattr("app.schema.predict_consumption", _async_mock(fake))

        result = gql_async(self.QUERY, {"datetimes": ["2026-06-18T12:00:00"]})

        assert result["errors"] == []
        pred = result["data"]["mlPredictConsumption"][0]
        assert "datetime" in pred
        assert "consumptionKw" in pred
        assert pred["datetime"] == "2026-06-18T12:00:00"
        # divisor from settings defaults to 10.0 so 3.5 / 10 = 0.35
        assert isinstance(pred["consumptionKw"], float)

    def test_modelo_no_cargado_retorna_lista_vacia(self, monkeypatch):
        monkeypatch.setattr("app.schema.predict_consumption", _async_mock([]))

        result = gql_async(self.QUERY, {"datetimes": ["2026-06-18T12:00:00"]})

        assert result["errors"] == []
        assert result["data"]["mlPredictConsumption"] == []


# ─────────────────────────────────────────────────────────────────────────────
# mlPredictConsumptionNextHours
# ─────────────────────────────────────────────────────────────────────────────

class TestMlPredictConsumptionNextHours:

    QUERY_WITH_HOURS = """
        query($hours: Int!) {
            mlPredictConsumptionNextHours(hours: $hours) {
                datetime
                consumptionKw
            }
        }
    """

    QUERY_DEFAULT = """
        query {
            mlPredictConsumptionNextHours {
                datetime
                consumptionKw
            }
        }
    """

    def test_retorna_n_predicciones(self, monkeypatch):
        fake = [
            _make_prediction(f"2026-06-18T{h:02d}:00:00", 2.0 + h * 0.1)
            for h in range(6)
        ]
        monkeypatch.setattr(
            "app.schema.predict_consumption_next_hours", _async_mock(fake)
        )

        result = gql_async(self.QUERY_WITH_HOURS, {"hours": 6})

        assert result["errors"] == []
        preds = result["data"]["mlPredictConsumptionNextHours"]
        assert len(preds) == 6

    def test_default_24_horas(self, monkeypatch):
        fake = [
            _make_prediction(f"2026-06-18T{h:02d}:00:00", 3.0)
            for h in range(24)
        ]
        monkeypatch.setattr(
            "app.schema.predict_consumption_next_hours", _async_mock(fake)
        )

        result = gql_async(self.QUERY_DEFAULT)

        assert result["errors"] == []
        preds = result["data"]["mlPredictConsumptionNextHours"]
        assert len(preds) == 24


# ─────────────────────────────────────────────────────────────────────────────
# mlPredictConsumptionDateRange
# ─────────────────────────────────────────────────────────────────────────────

class TestMlPredictConsumptionDateRange:

    QUERY = """
        query($startDate: String!, $endDate: String!) {
            mlPredictConsumptionDateRange(startDate: $startDate, endDate: $endDate) {
                datetime
                consumptionKw
            }
        }
    """

    def test_retorna_predicciones_para_rango(self, monkeypatch):
        # Two days → 49 hours (inclusive from 00:00 to 00:00 next day)
        fake = [
            _make_prediction(f"2026-06-18T{h:02d}:00:00", 4.0)
            for h in range(24)
        ] + [
            _make_prediction(f"2026-06-19T{h:02d}:00:00", 4.5)
            for h in range(24)
        ] + [_make_prediction("2026-06-20T00:00:00", 4.5)]
        monkeypatch.setattr(
            "app.schema.predict_consumption_for_date_range", _async_mock(fake)
        )

        result = gql_async(
            self.QUERY,
            {"startDate": "2026-06-18", "endDate": "2026-06-20"},
        )

        assert result["errors"] == []
        preds = result["data"]["mlPredictConsumptionDateRange"]
        assert len(preds) == 49
        assert all("datetime" in p for p in preds)
        assert all("consumptionKw" in p for p in preds)


# ─────────────────────────────────────────────────────────────────────────────
# mlPredictConsumptionForHours
# ─────────────────────────────────────────────────────────────────────────────

class TestMlPredictConsumptionForHours:

    QUERY = """
        query($date: String!, $hours: [Int!]!) {
            mlPredictConsumptionForHours(date: $date, hours: $hours) {
                datetime
                consumptionKw
            }
        }
    """

    def test_horas_especificas(self, monkeypatch):
        fake = [
            _make_prediction("2026-06-18T08:00:00", 5.1),
            _make_prediction("2026-06-18T12:00:00", 6.3),
        ]
        monkeypatch.setattr(
            "app.schema.predict_consumption_for_specific_hours", _async_mock(fake)
        )

        result = gql_async(
            self.QUERY,
            {"date": "2026-06-18", "hours": [8, 12]},
        )

        assert result["errors"] == []
        preds = result["data"]["mlPredictConsumptionForHours"]
        assert len(preds) == 2
        datetimes = [p["datetime"] for p in preds]
        assert "2026-06-18T08:00:00" in datetimes
        assert "2026-06-18T12:00:00" in datetimes
