/**
 * Full-viewport click-to-manage HTML5 2D Canvas host for Indoor Gen 4 PokéMart.
 *
 * Responsibilities:
 * - Fills the entire viewport (`100vw × 100dvh`) with adaptive landscape/portrait rooms.
 * - Observes resize & `devicePixelRatio` changes and caches static indoor floor art.
 * - Runs a clamped `requestAnimationFrame` loop obeying `prefers-reduced-motion` and Pause.
 * - Hit-tests clicks on Pokémon, queued counter shoppers (`!`), empty pens, and stations
 *   (Wholesale PC, Egg Incubator, Healing Corner, Upgrades Board).
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { getSpecies } from '../data/species';
import type {
  CounterOffer,
  EggInstance,
  PokemonInstance,
  ShopCustomer,
  WholesaleOffer,
} from '../data/types';
import { computeIndoorLayout } from './layout';
import { buildIndoorBackgroundLayer, renderIndoorScene } from './indoorRenderer';
import { createPmdSpriteAdapter } from './pmdLoader';
import { usePrefersReducedMotion } from './useReducedMotion';
import type { CanvasHitTarget, ShopLayout } from './types';
import {
  buildFloorSnapshot,
  createWorld,
  hitTestIndoorScene,
  relayoutWorld,
  stepWorld,
  syncWorld,
} from './world';

export interface ShopCanvasProps {
  profileId: string;
  cash: number;
  shiftSpeed: 1 | 2;
  shiftRunning: boolean;
  pokemon: PokemonInstance[];
  customers: ShopCustomer[];
  counterQueue: CounterOffer[];
  eggs: EggInstance[];
  wholesaleCatalog: WholesaleOffer[];
  penCapacity: number;
  napBedCapacity: number;
  motionPaused: boolean;
  onSelectTarget: (target: CanvasHitTarget) => void;
}

function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [dpr]);
  return dpr;
}

function describeIndoorStore(
  pokemon: PokemonInstance[],
  customers: ShopCustomer[],
  counterQueue: CounterOffer[],
): string {
  const pens = pokemon
    .filter((p) => p.location === 'pen' && p.penIndex !== null)
    .map((p) => `${p.isShiny ? 'shiny ' : ''}${getSpecies(p.speciesId).name}`);
  return `Interactive Gen 4 PokéMart floor. On display: ${
    pens.length > 0 ? pens.join(', ') : 'none'
  }. ${customers.length} browsing, ${counterQueue.length} waiting at Kecleon's counter.`;
}

/** Full-screen animated Indoor PokéMart canvas. */
export function ShopCanvas({
  profileId,
  cash,
  shiftSpeed,
  shiftRunning,
  pokemon,
  customers,
  counterQueue,
  eggs,
  wholesaleCatalog,
  penCapacity,
  napBedCapacity,
  motionPaused,
  onSelectTarget,
}: ShopCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world] = useState(createWorld);
  const [adapter] = useState(createPmdSpriteAdapter);
  const layoutRef = useRef<ShopLayout | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(shiftRunning);
  const hoverTargetRef = useRef<CanvasHitTarget | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const reducedMotion = usePrefersReducedMotion();
  const dpr = useDevicePixelRatio();

  const snapshot = useMemo(
    () =>
      buildFloorSnapshot(
        profileId,
        cash,
        shiftSpeed,
        pokemon,
        customers,
        counterQueue,
        eggs,
        wholesaleCatalog,
      ),
    [profileId, cash, shiftSpeed, pokemon, customers, counterQueue, eggs, wholesaleCatalog],
  );
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    runningRef.current = shiftRunning;
  }, [shiftRunning]);

  useEffect(() => {
    world.reducedMotion = reducedMotion;
    world.motionPaused = motionPaused;
  }, [world, reducedMotion, motionPaused]);

  // Observe full-viewport container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setSize({
        w: Math.max(320, Math.floor(el.clientWidth || window.innerWidth)),
        h: Math.max(460, Math.floor(el.clientHeight || window.innerHeight)),
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rebuild indoor room geometry & static background cache on resize / capacity change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w <= 0 || size.h <= 0) return;
    const layout = computeIndoorLayout(size.w, size.h, penCapacity, napBedCapacity, dpr);
    canvas.width = layout.width;
    canvas.height = layout.height;
    layoutRef.current = layout;
    backgroundRef.current = buildIndoorBackgroundLayer(layout);
    relayoutWorld(world, layout, Math.random);
    syncWorld(world, snapshotRef.current, layout, Math.random);
  }, [size.w, size.h, penCapacity, napBedCapacity, dpr, world]);

  // Diff each simulation state update into animated entities
  useEffect(() => {
    snapshotRef.current = snapshot;
    const layout = layoutRef.current;
    if (layout) syncWorld(world, snapshot, layout, Math.random);
  }, [snapshot, world]);

  // Clamped requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let last = 0;
    let mounted = true;

    const frame = (now: number) => {
      if (!mounted) return;
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      const layout = layoutRef.current;
      if (layout) {
        stepWorld(world, dt, layout, Math.random);
        renderIndoorScene(ctx, layout, world, backgroundRef.current, adapter, {
          shiftRunning: runningRef.current,
          hoverTarget: hoverTargetRef.current,
        });
      }
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => {
      mounted = false;
      cancelAnimationFrame(frameId);
    };
  }, [world, adapter]);

  const toBackingPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutRef.current) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const pt = toBackingPoint(event.clientX, event.clientY);
    const layout = layoutRef.current;
    const hit = pt && layout ? hitTestIndoorScene(world, layout, pt.x, pt.y) : null;
    hoverTargetRef.current = hit;
    setHoverLabel(hit?.label ?? null);
    event.currentTarget.style.cursor = hit ? 'pointer' : 'default';
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const pt = toBackingPoint(event.clientX, event.clientY);
    const layout = layoutRef.current;
    const hit = pt && layout ? hitTestIndoorScene(world, layout, pt.x, pt.y) : null;
    if (hit) onSelectTarget(hit);
  };

  const ariaLabel = describeIndoorStore(pokemon, customers, counterQueue);

  return (
    <div ref={containerRef} className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#0c1733]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        data-testid="shop-floor-canvas"
        className="pixel-art block h-full w-full touch-manipulation"
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          hoverTargetRef.current = null;
          setHoverLabel(null);
        }}
      >
        {ariaLabel}
      </canvas>

      {hoverLabel && (
        <div
          aria-hidden="true"
          className="pmd-pill pointer-events-none fixed bottom-20 left-1/2 z-10 -translate-x-1/2 px-3 py-1 text-xs font-bold text-[#ffd84d]"
        >
          {hoverLabel}
        </div>
      )}
    </div>
  );
}
