'use client';

import { useEffect, useState } from 'react';
import { ArrowPathIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import Dashboard from './components/Dashboard';
import AuthGate from './components/AuthGate';
import OnboardingWizard from './components/OnboardingWizard';
import type { User } from '@/types';
import { executeQuery } from '@/lib/graphql-client';

const SESSION_KEY = 'gd_auth_user';
const ONBOARDING_KEY = 'gd_onboarding_done';

const FORCE_ONBOARDING = false;

// The system is considered "sin configurar" only when NONE of the data the
// wizard sets up exists yet: no panels, no batteries and no saved location
// (`locationConfig.updatedAt` is null until the location is explicitly saved).
const CHECK_SETUP_QUERY = `
  query CheckSetup {
    panels { _id }
    batteries { _id }
    locationConfig { updatedAt }
  }
`;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [systemUnconfigured, setSystemUnconfigured] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  // Restore session from localStorage
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

  // Check if first-time setup is needed after user is authenticated.
  // The onboarding wizard is admin-only: a non-admin who lands on an
  // unconfigured system gets a "ask an admin" notice instead.
  useEffect(() => {
    if (!user || setupChecked) return;

    const isAdmin = user.role === 'admin';

    if (FORCE_ONBOARDING && isAdmin) {
      setShowOnboarding(true);
      setSetupChecked(true);
      return;
    }

    const onboardingDone = (() => {
      try { return !!window.localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
    })();

    // An admin who already finished onboarding on this browser can skip the
    // round-trip. Non-admins always re-check, since the flag is per-browser
    // and may belong to a different (admin) user.
    if (isAdmin && onboardingDone) {
      setSetupChecked(true);
      return;
    }

    executeQuery<{
      panels: { _id: string }[];
      batteries: { _id: string }[];
      locationConfig: { updatedAt: string | null } | null;
    }>(CHECK_SETUP_QUERY, {}, 'network-only')
      .then(data => {
        const hasPanels = Array.isArray(data?.panels) && data.panels.length > 0;
        const hasBatteries = Array.isArray(data?.batteries) && data.batteries.length > 0;
        const hasLocation = !!data?.locationConfig?.updatedAt;
        const unconfigured = !hasPanels && !hasBatteries && !hasLocation;

        if (isAdmin) {
          setShowOnboarding(unconfigured);
        } else {
          setSystemUnconfigured(unconfigured);
        }
      })
      .catch(() => {
        // If we can't check, don't block the user.
        setShowOnboarding(false);
        setSystemUnconfigured(false);
      })
      .finally(() => {
        setSetupChecked(true);
      });
  }, [user, setupChecked]);

  const handleAuthenticated = (authenticated: User) => {
    setUser(authenticated);
    setSetupChecked(false); // re-check setup for this user
    setShowOnboarding(false);
    setSystemUnconfigured(false);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(authenticated));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setSetupChecked(false);
    setShowOnboarding(false);
    setSystemUnconfigured(false);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Loading — restoring session
  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-600">
          <ArrowPathIcon className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
          Preparando interfaz…
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  // Loading — checking setup
  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <ArrowPathIcon className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // Non-admin on an unconfigured system: the wizard is admin-only, so guide
  // them to ask an administrator instead of dropping them into an empty app.
  if (systemUnconfigured) {
    return <SystemUnconfiguredNotice user={user} onLogout={handleLogout} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

function SystemUnconfiguredNotice({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          <Cog6ToothIcon className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Sistema sin configurar
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          El gemelo digital aún no tiene una configuración inicial (ubicación,
          paneles ni baterías). Un <strong>administrador</strong> debe completar
          la configuración antes de poder usar la aplicación.
        </p>
        <button
          onClick={onLogout}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Cerrar sesión
        </button>
        {user.email && (
          <p className="text-xs text-slate-400 mt-4">
            Sesión actual: {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
