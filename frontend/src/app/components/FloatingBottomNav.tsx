'use client';

import { MonitorSmartphone, PieChart, Server, ShieldCheck } from 'lucide-react';
import { type ComponentType } from 'react';

type SectionKey = 'overview' | 'stats' | 'devices' | 'admin';

interface NavItem {
  id: SectionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface FloatingBottomNavProps {
  active: SectionKey;
  onSelect: (section: SectionKey) => void;
  isAdmin?: boolean;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Info general', icon: MonitorSmartphone },
  { id: 'stats', label: 'Estadísticas', icon: PieChart },
  { id: 'devices', label: 'Ajustes', icon: Server },
];

const adminItem: NavItem = { id: 'admin', label: 'Admin', icon: ShieldCheck };

export default function FloatingBottomNav({
  active,
  onSelect,
  isAdmin = false,
}: FloatingBottomNavProps) {
  const items = isAdmin ? [...navItems, adminItem] : navItems;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-8 rounded-full border border-white/50 bg-white/40 px-8 py-3 backdrop-blur-xl shadow-[0_20px_45px_-25px_rgba(15,23,42,0.45)]">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`group flex cursor-pointer flex-col items-center gap-1 text-xs font-medium transition-colors duration-200 active:scale-95 ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-full transition-all duration-200 ease-out group-active:scale-90 group-active:shadow-inner ${isActive
                  ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/20'
                  : 'bg-white/40 text-slate-600 group-hover:-translate-y-0.5 group-hover:bg-white/70 group-hover:shadow-md group-hover:shadow-slate-400/20'
                  }`}
              >
                <Icon className="h-5 w-5 transition-transform duration-200 ease-out group-active:scale-90" />
              </span>
              <span className="transition-transform duration-200">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
