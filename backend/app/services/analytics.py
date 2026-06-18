"""
Utility calculations for system metrics and energy flow.
"""
from __future__ import annotations

from typing import Dict, List


def calculate_system_metrics(current: Dict[str, float], historical: List[Dict[str, float]]) -> Dict[str, float]:
    production = current["production"]
    consumption = current["consumption"]
    efficiency = current["efficiency"]
    energy_balance = production - consumption

    daily_production = sum(item["production"] for item in historical)
    daily_consumption = sum(item["consumption"] for item in historical)
    co2_avoided = daily_production * 0.5

    return {
        "currentProduction": round(production, 2),
        "currentConsumption": round(consumption, 2),
        "energyBalance": round(energy_balance, 2),
        "systemEfficiency": round(efficiency, 2),
        "dailyProduction": round(daily_production, 2),
        "dailyConsumption": round(daily_consumption, 2),
        "co2Avoided": round(co2_avoided, 2),
    }


def calculate_energy_flow(
    production: float,
    consumption: float,
    battery_charging: bool,
    battery_power_flow: float,
) -> Dict[str, float]:
    solar_to_battery = 0.0
    solar_to_load = 0.0
    solar_to_grid = 0.0
    battery_to_load = 0.0
    grid_to_load = 0.0

    surplus = production - consumption
    if surplus > 0:
        solar_to_load = consumption
        if battery_charging and battery_power_flow > 0:
            solar_to_battery = min(surplus, abs(battery_power_flow))
            solar_to_grid = surplus - solar_to_battery
        else:
            solar_to_grid = surplus
    else:
        solar_to_load = production
        deficit = abs(surplus)
        if not battery_charging and battery_power_flow < 0:
            battery_to_load = min(deficit, abs(battery_power_flow))
            grid_to_load = deficit - battery_to_load
        else:
            grid_to_load = deficit

    return {
        "solarToBattery": round(solar_to_battery, 2),
        "solarToLoad": round(solar_to_load, 2),
        "solarToGrid": round(solar_to_grid, 2),
        "batteryToLoad": round(battery_to_load, 2),
        "gridToLoad": round(grid_to_load, 2),
    }

