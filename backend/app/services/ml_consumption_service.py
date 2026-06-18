"""
Machine Learning Consumption Model Service - Loads and manages the consumption prediction model.
"""
import joblib
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd


class MLConsumptionService:
    """Service for loading and managing ML models for consumption prediction."""

    def __init__(self):
        self.model: Optional[Any] = None
        self.config: Optional[Dict[str, Any]] = None
        self.model_loaded: bool = False
        self.models_dir = Path(__file__).parent.parent.parent / "models"

    def load_model(self) -> None:
        """
        Load the trained consumption prediction ML model and its configuration.

        Raises:
            FileNotFoundError: If model files are not found
            RuntimeError: If model loading fails
        """
        try:
            # Construct file paths
            model_path = self.models_dir / "consumo_random_forest.pkl"
            config_path = self.models_dir / "config_consumo.pkl"

            # Check if model file exists
            if not model_path.exists():
                raise FileNotFoundError(
                    f"Consumption model file not found: {model_path}. "
                    f"Please train the model by running the notebook at "
                    f"backend/notebooks/06_prediccion_consumo.ipynb"
                )

            # Load model
            print(f"Loading consumption ML model from: {model_path}")
            self.model = joblib.load(model_path)

            # Load configuration
            if config_path.exists():
                print(f"Loading consumption model config from: {config_path}")
                self.config = joblib.load(config_path)
                print(f"Consumption model metadata loaded:")
                print(f"  Model: {self.config.get('nombre_modelo')}")
                print(f"  Test R²: {self.config.get('metricas', {}).get('r2_test', 'N/A')}")
                print(f"  Test MAE: {self.config.get('metricas', {}).get('mae_test', 'N/A')} kW")
                print(f"  Test RMSE: {self.config.get('metricas', {}).get('rmse_test', 'N/A')} kW")
                print(f"  Features: {len(self.config.get('features', []))}")
                print(f"  Default Campus ID: {self.config.get('campus_id_default')}")
                print(f"  Default Meter ID: {self.config.get('meter_id_default')}")
            else:
                print(f"⚠️  Warning: Config file not found: {config_path}")
                # Default configuration based on notebook
                self.config = {
                    "nombre_modelo": "Random Forest",
                    "features": [
                        "hora", "diaSemana", "mes", "diaDelMes", "semanaDelAnio",
                        "esFinDeSemana", "esDiaHabil", "esHoraPico", "esHoraNocturna", "esHoraLaboral",
                        "hora_sin", "hora_cos", "mes_sin", "mes_cos", "diaSemana_sin", "diaSemana_cos",
                        "campus_id", "meter_id"
                    ],
                    "target": "consumo_promedio",
                    "campus_id_default": 1,
                    "meter_id_default": 55
                }

            self.model_loaded = True
            print(f"✓ Consumption ML model loaded successfully")

        except FileNotFoundError as e:
            print(f"❌ Error loading consumption model: {e}")
            raise
        except Exception as e:
            print(f"❌ Error loading consumption model: {e}")
            raise RuntimeError(f"Failed to load consumption ML model: {e}")

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        """
        Make consumption predictions using the loaded model.

        Args:
            features: DataFrame with features matching the model's expected input

        Returns:
            Array of predictions (consumption in kW)

        Raises:
            RuntimeError: If model is not loaded or prediction fails
        """
        if not self.model_loaded or self.model is None:
            raise RuntimeError(
                "Consumption model not loaded. Call load_model() first or check if model file exists."
            )

        try:
            # Ensure features are in the correct order
            if self.config:
                expected_features = self.config.get("features", [])
                features = features[expected_features]

            # Make predictions
            predictions = self.model.predict(features)

            # Ensure non-negative predictions
            predictions = np.maximum(predictions, 0)

            return predictions

        except Exception as e:
            raise RuntimeError(f"Consumption prediction failed: {e}")

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded consumption model.

        Returns:
            Dictionary with model metadata
        """
        if not self.model_loaded:
            return {
                "loaded": False,
                "message": "Consumption model not loaded"
            }

        metricas = self.config.get("metricas", {}) if self.config else {}

        return {
            "loaded": True,
            "model_name": self.config.get("nombre_modelo") if self.config else "unknown",
            "test_r2": metricas.get("r2_test"),
            "test_mae": metricas.get("mae_test"),
            "test_rmse": metricas.get("rmse_test"),
            "features": self.config.get("features") if self.config else [],
            "training_date": self.config.get("fecha_entrenamiento") if self.config else None,
            "campus_id_default": self.config.get("campus_id_default") if self.config else None,
            "meter_id_default": self.config.get("meter_id_default") if self.config else None,
        }

    def get_default_campus_id(self) -> int:
        """
        Return campus_id to feed the model.
        Prefers env override (settings.ML_CONSUMPTION_CAMPUS_ID), then the value
        the model was trained with, then 1.
        """
        from app.config import settings
        if settings.ML_CONSUMPTION_CAMPUS_ID is not None:
            return settings.ML_CONSUMPTION_CAMPUS_ID
        if not self.config:
            return 1
        return self.config.get("campus_id_default", 1)

    def get_default_meter_id(self) -> int:
        """
        Return meter_id to feed the model.
        Prefers env override (settings.ML_CONSUMPTION_METER_ID), then the value
        the model was trained with, then 55.
        """
        from app.config import settings
        if settings.ML_CONSUMPTION_METER_ID is not None:
            return settings.ML_CONSUMPTION_METER_ID
        if not self.config:
            return 55
        return self.config.get("meter_id_default", 55)


# Global singleton instance
ml_consumption_service = MLConsumptionService()
