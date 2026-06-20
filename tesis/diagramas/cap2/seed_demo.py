#!/usr/bin/env python3
"""Siembra datos demo realistas vía GraphQL (microrred 50 kW / 100 kWh, La Habana)."""
import json, urllib.request

URL = "http://localhost:8001/graphql"
TOKEN = None

def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(URL, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    if data.get("errors"):
        print("  ! errores:", json.dumps(data["errors"])[:300])
    return data.get("data")

# 1) Login admin
d = gql("""mutation($i:LoginInput!){ loginUser(input:$i){ token user{ email role } } }""",
        {"i": {"email": "demo@microrred.cu", "password": "Demo2026!"}})
TOKEN = d["loginUser"]["token"]
print("login OK:", d["loginUser"]["user"])

# 2) Ubicación
gql("""mutation($i:LocationConfigInput!){ saveLocationConfig(input:$i){ name lat lon } }""",
    {"i": {"lat": 23.1136, "lon": -82.3666, "name": "CUJAE, La Habana"}})
print("ubicación OK")

# 3) Paneles (≈50 kW)
gql("""mutation($i:PanelInput!){ createPanel(input:$i){ id manufacturer ratedPowerKw quantity } }""",
    {"i": {"manufacturer": "Canadian Solar", "model": "CS6R-410MS", "ratedPowerKw": 0.41,
           "quantity": 122, "tiltDegrees": 15, "orientation": "Sur",
           "efficiencyPercent": 21.0, "areaM2": 1.95}})
print("paneles OK (50.0 kW)")

# 4) Baterías (100 kWh)
gql("""mutation($i:BatteryInput!){ createBattery(input:$i){ id manufacturer capacityKwh } }""",
    {"i": {"manufacturer": "BYD", "model": "Battery-Box Premium HVM", "capacityKwh": 100.0,
           "quantity": 1, "maxDepthOfDischargePercent": 90.0, "chargeRateKw": 25.0,
           "dischargeRateKw": 25.0, "efficiencyPercent": 95.0}})
print("baterías OK (100 kWh)")

# 5) Inversor
gql("""mutation($i:InverterInput!){ createInverter(input:$i){ id manufacturer ratedPowerKw } }""",
    {"i": {"manufacturer": "Huawei", "model": "SUN2000-50KTL-M3", "ratedPowerKw": 50.0,
           "quantity": 1, "efficiencyPercent": 98.4}})
print("inversor OK")

# 6) Electrodomésticos / cargas del campus
cargas = [
    {"name": "Iluminación LED (aulas)", "category": "Iluminación", "averagePowerW": 4200,
     "maxPowerW": 5000, "quantity": 1, "activeHours": 12, "alwaysOn": True},
    {"name": "Aire acondicionado", "category": "Climatización", "averagePowerW": 3500,
     "maxPowerW": 5200, "quantity": 6, "activeHours": 8, "alwaysOn": False,
     "selectedModeIndex": 1,
     "modes": [{"name": "Eco", "averagePowerW": 2800, "maxPowerW": 4000},
               {"name": "Normal", "averagePowerW": 3500, "maxPowerW": 5200}]},
    {"name": "Computadoras de laboratorio", "category": "Cómputo", "averagePowerW": 5000,
     "maxPowerW": 7000, "quantity": 1, "activeHours": 9, "alwaysOn": False},
    {"name": "Bombas de agua", "category": "Bombeo", "averagePowerW": 2200,
     "maxPowerW": 3000, "quantity": 2, "activeHours": 4, "alwaysOn": False},
    {"name": "Refrigeración (cafetería)", "category": "Refrigeración", "averagePowerW": 1800,
     "maxPowerW": 2400, "quantity": 1, "activeHours": 24, "alwaysOn": True},
]
for c in cargas:
    gql("""mutation($i:ApplianceInput!){ createAppliance(input:$i){ id name } }""", {"i": c})
print(f"electrodomésticos OK ({len(cargas)} cargas)")

# 7) Perfil de consumo (kW por hora, día lectivo vs fin de semana)
weekday = [6,5,5,5,6,8,12,18,24,30,34,36,33,30,32,34,30,24,20,16,13,10,8,7]
weekend = [5,4,4,4,4,5,6,8,10,12,14,15,14,13,13,14,12,10,9,8,7,6,6,5]
gql("""mutation($w:[Float!]!,$e:[Float!]!,$n:String){ saveConsumptionProfile(weekday:$w, weekend:$e, name:$n){ name } }""",
    {"w": [float(x) for x in weekday], "e": [float(x) for x in weekend], "n": "Campus CUJAE"})
print("perfil de consumo OK")

# 8) Apagón programado de ejemplo
gql("""mutation($i:BlackoutInput!){ createBlackout(input:$i){ id date province } }""",
    {"i": {"date": "2026-06-15", "province": "La Habana", "municipality": "Marianao",
           "notes": "Mantenimiento programado de la red de la UNE",
           "intervals": [{"start": "2026-06-15T18:00:00", "end": "2026-06-15T22:00:00"}]}})
print("apagón OK")

# 9) Histórico (30 días de lecturas)
d = gql("""mutation{ seedHistoricalData(days:30) }""")
print("histórico sembrado:", d)

print("\\n=== Siembra completa ===")
