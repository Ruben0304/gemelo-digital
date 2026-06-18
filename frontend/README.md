# ⚡ Gemelo Digital de Microrred Fotovoltaica

Sistema de monitoreo y predicción en tiempo real para microrredes solares. Aplicación web desarrollada con Next.js 15 que simula el comportamiento de una instalación fotovoltaica de 50kW con almacenamiento en batería de 100kWh.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)
![GraphQL](https://img.shields.io/badge/GraphQL-Strawberry-ff4081)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Características Principales

- **📊 Dashboard en Tiempo Real**: Visualización completa del estado del sistema con actualización automática cada 5 segundos
- **📈 Gráficos Interactivos**: Producción vs consumo, predicciones, flujo energético
- **🔋 Monitoreo de Batería**: Estado de carga, autonomía, flujo de energía
- **🌤️ Integración Climática**: Condiciones actuales y pronóstico 7 días con impacto en producción
- **🤖 Predicciones Inteligentes**: Algoritmo basado en radiación solar, temperatura y nubosidad
- **🚨 Sistema de Alertas**: Notificaciones automáticas para condiciones críticas
- **💡 Recomendaciones**: Sugerencias para optimizar consumo según predicciones

## 🏗️ Arquitectura del Proyecto

```
tesis_gemelo_digital/
├── backend/                        # 🆕 Backend FastAPI + GraphQL
│   ├── app/
│   │   ├── main.py                 # Aplicación FastAPI
│   │   ├── schema.py               # Esquema GraphQL (Strawberry)
│   │   ├── database.py             # Conexión MongoDB
│   │   └── config.py               # Configuración
│   ├── venv/                       # Entorno virtual Python
│   ├── requirements.txt            # Dependencias Python
│   ├── .env                        # Variables de entorno
│   └── run.sh                      # Script de inicio
├── src/
│   ├── app/
│   │   ├── api/                    # API Routes (Next.js)
│   │   │   ├── solar/route.ts      # Datos solares y métricas
│   │   │   ├── weather/route.ts    # Clima y pronóstico
│   │   │   └── predictions/route.ts # Predicciones y alertas
│   │   ├── components/             # Componentes React
│   │   │   ├── Dashboard.tsx       # Dashboard principal
│   │   │   ├── MetricsCards.tsx    # Tarjetas de métricas
│   │   │   ├── SolarProductionChart.tsx # Gráfico producción
│   │   │   ├── BatteryStatus.tsx   # Indicador batería
│   │   │   ├── WeatherWidget.tsx   # Widget clima
│   │   │   ├── EnergyFlowDiagram.tsx # Diagrama flujo
│   │   │   └── PredictionsPanel.tsx # Panel predicciones
│   │   ├── layout.tsx              # Layout raíz
│   │   ├── page.tsx                # Página principal
│   │   └── globals.css             # Estilos globales
│   └── lib/                        # Lógica de negocio
│       ├── mockData.ts             # Generador de datos realistas
│       ├── calculations.ts         # Cálculos de eficiencia
│       ├── predictions.ts          # Algoritmos de predicción
│       ├── graphql-client.ts       # 🆕 Cliente GraphQL (urql)
│       ├── graphql-queries.ts      # 🆕 Queries y Mutations
│       └── graphql-hooks.ts        # 🆕 Custom hooks GraphQL
├── types/
│   └── index.ts                    # Interfaces TypeScript
└── public/
    └── data/                       # Datos estáticos (futuro)
```

## 🚀 Instalación y Uso

### Requisitos Previos

- Node.js 18+
- Python 3.11+
- MongoDB 6.0+ (opcional, usa datos mock si no está disponible)
- npm, yarn, pnpm o bun

### Pasos de Instalación

#### Frontend (Next.js)

```bash
# 1. Clonar el repositorio
git clone <repository-url>
cd tesis_gemelo_digital

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus configuraciones

# 4. Ejecutar en modo desarrollo
npm run dev

# 5. Abrir en el navegador
# http://localhost:3000
```

#### Backend (FastAPI + GraphQL) 🆕

```bash
# 1. Navegar al directorio backend
cd backend

# 2. Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 5. Iniciar servidor
./run.sh
# O manualmente:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. Abrir GraphQL Playground
# http://localhost:8000/graphql
```

### Scripts Disponibles

#### Frontend
```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run start    # Servidor de producción
```

#### Backend
```bash
./run.sh                    # Iniciar servidor GraphQL
uvicorn app.main:app --reload  # Con hot-reload
python -m app.main          # Sin hot-reload
```

### URLs del Sistema

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **GraphQL Playground**: http://localhost:8000/graphql
- **Health Check**: http://localhost:8000/health

## 📊 Modelo de Datos

### Configuración del Sistema

- **Capacidad Solar**: 50 kW (250 m² de paneles @ 20% eficiencia)
- **Almacenamiento**: 100 kWh (batería de litio)
- **Consumo Promedio**: 30-40 kW día, 15-20 kW noche
- **Localización**: Configurable (latitud/longitud)

### Datos Generados

#### 1. **Datos Solares** (`/api/solar`)
```typescript
{
  current: SolarData;        // Estado actual
  historical: SolarData[];   // Últimas 24 horas
  battery: BatteryStatus;    // Estado de batería
  metrics: SystemMetrics;    // Métricas calculadas
  energyFlow: EnergyFlow;    // Flujo energético
}
```

#### 2. **Datos Climáticos** (`/api/weather`)
```typescript
{
  temperature: number;       // °C
  solarRadiation: number;    // W/m²
  cloudCover: number;        // %
  humidity: number;          // %
  windSpeed: number;         // km/h
  forecast: DayForecast[];   // 7 días
}
```

#### 3. **Predicciones** (`/api/predictions`)
```typescript
{
  predictions: Prediction[];     // 24 horas
  alerts: Alert[];              // Alertas activas
  recommendations: string[];    // Recomendaciones
}
```

## 🧮 Algoritmos Implementados

### 1. Generación de Producción Solar

Usa una **curva gaussiana** centrada al mediodía:

```typescript
Production = Capacity × Gaussian(hour) × RadiationFactor × (1 - CloudPenalty)
```

- **Gaussian**: Pico a las 13:00h, sigma=3.5
- **RadiationFactor**: Basado en W/m² (0-1000)
- **CloudPenalty**: 5% reducción por cada 10% de nubes

### 2. Predicción de Producción

```typescript
Prediction = (Radiation × Area × Efficiency) × TempCorrection × CloudCorrection
```

**Factores de corrección:**
- Temperatura: -0.4% por cada °C sobre 25°C
- Nubosidad: -50% máximo con 100% de cobertura
- Hora del día: Factor 0-1 según ángulo solar

### 3. Gestión de Batería

```typescript
BatteryLevel(t+1) = BatteryLevel(t) + ((Production - Consumption) / Capacity) × 100
```

Con límites 0-100% y cálculo de autonomía:
```typescript
Autonomy = CurrentEnergy / CurrentConsumption
```

## 🎨 Diseño UI/UX

### Paleta de Colores

- **Background**: `#0a0e1a` (azul oscuro)
- **Cards**: `#1a1f35` con bordes sutiles
- **Producción**: `#10b981` (verde)
- **Consumo**: `#3b82f6` (azul)
- **Batería**: `#fbbf24` (amarillo)
- **Alertas**: `#ef4444` (rojo)

### Componentes Clave

1. **Metrics Cards**: 4 tarjetas superiores con datos en tiempo real
2. **Production Chart**: Gráfico de área con últimas 24h
3. **Battery Status**: Indicador circular animado
4. **Weather Widget**: Pronóstico visual 5 días
5. **Energy Flow**: Diagrama Sankey simplificado
6. **Predictions Panel**: Gráficos de barras + alertas

## 📈 Métricas y KPIs

El sistema calcula y muestra:

- **Producción Diaria Total** (kWh)
- **Consumo Diario Total** (kWh)
- **Balance Energético** (kW en tiempo real)
- **Eficiencia del Sistema** (%)
- **CO₂ Evitado** (kg/día @ 0.5kg/kWh)
- **Autonomía de Batería** (horas)
- **Performance Ratio** (PR) - Estándar industria

## 🔮 Próximos Pasos (Roadmap)

### Fase 2: Integración Real

- [ ] Conexión a API de clima real (OpenWeatherMap)
- [ ] Integración con inversor solar (Modbus TCP/RTU)
- [ ] MQTT broker para datos en tiempo real
- [ ] WebSocket para updates instantáneos

### Fase 3: Base de Datos

- [ ] PostgreSQL + Prisma ORM
- [ ] Time-series DB (InfluxDB) para históricos
- [ ] Cache con Redis
- [ ] Backup automático

### Fase 4: Machine Learning

- [ ] Modelo LSTM para predicciones avanzadas
- [ ] Detección de anomalías
- [ ] Optimización de carga predictiva
- [ ] Forecasting a 30 días

### Fase 5: Features Avanzadas

- [ ] Multi-tenancy (múltiples instalaciones)
- [ ] Panel de administración
- [ ] Notificaciones push (email/SMS)
- [ ] Exportación de reportes (PDF/CSV/Excel)
- [ ] App móvil (React Native)
- [ ] API pública con rate limiting

### Fase 6: Optimización

- [ ] PWA (Progressive Web App)
- [ ] Server-Side Rendering (SSR)
- [ ] Edge Functions para latencia mínima
- [ ] CDN para assets estáticos

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Dates**: date-fns

### Backend (API Routes)
- **Runtime**: Node.js 18+
- **API**: Next.js API Routes
- **Data**: Mock (JSON) - Preparado para DB

### DevOps (Futuro)
- **Hosting**: Vercel / Railway / Fly.io
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + Analytics
- **Testing**: Jest + Playwright

## 📝 Convenciones de Código

- **TypeScript Strict Mode**: Activado
- **ESLint**: Configuración Next.js
- **Naming**: camelCase para funciones/variables, PascalCase para componentes
- **Comments**: JSDoc para funciones públicas
- **Commits**: Conventional Commits

## 🤝 Contribución

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: nueva funcionalidad'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 👥 Autor

Proyecto de Tesis - Gemelo Digital de Microrred Fotovoltaica

## 🙏 Agradecimientos

- Datos de algoritmos solares basados en estándares IEC
- Inspiración en dashboards de Tesla Powerwall y SolarEdge
- Comunidad de Next.js y Tailwind CSS

---

**⚡ Generado con energía solar ☀️**
