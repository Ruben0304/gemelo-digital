# 🚀 Instrucciones de Uso - Gemelo Digital

## ✅ Sistema Instalado y Probado

Tu proyecto ahora incluye:
- ✅ Backend FastAPI + GraphQL (Strawberry)
- ✅ Cliente GraphQL en Next.js (urql)
- ✅ Todas las dependencias instaladas
- ✅ Servidor probado y funcionando

---

## 📋 Cómo Iniciar el Sistema

### Método 1: Modo Completo (Backend + Frontend)

#### Terminal 1 - Backend GraphQL

```bash
cd backend
./run.sh
```

Verás:
```
🚀 Iniciando servidor GraphQL en http://localhost:8000
📊 GraphQL Playground: http://localhost:8000/graphql
```

#### Terminal 2 - Frontend Next.js

```bash
npm run dev
```

Verás:
```
▲ Next.js 15.x.x
- Local:   http://localhost:3000
```

### Método 2: Solo Backend (para desarrollo GraphQL)

```bash
cd backend
./run.sh
```

Luego abre http://localhost:8000/graphql en tu navegador.

### Método 3: Solo Frontend (usando APIs REST existentes)

```bash
npm run dev
```

---

## 🌐 URLs del Sistema

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3000 | Dashboard principal |
| **Backend API** | http://localhost:8000 | API REST y GraphQL |
| **GraphQL Playground** | http://localhost:8000/graphql | Interface interactiva GraphQL |
| **Health Check** | http://localhost:8000/health | Estado del backend |

---

## 🧪 Probar el Backend GraphQL

### 1. Verificar que está funcionando

```bash
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{"status":"healthy","database":"connected"}
```

### 2. Probar GraphQL desde terminal

```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ hello }"}'
```

Respuesta esperada:
```json
{"data": {"hello": "Hello from Digital Twin GraphQL API!"}}
```

### 3. Usar GraphQL Playground (Recomendado)

1. Abrir http://localhost:8000/graphql
2. Escribir en el panel izquierdo:

```graphql
query {
  hello
}
```

3. Presionar el botón "Play" ▶️
4. Ver resultado en panel derecho

---

## 📝 Errores Comunes y Soluciones

### Error: "ModuleNotFoundError: No module named 'fastapi'"

**Causa**: No has activado el entorno virtual o no has instalado las dependencias.

**Solución**:
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Error: "ModuleNotFoundError: No module named 'app'"

**Causa**: Estás ejecutando Python desde el directorio incorrecto.

**Solución**: Ejecuta el servidor con `uvicorn` desde el directorio `backend/`:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Error: "Address already in use" (puerto 8000)

**Causa**: Ya hay un servidor corriendo en el puerto 8000.

**Solución**:
```bash
# Encontrar el proceso
lsof -i :8000

# Matar el proceso (reemplaza PID con el número que te dio el comando anterior)
kill -9 PID
```

### Error: MongoDB connection failed

**Causa**: MongoDB no está corriendo.

**Solución**: El sistema usa datos mock si MongoDB no está disponible, pero si quieres usar MongoDB:
```bash
# macOS con Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Verificar
mongosh
```

---

## 🎯 Próximos Pasos

### 1. Implementar Resolvers GraphQL

Los resolvers en `backend/app/schema.py` están definidos pero vacíos (marcados con `TODO`). Puedes:

- Conectarlos con MongoDB
- Reutilizar la lógica de `src/lib/` de Next.js
- Migrar gradualmente de REST a GraphQL

### 2. Usar GraphQL en Componentes Next.js

Ejemplo básico:

```typescript
// src/app/components/MiComponente.tsx
'use client'

import { executeQuery } from '@/lib/graphql-client'

export default function MiComponente() {
  const fetchData = async () => {
    const data = await executeQuery(`
      query {
        hello
      }
    `)
    console.log(data)
  }

  return <button onClick={fetchData}>Test GraphQL</button>
}
```

### 3. Explorar el Esquema GraphQL

En http://localhost:8000/graphql, presiona "Docs" para ver:
- Todas las queries disponibles
- Todas las mutations disponibles
- Todos los tipos definidos
- Argumentos y tipos de retorno

---

## 📚 Documentación Adicional

- **[GRAPHQL_USAGE.md](GRAPHQL_USAGE.md)** - Guía completa de GraphQL con ejemplos
- **[backend/QUICKSTART.md](backend/QUICKSTART.md)** - Inicio rápido del backend
- **[backend/README.md](backend/README.md)** - Documentación técnica del backend
- **[CLAUDE.md](CLAUDE.md)** - Documentación del proyecto completo

---

## 🛑 Detener los Servidores

### Backend
Presiona `Ctrl + C` en la terminal donde está corriendo

### Frontend
Presiona `Ctrl + C` en la terminal donde está corriendo

---

## 💡 Consejos

1. **Modo de desarrollo**: Ambos servidores tienen hot-reload activado, los cambios se reflejan automáticamente
2. **GraphQL Playground**: Es tu mejor amigo para probar queries antes de implementarlas en el frontend
3. **Logs**: Revisa las terminales donde corren los servidores para ver errores y debug
4. **MongoDB**: No es obligatorio para empezar, el sistema funciona con datos mock

---

## ✅ Verificación Rápida

Para verificar que todo está bien instalado:

```bash
# 1. Verificar Node.js
node --version  # Debe ser 18+

# 2. Verificar Python
python3 --version  # Debe ser 3.11+

# 3. Verificar dependencias del frontend
npm list urql graphql

# 4. Verificar dependencias del backend
cd backend
source venv/bin/activate
pip list | grep -E "fastapi|strawberry|uvicorn"
```

¡Listo! Ya puedes empezar a desarrollar con GraphQL. 🎉
