# Mock Weather Station Server

Servidor FastAPI independiente que simula una estación meteorológica externa con datos **adversos para generación fotovoltaica** (alta nubosidad, lluvia, baja irradiancia).

Sirve para probar la integración de **fuentes de clima externas** en el Gemelo Digital.

---

## Arrancar el servidor

```bash
cd mock_weather_server

# Crear entorno virtual (solo la primera vez)
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

pip install -r requirements.txt

# Arrancar en puerto 8001
uvicorn main:app --reload --port 8001
```

Swagger UI disponible en: http://localhost:8001/docs

---

## Autenticación

**Obtener token:**
```bash
curl -X POST http://localhost:8001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "cujae2024"}'
```
Respuesta:
```json
{ "access_token": "mock-jwt-cujae-2024-secret", "token_type": "bearer", ... }
```

**Credenciales válidas:**
| Usuario | Contraseña |
|---------|-----------|
| admin   | cujae2024 |
| gemelo  | digital   |
| user    | weather123 |

**Usar el token:**
```bash
curl http://localhost:8001/weather \
  -H "Authorization: Bearer mock-jwt-cujae-2024-secret"
```

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/token` | No | Obtener token JWT |
| GET | `/weather` | Sí | Datos completos (usar este en el gemelo) |
| GET | `/weather/current` | Sí | Solo condiciones actuales |
| GET | `/weather/forecast` | Sí | Solo pronóstico 7 días |
| GET | `/weather/history` | Sí | Lecturas últimas 24 h |
| GET | `/weather/alerts` | Sí | Alertas activas |
| GET | `/health` | No | Estado del servidor |

---

## Configurar en el Gemelo Digital

**Ajustes → Fuente de clima → Nueva fuente**

| Campo | Valor |
|-------|-------|
| Nombre | Estación CUJAE Mock |
| URL base | `http://localhost:8001/weather` |
| Tipo de auth | `bearer` |
| Token | `mock-jwt-cujae-2024-secret` |
| Query params | `{}` |

**Field Mapping** (copiar tal cual):
```json
{
  "temperaturePath":            "conditions.temperature_c",
  "humidityPath":               "conditions.humidity_pct",
  "cloudCoverPath":             "conditions.cloud_cover_pct",
  "windSpeedPath":              "conditions.wind_speed_kmh",
  "solarRadiationPath":         "conditions.solar_irradiance_wm2",
  "descriptionPath":            "conditions.description",
  "forecastArrayPath":          "forecast.days",
  "forecastDatePath":           "date",
  "forecastMaxTempPath":        "temp_max_c",
  "forecastMinTempPath":        "temp_min_c",
  "forecastSolarRadiationPath": "solar_radiation_wm2",
  "forecastCloudCoverPath":     "cloud_cover_pct",
  "forecastConditionPath":      "condition"
}
```

También puedes usar el botón **"Probar y detectar campos"** en la UI para que el sistema detecte los campos automáticamente.

---

## Datos simulados

Los datos rotan cada 15 minutos entre 4 escenarios adversos:

| Escenario | Nubosidad | Irradiancia | Precipitación |
|-----------|-----------|-------------|---------------|
| Tormenta eléctrica | 97% | 12 W/m² | 22 mm/h |
| Lluvia moderada | 89% | 48 W/m² | 9.8 mm/h |
| Nublado total | 93% | 72 W/m² | 2.1 mm/h |
| Muy nublado | 84% | 115 W/m² | 0.4 mm/h |

Pronóstico 7 días: todos con condiciones de lluvia o nubosidad total.

Para comparación, condiciones óptimas FV serían: nubosidad <10%, irradiancia >900 W/m².
