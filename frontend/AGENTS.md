# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Digital Twin system for a photovoltaic (solar) microgrid with real-time monitoring, intelligent predictions, and blackout scenario analysis. Built with Next.js 15, React 19, MongoDB, and TypeScript.

**System Specifications:**
- 50 kW solar capacity (configurable via database)
- 100 kWh battery storage (configurable)
- Location: La Habana, Cuba (23.1136, -82.3666)
- Real-time weather integration via Open-Meteo API

## Development Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Production server (after build)
npm start
```

**Environment Variables Required:**
- `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017/GemeloDigitalCujai`)
- `MONGODB_DB` - Database name (default: `GemeloDigitalCujai`)
- `OPENWEATHER_API_KEY` - Currently using Open-Meteo (free, no key needed), this is legacy

**Development Server:** http://localhost:3000

## Architecture Overview

### Three-Layer Architecture

1. **API Routes** (`src/app/api/`) - Next.js server-side endpoints
2. **Service Layer** (`src/lib/*Service.ts`) - Business logic and database operations
3. **Components** (`src/app/components/`) - React UI with local state

### Data Flow Pattern

```
Component (useEffect) → fetch(/api/endpoint) → API Route → Service Layer → MongoDB
                                              ↓
                                        Calculation Libraries
                                      (predictions, calculations)
```

**No state management library** - Uses React hooks (`useState`, `useEffect`) exclusively. The Dashboard component orchestrates all data fetching and passes props down to child components.

### Key API Endpoints

- `GET /api/solar` - Returns current solar data, 24h timeline, battery status, metrics, energy flow
- `GET /api/weather` - Fetches real-time weather from Open-Meteo API with fallback to mock data
- `GET /api/predictions` - Generates 24-hour predictions with blackout adjustments and alerts
- `GET/POST /api/paneles` - Solar panel configuration management
- `GET/POST /api/baterias` - Battery configuration management
- `GET/POST /api/blackouts` - Blackout schedule management
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration

All API routes use `export const dynamic = 'force-dynamic'` to prevent caching and ensure fresh data.

## MongoDB Collections

**Database:** `GemeloDigitalCujai`

### usuarios (Users)
```typescript
{
  email: string,           // unique, lowercase
  name?: string,
  role: 'admin' | 'user',
  passwordHash: string,    // scrypt with salt
  createdAt: Date,
  updatedAt: Date
}
```

### paneles (Solar Panel Configurations)
```typescript
{
  name: string,
  manufacturer?: string,
  model?: string,
  ratedPowerKw: number,    // Power per panel
  quantity: number,         // Number of panels
  strings: number,
  efficiencyPercent?: number,
  areaM2?: number,
  tiltDegrees?: number,
  orientation?: string,
  notes?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### baterias (Battery Configurations)
```typescript
{
  name: string,
  manufacturer?: string,
  model?: string,
  capacityKwh: number,     // Capacity per battery
  quantity: number,         // Number of batteries
  maxDepthOfDischargePercent?: number,
  chargeRateKw?: number,
  dischargeRateKw?: number,
  efficiencyPercent?: number,
  chemistry?: string,       // e.g., 'LiFePO4'
  nominalVoltage?: number,
  notes?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### apagones (Blackout Schedules)
```typescript
{
  date: Date,              // Start of day
  intervals: [{
    start: Date,           // ISO datetime
    end: Date,
    durationMinutes: number
  }],
  province?: string,
  municipality?: string,
  notes?: string,
  createdAt: Date,
  updatedAt: Date
}
```

**Connection Management:** Use `getDb()` from `src/lib/db.ts` for database operations. Connection pooling is handled automatically with development-specific global caching to prevent hot-reload connection leaks.

## Core Business Logic

### System Configuration (`src/lib/systemConfig.ts`)

`getSystemConfig()` aggregates total capacity from all panels and batteries in the database. Falls back to `DEFAULT_SYSTEM_CONFIG` if database is unavailable.

**Total capacity calculation:**
- Solar: Sum of `ratedPowerKw × quantity` from all panels
- Battery: Sum of `capacityKwh × quantity` from all batteries
- Uses first panel/battery specs as system-wide defaults

### Solar Production Algorithm (`src/lib/calculations.ts`)

**Theoretical Production:**
```typescript
Power = (SolarRadiation_W/m² × PanelArea_m² × Efficiency) / 1000
```

**Actual Production** (includes corrections):
- Temperature coefficient: -0.4% per °C above 25°C
- Age degradation: -0.5% per year
- Cloud cover penalty: Up to -50% at 100% cloud cover
- Time-of-day factor: Gaussian curve centered at 13:00 (sigma=3.5)

**Efficiency Calculation:**
```typescript
Efficiency = (ActualProduction / TheoreticalProduction) × 100
```

### Prediction Engine (`src/lib/predictions.ts`)

**Hourly Predictions:**
```typescript
Production = SolarRadiation × PanelArea × Efficiency × TimeOfDayFactor × CloudFactor
Confidence = BaseConfidence × (1 - CloudCover/200)
```

**Blackout Adjustments:**
- Consumption reduced by 60% during blackouts (loadFactor = 0.6)
- Production reduced by 15% during blackouts (productionFactor = 0.85)
- Confidence reduced by 12% if blackout overlap

**Alert Generation Rules:**
- Critical: Battery < 20%
- Warning: Battery < 40% or production deficit > 50%
- Info: Weather-based alerts (storms, low radiation)

### Energy Flow Calculation (`src/lib/calculations.ts`)

Distributes energy among five flows:
1. **solarToLoad** - Direct solar to consumption
2. **solarToBattery** - Charging battery from solar
3. **solarToGrid** - Exporting excess to grid
4. **batteryToLoad** - Discharging battery to meet demand
5. **gridToLoad** - Importing from grid when needed

**Priority Logic:**
1. Solar covers load first
2. Surplus charges battery
3. If battery full, export to grid
4. Deficit covered by battery, then grid

### Battery Strategy (`src/lib/calculations.ts`)

`calculateBatteryStrategy()` determines charge/discharge action:
- **Charge:** Surplus production AND battery < 95%
- **Discharge:** Production deficit AND battery > 20%
- **Hold:** Otherwise

## Component Architecture

### Main Components

**Dashboard.tsx** - Central orchestrator
- Manages all application state (solar, weather, predictions, configs)
- Fetches data from all APIs via `useEffect`
- Handles section navigation (overview/stats/devices)
- Passes data down to child components via props

**AuthGate.tsx** - Authentication wrapper
- Login/registration forms
- Session persistence via localStorage (`SESSION_KEY = 'gd_auth_user'`)
- Displays feature cards when not authenticated

**Key Child Components:**
- `MetricsCards` - 4 KPI cards (production, consumption, daily totals, efficiency)
- `SolarProductionChart` - Recharts line chart showing 24h production timeline
- `BatteryStatus` - Circular progress indicator with autonomy hours
- `FlujoEnergia` - Sankey-style energy flow diagram
- `PredictionsPanel` - Hourly predictions table with alerts and recommendations
- `WeatherToday` + `WeatherForecast` - Current and 7-day weather display
- `SolarStatsView` - Detailed analytics (performance ratio, ROI)
- `DevicesView` - CRUD interfaces for panels, batteries, and blackout schedules

### Component Communication

**No Context API or Redux** - All data flows through props from Dashboard:
```typescript
<BatteryStatus
  battery={solarData?.battery}
  consumption={solarData?.current.consumption}
/>
```

## Type Definitions

All interfaces are in `src/types/index.ts`. Key types:

- `SolarData` - Production, consumption, battery level at a point in time
- `WeatherData` - Current weather + 7-day forecast with solar radiation
- `BatteryStatus` - Charge level, capacity, autonomy, power flow
- `Prediction` - Hourly forecast with confidence and blackout impact
- `SystemConfig` - Solar/battery specs, location coordinates
- `EnergyFlow` - Power distribution across five pathways
- `BlackoutSchedule` - Date with multiple time intervals
- `Alert` - Severity (critical/warning/info), message, type

## Authentication System

**Password Security:**
- Uses Node.js `crypto.scryptSync` (not bcrypt)
- Salt: 16 random bytes
- Hash format: `salt:derivedKey` (hex)
- Timing-safe comparison with `timingSafeEqual`

**Session Management:**
- Client-side only (localStorage)
- No JWT tokens or server-side sessions
- Session key: `gd_auth_user`
- Logout clears localStorage and component state

**Roles:** `admin` | `user` (stored but not enforced on backend)

## Path Aliases

TypeScript paths configured in `tsconfig.json`:
```typescript
import { getDb } from '@/lib/db'
import type { SolarData } from '@/types'
```

`@/*` maps to `./src/*`

## Weather Integration

**Open-Meteo API** (free, no authentication):
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Data: Temperature, humidity, cloud cover, solar radiation, wind
- 7-day forecast with hourly resolution
- Fallback to mock data if API unavailable

**Mock Data Generation** (`src/lib/mockData.ts`):
- Gaussian solar production curve (peak at 13:00)
- Realistic consumption patterns (35kW day, 18kW night)
- Weather scenarios: sunny, partly-cloudy, cloudy, rainy

## Adding New Features

### New API Endpoint
1. Create `src/app/api/[resource]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` async functions
3. Add `export const dynamic = 'force-dynamic'`
4. Use service layer for database operations

### New Database Collection
1. Create `src/lib/[resource]Service.ts` with CRUD functions
2. Add type definition to `src/types/index.ts`
3. Use `getDb()` from `@/lib/db` for collection access
4. Always set `createdAt` and `updatedAt` timestamps

### New Component
1. Create functional component in `src/app/components/[Name].tsx`
2. Define props interface
3. Import in Dashboard and add to appropriate section
4. Use Tailwind CSS for styling (dark theme: bg-slate-900/800/700)

## Performance Considerations

- All calculations use `useMemo` when expensive (e.g., energy flow in Dashboard)
- Charts are rendered client-side with Recharts
- API routes execute server-side, avoiding client bundle bloat
- MongoDB queries use indexes on frequently queried fields (email, date)

## Common Patterns

**Date Handling:**
- Store as `Date` objects in MongoDB
- Convert to ISO strings for JSON serialization
- Use `date-fns` for formatting in UI

**Error Handling:**
```typescript
try {
  // Operation
  return NextResponse.json(data, { status: 200 })
} catch (error) {
  console.error('Context:', error)
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  )
}
```

**Validation:**
- Input validation in service layer before database operations
- Type safety enforced by TypeScript
- Form validation in components before API calls

## Key Calculations Reference

**CO₂ Avoided:** `dailyProduction_kWh × 0.5 kg/kWh`

**Battery Autonomy:** `currentEnergy_kWh / currentConsumption_kW` (hours)

**Performance Ratio (PR):** `(actualProduction / theoreticalProduction) × 100` (industry standard)

**Energy Balance:** `production_kW - consumption_kW` (positive = surplus, negative = deficit)

## File Organization

```
src/
├── app/
│   ├── api/              # Next.js API routes (server-side)
│   ├── components/       # React components (client-side)
│   ├── layout.tsx        # Root layout with metadata
│   ├── page.tsx          # Homepage (AuthGate + Dashboard)
│   └── globals.css       # Tailwind styles
├── lib/                  # Business logic and utilities
│   ├── *Service.ts       # Database CRUD operations
│   ├── calculations.ts   # Energy and efficiency calculations
│   ├── predictions.ts    # Forecast algorithms
│   ├── systemConfig.ts   # Configuration aggregation
│   ├── mockData.ts       # Demo data generation
│   ├── openMeteo.ts      # Weather API integration
│   └── db.ts             # MongoDB connection
└── types/
    └── index.ts          # TypeScript interfaces
```

## Debugging Tips

- Check browser Network tab for API response payloads
- MongoDB queries logged to console in development
- Use React DevTools to inspect component props
- API routes run server-side, check terminal for logs
- Mock data always available if database connection fails
