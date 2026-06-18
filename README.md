# Gemelo Digital — Sistema Fotovoltaico CUJAE

Aplicación full-stack compuesta por tres servicios independientes. Arrancarlos en el orden indicado.

```
gemelo_digital/
├── backend/             FastAPI + GraphQL  →  :8000
├── servidor_clima_mock/ FastAPI mock       →  :8001
└── frontend/            Next.js            →  :3000
```

---

## 1. Backend principal (FastAPI + GraphQL)

> Requiere **Python 3.11+** y **MongoDB** corriendo en `localhost:27017`.

```bash
cd backend

# Primera vez: crear entorno virtual e instalar dependencias
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar variables de entorno (ya incluye valores por defecto)
# Editar .env si el URI de MongoDB es distinto:
#   MONGODB_URI=mongodb://localhost:27017/GemeloDigitalCujai
#   MONGODB_DB=GemeloDigitalCujai
#   HOST=0.0.0.0
#   PORT=8000
#   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Arrancar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

| URL | Descripción |
|-----|-------------|
| http://localhost:8000/graphql | GraphQL Playground |
| http://localhost:8000/health  | Estado del servidor y BD |
| http://localhost:8000/api/classify-panel | Clasificación de paneles (POST) |

### Ejecutar tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

---

## 2. Servidor clima mock (opcional)

> Simula una estación meteorológica externa con condiciones adversas para FV.
> Solo necesario si se quiere probar integración de clima personalizado.

```bash
cd servidor_clima_mock

# Primera vez
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Arrancar en puerto 8001
uvicorn main:app --reload --port 8001
```

| URL | Descripción |
|-----|-------------|
| http://localhost:8001/docs    | Swagger UI |
| http://localhost:8001/health  | Estado del servidor |
| http://localhost:8001/weather | Datos clima (requiere token) |

**Obtener token:**
```bash
curl -X POST http://localhost:8001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "cujae2024"}'
```

Credenciales disponibles: `admin/cujae2024` · `gemelo/digital` · `user/weather123`

---

## 3. Frontend (Next.js)

> Requiere **Node.js 18+**. El backend debe estar corriendo antes de abrir la app.

```bash
cd frontend

# Primera vez
npm install

# Desarrollo (hot reload)
npm run dev

# Producción
npm run build
npm start
```

La app queda disponible en **http://localhost:3000**.

El archivo `frontend/.env.local` ya está configurado para apuntar al backend local:
```
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8000/graphql
```

### Ejecutar tests

```bash
cd frontend
npm test
```

---

## Arranque rápido (los 3 servicios)

Abrir tres terminales:

```bash
# Terminal 1 — Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Servidor clima mock (opcional)
cd servidor_clima_mock && source venv/bin/activate && uvicorn main:app --reload --port 8001

# Terminal 3 — Frontend
cd frontend && npm run dev
```
