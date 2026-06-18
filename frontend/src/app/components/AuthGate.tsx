'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  SparklesIcon,
  UserPlusIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  BoltIcon,
  ChartPieIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import type { User } from '@/types';
import { executeMutation } from '@/lib/graphql-client';

type AuthMode = 'login' | 'register' | 'ldap';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
}

const STORAGE_KEY = 'gd_auth_autofill';
const DEFAULT_DEMO: {
  name: string;
  email: string;
  password: string;
  invitationCode?: string;
} = {
  name: 'Operador Demo',
  email: 'demo@microrred.cu',
  password: 'Energia2025!',
  invitationCode: '',
};

const FEATURE_CARDS = [
  {
    icon: ShieldCheckIcon,
    title: 'Acceso cifrado',
    description: 'Roles separados y sesiones protegidas para el equipo operativo.',
  },
  {
    icon: BoltIcon,
    title: 'Monitoreo solar',
    description: 'Sincronización continua con la generación fotovoltaica proyectada.',
  },
  {
    icon: ChartPieIcon,
    title: 'Análisis accionable',
    description: 'Pronóstico de generación y alertas energéticas en un mismo panel.',
  },
];

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [ldapNeedsCode, setLdapNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isRegister = mode === 'register';
  const isLdap = mode === 'ldap';

  const title = useMemo(() => {
    if (isRegister) return 'Crear cuenta';
    if (isLdap) return 'Acceso LDAP institucional';
    return 'Acceder al gemelo digital';
  }, [isRegister, isLdap]);
  const actionLabel = useMemo(() => {
    if (isRegister) return 'Registrar y acceder';
    if (isLdap) return 'Iniciar sesión con LDAP';
    return 'Iniciar sesión';
  }, [isRegister, isLdap]);

  const autofill = useCallback(() => {
    let values = DEFAULT_DEMO;
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          values = { ...DEFAULT_DEMO, ...parsed };
        } catch (error) {
          console.warn('No se pudieron leer los datos guardados del relleno rápido.', error);
        }
      }
    }
    setName(values.name);
    setEmail(values.email);
    setPassword(values.password);
    setInvitationCode(values.invitationCode || '');

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    }
    setMessage({
      type: 'success',
      text: 'Campos rellenados con datos de demostración. Puede ajustar antes de continuar.',
    });
  }, []);

  const handleModeChange = useCallback(
    (nextMode: AuthMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      setMessage(null);
      setLdapNeedsCode(false);
    },
    [mode]
  );

  const toggleMode = () => {
    handleModeChange(isRegister ? 'login' : 'register');
  };

  const LDAP_MUTATION = `
    mutation LoginLdap($input: LdapLoginInput!) {
      loginLdap(input: $input) {
        token
        user {
          _id
          email
          name
          role
          createdAt
          updatedAt
        }
      }
    }
  `;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);

    if (isRegister && password.length < 8) {
      setMessage({
        type: 'error',
        text: 'La contraseña debe tener al menos 8 caracteres.',
      });
      setLoading(false);
      return;
    }

    const payload: Record<string, unknown> = {
      email,
      password,
    };
    if (isRegister) {
      payload.name = name.trim() || undefined;
      payload.invitationCode = invitationCode.trim();
    }
    if (isLdap && invitationCode.trim()) {
      payload.invitationCode = invitationCode.trim();
    }

    try {
      const mutation = isRegister
        ? REGISTER_MUTATION
        : isLdap
          ? LDAP_MUTATION
          : LOGIN_MUTATION;

      interface AuthPayload { token: string; user: User }
      const response = await executeMutation<{
        registerUser?: AuthPayload;
        loginUser?: AuthPayload;
        loginLdap?: AuthPayload;
      }>(mutation, { input: cleanInput(payload) });

      const payload2 = (
        isRegister ? response.registerUser : isLdap ? response.loginLdap : response.loginUser
      ) as AuthPayload | undefined;
      if (!payload2?.user) {
        throw new Error('No se pudo completar la autenticación.');
      }
      const user: User = { ...payload2.user, token: payload2.token };

      setMessage({
        type: 'success',
        text: isRegister ? 'Registro completado. Redirigiendo…' : 'Acceso concedido. Preparando panel…',
      });

      if (typeof window !== 'undefined') {
        const persistedName = (user as User).name ?? name;
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            name: persistedName,
            email,
            password,
            invitationCode: isRegister ? '' : invitationCode, // Don't save used code
          })
        );
      }

      onAuthenticated(user);
    } catch (error) {
      console.error('Authentication error:', error);
      const errText = error instanceof Error ? error.message : 'Fallo inesperado al autenticar.';
      if (isLdap && errText.includes('INVITATION_CODE_REQUIRED')) {
        setLdapNeedsCode(true);
        setMessage({
          type: 'error',
          text: 'Es su primer ingreso por LDAP. Introduzca el código de invitación generado por un administrador para completar el alta.',
        });
      } else {
        setMessage({ type: 'error', text: errText });
      }
    } finally {
      setLoading(false);
    }
  };

  const modeIndex = isRegister ? 1 : isLdap ? 2 : 0;
  const oppositePrompt = isRegister ? '¿Ya forma parte del equipo?' : '¿Primera vez en la plataforma?';
  const oppositeAction = isRegister ? 'Acceder con mi cuenta' : 'Crear acceso';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-slate-200/60 blur-[110px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-100/70 blur-[120px]" />
        <div className="absolute -bottom-40 -right-28 h-80 w-80 rounded-full bg-blue-100/60 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2.25rem] border border-slate-100/80 bg-white/70 shadow-[0_45px_95px_-45px_rgba(15,23,42,0.35)] backdrop-blur-[20px] md:grid-cols-2">
          <aside className="relative hidden md:flex md:flex-col md:justify-between">
            <img
              src="/img/image.png"
              alt="Microrred solar"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/70" />

            <div className="relative z-10 flex flex-col gap-8 p-12 text-white">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-200/90">
                  <SparklesIcon className="h-4 w-4 text-blue-200" />
                  Microrred Solar
                </span>
                <h1 className="text-[32px] font-semibold leading-tight text-white">
                  Gemelo Digital Fotovoltaico
                </h1>
                <p className="text-sm text-white/70 leading-relaxed">
                  Monitoreo en tiempo real, predicción de generación y consumo, y análisis de apagones para la microrred solar.
                </p>
              </div>

              <div className="grid gap-3">
                {FEATURE_CARDS.map(({ icon: Icon, title: featureTitle, description }) => (
                  <div
                    key={featureTitle}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-black/10 backdrop-blur"
                  >
                    <div className="rounded-xl bg-white/10 p-2">
                      <Icon className="h-5 w-5 text-blue-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{featureTitle}</p>
                      <p className="text-xs text-blue-100/80">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 border-t border-white/10 px-12 py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200/70">
                Sistema monitoreado
              </p>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-xl font-semibold text-white">50 kW</p>
                  <p className="text-xs text-blue-100/70">Generación solar</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-white">100 kWh</p>
                  <p className="text-xs text-blue-100/70">Almacenamiento</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-white">La Habana</p>
                  <p className="text-xs text-blue-100/70">Cuba</p>
                </div>
              </div>
            </div>
          </aside>

          <section className="relative flex flex-col justify-between p-8 sm:p-12">
            <div className="mb-10">
              <div className="relative">
                <div className="flex rounded-full bg-slate-200/60 p-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                  <span
                    className="absolute inset-y-1 left-1 w-1/3 rounded-full bg-white shadow-lg shadow-slate-300/70 transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(${modeIndex * 100}%)` }}
                  />
                  <button
                    type="button"
                    aria-pressed={mode === 'login'}
                    onClick={() => handleModeChange('login')}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 transition-colors ${mode === 'login' ? 'text-slate-900' : 'hover:text-slate-700'
                      }`}
                  >
                    Acceso
                  </button>
                  <button
                    type="button"
                    aria-pressed={isRegister}
                    onClick={() => handleModeChange('register')}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 transition-colors ${isRegister ? 'text-slate-900' : 'hover:text-slate-700'
                      }`}
                  >
                    Registro
                  </button>
                  <button
                    type="button"
                    aria-pressed={isLdap}
                    onClick={() => handleModeChange('ldap')}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 transition-colors ${isLdap ? 'text-slate-900' : 'hover:text-slate-700'
                      }`}
                  >
                    LDAP
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                  Portal Operativo
                </p>
                <h2 className="text-3xl font-semibold text-slate-900">{title}</h2>
                <p className="text-sm text-slate-500">
                  {isRegister
                    ? 'Cree su cuenta de operador para planificar mantenimientos, supervisar baterías y responder a apagones.'
                    : isLdap
                      ? 'Autenticación contra el directorio corporativo. En su primer ingreso necesitará el código de invitación del administrador.'
                      : 'Ingrese con sus credenciales o utilice datos demo para explorar el gemelo digital.'}
                </p>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5">
                {isRegister && (
                  <div
                    className="transition-all duration-500 ease-out"
                    style={{ transform: `translateY(${isRegister ? '0%' : '-8%'})`, opacity: isRegister ? 1 : 0 }}
                  >
                    <label className="flex items-center justify-between text-sm font-medium text-slate-700" htmlFor="name">
                      Nombre completo (opcional)
                      <span className="text-[10px] uppercase tracking-[0.3em] text-sky-500">Equipo</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 shadow-inner shadow-white/40 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50 focus:outline-none"
                      placeholder="Ej. Operador turno mañana"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 shadow-inner shadow-white/40 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50 focus:outline-none"
                    placeholder="operador@microrred.cu"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 shadow-inner shadow-white/40 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50 focus:outline-none"
                    placeholder={isLdap ? 'Contraseña LDAP' : isRegister ? 'Mínimo 8 caracteres' : 'Su contraseña'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    minLength={isRegister ? 8 : undefined}
                  />
                </div>

                {(isRegister || (isLdap && ldapNeedsCode)) && (
                  <div
                    className="transition-all duration-500 ease-out"
                    style={{ transform: 'translateY(0%)', opacity: 1 }}
                  >
                    <label className="block text-sm font-medium text-slate-700" htmlFor="invitationCode">
                      Código de invitación
                    </label>
                    <div className="relative">
                      <input
                        id="invitationCode"
                        type="text"
                        required
                        value={invitationCode}
                        onChange={(event) => setInvitationCode(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 pl-12 text-slate-900 shadow-inner shadow-white/40 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50 focus:outline-none font-mono tracking-wider"
                        placeholder="ABCD1234"
                        autoComplete="off"
                      />
                      <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 mt-1 h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {isLdap
                        ? 'Solo se solicita en su primer ingreso por LDAP. Define su rol en el sistema.'
                        : 'Código único proporcionado por el administrador. Define su rol.'}
                    </p>
                  </div>
                )}
              </div>

              {message && (
                <div
                  role={message.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`rounded-2xl border px-4 py-3 text-sm shadow-inner transition ${message.type === 'error'
                    ? 'border-red-300/60 bg-red-50 text-red-600'
                    : 'border-sky-300/60 bg-sky-50 text-sky-600'
                    }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-400/30 transition hover:bg-blue-500 hover:shadow-blue-400/50 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
                disabled={loading}
              >
                <span className="absolute inset-0 -translate-x-full bg-white/30 mix-blend-overlay transition-transform duration-700 ease-out group-hover:translate-x-0" />
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Procesando…
                  </>
                ) : isRegister ? (
                  <>
                    <UserPlusIcon className="h-5 w-5" />
                    {actionLabel}
                  </>
                ) : (
                  <>
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    {actionLabel}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={autofill}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200/80 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-800"
                type="button"
              >
                Rellenar datos demo
              </button>
              <button
                onClick={toggleMode}
                className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                type="button"
              >
                <span className="mr-1 text-xs uppercase tracking-[0.3em] text-slate-400">{oppositePrompt}</span>
                {oppositeAction}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
const REGISTER_MUTATION = `
  mutation RegisterUser($input: RegisterInput!) {
    registerUser(input: $input) {
      token
      user {
        _id
        email
        name
        role
        createdAt
        updatedAt
      }
    }
  }
`;

const LOGIN_MUTATION = `
  mutation LoginUser($input: LoginInput!) {
    loginUser(input: $input) {
      token
      user {
        _id
        email
        name
        role
        createdAt
        updatedAt
      }
    }
  }
`;

const cleanInput = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T;
