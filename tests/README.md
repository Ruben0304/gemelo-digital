# Tests — Gemelo Digital

Overview of the three test suites in this project.

## Structure

```
gemelo-digital/
├── backend/tests/          # pytest — unit & integration tests
├── frontend/src/lib/__tests__/  # vitest — component & utility tests
└── tests/e2e/              # E2E tests requiring live servers
```

---

## Backend tests (pytest)

**Location:** `backend/tests/`

**Covers:** resolvers GraphQL, servicios de predicción ML, lógica de fuentes meteorológicas, autenticación JWT, modelos MongoDB.

**Run:**
```bash
cd backend
pytest
# or with coverage:
pytest --cov=app
```

**Requirements:** MongoDB running locally (`GemeloDigitalCujai`).

---

## Frontend tests (vitest)

**Location:** `frontend/src/lib/__tests__/`

**Covers:** componentes Svelte, utilidades de formateo, stores, lógica de gráficos.

**Run:**
```bash
cd frontend
npm test
# or watch mode:
npm run test:watch
```

**Requirements:** Node.js + dependencies installed (`npm install`).

---

## E2E tests

**Location:** `tests/e2e/`

**Covers:** flujo completo de cambio de fuente meteorológica — desde Open-Meteo hasta una API propia y vuelta. 59 checks across 8 sections.

**Run:**
```bash
# Start backend (port 8000) and mock server (port 8001) first — see tests/e2e/README.md
python tests/e2e/test_weather_e2e.py
```

**Requirements:** backend + mock weather server running, MongoDB. No pip dependencies (pure stdlib).

See [`tests/e2e/README.md`](e2e/README.md) for full setup instructions.
