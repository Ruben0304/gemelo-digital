#!/usr/bin/env python3
"""Re-siembra: crea activos (con selección _id válida) y re-genera 30 días de histórico."""
import json, urllib.request, pymongo

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

d = gql("""mutation($i:LoginInput!){ loginUser(input:$i){ token } }""",
        {"i": {"email": "demo@microrred.cu", "password": "Demo2026!"}})
TOKEN = d["loginUser"]["token"]
print("login OK")

gql("""mutation($i:PanelInput!){ createPanel(input:$i){ _id ratedPowerKw quantity } }""",
    {"i": {"manufacturer": "Canadian Solar", "model": "CS6R-410MS", "ratedPowerKw": 0.41,
           "quantity": 122, "tiltDegrees": 15, "orientation": "Sur",
           "efficiencyPercent": 21.0, "areaM2": 1.95}})
print("paneles OK (50.0 kW)")

gql("""mutation($i:BatteryInput!){ createBattery(input:$i){ _id capacityKwh } }""",
    {"i": {"manufacturer": "BYD", "model": "Battery-Box Premium HVM", "capacityKwh": 100.0,
           "quantity": 1, "maxDepthOfDischargePercent": 90.0, "chargeRateKw": 25.0,
           "dischargeRateKw": 25.0, "efficiencyPercent": 95.0}})
print("baterías OK (100 kWh)")

gql("""mutation($i:InverterInput!){ createInverter(input:$i){ _id ratedPowerKw } }""",
    {"i": {"manufacturer": "Huawei", "model": "SUN2000-50KTL-M3", "ratedPowerKw": 50.0,
           "quantity": 1, "efficiencyPercent": 98.4}})
print("inversor OK")

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
    gql("""mutation($i:ApplianceInput!){ createAppliance(input:$i){ _id name } }""", {"i": c})
print(f"electrodomésticos OK ({len(cargas)} cargas)")

gql("""mutation($i:BlackoutInput!){ createBlackout(input:$i){ _id date province } }""",
    {"i": {"date": "2026-06-15", "province": "La Habana", "municipality": "Marianao",
           "notes": "Mantenimiento programado de la red de la UNE",
           "intervals": [{"start": "2026-06-15T18:00:00", "end": "2026-06-15T22:00:00"}]}})
print("apagón OK")

# Limpiar lecturas existentes y re-sembrar 30 días continuos
cli = pymongo.MongoClient("mongodb://localhost:27017")
deleted = cli["GemeloDigitalCujai"].lecturas_historicas.delete_many({}).deleted_count
print(f"lecturas previas eliminadas: {deleted}")
d = gql("""mutation{ seedHistoricalData(days:30) }""")
print("histórico sembrado:", d)
print("\\n=== Re-siembra completa ===")
