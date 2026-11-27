/**
 * MagnificationDock Component
 *
 * A premium macOS-inspired dock component with fluid magnification effects,
 * spring physics (mass, stiffness, damping), and floating tooltips.
 * Adapted for SentinelAI's Deep Navy SOC glassmorphism system without
 * requiring an external ESM bundler.
 */

import React, { useEffect, useRef, useState } from 'react';

export type SpringOptions = {
  mass?: number;
  stiffness?: number;
  damping?: number;
};

export type DockItemData = {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick: () => void;
  className?: string;
  active?: boolean;
  badge?: number;
};

export type DockProps = {
  items: DockItemData[];
  className?: string;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  dockHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
};

export function MagnificationDock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 64,
  baseItemSize = 50,
}: DockProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sizesRef = useRef<number[]>([]);
  const velocitiesRef = useRef<number[]>([]);
  const mouseXRef = useRef<number>(Infinity);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const mass = spring.mass ?? 0.1;
  const stiffness = spring.stiffness ?? 150;
  const damping = spring.damping ?? 12;

  // Keep internal physics arrays synced with items length
  if (sizesRef.current.length !== items.length) {
    sizesRef.current = items.map((_, i) => sizesRef.current[i] ?? baseItemSize);
    velocitiesRef.current = items.map((_, i) => velocitiesRef.current[i] ?? 0);
  }

  const startLoop = () => {
    if (rafRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.032);
      lastTimeRef.current = now;

      let moving = false;
      const mouseX = mouseXRef.current;

      for (let i = 0; i < items.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;

        let target = baseItemSize;
        if (Number.isFinite(mouseX)) {
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const dist = Math.abs(mouseX - centerX);
          if (dist < distance) {
            const ratio = 1 - dist / distance;
            target = baseItemSize + (magnification - baseItemSize) * ratio;
          }
        }

        const current = sizesRef.current[i] ?? baseItemSize;
        const velocity = velocitiesRef.current[i] ?? 0;

        // Semi-implicit Euler spring integration matching Framer Motion spring physics
        const force = -stiffness * (current - target) - damping * velocity;
        const acc = force / mass;
        const nextVel = velocity + acc * dt;
        const nextSize = Math.max(baseItemSize * 0.9, current + nextVel * dt);

        if (Math.abs(nextSize - target) > 0.08 || Math.abs(nextVel) > 0.08) {
          moving = true;
          sizesRef.current[i] = nextSize;
          velocitiesRef.current[i] = nextVel;
        } else {
          sizesRef.current[i] = target;
          velocitiesRef.current[i] = 0;
        }

        const finalSize = sizesRef.current[i];
        el.style.width = `${finalSize}px`;
        el.style.height = `${finalSize}px`;
      }

      if (moving) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="flex max-w-full items-end justify-center pointer-events-none select-none">
      <div
        onMouseMove={(e) => {
          mouseXRef.current = e.clientX;
          startLoop();
        }}
        onMouseLeave={() => {
          mouseXRef.current = Infinity;
          setHoveredIndex(null);
          startLoop();
        }}
        className={`pointer-events-auto flex items-end w-fit gap-3.5 sm:gap-4 rounded-full border border-slate-300/90 dark:border-blue-500/30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl pt-3 pb-2.5 px-5 sm:px-6 shadow-2xl shadow-blue-950/20 dark:shadow-black/60 ${className}`}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="SentinelAI Quick Navigation Dock"
      >
        {items.map((item, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <div key={index} className="relative flex flex-col items-center justify-end">
              {/* Floating Tooltip (DockLabel) */}
              <div
                role="tooltip"
                className={`pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 w-fit whitespace-nowrap rounded-lg border border-slate-200 dark:border-blue-500/35 bg-slate-900 dark:bg-slate-900 text-white px-2.5 py-1 text-[11px] font-bold shadow-lg transition-all duration-150 ${
                  isHovered
                    ? 'opacity-100 -translate-y-1.5 scale-100'
                    : 'opacity-0 translate-y-0 scale-95'
                }`}
              >
                {item.label}
              </div>

              {/* Magnifying Dock Item */}
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                onClick={item.onClick}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                style={{ width: baseItemSize, height: baseItemSize }}
                className={`relative inline-flex items-center justify-center rounded-full border shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 transition-colors ${
                  item.active
                    ? 'bg-gradient-to-br from-blue-950 to-blue-800 text-white border-blue-700 shadow-blue-900/40'
                    : 'bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300/90 dark:border-slate-700'
                } ${item.className || ''}`}
                aria-label={typeof item.label === 'string' ? item.label : undefined}
              >
                <div className="flex items-center justify-center">{item.icon}</div>

                {/* Live Count Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-extrabold flex items-center justify-center shadow border border-white dark:border-slate-950">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>

              {/* macOS-style Active Indicator Dot */}
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full transition-opacity duration-200 ${
                  item.active
                    ? 'opacity-100 bg-blue-900 dark:bg-blue-400'
                    : 'opacity-0'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MagnificationDock;
