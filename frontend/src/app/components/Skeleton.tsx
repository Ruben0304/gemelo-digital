'use client';

/**
 * Skeleton loaders: placeholders con efecto "shimmer" que se muestran mientras
 * cargan los datos, en vez de un spinner vacío. Mejoran la percepción de
 * velocidad y dan sensación de app pulida.
 *
 * - `Skeleton`: bloque básico reutilizable.
 * - `DashboardSkeleton`: composición que imita el layout real del panel
 *   (tarjetas KPI, diagrama, gráfico, clima) para una transición sin saltos.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/50 bg-white/70 p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <Skeleton className="mb-3 h-28 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6" aria-busy="true" aria-label="Cargando panel">
      {/* KPIs superiores */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/50 bg-white/70 p-4">
            <Skeleton className="mb-3 h-3 w-1/2" />
            <Skeleton className="h-7 w-3/4" />
          </div>
        ))}
      </div>

      {/* Cuerpo: diagrama + gráfico + clima */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" />
        <CardSkeleton />
        <CardSkeleton className="lg:col-span-2" />
        <CardSkeleton />
      </div>
    </div>
  );
}
