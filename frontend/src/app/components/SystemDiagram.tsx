'use client';

import { useRouter } from 'next/navigation';

interface Props {
  solarKw: number;
  batteryKwh: number;
  consumptionKw: number;
  isAdmin?: boolean;
}

// Flecha solar: label encima del panel, flecha recta vertical hacia abajo
const SOLAR_X     = 24;
const SOLAR_TIP_Y = 33;   // toca el panel
const SOLAR_LBL_Y = 6;    // label encima

// Flecha batería: label debajo de la batería, flecha recta vertical hacia arriba
const BATT_X      = 40;
const BATT_TIP_Y  = 73;   // toca la batería
const BATT_LBL_Y  = 91;   // label debajo

// Flecha consumo: puerta abajo a la derecha, label debajo
const LOAD_X      = 76;
const LOAD_TIP_Y  = 73;   // toca la puerta
const LOAD_LBL_Y  = 91;   // label debajo

const LH = 7.5;

// Centros de cada componente en % de la imagen (para los botones de editar)
const EDIT_BUTTONS = [
  { left: '26%', top: '39%', href: '/ajustes/paneles' },   // centro panel solar azul
  { left: '42%', top: '72%', href: '/ajustes/baterias' },  // centro batería blanca
  { left: '82%', top: '64%', href: '/ajustes/consumo' },   // centro puerta
];

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-900" stroke="currentColor" strokeWidth="1.8">
      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
    </svg>
  );
}

export default function SystemDiagram({ solarKw, batteryKwh, consumptionKw, isAdmin = false }: Props) {
  const router = useRouter();
  const solarText = solarKw % 1 === 0 ? `${solarKw} kW`         : `${solarKw.toFixed(1)} kW`;
  const battText  = batteryKwh % 1 === 0 ? `${batteryKwh} kWh`  : `${batteryKwh.toFixed(1)} kWh`;
  const loadText  = consumptionKw % 1 === 0 ? `${consumptionKw} kW` : `${consumptionKw.toFixed(1)} kW`;

  const solarLW = solarText.length * 2.1 + 5;
  const battLW  = battText.length  * 2.1 + 5;
  const loadLW  = loadText.length  * 2.1 + 5;

  return (
    <div className="relative w-full">
      <img
        src="/system.png"
        alt="Diagrama del sistema"
        className="w-full h-auto rounded-xl block"
      />

      {isAdmin && EDIT_BUTTONS.map(({ left, top, href }) => (
        <button
          key={href}
          onClick={() => router.push(href)}
          style={{ left, top, transform: 'translate(-50%, -50%)' }}
          className="absolute bg-gray-800/40 hover:bg-gray-800/65 backdrop-blur-sm border border-white/25 rounded-full p-1.5 transition-all hover:scale-110 cursor-pointer"
          title="Editar configuración"
        >
          <EditIcon />
        </button>
      ))}

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arr-s" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
            <polygon points="0 0,5 2,0 4" fill="#3b82f6" />
          </marker>
          <marker id="arr-b" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
            <polygon points="0 0,5 2,0 4" fill="#10b981" />
          </marker>
          <marker id="arr-l" markerWidth="5" markerHeight="4" refX="4.5" refY="2" orient="auto">
            <polygon points="0 0,5 2,0 4" fill="#f59e0b" />
          </marker>
        </defs>

        {/* ── Solar: vertical hacia abajo ── */}
        <line
          x1={SOLAR_X} y1={SOLAR_LBL_Y + LH / 2}
          x2={SOLAR_X} y2={SOLAR_TIP_Y - 1.5}
          stroke="#3b82f6" strokeWidth="0.55" strokeDasharray="1.8 1"
          markerEnd="url(#arr-s)"
        />
        <rect
          x={SOLAR_X - solarLW / 2} y={SOLAR_LBL_Y - LH / 2}
          width={solarLW} height={LH} rx="2"
          fill="#3b82f6" fillOpacity="0.93"
        />
        <text
          x={SOLAR_X} y={SOLAR_LBL_Y + 0.4}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="3" fontWeight="bold" fontFamily="system-ui,sans-serif"
        >
          {solarText}
        </text>

        {/* ── Batería: vertical hacia arriba ── */}
        <line
          x1={BATT_X} y1={BATT_LBL_Y - LH / 2}
          x2={BATT_X} y2={BATT_TIP_Y + 1.5}
          stroke="#10b981" strokeWidth="0.55" strokeDasharray="1.8 1"
          markerEnd="url(#arr-b)"
        />
        <rect
          x={BATT_X - battLW / 2} y={BATT_LBL_Y - LH / 2}
          width={battLW} height={LH} rx="2"
          fill="#10b981" fillOpacity="0.93"
        />
        <text
          x={BATT_X} y={BATT_LBL_Y + 0.4}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="3" fontWeight="bold" fontFamily="system-ui,sans-serif"
        >
          {battText}
        </text>
        {/* ── Consumo: puerta inferior derecha, vertical hacia arriba ── */}
        <line
          x1={LOAD_X} y1={LOAD_LBL_Y - LH / 2}
          x2={LOAD_X} y2={LOAD_TIP_Y + 1.5}
          stroke="#f59e0b" strokeWidth="0.55" strokeDasharray="1.8 1"
          markerEnd="url(#arr-l)"
        />
        <rect
          x={LOAD_X - loadLW / 2} y={LOAD_LBL_Y - LH / 2}
          width={loadLW} height={LH} rx="2"
          fill="#f59e0b" fillOpacity="0.93"
        />
        <text
          x={LOAD_X} y={LOAD_LBL_Y + 0.4}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="3" fontWeight="bold" fontFamily="system-ui,sans-serif"
        >
          {loadText}
        </text>
      </svg>
    </div>
  );
}
