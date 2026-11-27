/**
 * MagnificationDock Component
 *
 * A macOS-inspired dock component with fluid magnification effects and spring physics
 * on desktop (fine pointer), and rock-solid, zero-flicker native touch navigation on mobile/tablet.
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
  magnification = 68,
  distance = 160,
  panelHeight = 76,
  baseItemSize = 46,
}: DockProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sizesRef = useRef<number[]>([]);
  const velocitiesRef = useRef<number[]>([]);
  const mouseXRef = useRef<number>(Infinity);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [canHover, setCanHover] = useState<boolean>(false);

  const mass = spring.mass ?? 0.1;
  const stiffness = spring.stiffness ?? 150;
  const damping = spring.damping ?? 12;

  // Only enable mouse magnification & hover tooltips on fine-pointer desktop devices
  // to guarantee zero flicker / zero touch-loop freeze on phones & tablets.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    return undefined;
  }, []);

  if (sizesRef.current.length !== items.length) {
    sizesRef.current = items.map((_, i) => sizesRef.current[i] ?? baseItemSize);
    velocitiesRef.current = items.map((_, i) => velocitiesRef.current[i] ?? 0);
  }

  const startLoop = () => {
    if (!canHover) return;
    if (rafRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.025);
      lastTimeRef.current = now;

      const mouseX = mouseXRef.current;

      // Pass 1: Read all rects in one batch (prevents layout thrashing)
      const centers: number[] = new Array(items.length).fill(0);
      if (Number.isFinite(mouseX)) {
        for (let i = 0; i < items.length; i++) {
          const el = itemRefs.current[i];
          if (el) {
            const rect = el.getBoundingClientRect();
            centers[i] = rect.left + rect.width / 2;
          }
        }
      }

      // Pass 2: Compute spring physics & write dimensions
      let moving = false;
      for (let i = 0; i < items.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;

        let target = baseItemSize;
        if (Number.isFinite(mouseX)) {
          const dist = Math.abs(mouseX - centers[i]);
          if (dist < distance) {
            const ratio = 1 - dist / distance;
            target = baseItemSize + (magnification - baseItemSize) * ratio;
          }
        }

        const current = sizesRef.current[i] ?? baseItemSize;
        const velocity = velocitiesRef.current[i] ?? 0;

        const force = -stiffness * (current - target) - damping * velocity;
        const acc = force / mass;
        const nextVel = velocity + acc * dt;
        const nextSize = Math.max(baseItemSize * 0.95, Math.min(magnification + 4, current + nextVel * dt));

        if (Math.abs(nextSize - target) > 0.15 || Math.abs(nextVel) > 0.15) {
          moving = true;
          sizesRef.current[i] = nextSize;
          velocitiesRef.current[i] = nextVel;
        } else {
          sizesRef.current[i] = target;
          velocitiesRef.current[i] = 0;
        }

        const finalSize = Math.round(sizesRef.current[i] * 10) / 10;
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
    <div
      className="flex max-w-full items-end justify-center pointer-events-none select-none"
      style={{ transform: 'translateZ(0)' }}
    >
      <div
        onMouseMove={
          canHover
            ? (e) => {
                mouseXRef.current = e.clientX;
                startLoop();
              }
            : undefined
        }
        onMouseLeave={
          canHover
            ? () => {
                mouseXRef.current = Infinity;
                setHoveredIndex(null);
                startLoop();
              }
            : undefined
        }
        className={`pointer-events-auto flex items-end w-fit gap-2.5 sm:gap-4 rounded-full border border-slate-300 dark:border-blue-500/35 bg-white dark:bg-slate-950 lg:bg-white/92 lg:dark:bg-slate-950/92 lg:backdrop-blur-md pt-2.5 pb-2 px-4 sm:px-6 shadow-xl shadow-blue-950/15 dark:shadow-black/60 ${className}`}
        style={{ height: canHover ? panelHeight : 68 }}
        role="toolbar"
        aria-label="SentinelAI Quick Navigation Dock"
      >
        {items.map((item, index) => {
          const isHovered = canHover && hoveredIndex === index;
          const itemSize = canHover ? baseItemSize : 44;
          return (
            <div key={index} className="relative flex flex-col items-center justify-end">
              {/* Floating Tooltip (Desktop Hover Only) */}
              {canHover && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 w-fit whitespace-nowrap rounded-lg border border-slate-200 dark:border-blue-500/35 bg-slate-900 text-white px-2.5 py-1 text-[11px] font-bold shadow-lg transition-opacity duration-150 ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {item.label}
                </div>
              )}

              {/* Dock Button */}
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                onClick={item.onClick}
                onMouseEnter={canHover ? () => setHoveredIndex(index) : undefined}
                onMouseLeave={
                  canHover ? () => setHoveredIndex((prev) => (prev === index ? null : prev)) : undefined
                }
                onFocus={canHover ? () => setHoveredIndex(index) : undefined}
                onBlur={canHover ? () => setHoveredIndex((prev) => (prev === index ? null : prev)) : undefined}
                style={{ width: itemSize, height: itemSize, touchAction: 'manipulation' }}
                className={`relative inline-flex items-center justify-center rounded-full border shadow-sm cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                  item.active
                    ? 'bg-gradient-to-br from-blue-950 to-blue-800 text-white border-blue-700 shadow-blue-900/30'
                    : 'bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
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
                className={`mt-1 w-1.5 h-1.5 rounded-full ${
                  item.active ? 'opacity-100 bg-blue-900 dark:bg-blue-400' : 'opacity-0'
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
