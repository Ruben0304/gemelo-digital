# GraphQL Integration Guide

Este proyecto ahora incluye un backend GraphQL usando FastAPI + Strawberry y un cliente GraphQL en Next.js usando urql.

## Estructura del Proyecto

```
tesis_gemelo_digital/
├── backend/                  # Backend FastAPI + Strawberry GraphQL
│   ├── app/
│   │   ├── main.py          # Aplicación FastAPI principal
│   │   ├── schema.py        # Esquema GraphQL (tipos, queries, mutations)
│   │   ├── database.py      # Conexión a MongoDB
│   │   └── config.py        # Configuración de la aplicación
│   ├── requirements.txt     # Dependencias Python
│   ├── .env.example         # Variables de entorno (ejemplo)
│   └── README.md            # Documentación del backend
│
└── src/lib/                  # Cliente GraphQL en Next.js
    ├── graphql-client.ts    # Configuración del cliente urql
    ├── graphql-queries.ts   # Queries y mutations definidas
    └── graphql-hooks.ts     # Custom hooks para usar en componentes
```

## Configuración Inicial

### 1. Backend (FastAPI + Strawberry)

**Instalar dependencias:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Configurar variables de entorno:**

```bash
cd backend
cp .env.example .env
# Editar .env con tus configuraciones
```

**Iniciar el servidor:**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El servidor estará disponible en:
- API: http://localhost:8000
- GraphQL Playground: http://localhost:8000/graphql

### 2. Frontend (Next.js + urql)

Las dependencias ya están instaladas. Solo asegúrate de que `.env.local` contenga:

```
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8000/graphql
```

## Uso en Componentes Next.js

### Opción 1: Usando Custom Hooks

```typescript
import { useSolarDataQuery } from '@/lib/graphql-hooks'

export default function SolarComponent() {
  const { data, loading, error } = useSolarDataQuery()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>Production: {data?.solarData?.current?.production} kW</h2>
      <h2>Consumption: {data?.solarData?.current?.consumption} kW</h2>
    </div>
  )
}
```

### Opción 2: Usando executeQuery directamente

```typescript
import { executeQuery } from '@/lib/graphql-client'
import { SOLAR_DATA_QUERY } from '@/lib/graphql-queries'

async function fetchSolarData() {
  const data = await executeQuery(SOLAR_DATA_QUERY)
  console.log(data.solarData)
}
```

### Opción 3: Usando mutations

```typescript
import { executeMutation } from '@/lib/graphql-client'
import { CREATE_PANEL_MUTATION } from '@/lib/graphql-queries'

async function createPanel() {
  const result = await executeMutation(CREATE_PANEL_MUTATION, {
    input: {
      name: "Panel Solar 400W",
      ratedPowerKw: 0.4,
      quantity: 125,
      strings: 5
    }
  })
  console.log('Panel created:', result.createPanel)
}
```

## Queries Disponibles

### Solar Data
```graphql
query SolarData {
  solarData {
    current {
      production
      consumption
      batteryLevel
      efficiency
    }
    battery {
      level
      capacityKwh
      charging
      powerKw
    }
  }
}
```

### Weather
```graphql
query Weather {
  weather {
    current {
      temperature
      humidity
      solarRadiation
      condition
    }
  }
}
```

### Panels
```graphql
query Panels {
  panels {
    id
    name
    ratedPowerKw
    quantity
  }
}
```

## Mutations Disponibles

### Create Panel
```graphql
mutation CreatePanel($input: PanelInput!) {
  createPanel(input: $input) {
    id
    name
    ratedPowerKw
    quantity
  }
}
```

Variables:
```json
{
  "input": {
    "name": "Panel Solar 400W",
    "ratedPowerKw": 0.4,
    "quantity": 125,
    "strings": 5
  }
}
```

### Update Battery
```graphql
mutation UpdateBattery($id: String!, $input: BatteryInput!) {
  updateBattery(id: $id, input: $input) {
    id
    name
    capacityKwh
  }
}
```

## Testing GraphQL

### Usando GraphQL Playground

1. Iniciar el backend: `uvicorn app.main:app --reload`
2. Abrir navegador en: http://localhost:8000/graphql
3. Escribir queries en el panel izquierdo
4. Ver resultados en el panel derecho

### Ejemplo de Query en Playground

```graphql
query TestQuery {
  hello
  panels {
    id
    name
    ratedPowerKw
  }
}
```

### Usando curl

```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ hello }"}'
```

## Migración de REST a GraphQL

Para migrar endpoints REST existentes a GraphQL:

1. **Identificar endpoint REST**: Por ejemplo, `GET /api/solar`
2. **Crear tipo GraphQL** en `backend/app/schema.py`
3. **Implementar resolver** en la clase `Query` o `Mutation`
4. **Actualizar frontend** para usar `executeQuery` en lugar de `fetch`

### Ejemplo de Migración

**Antes (REST):**
```typescript
const response = await fetch('/api/solar')
const data = await response.json()
```

**Después (GraphQL):**
```typescript
import { executeQuery } from '@/lib/graphql-client'
import { SOLAR_DATA_QUERY } from '@/lib/graphql-queries'

const data = await executeQuery(SOLAR_DATA_QUERY)
```

## Ventajas de GraphQL

1. **Consultas flexibles**: El cliente pide exactamente los datos que necesita
2. **Menos requests**: Una sola llamada puede traer datos de múltiples recursos
3. **Type-safe**: El esquema define tipos estrictos
4. **Introspección**: El API se auto-documenta
5. **Evolución sin versiones**: Agregar campos sin romper clientes existentes

## Próximos Pasos

1. Implementar los resolvers pendientes en `backend/app/schema.py` (marcados con `TODO`)
2. Conectar los resolvers con MongoDB usando servicios existentes
3. Actualizar componentes de Next.js para usar GraphQL en lugar de REST
4. Agregar autenticación a las queries/mutations que lo requieran
5. Implementar subscriptions para datos en tiempo real (opcional)

## Recursos

- [Strawberry GraphQL Documentation](https://strawberry.rocks/)
- [urql Documentation](https://formidable.com/open-source/urql/)
- [GraphQL Specification](https://spec.graphql.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
