'use client';

import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Dashboard from './components/Dashboard';
import AuthGate from './components/AuthGate';
import OnboardingWizard from './components/OnboardingWizard';
import type { User } from '@/types';
import { executeQuery } from '@/lib/graphql-client';

const SESSION_KEY = 'gd_auth_user';
const ONBOARDING_KEY = 'gd_onboarding_done';

const FORCE_ONBOARDING = false;

const CHECK_PANELS_QUERY = `
  query CheckPanels {
    panels { _id }
  }
`;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
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

  // Check if first-time setup is needed after user is authenticated
  useEffect(() => {
    if (!user || setupChecked) return;

    if (FORCE_ONBOARDING) {
      setShowOnboarding(true);
      setSetupChecked(true);
      return;
    }

    const onboardingDone = (() => {
      try { return !!window.localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
    })();

    if (onboardingDone) {
      setSetupChecked(true);
      return;
    }

    executeQuery<{ panels: { _id: string }[] }>(CHECK_PANELS_QUERY, {}, 'network-only')
      .then(data => {
        const hasPanels = Array.isArray(data?.panels) && data.panels.length > 0;
        setShowOnboarding(!hasPanels);
      })
      .catch(() => {
        // If we can't check, skip onboarding to avoid blocking the user
        setShowOnboarding(false);
      })
      .finally(() => {
        setSetupChecked(true);
      });
  }, [user, setupChecked]);

  const handleAuthenticated = (authenticated: User) => {
    setUser(authenticated);
    setSetupChecked(false); // re-check setup for this user
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(authenticated));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setSetupChecked(false);
    setShowOnboarding(false);
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

  return <Dashboard user={user} onLogout={handleLogout} />;
}
