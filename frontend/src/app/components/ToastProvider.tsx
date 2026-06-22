'use client';

/**
 * Sistema de notificaciones (toasts) global.
 *
 * Provee `ToastProvider` (se monta una vez en el layout raíz) y el hook
 * `useToast()`, que devuelve helpers `success / error / info / warning` para
 * dar feedback inmediato al usuario tras una acción (guardar, borrar, etc.).
 *
 * Antes muchos errores se tragaban con `console.error` y el usuario no veía
 * nada; ahora cada acción confirma visualmente su resultado.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
  exiting?: boolean;
};

type ToastContextValue = {
  notify: (variant: ToastVariant, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<
  ToastVariant,
  { icon: React.ReactNode; ring: string; bar: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    ring: 'border-emerald-200',
    bar: 'bg-emerald-500',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    ring: 'border-red-200',
    bar: 'bg-red-500',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    ring: 'border-amber-200',
    bar: 'bg-amber-500',
    iconColor: 'text-amber-600',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    ring: 'border-sky-200',
    bar: 'bg-sky-500',
    iconColor: 'text-sky-600',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    // Marca como saliente para reproducir la animación, luego lo quita.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 300);
    timers.current.set(id, t);
  }, []);

  const notify = useCallback(
    (variant: ToastVariant, message: string, duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
      const t = setTimeout(() => remove(id), duration);
      timers.current.set(id, t);
    },
    [remove],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value: ToastContextValue = {
    notify,
    success: (m, d) => notify('success', m, d),
    error: (m, d) => notify('error', m, d),
    info: (m, d) => notify('info', m, d),
    warning: (m, d) => notify('warning', m, d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,22rem)] flex-col items-stretch">
        {toasts.map((toast) => {
          const style = VARIANT_STYLE[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto mb-2 overflow-hidden rounded-xl border ${style.ring} bg-white/95 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.55)] backdrop-blur ${
                toast.exiting ? 'animate-toast-out' : 'animate-toast-in'
              }`}
            >
              <div className="flex items-start gap-3 p-3.5">
                <span className={`mt-0.5 shrink-0 ${style.iconColor}`}>{style.icon}</span>
                <p className="flex-1 text-sm leading-snug text-slate-700">{toast.message}</p>
                <button
                  onClick={() => remove(toast.id)}
                  className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Cerrar notificación"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!toast.exiting && (
                <div
                  className={`h-0.5 origin-left ${style.bar}`}
                  style={{ animation: `toast-bar ${toast.duration}ms linear forwards` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook para emitir notificaciones. Si se usa fuera del provider, degrada a
 * no-op (no rompe el render) para no obligar a envolver tests aislados.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  const noop = () => {};
  return { notify: noop, success: noop, error: noop, info: noop, warning: noop };
}
