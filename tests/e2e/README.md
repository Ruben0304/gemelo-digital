# E2E Tests — Weather Source Switching

End-to-end test that verifies the full flow of switching the meteorological data source from Open-Meteo to a custom API and back.

## Prerequisites

Three services must be running before executing the test:

| Service | Port | Command |
|---|---|---|
| Backend (FastAPI + GraphQL) | 8000 | `uvicorn app.main:app --reload` (from `backend/`) |
| Mock weather server | 8001 | `uvicorn main:app --port 8001` (from `servidor_clima_mock/`) |
| MongoDB | 27017 | database: `GemeloDigitalCujai` |

## Starting the servers

```bash
# Terminal 1 — backend
cd backend
uvicorn app.main:app --reload

# Terminal 2 — mock weather server
cd servidor_clima_mock
uvicorn main:app --port 8001
```

## Running the test

From the project root:

```bash
python tests/e2e/test_weather_e2e.py
```

No external dependencies — uses Python stdlib only (`urllib`, `json`, `sys`).

## What it tests (59 checks across 8 sections)

1. **Initial state** — Open-Meteo is active, returns solar/temperature/forecast data
2. **Mock server auth** — Bearer token flow, rejects missing/wrong credentials
3. **testWeatherSource** — validates a new source without saving it; tests `useMock` flag
4. **saveWeatherSource** — persists the custom source, verifies stored fields
5. **setActiveWeatherSource** — activates the source, verifies the switch
6. **Weather data comparison** — backend now returns mock data (adverse: high cloud cover, low irradiance)
7. **Second source** — partial field mapping (no forecast path), verifies graceful fallback
8. **Delete + restore** — deleting the custom source falls back to Open-Meteo automatically

## Expected output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Estado inicial — Open-Meteo como fuente activa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Open-Meteo es la fuente inicial
  ...
  ✅  TODOS LOS TESTS PASARON
```

Exit code is `0` on full pass, `1` if any check fails.
