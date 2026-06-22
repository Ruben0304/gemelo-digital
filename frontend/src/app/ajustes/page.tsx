'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BatteryCharging, Info, Layers, Power, Settings2, MapPin, FileDown, Sun, Trash2 } from 'lucide-react';
import { canAccessModule, moduleKeyFromPath } from '@/lib/permissions';
import { executeMutation } from '@/lib/graphql-client';

const RESET_MUTATION = `
  mutation ResetSystemData {
    resetSystemData
  }
`;

const sections = [
  {
    href: '/ajustes/paneles',
    title: 'Paneles solares',
    subtitle: 'Potencia, cantidad y limpieza',
    icon: <Layers className="h-5 w-5 text-blue-600" />,
  },
  {
    href: '/ajustes/baterias',
    title: 'Baterías',
    subtitle: 'Capacidad y bancos de almacenamiento',
    icon: <BatteryCharging className="h-5 w-5 text-emerald-600" />,
  },
  {
    href: '/ajustes/inversores',
    title: 'Inversores',
    subtitle: 'Potencia AC y eficiencia',
    icon: <Power className="h-5 w-5 text-indigo-600" />,
  },
  {
    href: '/ajustes/electrodomesticos',
    title: 'Electrodomésticos',
    subtitle: 'Cargas, tiempos y modos',
    icon: <Settings2 className="h-5 w-5 text-amber-600" />,
  },
  {
    href: '/ajustes/clima',
    title: 'Fuente de clima',
    subtitle: 'Conexión con servicios meteorológicos',
    icon: <Info className="h-5 w-5 text-fuchsia-600" />,
  },
  {
    href: '/ajustes/ubicacion',
    title: 'Ubicación',
    subtitle: 'Coordenadas geográficas de la instalación',
    icon: <MapPin className="h-5 w-5 text-rose-500" />,
  },
  {
    href: '/ajustes/reportes',
    title: 'Exportar reportes',
    subtitle: 'Descargar datos en CSV o PDF profesional',
    icon: <FileDown className="h-5 w-5 text-sky-600" />,
  },
  {
    href: '/ajustes/sombras',
    title: 'Configurar sombra',
    subtitle: 'Perfil de sombra por franja horaria y su impacto en la producción',
    icon: <Sun className="h-5 w-5 text-orange-500" />,
  },
] as const;

export default function AjustesHomePage() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('gd_auth_user');
      setRole(stored ? (JSON.parse(stored)?.role ?? null) : null);
    } catch {
      setRole(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      await executeMutation(RESET_MUTATION, {});
      window.localStorage.removeItem('gd_onboarding_done');
      router.push('/');
    } catch (err) {
      console.error('Error al restablecer el sistema:', err);
      setResetting(false);
      setConfirmReset(false);
    }
  };

  // Solo se muestran los módulos que el rol del usuario puede usar.
  const visibleSections = !loaded ? [] : sections.filter((section) => {
    const key = moduleKeyFromPath(section.href);
    return key ? canAccessModule(role, key) : true;
  });

  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_30px_70px_-50px_rgba(15,23,42,0.65)]">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Ajustes</h2>
        <p className="text-sm text-slate-500">
          {role === 'admin'
            ? 'Administre cada parte de la configuración en su propia sección.'
            : 'Exporte reportes del sistema. La configuración avanzada está reservada a administradores.'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-2">{section.icon}</div>
            <h3 className="text-base font-semibold text-slate-800 group-hover:text-blue-700">
              {section.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
          </Link>
        ))}
      </div>

      {role === 'admin' && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Borrar datos y configurar nuevamente
            </button>
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="mb-3 text-sm font-medium text-red-800">
                ¿Confirmar restablecimiento? Se eliminarán paneles, baterías, inversores,
                electrodomésticos y la configuración de ubicación. Los usuarios y
                lecturas históricas se conservarán.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {resetting ? 'Borrando…' : 'Sí, borrar y reconfigurar'}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  disabled={resetting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
