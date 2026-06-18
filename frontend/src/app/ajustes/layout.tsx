'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import AuthGate from '@/app/components/AuthGate';
import FloatingBottomNav from '@/app/components/FloatingBottomNav';
import UserMenu from '@/app/components/UserMenu';
import type { User } from '@/types';
import { canAccessModule, moduleKeyFromPath } from '@/lib/permissions';

const SESSION_KEY = 'gd_auth_user';

const navItems = [
  { href: '/ajustes', label: 'Secciones' },
  { href: '/ajustes/paneles', label: 'Paneles' },
  { href: '/ajustes/baterias', label: 'Baterías' },
  { href: '/ajustes/inversores', label: 'Inversores' },
  { href: '/ajustes/electrodomesticos', label: 'Electrodomésticos' },
  { href: '/ajustes/clima', label: 'Clima' },
  { href: '/ajustes/ubicacion', label: 'Ubicación' },
  { href: '/ajustes/reportes', label: 'Reportes' },
] as const;

export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      }
    } catch (error) {
      console.warn('No se pudo leer la sesión almacenada.', error);
    } finally {
      setBootstrapped(true);
    }
  }, []);

  // Guard de ruta único: si el rol del usuario no puede acceder al módulo de la
  // URL actual, lo enviamos al índice de Ajustes (donde solo verá lo permitido).
  useEffect(() => {
    if (!bootstrapped || !user) return;
    const moduleKey = moduleKeyFromPath(pathname);
    if (moduleKey && !canAccessModule(user.role, moduleKey)) {
      router.replace('/ajustes');
    }
  }, [bootstrapped, user, pathname, router]);

  const handleAuthenticated = (authenticated: User) => {
    setUser(authenticated);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(authenticated));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    router.push('/');
  };

  const pageTitle = useMemo(() => {
    const active = navItems.find((item) => item.href === pathname);
    if (!active) return 'Ajustes';
    return active.label === 'Secciones' ? 'Ajustes' : `Ajustes · ${active.label}`;
  }, [pathname]);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center text-gray-600">
          <ArrowPathIcon className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          Preparando ajustes…
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Microrred solar</p>
            <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>
          </div>

          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 sm:px-6">{children}</main>

      <FloatingBottomNav
        active="devices"
        isAdmin={user.role === 'admin'}
        onSelect={(section) => {
          if (section === 'devices') {
            router.push('/ajustes');
            return;
          }
          router.push(section === 'overview' ? '/' : `/?section=${section}`);
        }}
      />
    </div>
  );
}
