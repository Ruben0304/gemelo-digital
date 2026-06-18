# Gemelo Digital — Sistema Fotovoltaico CUJAE

Aplicación full-stack compuesta por tres servicios independientes. Arrancarlos en el orden indicado.

```
gemelo_digital/
├── backend/             FastAPI + GraphQL  →  :8000
├── servidor_clima_mock/ FastAPI mock       →  :8001
└── frontend/            Next.js            →  :3000
```

---

## Arranque con Docker (recomendado)

> Requiere **Docker** y **Docker Compose**. Levanta los cuatro servicios
> (MongoDB, backend, frontend y clima mock) con un solo comando. No hace falta
> instalar Python, Node ni MongoDB en la máquina.

```bash
# Desde la raíz del repositorio
docker compose up --build
```

Esto construye y arranca:

| Servicio | URL | Descripción |
|----------|-----|-------------|
| frontend   | http://localhost:3000         | Aplicación Next.js |
| backend    | http://localhost:8000/graphql | API GraphQL + REST |
| clima_mock | http://localhost:8001/docs    | Estación meteorológica mock (opcional) |
| mongodb    | localhost:27017               | Base de datos (volumen persistente `mongodb_data`) |

Comandos útiles:

```bash
docker compose up -d --build     # En segundo plano
docker compose logs -f backend   # Ver logs de un servicio
docker compose down              # Parar y eliminar contenedores
docker compose down -v           # Además borra el volumen de MongoDB (datos)
```

> **Puertos:** los puertos `3000`, `8000`, `8001` y `27017` del host deben estar
> libres. Si ya tienes algo corriendo en `8000`, ajusta el mapeo en
> `docker-compose.yml` (y la variable `NEXT_PUBLIC_GRAPHQL_URL` / `NEXT_PUBLIC_API_URL`
> del frontend, que se hornean en tiempo de build).

> El secreto JWT se puede sobreescribir con la variable de entorno `JWT_SECRET`
> al ejecutar `docker compose up` (por defecto usa un valor de desarrollo).

---

## Arranque manual

Si prefieres correr los servicios sin Docker, sigue las secciones siguientes.
Arrancarlos en el orden indicado.

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
