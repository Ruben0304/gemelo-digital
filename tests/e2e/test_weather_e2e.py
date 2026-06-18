"""
Test End-to-End: Cambio de fuente meteorológica Open-Meteo → API propia

Prueba COMPLETA contra servidores reales:
  - Backend:       http://localhost:8000  (FastAPI + GraphQL)
  - Mock Climate:  http://localhost:8001  (servidor_clima_mock/main.py)
  - MongoDB:       GemeloDigitalCujai

Flujo probado:
  1. Estado inicial: Open-Meteo activo (sol, alta irradiancia)
  2. Verificar que el mock server responde con Bearer auth
  3. testWeatherSource — validar la fuente antes de guardar
  4. Guardar la fuente propia
  5. Activar la fuente propia
  6. Verificar que weather query ahora usa datos adversos del mock
  7. Comparar métricas: irradiancia, nubosidad, temperatura, proveedor
  8. Eliminar la fuente → sistema vuelve a Open-Meteo
"""

import sys
import json
import urllib.request
import urllib.error

BACKEND = "http://localhost:8000/graphql"
MOCK = "http://localhost:8001"

PASS = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
INFO = "\033[36mℹ\033[0m"
BOLD = "\033[1m"
RESET = "\033[0m"

results = []
_auth_token = None


def gql(query, variables=None, auth=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {auth}"
    req = urllib.request.Request(BACKEND, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def http_get(url, auth_bearer=None):
    headers = {}
    if auth_bearer:
        headers["Authorization"] = f"Bearer {auth_bearer}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def http_post(url, body_dict, auth_bearer=None):
    body = json.dumps(body_dict).encode()
    headers = {"Content-Type": "application/json"}
    if auth_bearer:
        headers["Authorization"] = f"Bearer {auth_bearer}"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def check(label, condition, info=""):
    status = PASS if condition else FAIL
    results.append((label, condition))
    extra = f"  {INFO} {info}" if info else ""
    print(f"  {status} {label}{extra}")
    return condition


def section(title):
    print(f"\n{BOLD}{'━'*60}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'━'*60}{RESET}")


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 1 — Estado inicial con Open-Meteo
# ═══════════════════════════════════════════════════════════════
section("1. Estado inicial — Open-Meteo como fuente activa")

initial = gql("""
{
  weather {
    temperature solarRadiation cloudCover humidity windSpeed
    provider locationName lastUpdated
    forecast { date maxTemp minTemp solarRadiation condition predictedProduction }
  }
}
""")

errors = initial.get("errors")
if errors:
    print(f"  {FAIL} Error en weather query inicial: {errors}")
    sys.exit(1)

w0 = initial["data"]["weather"]
print(f"  {INFO} Proveedor actual: {w0['provider']}")
print(f"  {INFO} Temperatura:      {w0['temperature']}°C")
print(f"  {INFO} Irradiancia:      {w0['solarRadiation']} W/m²")
print(f"  {INFO} Nubosidad:        {w0['cloudCover']}%")
print(f"  {INFO} Pronóstico días:  {len(w0['forecast'])}")

check("Open-Meteo es la fuente inicial", "Open-Meteo" in w0["provider"], w0["provider"])
check("Temperatura razonable (10–50°C)", 10 <= w0["temperature"] <= 50, f"{w0['temperature']}°C")
check("Irradiancia presente (> 0)", w0["solarRadiation"] is not None and w0["solarRadiation"] >= 0)
check("Pronóstico tiene 7 días", len(w0["forecast"]) == 7, f"{len(w0['forecast'])} días")
check("predictedProduction en pronóstico", all(d["predictedProduction"] >= 0 for d in w0["forecast"]))

initial_irradiance = w0["solarRadiation"]
initial_cloudcover = w0["cloudCover"]


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 2 — Verificar mock weather server directamente
# ═══════════════════════════════════════════════════════════════
section("2. Mock Weather Server — verificación directa")

mock_health = http_get(f"{MOCK}/health")
check("GET /health responde ok", mock_health["status"] == "ok")

# Sin token → 401
try:
    http_get(f"{MOCK}/weather")
    check("Sin token → rechazado", False, "debía rechazar")
except urllib.error.HTTPError as e:
    check("Sin token → 401 Unauthorized", e.code == 401, f"HTTP {e.code}")

# Con credenciales incorrectas → 401
try:
    http_post(f"{MOCK}/auth/token", {"username": "admin", "password": "INCORRECTA"})
    check("Creds incorrectas → rechazadas", False)
except urllib.error.HTTPError as e:
    check("Creds incorrectas → 401", e.code == 401, f"HTTP {e.code}")

# Login en el mock server
token_resp = http_post(f"{MOCK}/auth/token", {"username": "admin", "password": "cujae2024"})
MOCK_TOKEN = token_resp["access_token"]
check("POST /auth/token devuelve access_token", bool(MOCK_TOKEN))
check("station_id correcto", token_resp.get("station_id") == "CU-HAV-CUJAE-001")

# Datos con token válido
mock_data = http_get(f"{MOCK}/weather", auth_bearer=MOCK_TOKEN)
print(f"  {INFO} Escenario activo:  {mock_data['meta']['scenario_active']}")
print(f"  {INFO} Temperatura mock:  {mock_data['conditions']['temperature_c']}°C")
print(f"  {INFO} Irradiancia mock:  {mock_data['conditions']['solar_irradiance_wm2']} W/m²")
print(f"  {INFO} Nubosidad mock:    {mock_data['conditions']['cloud_cover_pct']}%")
print(f"  {INFO} Precipitación:     {mock_data['conditions']['precipitation_mm_h']} mm/h")

check("Datos con token válido recibidos", "conditions" in mock_data)
check("Datos adversos: nubosidad > 70%",
      mock_data["conditions"]["cloud_cover_pct"] > 70,
      f"{mock_data['conditions']['cloud_cover_pct']}%")
check("Datos adversos: irradiancia < 200 W/m²",
      mock_data["conditions"]["solar_irradiance_wm2"] < 200,
      f"{mock_data['conditions']['solar_irradiance_wm2']} W/m²")
check("Mock tiene pronóstico 7 días", len(mock_data["forecast"]["days"]) == 7)
check("Mock tiene solar_impact con alert", "alert" in mock_data.get("solar_impact", {}))
check("Alerta solar presente",
      mock_data.get("solar_impact", {}).get("alert") in ("ADVERSO", "REDUCIDO"))

# Endpoints alternativos
current_only = http_get(f"{MOCK}/weather/current", auth_bearer=MOCK_TOKEN)
check("GET /weather/current responde", "conditions" in current_only)

forecast_only = http_get(f"{MOCK}/weather/forecast", auth_bearer=MOCK_TOKEN)
check("GET /weather/forecast tiene 7 días", len(forecast_only["forecast"]["days"]) == 7)

history = http_get(f"{MOCK}/weather/history", auth_bearer=MOCK_TOKEN)
check("GET /weather/history tiene 24 lecturas", len(history["history"]) == 24)
check("Historial: irradiancia 0 de noche",
      any(h["solar_irradiance_wm2"] == 0 for h in history["history"]))

alerts = http_get(f"{MOCK}/weather/alerts", auth_bearer=MOCK_TOKEN)
check("GET /weather/alerts tiene alertas", len(alerts["alerts"]) > 0)
check("Alerta de reducción solar presente",
      any("solar" in a["type"] for a in alerts["alerts"]))

mock_server_temp = mock_data["conditions"]["temperature_c"]
mock_server_irr = mock_data["conditions"]["solar_irradiance_wm2"]
mock_server_cloud = mock_data["conditions"]["cloud_cover_pct"]
mock_server_humidity = mock_data["conditions"]["humidity_pct"]


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 3 — Login en el backend
# ═══════════════════════════════════════════════════════════════
section("3. Autenticación en el backend principal")

login_result = gql(
    """mutation Login($input: LoginInput!) {
         loginUser(input: $input) { token user { _id email role } }
       }""",
    variables={"input": {"email": "admin@cujae.cu", "password": "Admin1234!"}},
)
_auth_token = login_result["data"]["loginUser"]["token"]
user_email = login_result["data"]["loginUser"]["user"]["email"]
user_role = login_result["data"]["loginUser"]["user"]["role"]

print(f"  {INFO} Usuario: {user_email} ({user_role})")
check("Login admin exitoso", bool(_auth_token))
check("Rol es admin", user_role == "admin", user_role)

# Verificar que sin token las mutaciones protegidas dan error
no_auth = gql(
    """mutation { generateInvitationCode(role: "user", createdBy: "x") { code } }"""
)
check("Sin token → mutación admin rechazada",
      bool(no_auth.get("errors")),
      no_auth.get("errors", [{}])[0].get("message", "")[:60] if no_auth.get("errors") else "")


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 4 — testWeatherSource (prueba sin guardar)
# ═══════════════════════════════════════════════════════════════
section("4. testWeatherSource — validar fuente sin guardar aún")

FIELD_MAPPING = {
    "temperaturePath":            "conditions.temperature_c",
    "humidityPath":               "conditions.humidity_pct",
    "cloudCoverPath":             "conditions.cloud_cover_pct",
    "windSpeedPath":              "conditions.wind_speed_kmh",
    "solarRadiationPath":         "conditions.solar_irradiance_wm2",
    "forecastArrayPath":          "forecast.days",
    "forecastDatePath":           "date",
    "forecastMaxTempPath":        "temp_max_c",
    "forecastMinTempPath":        "temp_min_c",
    "forecastSolarRadiationPath": "solar_radiation_wm2",
    "forecastCloudCoverPath":     "cloud_cover_pct",
}

SOURCE_INPUT = {
    "name": "Estación CUJAE Mock",
    "baseUrl": "http://localhost:8001/weather",
    "authType": "bearer",
    "authValue": "mock-jwt-cujae-2024-secret",
    "authHeaderName": None,
    "authQueryName": None,
    "queryParams": {},
    "fieldMapping": FIELD_MAPPING,
    "enabled": True,
    "isActive": False,
}

# useMock=false → llama de verdad al mock server
test_result = gql(
    """mutation T($input: WeatherSourceInput!) {
         testWeatherSource(input: $input, useMock: false) {
           success message rawJson
           fields { path valueType sampleValue }
         }
       }""",
    variables={"input": SOURCE_INPUT},
    auth=_auth_token,
)

if test_result.get("errors"):
    print(f"  {FAIL} Error en testWeatherSource: {test_result['errors']}")
    tr = {"success": False, "message": str(test_result["errors"]), "fields": [], "rawJson": "{}"}
else:
    tr = test_result["data"]["testWeatherSource"]

print(f"  {INFO} success:  {tr['success']}")
print(f"  {INFO} message:  {tr['message']}")
print(f"  {INFO} campos detectados: {len(tr['fields'])}")

raw = json.loads(tr["rawJson"]) if tr["rawJson"] else {}

check("testWeatherSource success=True", tr["success"] is True, tr["message"])
check("rawJson contiene datos del mock", "conditions" in raw, list(raw.keys())[:5])
check("rawJson temperatura coincide",
      abs(raw.get("conditions", {}).get("temperature_c", 0) - mock_server_temp) < 2,
      f"rawJson={raw.get('conditions',{}).get('temperature_c')}, mock={mock_server_temp}")
check("Campos detectados >= 5", len(tr["fields"]) >= 5, f"{len(tr['fields'])} campos")

# useMock=true → modo simulado (debe funcionar sin servidor externo)
test_mock_mode = gql(
    """mutation T($input: WeatherSourceInput!) {
         testWeatherSource(input: $input, useMock: true) {
           success message
         }
       }""",
    variables={"input": SOURCE_INPUT},
    auth=_auth_token,
)
tm = test_mock_mode["data"]["testWeatherSource"]
check("testWeatherSource useMock=true también funciona", tm["success"] is True, tm["message"])

# Token incorrecto → el backend recibe 401 y lo reporta (error GraphQL o success=False)
wrong_source = {**SOURCE_INPUT, "authValue": "token-incorrecto"}
test_wrong = gql(
    """mutation T($input: WeatherSourceInput!) {
         testWeatherSource(input: $input, useMock: false) {
           success message
         }
       }""",
    variables={"input": wrong_source},
    auth=_auth_token,
)
# El backend puede reportar el error como errors[] (excepción) o como success=False
wrong_reported_as_error = bool(test_wrong.get("errors"))
wrong_reported_as_fail = (
    test_wrong.get("data", {}) and
    test_wrong["data"].get("testWeatherSource", {}) and
    test_wrong["data"]["testWeatherSource"].get("success") is False
)
check("Token incorrecto → error reportado (401 propagado)",
      wrong_reported_as_error or wrong_reported_as_fail,
      test_wrong.get("errors", [{}])[0].get("message", "")[:60] if wrong_reported_as_error else "")


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 5 — Guardar fuente y activarla
# ═══════════════════════════════════════════════════════════════
section("5. saveWeatherSource + setActiveWeatherSource")

save_result = gql(
    """mutation Save($input: WeatherSourceInput!) {
         saveWeatherSource(input: $input) {
           _id name isActive enabled authType baseUrl
           fieldMapping queryParams
         }
       }""",
    variables={"input": SOURCE_INPUT},
    auth=_auth_token,
)

if save_result.get("errors"):
    print(f"  {FAIL} Error al guardar: {save_result['errors']}")
    sys.exit(1)

saved = save_result["data"]["saveWeatherSource"]
source_id = saved["_id"]
print(f"  {INFO} Fuente creada: {saved['name']}")
print(f"  {INFO} ID:            {source_id}")
print(f"  {INFO} authType:      {saved['authType']}")
print(f"  {INFO} baseUrl:       {saved['baseUrl']}")

check("Fuente guardada con _id", bool(source_id))
check("Nombre correcto", saved["name"] == "Estación CUJAE Mock")
check("authType=bearer", saved["authType"] == "bearer")
check("enabled=True", saved["enabled"] is True)
check("isActive=False al crear", saved["isActive"] is False)
check("fieldMapping guardado", bool(saved["fieldMapping"]))
check("baseUrl guardada", saved["baseUrl"] == "http://localhost:8001/weather")

# Activar la fuente
activate_result = gql(
    """mutation Act($id: String!) { setActiveWeatherSource(id: $id) }""",
    variables={"id": source_id},
    auth=_auth_token,
)

if activate_result.get("errors"):
    print(f"  {FAIL} Error al activar: {activate_result['errors']}")
    sys.exit(1)

activated = activate_result["data"]["setActiveWeatherSource"]
print(f"  {INFO} setActiveWeatherSource retornó: {activated}")
check("setActiveWeatherSource retornó True", activated is True)

# Verificar en la lista de fuentes que está activa
sources_query = gql("{ __type(name: \"WeatherSourceType\") { fields { name } } }")
# Sencillo: checar via weather que ya usa el mock (sección siguiente)


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 6 — Weather query ahora usa el mock (datos adversos)
# ═══════════════════════════════════════════════════════════════
section("6. Weather query — datos del mock (condiciones adversas FV)")

new_weather = gql("""
{
  weather {
    temperature humidity solarRadiation cloudCover windSpeed
    provider locationName lastUpdated
    forecast {
      date maxTemp minTemp solarRadiation cloudCover
      condition predictedProduction
    }
  }
}
""")

if new_weather.get("errors"):
    print(f"  {FAIL} Error: {new_weather['errors']}")
    sys.exit(1)

w1 = new_weather["data"]["weather"]

print(f"\n  {'Campo':<25} {'Open-Meteo':<20} {'Mock CUJAE':<20} {'Diferencia'}")
print(f"  {'─'*80}")
print(f"  {'Proveedor':<25} {initial['data']['weather']['provider'][:18]:<20} {w1['provider'][:18]:<20}")
print(f"  {'Temperatura (°C)':<25} {initial_irradiance if False else w0['temperature']:<20} {w1['temperature']:<20} {abs(w1['temperature'] - w0['temperature']):.1f}°C")
print(f"  {'Irradiancia (W/m²)':<25} {initial_irradiance:<20} {w1['solarRadiation']:<20} {abs(w1['solarRadiation'] - initial_irradiance):.0f} W/m²")
print(f"  {'Nubosidad (%)':<25} {initial_cloudcover:<20} {w1['cloudCover']:<20} {abs(w1['cloudCover'] - initial_cloudcover):.0f}%")
print()

check("Proveedor NO es Open-Meteo",
      "Open-Meteo" not in w1["provider"], w1["provider"])
check("Proveedor es la fuente propia (Estación CUJAE Mock)",
      "Estación CUJAE Mock" in w1["provider"] or "CUJAE" in w1["provider"],
      w1["provider"])

check("Temperatura concuerda con mock (±3°C)",
      abs(w1["temperature"] - mock_server_temp) <= 3,
      f"backend={w1['temperature']}°C, mock={mock_server_temp}°C")

check("Irradiancia concuerda con mock (±50 W/m²)",
      abs(w1["solarRadiation"] - mock_server_irr) <= 50,
      f"backend={w1['solarRadiation']}, mock={mock_server_irr}")

check("Nubosidad concuerda con mock (±10%)",
      abs(w1["cloudCover"] - mock_server_cloud) <= 10,
      f"backend={w1['cloudCover']}%, mock={mock_server_cloud}%")

check("Irradiancia del mock es MENOR que Open-Meteo (datos adversos)",
      w1["solarRadiation"] < initial_irradiance,
      f"mock={w1['solarRadiation']} < openmeteo={initial_irradiance}")

check("Nubosidad del mock es MAYOR que Open-Meteo (datos adversos)",
      w1["cloudCover"] > initial_cloudcover,
      f"mock={w1['cloudCover']}% > openmeteo={initial_cloudcover}%")

check("Pronóstico tiene 7 días", len(w1["forecast"]) == 7)
check("predictedProduction calculada para todos los días",
      all(d["predictedProduction"] >= 0 for d in w1["forecast"]))
check("predictedProduction del mock es MENOR (menos sol)",
      sum(d["predictedProduction"] for d in w1["forecast"]) <
      sum(d["predictedProduction"] for d in w0["forecast"]),
      f"mock_total={sum(d['predictedProduction'] for d in w1['forecast']):.1f} < "
      f"openmeteo_total={sum(d['predictedProduction'] for d in w0['forecast']):.1f}")

check("lastUpdated presente", bool(w1.get("lastUpdated")))
check("locationName presente", bool(w1.get("locationName")))


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 7 — Segunda fuente: solo /weather/current (sin forecast)
# ═══════════════════════════════════════════════════════════════
section("7. Segunda fuente con endpoint distinto (/weather/current)")

SOURCE_CURRENT = {
    "name": "CUJAE Solo Actual",
    "baseUrl": "http://localhost:8001/weather/current",
    "authType": "bearer",
    "authValue": "mock-jwt-cujae-2024-secret",
    "authHeaderName": None,
    "authQueryName": None,
    "queryParams": {},
    "fieldMapping": {
        "temperaturePath":    "conditions.temperature_c",
        "humidityPath":       "conditions.humidity_pct",
        "cloudCoverPath":     "conditions.cloud_cover_pct",
        "windSpeedPath":      "conditions.wind_speed_kmh",
        "solarRadiationPath": "conditions.solar_irradiance_wm2",
    },
    "enabled": True,
    "isActive": False,
}

save_curr = gql(
    """mutation Save($input: WeatherSourceInput!) {
         saveWeatherSource(input: $input) { _id name isActive }
       }""",
    variables={"input": SOURCE_CURRENT},
    auth=_auth_token,
)
curr_id = save_curr["data"]["saveWeatherSource"]["_id"]
check("Segunda fuente guardada", bool(curr_id))

# Activarla (desactiva la primera automáticamente)
gql(
    "mutation { setActiveWeatherSource(id: \"" + curr_id + "\") }",
    auth=_auth_token,
)

weather_curr = gql("{ weather { temperature solarRadiation cloudCover provider } }")
wc = weather_curr["data"]["weather"]
print(f"  {INFO} Proveedor con segunda fuente: {wc['provider']}")
print(f"  {INFO} Temperatura: {wc['temperature']}°C")
# Una fuente sin forecastArrayPath no puede completar el mapeo de pronóstico,
# por lo que el sistema cae a Open-Meteo (fallback esperado).
# El sistema no bloquea — siempre devuelve datos.
check("Temperatura disponible con segunda fuente (no bloquea)", wc["temperature"] is not None)
check("Weather query no falla con fuente parcial (sin forecast map)",
      "error" not in str(wc).lower(), wc["provider"])

# Volver a activar la primera
gql(
    "mutation { setActiveWeatherSource(id: \"" + source_id + "\") }",
    auth=_auth_token,
)

# Limpiar la segunda
gql(
    "mutation { deleteWeatherSource(id: \"" + curr_id + "\") }",
    auth=_auth_token,
)


# ═══════════════════════════════════════════════════════════════
# SECCIÓN 8 — Eliminar fuente propia → volver a Open-Meteo
# ═══════════════════════════════════════════════════════════════
section("8. Eliminar fuente propia → fallback a Open-Meteo")

delete_result = gql(
    """mutation Del($id: String!) { deleteWeatherSource(id: $id) }""",
    variables={"id": source_id},
    auth=_auth_token,
)
deleted = delete_result["data"]["deleteWeatherSource"]
check("deleteWeatherSource retornó True", deleted is True)

# Ahora la query debe caer al fallback (Open-Meteo o datos generados)
restored = gql("""
{ weather { temperature solarRadiation cloudCover provider forecast { date } } }
""")

if restored.get("errors"):
    check("Weather funciona tras eliminar fuente", False, str(restored["errors"]))
else:
    w2 = restored["data"]["weather"]
    print(f"  {INFO} Proveedor restaurado: {w2['provider']}")
    print(f"  {INFO} Irradiancia:          {w2['solarRadiation']} W/m²")

    check("Fuente propia ya no es el proveedor",
          "Estación CUJAE Mock" not in w2["provider"], w2["provider"])
    check("Weather query sigue funcionando", w2["temperature"] is not None)
    check("Pronóstico sigue disponible", len(w2["forecast"]) == 7)
    # La irradiancia debería ser mayor (más sol) sin la fuente adversa
    check("Irradiancia recuperada (mayor sin mock adverso)",
          w2["solarRadiation"] > w1["solarRadiation"],
          f"sin_mock={w2['solarRadiation']} > con_mock={w1['solarRadiation']}")


# ═══════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'═'*60}{RESET}")
print(f"{BOLD}  RESUMEN E2E — CAMBIO DE API METEOROLÓGICA{RESET}")
print(f"{BOLD}{'═'*60}{RESET}")

passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
total = len(results)

print(f"\n  Total:          {total}")
print(f"  {PASS} Pasaron:    {passed}")
if failed:
    print(f"  {FAIL} Fallaron:   {failed}")
    print(f"\n  Tests fallidos:")
    for label, ok in results:
        if not ok:
            print(f"    {FAIL} {label}")

final_status = "✅  TODOS LOS TESTS PASARON" if not failed else "❌  HAY FALLOS"
print(f"\n  {BOLD}{final_status}{RESET}")
print()
sys.exit(0 if not failed else 1)
