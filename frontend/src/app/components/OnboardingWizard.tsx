'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { executeMutation } from '@/lib/graphql-client';
import { ArrowRightIcon, ArrowLeftIcon, CheckIcon, ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Lazy-load Leaflet map (client-only, no SSR)
const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f7',
        color: '#86868b',
        fontSize: 12,
      }}
    >
      Cargando mapa…
    </div>
  ),
});

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const SAVE_LOCATION_MUTATION = `
  mutation SaveLocationConfig($input: LocationConfigInput!) {
    saveLocationConfig(input: $input) { lat lon name }
  }
`;

const CREATE_PANEL_MUTATION = `
  mutation CreatePanel($input: PanelInput!) {
    createPanel(input: $input) { _id }
  }
`;

const CREATE_BATTERY_MUTATION = `
  mutation CreateBattery($input: BatteryInput!) {
    createBattery(input: $input) { _id }
  }
`;

const CREATE_APPLIANCE_MUTATION = `
  mutation CreateAppliance($input: ApplianceInput!) {
    createAppliance(input: $input) { _id }
  }
`;

// ─── Presets ──────────────────────────────────────────────────────────────────

const LOCATION_PRESETS = [
  { name: 'La Habana, Cuba',      lat: 23.1136,  lon: -82.3666 },
  { name: 'Santiago de Cuba',     lat: 20.0174,  lon: -75.8171 },
  { name: 'Matanzas, Cuba',       lat: 23.0444,  lon: -81.5776 },
  { name: 'Santa Clara, Cuba',    lat: 22.4065,  lon: -79.9635 },
  { name: 'Camagüey, Cuba',       lat: 21.3809,  lon: -77.9172 },
  { name: 'Holguín, Cuba',        lat: 20.8874,  lon: -76.2674 },
  { name: 'Cienfuegos, Cuba',     lat: 22.1469,  lon: -80.4478 },
  { name: 'Pinar del Río, Cuba',  lat: 22.4170,  lon: -83.6989 },
];

const ORIENTATIONS = ['Sur', 'Sureste', 'Suroeste', 'Este', 'Oeste', 'Norte'];

const APPLIANCE_PRESETS = [
  { name: 'Refrigerador',       category: 'Refrigeración',  avg: 150,  max: 400 },
  { name: 'Aire acondicionado', category: 'Climatización',  avg: 1200, max: 1800 },
  { name: 'Televisor',          category: 'Entretenimiento', avg: 80,  max: 120 },
  { name: 'Iluminación LED',    category: 'Iluminación',    avg: 60,   max: 60 },
  { name: 'Lavadora',           category: 'Lavandería',     avg: 500,  max: 1300 },
];

interface ApplianceDraft {
  name: string;
  category?: string;
  averagePowerW: number;
  maxPowerW: number;
  quantity: number;
  activeHours?: number;
}

// Apple-inspired palette
const C = {
  text: '#1d1d1f',
  text2: '#424245',
  text3: '#6e6e73',
  text4: '#86868b',
  border: '#d2d2d7',
  borderLight: '#e5e5e7',
  bg: '#fbfbfd',
  bgChip: '#f5f5f7',
  white: '#ffffff',
  blue: '#0071e3',
  blueHover: '#0077ed',
  green: '#34c759',
  greenDark: '#26a749',
  dark: '#1d1d1f',
};

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';

// ─── Animated number counter ──────────────────────────────────────────────────

function useAnimatedNumber(value: number, duration = 400) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

// ─── Mouse parallax ───────────────────────────────────────────────────────────
// Smoothed pointer tracking exposed as CSS vars (--px / --py, range -1..1) so
// each background layer can translate at its own depth without re-rendering.

function useParallax() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = 0, targetY = 0, curX = 0, curY = 0, raf = 0;

    const onMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const tick = () => {
      curX += (targetX - curX) * 0.055;
      curY += (targetY - curY) * 0.055;
      el.style.setProperty('--px', curX.toFixed(4));
      el.style.setProperty('--py', curY.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

type Direction = 'forward' | 'backward' | 'none';

// ─── UI primitives ────────────────────────────────────────────────────────────
// Labels are a single fixed-height line and hints go BELOW the input, so the
// inputs of a two-column row always sit on the same baseline.

function Field({
  label, hint, children, delay = 0, required,
}: {
  label: string; hint?: string; children: React.ReactNode; delay?: number; required?: boolean;
}) {
  return (
    <div className="wiz-stagger" style={{ animationDelay: `${delay}ms`, minWidth: 0 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: C.text,
          marginBottom: 7,
          lineHeight: '18px',
          height: 18,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {label}
        {required && (
          <span style={{ fontSize: 11.5, color: C.text4, fontWeight: 400 }}>
            requerido
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 12, color: C.text4, lineHeight: 1.45, marginTop: 6 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Input({
  value, onChange, type = 'text', placeholder, step, min, max,
}: {
  value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; step?: string;
  min?: string; max?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      className="wiz-input"
      style={{
        width: '100%',
        height: 44,
        fontFamily: FONT_STACK,
        fontSize: 15,
        color: C.text,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '0 14px',
        outline: 'none',
        transition: 'all 0.15s ease',
      }}
    />
  );
}

function Select({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="wiz-input"
        style={{
          width: '100%',
          height: 44,
          fontFamily: FONT_STACK,
          fontSize: 15,
          color: C.text,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '0 38px 0 14px',
          outline: 'none',
          transition: 'all 0.15s ease',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: C.text4,
        }}
      >
        <svg width="11" height="7" viewBox="0 0 12 8" fill="none">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="wiz-stagger"
      style={{
        animationDelay: `${delay}ms`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text4,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(29,29,31,0.08)' }} />
    </div>
  );
}

function PrimaryButton({
  onClick, loading, disabled, children,
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="wiz-btn-primary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: FONT_STACK,
        fontSize: 14.5,
        fontWeight: 500,
        color: C.white,
        background: C.dark,
        borderRadius: 10,
        padding: '0 22px',
        height: 44,
        border: 'none',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.4 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="wiz-btn-ghost"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: FONT_STACK,
        fontSize: 14,
        fontWeight: 500,
        color: C.text2,
        background: 'rgba(29,29,31,0.05)',
        borderRadius: 10,
        padding: '0 16px',
        height: 44,
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ─── Footer actions ───────────────────────────────────────────────────────────
// Single consistent action row: back on the left, skip + primary on the right.

function FooterActions({
  onBack, onSkip, skipLabel = 'Omitir este paso', primaryLabel, onPrimary, loading, delay = 0,
}: {
  onBack?: () => void; onSkip?: () => void; skipLabel?: string;
  primaryLabel: React.ReactNode; onPrimary: () => void; loading?: boolean; delay?: number;
}) {
  return (
    <div
      className="wiz-stagger"
      style={{
        animationDelay: `${delay}ms`,
        marginTop: 34,
        paddingTop: 22,
        borderTop: '1px solid rgba(29,29,31,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        {onBack && (
          <GhostButton onClick={onBack}>
            <ArrowLeftIcon className="w-4 h-4" strokeWidth={2.2} />
            Atrás
          </GhostButton>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {onSkip && (
          <button onClick={onSkip} className="wiz-link" style={{ fontFamily: FONT_STACK }}>
            {skipLabel}
          </button>
        )}
        <PrimaryButton onClick={onPrimary} loading={loading}>
          {primaryLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Step rail (left sidebar) ─────────────────────────────────────────────────

const RAIL_STEPS = [
  { n: 1, title: 'Ubicación', sub: 'Sitio de la instalación' },
  { n: 2, title: 'Paneles', sub: 'Arreglo fotovoltaico' },
  { n: 3, title: 'Baterías', sub: 'Almacenamiento' },
  { n: 4, title: 'Consumo', sub: 'Equipos eléctricos' },
];

function StepRail({ step }: { step: number }) {
  return (
    <aside
      className="wiz-rail"
      style={{
        width: 272,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '38px 32px 30px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 100%)',
        borderRight: '1px solid rgba(29,29,31,0.07)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'linear-gradient(150deg, #2c2c2e 0%, #111113 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px -3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
            flexShrink: 0,
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Gemelo digital
          </p>
          <p style={{ fontSize: 12, color: C.text4, marginTop: 2 }}>
            Configuración inicial
          </p>
        </div>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, paddingTop: 44 }}>
        {RAIL_STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          const last = i === RAIL_STEPS.length - 1;
          return (
            <div key={s.n} style={{ display: 'flex', gap: 14 }}>
              {/* Circle + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 0.35s ease',
                    ...(done
                      ? { background: C.green, color: C.white, boxShadow: '0 3px 8px -2px rgba(52,199,89,0.5)' }
                      : active
                        ? { background: C.dark, color: C.white, boxShadow: '0 0 0 4px rgba(29,29,31,0.09)' }
                        : { background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.border}`, color: C.text4 }),
                  }}
                >
                  {done ? <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} /> : s.n}
                </div>
                {!last && (
                  <div
                    style={{
                      width: 1.5,
                      flex: 1,
                      minHeight: 26,
                      margin: '7px 0',
                      borderRadius: 999,
                      background: done ? 'rgba(52,199,89,0.45)' : 'rgba(29,29,31,0.1)',
                      transition: 'background 0.35s ease',
                    }}
                  />
                )}
              </div>
              {/* Labels */}
              <div style={{ paddingBottom: last ? 0 : 30, paddingTop: 3, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    color: active || done ? C.text : C.text3,
                    lineHeight: 1.25,
                    transition: 'color 0.3s ease',
                  }}
                >
                  {s.title}
                </p>
                <p style={{ fontSize: 11.5, color: C.text4, marginTop: 3, lineHeight: 1.35 }}>
                  {s.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rail footer */}
      <p
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: C.text4,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        CUJAE · La Habana
      </p>
    </aside>
  );
}

// ─── Compact progress (mobile, rail hidden) ───────────────────────────────────

function ProgressIndicator({ step }: { step: number }) {
  const labels = ['Ubicación', 'Paneles', 'Baterías', 'Consumo'];
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {labels.map((label, idx) => {
          const n = idx + 1;
          const filled = step >= n;
          const active = step === n;
          return (
            <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ width: '100%', height: 3, borderRadius: 999, background: 'rgba(29,29,31,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: filled ? '100%' : '0%',
                    borderRadius: 999,
                    background: C.dark,
                    transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: filled ? C.text : C.text4,
                  letterSpacing: '0.02em',
                }}
              >
                {n}. {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({
  eyebrow, title, description,
}: {
  eyebrow: string; title: string; description: string;
}) {
  return (
    <div style={{ marginBottom: 30 }}>
      <p
        className="wiz-stagger"
        style={{
          animationDelay: '0ms',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.text4,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </p>
      <h2
        className="wiz-stagger"
        style={{
          animationDelay: '60ms',
          fontSize: 27,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <p
        className="wiz-stagger"
        style={{
          animationDelay: '120ms',
          fontSize: 14.5,
          color: C.text2,
          lineHeight: 1.55,
          maxWidth: 560,
        }}
      >
        {description}
      </p>
    </div>
  );
}

// ─── Summary strip (live totals) ──────────────────────────────────────────────

function SummaryStrip({
  label, value, unit, delay = 0,
}: {
  label: string; value: string; unit: string; delay?: number;
}) {
  return (
    <div
      className="wiz-stagger"
      style={{
        animationDelay: `${delay}ms`,
        marginTop: 26,
        background: 'rgba(29,29,31,0.035)',
        border: '1px solid rgba(29,29,31,0.07)',
        borderRadius: 12,
        padding: '15px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text3, marginLeft: 5 }}>{unit}</span>
      </span>
    </div>
  );
}

// ─── Step content ──────────────────────────────────────────────────────────────

function WelcomeContent({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div>
      <div
        className="wiz-stagger"
        style={{
          animationDelay: '0ms',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 13px',
          borderRadius: 999,
          background: 'rgba(52,199,89,0.09)',
          border: '1px solid rgba(52,199,89,0.22)',
          marginBottom: 22,
        }}
      >
        <span
          className="wiz-pulse-dot"
          style={{ width: 6, height: 6, borderRadius: 999, background: C.green, flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.greenDark, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Asistente de configuración
        </span>
      </div>

      <h1
        className="wiz-stagger"
        style={{
          animationDelay: '60ms',
          fontSize: 38,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.028em',
          lineHeight: 1.08,
          marginBottom: 16,
          maxWidth: 520,
        }}
      >
        Configure su sistema fotovoltaico
      </h1>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '120ms',
          fontSize: 15.5,
          color: C.text2,
          lineHeight: 1.6,
          marginBottom: 30,
          maxWidth: 540,
        }}
      >
        Este asistente le guiará en la puesta en marcha del gemelo digital. Los
        parámetros que ingrese alimentan los cálculos de producción solar, las
        predicciones meteorológicas y las estimaciones de autonomía energética.
      </p>

      {/* Meta row */}
      <div
        className="wiz-stagger"
        style={{
          animationDelay: '180ms',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        {[
          { v: '4', l: 'pasos guiados' },
          { v: '~3 min', l: 'tiempo estimado' },
          { v: 'Ajustes', l: 'editable después' },
        ].map((m, i) => (
          <div
            key={m.l}
            style={{
              paddingRight: 28,
              marginRight: 28,
              borderRight: i < 2 ? '1px solid rgba(29,29,31,0.1)' : 'none',
            }}
          >
            <p style={{ fontSize: 19, fontWeight: 600, color: C.text, letterSpacing: '-0.015em' }}>{m.v}</p>
            <p style={{ fontSize: 12, color: C.text4, marginTop: 2 }}>{m.l}</p>
          </div>
        ))}
      </div>

      <FooterActions
        onSkip={onSkip}
        skipLabel="Configurar más tarde"
        primaryLabel={<>Comenzar configuración <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} /></>}
        onPrimary={onStart}
        delay={240}
      />
    </div>
  );
}

function LocationContent({
  onSave, onSkip, onBack,
}: {
  onSave: (data: { lat: number; lon: number; name: string }) => Promise<void>;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [preset, setPreset] = useState('La Habana, Cuba');
  const [lat, setLat] = useState('23.1136');
  const [lon, setLon] = useState('-82.3666');
  const [name, setName] = useState('La Habana, Cuba');
  const [saving, setSaving] = useState(false);

  const handlePreset = (val: string) => {
    setPreset(val);
    const p = LOCATION_PRESETS.find(p => p.name === val);
    if (p) { setLat(String(p.lat)); setLon(String(p.lon)); setName(p.name); }
  };

  const handleMapPick = (newLat: number, newLon: number) => {
    setLat(newLat.toFixed(4));
    setLon(newLon.toFixed(4));
    setPreset('__custom__');
  };

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    if (isNaN(latN) || isNaN(lonN) || !name.trim()) { onSkip(); return; }
    setSaving(true);
    await onSave({ lat: latN, lon: lonN, name: name.trim() });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 1 de 4"
        title="Ubicación geográfica"
        description="Estos datos se utilizan para calcular la radiación solar disponible y obtener pronósticos meteorológicos del servicio Open-Meteo."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="wiz-grid2">
          <Field
            label="Localidad"
            hint="Ciudad preconfigurada o coordenadas personalizadas."
            delay={180}
          >
            <Select
              value={preset}
              onChange={handlePreset}
              options={[
                ...LOCATION_PRESETS.map(p => ({ value: p.name, label: p.name })),
                { value: '__custom__', label: 'Coordenadas personalizadas' },
              ]}
            />
          </Field>
          <Field
            label="Nombre del sistema"
            hint="Aparecerá en reportes y en el panel principal."
            delay={220}
          >
            <Input value={name} onChange={setName} placeholder="CUJAE — La Habana, Cuba" />
          </Field>
        </div>

        <div className="wiz-stagger" style={{ animationDelay: '260ms' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 230,
              borderRadius: 14,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              background: '#f5f5f7',
            }}
          >
            <MapPicker
              lat={Number.isFinite(latNum) ? latNum : 23.1136}
              lon={Number.isFinite(lonNum) ? lonNum : -82.3666}
              onChange={handleMapPick}
            />
          </div>
          <p style={{ fontSize: 12, color: C.text4, lineHeight: 1.45, marginTop: 8 }}>
            Haga clic en el mapa o arrastre el marcador; las coordenadas se actualizan automáticamente.
          </p>
        </div>

        <div className="wiz-grid2">
          <Field label="Latitud" hint="Grados decimales (−90 a 90)." delay={300}>
            <Input
              value={lat}
              onChange={v => { setLat(v); setPreset('__custom__'); }}
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              placeholder="23.1136"
            />
          </Field>
          <Field label="Longitud" hint="Grados decimales (−180 a 180)." delay={340}>
            <Input
              value={lon}
              onChange={v => { setLon(v); setPreset('__custom__'); }}
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              placeholder="-82.3666"
            />
          </Field>
        </div>
      </div>

      <FooterActions
        onBack={onBack}
        onSkip={onSkip}
        primaryLabel={<>Continuar <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} /></>}
        onPrimary={handleSave}
        loading={saving}
        delay={400}
      />
    </div>
  );
}

function PanelContent({
  onSave, onSkip, onBack,
}: {
  onSave: (data: {
    manufacturer: string; model?: string; ratedPowerKw: number;
    quantity: number; tiltDegrees?: number; orientation?: string;
  }) => Promise<void>;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [ratedPowerKw, setRatedPowerKw] = useState('0.55');
  const [quantity, setQuantity] = useState('10');
  const [tiltDegrees, setTiltDegrees] = useState('15');
  const [orientation, setOrientation] = useState('Sur');
  const [saving, setSaving] = useState(false);

  const totalKw = (parseFloat(ratedPowerKw) || 0) * (parseInt(quantity) || 0);
  const animatedTotal = useAnimatedNumber(totalKw);

  const handleSave = async () => {
    const kw = parseFloat(ratedPowerKw);
    const qty = parseInt(quantity);
    if (!manufacturer.trim() || !Number.isFinite(kw) || kw <= 0 || !Number.isFinite(qty) || qty <= 0) {
      onSkip();
      return;
    }
    setSaving(true);
    await onSave({
      manufacturer: manufacturer.trim(),
      model: model.trim() || undefined,
      ratedPowerKw: kw,
      quantity: qty,
      tiltDegrees: tiltDegrees ? parseFloat(tiltDegrees) : undefined,
      orientation: orientation || undefined,
    });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 2 de 4"
        title="Arreglo fotovoltaico"
        description="La potencia total instalada es el parámetro principal del modelo de simulación de producción solar."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionLabel delay={160}>Identificación</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Fabricante" required delay={200}>
            <Input value={manufacturer} onChange={setManufacturer} placeholder="Canadian Solar" />
          </Field>
          <Field label="Modelo" hint="Opcional." delay={240}>
            <Input value={model} onChange={setModel} placeholder="CS6R-550MS" />
          </Field>
        </div>

        <SectionLabel delay={280}>Características técnicas</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Potencia por panel" hint="Potencia nominal STC en kilowatts." delay={320}>
            <Input value={ratedPowerKw} onChange={setRatedPowerKw} type="number" step="0.01" min="0.01" placeholder="0.55" />
          </Field>
          <Field label="Número de paneles" hint="Cantidad total del arreglo." delay={360}>
            <Input value={quantity} onChange={setQuantity} type="number" step="1" min="1" placeholder="10" />
          </Field>
        </div>

        <SectionLabel delay={400}>Geometría del montaje</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Inclinación" hint="Ángulo respecto al plano horizontal (°)." delay={440}>
            <Input value={tiltDegrees} onChange={setTiltDegrees} type="number" step="1" min="0" max="90" placeholder="15" />
          </Field>
          <Field label="Orientación" hint="Dirección de las caras frontales." delay={480}>
            <Select value={orientation} onChange={setOrientation} options={ORIENTATIONS.map(o => ({ value: o, label: o }))} />
          </Field>
        </div>
      </div>

      <SummaryStrip
        label="Potencia instalada estimada"
        value={animatedTotal > 0.05 ? animatedTotal.toFixed(1) : '—'}
        unit="kW"
        delay={520}
      />

      <FooterActions
        onBack={onBack}
        onSkip={onSkip}
        primaryLabel={<>Continuar <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} /></>}
        onPrimary={handleSave}
        loading={saving}
        delay={560}
      />
    </div>
  );
}

function BatteryContent({
  onSave, onSkip, onBack,
}: {
  onSave: (data: { manufacturer: string; model?: string; capacityKwh: number; quantity: number }) => Promise<void>;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [capacityKwh, setCapacityKwh] = useState('100');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const totalKwh = (parseFloat(capacityKwh) || 0) * (parseInt(quantity) || 0);
  const animatedTotal = useAnimatedNumber(totalKwh);

  const handleSave = async () => {
    const cap = parseFloat(capacityKwh);
    const qty = parseInt(quantity);
    if (!manufacturer.trim() || !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(qty) || qty <= 0) {
      onSkip();
      return;
    }
    setSaving(true);
    await onSave({
      manufacturer: manufacturer.trim(),
      model: model.trim() || undefined,
      capacityKwh: cap,
      quantity: qty,
    });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 3 de 4"
        title="Sistema de almacenamiento"
        description="La capacidad total del banco de baterías determina la autonomía del sistema durante períodos sin radiación solar o apagones."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionLabel delay={160}>Identificación</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Fabricante" required delay={200}>
            <Input value={manufacturer} onChange={setManufacturer} placeholder="CATL" />
          </Field>
          <Field label="Modelo" hint="Opcional." delay={240}>
            <Input value={model} onChange={setModel} placeholder="LiFePO4-100" />
          </Field>
        </div>

        <SectionLabel delay={280}>Capacidad</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Capacidad por módulo" hint="Capacidad nominal en kWh." delay={320}>
            <Input value={capacityKwh} onChange={setCapacityKwh} type="number" step="0.1" min="0.1" placeholder="100" />
          </Field>
          <Field label="Número de módulos" hint="Cantidad de unidades." delay={360}>
            <Input value={quantity} onChange={setQuantity} type="number" step="1" min="1" placeholder="1" />
          </Field>
        </div>
      </div>

      <SummaryStrip
        label="Almacenamiento total estimado"
        value={animatedTotal > 0.5 ? animatedTotal.toFixed(0) : '—'}
        unit="kWh"
        delay={400}
      />

      <FooterActions
        onBack={onBack}
        onSkip={onSkip}
        primaryLabel={<>Continuar <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} /></>}
        onPrimary={handleSave}
        loading={saving}
        delay={440}
      />
    </div>
  );
}

function AppliancesContent({
  onSave, onSkip, onBack,
}: {
  onSave: (items: ApplianceDraft[]) => Promise<void>;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ApplianceDraft[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [avgW, setAvgW] = useState('');
  const [maxW, setMaxW] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [activeHours, setActiveHours] = useState('');
  const [saving, setSaving] = useState(false);

  const totalAvgW = items.reduce((sum, i) => sum + i.averagePowerW * i.quantity, 0);
  const animatedTotal = useAnimatedNumber(totalAvgW);

  const applyPreset = (p: typeof APPLIANCE_PRESETS[number]) => {
    setName(p.name);
    setCategory(p.category);
    setAvgW(String(p.avg));
    setMaxW(String(p.max));
    setQuantity('1');
  };

  const avg = parseFloat(avgW);
  const canAdd = !!name.trim() && Number.isFinite(avg) && avg > 0;

  const addItem = () => {
    if (!canAdd) return;
    const max = parseFloat(maxW);
    const qty = parseInt(quantity);
    const hours = parseFloat(activeHours);
    setItems(prev => [
      ...prev,
      {
        name: name.trim(),
        category: category.trim() || undefined,
        averagePowerW: avg,
        maxPowerW: Number.isFinite(max) && max > 0 ? max : avg,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        activeHours: Number.isFinite(hours) && hours >= 0 ? hours : undefined,
      },
    ]);
    setName(''); setCategory(''); setAvgW(''); setMaxW(''); setQuantity('1'); setActiveHours('');
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!items.length) { onSkip(); return; }
    setSaving(true);
    await onSave(items);
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 4 de 4"
        title="Equipos de consumo"
        description="Registre los equipos eléctricos conectados al sistema. La carga total se utiliza para estimar la autonomía de las baterías y planificar el consumo."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Quick presets */}
        <div className="wiz-stagger" style={{ animationDelay: '160ms' }}>
          <p style={{ fontSize: 12, color: C.text4, marginBottom: 9 }}>
            Equipos comunes — haga clic para rellenar el formulario:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {APPLIANCE_PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="wiz-chip"
                style={{ fontFamily: FONT_STACK }}
              >
                {p.name}
                <span style={{ color: C.text4, fontWeight: 400, marginLeft: 5 }}>{p.avg} W</span>
              </button>
            ))}
          </div>
        </div>

        <SectionLabel delay={200}>Nuevo equipo</SectionLabel>

        <div className="wiz-grid2">
          <Field label="Nombre" required delay={240}>
            <Input value={name} onChange={setName} placeholder="Refrigerador" />
          </Field>
          <Field label="Categoría" hint="Opcional." delay={270}>
            <Input value={category} onChange={setCategory} placeholder="Refrigeración" />
          </Field>
        </div>

        <div className="wiz-grid2">
          <Field label="Potencia media" hint="Consumo promedio en watts." required delay={300}>
            <Input value={avgW} onChange={setAvgW} type="number" step="1" min="1" placeholder="150" />
          </Field>
          <Field label="Potencia máxima" hint="En watts; vacío = igual a la media." delay={330}>
            <Input value={maxW} onChange={setMaxW} type="number" step="1" min="1" placeholder="400" />
          </Field>
        </div>

        <div className="wiz-grid2">
          <Field label="Cantidad" hint="Unidades de este equipo." delay={360}>
            <Input value={quantity} onChange={setQuantity} type="number" step="1" min="1" placeholder="1" />
          </Field>
          <Field label="Horas activas por día" hint="Opcional; uso diario estimado." delay={390}>
            <Input value={activeHours} onChange={setActiveHours} type="number" step="0.5" min="0" max="24" placeholder="8" />
          </Field>
        </div>

        <div className="wiz-stagger" style={{ animationDelay: '420ms', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={addItem}
            disabled={!canAdd}
            className="wiz-btn-ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: FONT_STACK,
              fontSize: 14,
              fontWeight: 500,
              color: C.text2,
              background: 'rgba(29,29,31,0.05)',
              borderRadius: 10,
              padding: '0 16px',
              height: 40,
              border: 'none',
              cursor: canAdd ? 'pointer' : 'not-allowed',
              opacity: canAdd ? 1 : 0.45,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <PlusIcon className="w-4 h-4" strokeWidth={2.2} />
            Agregar a la lista
          </button>
        </div>

        {/* Added appliances */}
        {items.length > 0 && (
          <div>
            <SectionLabel>Equipos registrados ({items.length})</SectionLabel>
            <div
              style={{
                marginTop: 14,
                border: '1px solid rgba(29,29,31,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {items.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 16px',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(29,29,31,0.02)',
                    borderTop: i > 0 ? '1px solid rgba(29,29,31,0.06)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 500, color: C.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                      {item.quantity > 1 && (
                        <span style={{ color: C.text4, fontWeight: 400 }}> × {item.quantity}</span>
                      )}
                    </p>
                    {item.category && (
                      <p style={{ fontSize: 11.5, color: C.text4, marginTop: 1 }}>{item.category}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {item.averagePowerW * item.quantity} W
                    {item.activeHours !== undefined && (
                      <span style={{ color: C.text4, fontWeight: 400 }}> · {item.activeHours} h/día</span>
                    )}
                  </span>
                  <button
                    onClick={() => removeItem(i)}
                    aria-label={`Eliminar ${item.name}`}
                    className="wiz-row-remove"
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      border: 'none',
                      background: 'transparent',
                      color: C.text4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <XMarkIcon className="w-4 h-4" strokeWidth={2.2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SummaryStrip
        label="Carga media total"
        value={animatedTotal > 0.5 ? animatedTotal.toFixed(0) : '—'}
        unit="W"
        delay={460}
      />

      <FooterActions
        onBack={onBack}
        onSkip={onSkip}
        primaryLabel={<>Finalizar <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} /></>}
        onPrimary={handleSave}
        loading={saving}
        delay={500}
      />
    </div>
  );
}

function DoneContent({ onFinish }: { onFinish: () => void }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div className="wiz-stagger" style={{ animationDelay: '0ms', display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
        <div style={{ position: 'relative', width: 62, height: 62 }}>
          <div
            className="wiz-ring"
            style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `1.5px solid ${C.green}` }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background: `linear-gradient(160deg, #3ed167 0%, ${C.greenDark} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.white,
              boxShadow: `0 10px 26px -8px ${C.green}99, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            <CheckIcon className="w-7 h-7 wiz-check-pop" strokeWidth={2.8} />
          </div>
        </div>
      </div>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '80ms',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.greenDark,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Configuración completada
      </p>

      <h2
        className="wiz-stagger"
        style={{
          animationDelay: '140ms',
          fontSize: 30,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.022em',
          lineHeight: 1.15,
          marginBottom: 14,
        }}
      >
        El sistema está listo
      </h2>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '200ms',
          fontSize: 14.5,
          color: C.text2,
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        El gemelo digital está configurado y comenzará a procesar datos de su
        instalación. Podrá modificar cualquier parámetro desde el módulo de
        Ajustes en cualquier momento.
      </p>

      <div className="wiz-stagger" style={{ animationDelay: '260ms', display: 'flex', justifyContent: 'center' }}>
        <PrimaryButton onClick={onFinish}>
          Ir al panel principal
          <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>('none');
  const [transitioning, setTransitioning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const parallaxRef = useParallax();
  const paneRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((next: number, dir: Direction) => {
    setDirection(dir);
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
      paneRef.current?.scrollTo({ top: 0 });
    }, 180);
  }, []);

  const forward = useCallback((next: number) => navigate(next, 'forward'), [navigate]);
  const back = useCallback(() => {
    if (step > 0 && step < 5) navigate(step - 1, 'backward');
  }, [step, navigate]);

  const finish = useCallback(() => {
    try { localStorage.setItem('gd_onboarding_done', '1'); } catch { /* ignore */ }
    onComplete();
  }, [onComplete]);

  const handleSaveLocation = useCallback(async (data: { lat: number; lon: number; name: string }) => {
    setSaveError(null);
    try {
      await executeMutation(SAVE_LOCATION_MUTATION, { input: data });
      forward(2);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la ubicación. Revise la conexión con el servidor.');
    }
  }, [forward]);

  const handleSavePanel = useCallback(async (data: {
    manufacturer: string; model?: string; ratedPowerKw: number;
    quantity: number; tiltDegrees?: number; orientation?: string;
  }) => {
    setSaveError(null);
    try {
      await executeMutation(CREATE_PANEL_MUTATION, { input: data });
      forward(3);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudieron guardar los paneles. Revise la conexión con el servidor.');
    }
  }, [forward]);

  const handleSaveBattery = useCallback(async (data: {
    manufacturer: string; model?: string; capacityKwh: number; quantity: number;
  }) => {
    setSaveError(null);
    try {
      await executeMutation(CREATE_BATTERY_MUTATION, { input: data });
      forward(4);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la batería. Revise la conexión con el servidor.');
    }
  }, [forward]);

  const handleSaveAppliances = useCallback(async (items: ApplianceDraft[]) => {
    setSaveError(null);
    try {
      for (const item of items) {
        await executeMutation(CREATE_APPLIANCE_MUTATION, {
          input: {
            name: item.name,
            category: item.category,
            averagePowerW: item.averagePowerW,
            maxPowerW: item.maxPowerW,
            quantity: item.quantity,
            activeHours: item.activeHours,
            alwaysOn: true,
          },
        });
      }
      forward(5);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudieron guardar los equipos. Revise la conexión con el servidor.');
    }
  }, [forward]);

  const contentTransform = transitioning
    ? {
        opacity: 0,
        transform: direction === 'forward'
          ? 'translateX(-14px)'
          : 'translateX(14px)',
        filter: 'blur(5px)',
      }
    : { opacity: 1, transform: 'translateX(0)', filter: 'blur(0px)' };

  const centered = step === 0 || step === 5;

  return (
    <div
      ref={parallaxRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '28px 18px',
        fontFamily: FONT_STACK,
        ['--px' as string]: '0',
        ['--py' as string]: '0',
      }}
    >
      <style>{`
        @keyframes wiz-fade-in-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wiz-stagger {
          animation: wiz-fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes wiz-check-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .wiz-check-pop {
          animation: wiz-check-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
        }
        @keyframes wiz-blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(38px, -26px) scale(1.06); }
          66% { transform: translate(-30px, 24px) scale(0.96); }
        }
        @keyframes wiz-blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-44px, 30px) scale(1.08); }
        }
        .wiz-blob { animation: wiz-blob-1 22s ease-in-out infinite; }
        .wiz-blob-b { animation: wiz-blob-2 28s ease-in-out infinite; }
        @keyframes wiz-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.975); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .wiz-card-in {
          animation: wiz-card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes wiz-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,199,89,0.45); }
          60% { box-shadow: 0 0 0 5px rgba(52,199,89,0); }
        }
        .wiz-pulse-dot { animation: wiz-pulse 2.4s ease-out infinite; }
        @keyframes wiz-ring-expand {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        .wiz-ring { animation: wiz-ring-expand 2.2s cubic-bezier(0.22, 1, 0.36, 1) 0.5s infinite; }
        @keyframes wiz-rings-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Parallax depth layers — driven by --px / --py set from pointer position */
        .wiz-layer-far {
          transform: translate3d(calc(var(--px, 0) * -22px), calc(var(--py, 0) * -14px), 0);
          will-change: transform;
        }
        .wiz-layer-mid {
          transform: translate3d(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 10px), 0);
          will-change: transform;
        }
        .wiz-layer-near {
          transform: translate3d(calc(var(--px, 0) * 36px), calc(var(--py, 0) * 26px), 0);
          will-change: transform;
        }
        .wiz-layer-card {
          transform: translate3d(calc(var(--px, 0) * -7px), calc(var(--py, 0) * -5px), 0);
          will-change: transform;
        }
        /* Two-column form grid */
        .wiz-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .wiz-progress-mobile { display: none; }
        @media (max-width: 900px) {
          .wiz-rail { display: none !important; }
          .wiz-progress-mobile { display: block; }
          .wiz-pane { padding: 32px 28px !important; }
        }
        @media (max-width: 600px) {
          .wiz-grid2 { grid-template-columns: 1fr; }
        }
        .wiz-input:focus {
          border-color: ${C.dark} !important;
          background: ${C.white} !important;
          box-shadow: 0 0 0 3px rgba(29,29,31,0.08);
        }
        .wiz-input:hover {
          border-color: #b8b8bf;
        }
        .wiz-btn-primary:hover:not(:disabled) {
          background: #000 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .wiz-btn-primary:active:not(:disabled) {
          transform: scale(0.985);
        }
        .wiz-btn-ghost:hover {
          background: rgba(29,29,31,0.09) !important;
          color: ${C.text} !important;
        }
        .wiz-btn-ghost:active {
          transform: scale(0.985);
        }
        .wiz-link {
          font-size: 13.5px;
          font-weight: 400;
          color: ${C.blue};
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 10px 0;
          transition: color 0.15s ease;
          white-space: nowrap;
        }
        .wiz-link:hover {
          color: ${C.blueHover};
        }
        .wiz-chip {
          font-size: 12.5px;
          font-weight: 500;
          color: ${C.text2};
          background: rgba(255,255,255,0.7);
          border: 1px solid ${C.border};
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .wiz-chip:hover {
          border-color: ${C.dark};
          color: ${C.text};
          background: ${C.white};
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.12);
        }
        .wiz-chip:active {
          transform: scale(0.97);
        }
        .wiz-row-remove:hover {
          background: rgba(185,28,28,0.08) !important;
          color: #b91c1c !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .wiz-stagger, .wiz-card-in, .wiz-blob, .wiz-blob-b,
          .wiz-pulse-dot, .wiz-ring, .wiz-check-pop {
            animation: none !important;
          }
        }
        /* Leaflet overrides for embedded map */
        .leaflet-container {
          font-family: ${FONT_STACK};
          background: #f5f5f7;
        }
        .leaflet-container a {
          color: ${C.blue};
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
        }
        .leaflet-control-zoom a {
          background: ${C.white} !important;
          color: ${C.text} !important;
          border: 1px solid ${C.borderLight} !important;
          font-weight: 500 !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${C.bgChip} !important;
        }
      `}</style>

      {/* Background — layered, each plane moves at its own parallax depth */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: "url('/background%20panels.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Far plane — aurora wash */}
      <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
        <div className="wiz-layer-far" style={{ position: 'absolute', inset: '-60px' }}>
          <div
            className="wiz-blob"
            style={{
              position: 'absolute',
              top: '6%',
              left: '8%',
              width: 520,
              height: 520,
              borderRadius: '50%',
              background: 'rgba(52,199,89,0.14)',
              filter: 'blur(110px)',
            }}
          />
          <div
            className="wiz-blob-b"
            style={{
              position: 'absolute',
              top: '12%',
              right: '4%',
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: 'rgba(0,113,227,0.13)',
              filter: 'blur(110px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-12%',
              left: '32%',
              width: 560,
              height: 420,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)',
              filter: 'blur(100px)',
            }}
          />
        </div>
      </div>

      {/* Mid plane — fine dot grid, faded toward the edges */}
      <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
        <div
          className="wiz-layer-mid"
          style={{
            position: 'absolute',
            inset: '-40px',
            opacity: 0.055,
            backgroundImage: 'radial-gradient(rgba(0,0,0,1) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, black 30%, transparent 100%)',
          }}
        />
      </div>

      {/* Near plane — hairline concentric rings behind the card */}
      <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
        <div
          className="wiz-layer-near"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 1300,
            height: 1300,
            marginTop: -650,
            marginLeft: -650,
          }}
        >
          <svg
            width="1300"
            height="1300"
            viewBox="0 0 1300 1300"
            fill="none"
            style={{ animation: 'wiz-rings-spin 180s linear infinite' }}
          >
            <circle cx="650" cy="650" r="420" stroke="rgba(29,29,31,0.055)" strokeWidth="1" />
            <circle cx="650" cy="650" r="520" stroke="rgba(29,29,31,0.04)" strokeWidth="1" strokeDasharray="2 9" />
            <circle cx="650" cy="650" r="625" stroke="rgba(29,29,31,0.03)" strokeWidth="1" />
            <circle cx="650" cy="230" r="3" fill="rgba(0,113,227,0.35)" />
            <circle cx="1170" cy="650" r="2.5" fill="rgba(52,199,89,0.4)" />
          </svg>
        </div>
      </div>

      {/* Diagonal light sweep */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%)',
          opacity: 0.6,
        }}
      />

      {/* GLASS CARD — wide split layout: step rail + content pane */}
      <div
        className="wiz-layer-card wiz-card-in"
        style={{
          position: 'relative',
          zIndex: 10,
          width: 'min(920px, 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            height: 'min(86vh, 680px)',
            minHeight: 520,
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(30px) saturate(1.7)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.7)',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: [
              '0 36px 90px -22px rgba(15,23,42,0.24)',
              '0 8px 24px -8px rgba(15,23,42,0.1)',
              '0 0 0 1px rgba(255,255,255,0.65)',
              'inset 0 1px 0 rgba(255,255,255,0.9)',
            ].join(', '),
          }}
        >
          <StepRail step={step} />

          {/* Content pane */}
          <div
            ref={paneRef}
            className="wiz-pane"
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              padding: '44px 52px',
            }}
          >
            <div
              style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: centered ? 'center' : 'flex-start',
                transition: 'opacity 180ms ease, transform 180ms ease, filter 180ms ease',
                ...contentTransform,
              }}
            >
              {step >= 1 && step <= 4 && (
                <div className="wiz-progress-mobile" style={{ marginBottom: 26 }}>
                  <ProgressIndicator step={step} />
                </div>
              )}

              {saveError && step >= 1 && step <= 4 && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 18,
                    borderRadius: 12,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  {saveError}
                </div>
              )}

              {step === 0 && <WelcomeContent onStart={() => forward(1)} onSkip={finish} />}
              {step === 1 && <LocationContent onSave={handleSaveLocation} onSkip={() => forward(2)} onBack={back} />}
              {step === 2 && <PanelContent onSave={handleSavePanel} onSkip={() => forward(3)} onBack={back} />}
              {step === 3 && <BatteryContent onSave={handleSaveBattery} onSkip={() => forward(4)} onBack={back} />}
              {step === 4 && <AppliancesContent onSave={handleSaveAppliances} onSkip={() => forward(5)} onBack={back} />}
              {step === 5 && <DoneContent onFinish={finish} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
