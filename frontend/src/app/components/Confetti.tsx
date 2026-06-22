'use client';

/**
 * Confeti de celebración. Se dispara cuando `fireKey` cambia a un valor > 0
 * (cada incremento = una nueva ráfaga). Dos "cañones" desde las esquinas
 * inferiores lanzan partículas hacia el centro con gravedad y rotación.
 *
 * Es puramente visual (canvas a pantalla completa, sin capturar clics) y se
 * limpia solo al terminar la animación.
 */
import { useEffect, useRef } from 'react';

const COLORS = ['#10b981', '#3b82f6', '#fbbf24', '#f97316', '#8b5cf6', '#ec4899', '#22d3ee'];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
};

export default function Confetti({ fireKey }: { fireKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (fireKey <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // Dos cañones (esquinas inferiores) apuntando hacia arriba y al centro.
    const make = (fromLeft: boolean): Particle => {
      const baseAngle = fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3; // hacia arriba-centro
      const angle = baseAngle + (Math.random() - 0.5) * 0.7;
      const speed = 9 + Math.random() * 9;
      return {
        x: fromLeft ? 0 : W,
        y: H,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
      };
    };

    const N = 150;
    const particles: Particle[] = [];
    for (let i = 0; i < N; i++) particles.push(make(i % 2 === 0));

    const gravity = 0.22;
    const drag = 0.992;
    const duration = 2800;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - elapsed / duration);
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, W, H);
    };
  }, [fireKey]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[200]" aria-hidden="true" />;
}
