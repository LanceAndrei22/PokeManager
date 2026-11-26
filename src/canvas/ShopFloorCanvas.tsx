/**
 * React host for the animated HTML5 2D Canvas shop floor.
 *
 * Responsibilities:
 * - Measures the container (ResizeObserver) and rebuilds the backing-store layout on
 *   width / pen-count / bed-count / devicePixelRatio changes.
 * - Diffs simulation snapshots into the canvas world (sales → coins, heals → hearts…).
 * - Runs a requestAnimationFrame loop with clamped delta time, paused while the floor is
 *   off-screen (content-visibility with an IntersectionObserver fallback).
 * - Honors `prefers-reduced-motion` and the panel's Pause animation control.
 * - Converts pointer clicks to backing-store coordinates to inspect Pokémon.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { getSpecies } from '../data/species';
import type { PokemonInstance, ShopCustomer } from '../data/types';
import { computeShopCssHeight, computeShopLayout } from './layout';
import { createPmdSpriteAdapter } from './pmdLoader';
import { renderScene } from './renderer';
import { buildBackgroundLayer } from './tiles';
import type { ShopLayout } from './types';
import {
  buildFloorSnapshot,
  createWorld,
  hitTestPokemon,
  relayoutWorld,
  stepWorld,
  syncWorld,
} from './world';

/** Props for the animated shop floor canvas. */
export interface ShopFloorCanvasProps {
  profileId: string;
  cash: number;
  shiftSpeed: 1 | 2;
  shiftRunning: boolean;
  pokemon: PokemonInstance[];
  customers: ShopCustomer[];
  penCapacity: number;
  napBedCapacity: number;
  motionPaused: boolean;
  onInspectPokemon: (uid: string) => void;
}

/** Tracks the user's `prefers-reduced-motion` setting live. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Tracks devicePixelRatio so browser zoom / monitor moves re-rasterize crisply. */
function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    // A query matching the *current* DPR stops matching as soon as zoom or the display changes.
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [dpr]);
  return dpr;
}

/** Text alternative describing the floor for screen readers. */
function describeFloor(pokemon: PokemonInstance[], customers: ShopCustomer[]): string {
  const pens = pokemon
    .filter((p) => p.location === 'pen' && p.penIndex !== null)
    .sort((a, b) => (a.penIndex ?? 0) - (b.penIndex ?? 0))
    .map((p) => `${p.isShiny ? 'shiny ' : ''}${getSpecies(p.speciesId).name} in Pen ${(p.penIndex ?? 0) + 1}`);
  const napping = pokemon.filter((p) => p.location === 'healing').map((p) => getSpecies(p.speciesId).name);
  let text = 'Animated cozy shop floor.';
  text += pens.length > 0 ? ` ${pens.join(', ')}.` : ' All display pens are empty.';
  if (napping.length > 0) text += ` Napping: ${napping.join(', ')}.`;
  if (customers.length > 0) text += ` ${customers.length} shopper${customers.length === 1 ? '' : 's'} browsing.`;
  return text;
}

/** Animated pixel-art shop floor with Platinum sprites, shoppers, and particles. */
export function ShopFloorCanvas({
  profileId,
  cash,
  shiftSpeed,
  shiftRunning,
  pokemon,
  customers,
  penCapacity,
  napBedCapacity,
  motionPaused,
  onInspectPokemon,
}: ShopFloorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world] = useState(createWorld);
  const [adapter] = useState(createPmdSpriteAdapter);
  const layoutRef = useRef<ShopLayout | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(shiftRunning);
  const hoverRef = useRef<string | null>(null);
  const [cssWidth, setCssWidth] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const dpr = useDevicePixelRatio();

  const snapshot = useMemo(
    () => buildFloorSnapshot(profileId, cash, shiftSpeed, pokemon, customers),
    [profileId, cash, shiftSpeed, pokemon, customers],
  );
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    runningRef.current = shiftRunning;
  }, [shiftRunning]);

  useEffect(() => {
    world.reducedMotion = reducedMotion;
    world.motionPaused = motionPaused;
  }, [world, reducedMotion, motionPaused]);

  // Measure the container width (CSS px).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setCssWidth(Math.floor(el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rebuild layout + cached background whenever geometry inputs change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssWidth <= 0) return;
    const layout = computeShopLayout(cssWidth, penCapacity, napBedCapacity, dpr);
    // Setting width/height resets context state; renderScene re-applies smoothing each frame.
    canvas.width = layout.width;
    canvas.height = layout.height;
    layoutRef.current = layout;
    backgroundRef.current = buildBackgroundLayer(layout);
    relayoutWorld(world, layout, Math.random);
    syncWorld(world, snapshotRef.current, layout, Math.random);
  }, [cssWidth, penCapacity, napBedCapacity, dpr, world]);

  // Diff each new simulation snapshot into the animated world.
  useEffect(() => {
    snapshotRef.current = snapshot;
    const layout = layoutRef.current;
    if (layout) syncWorld(world, snapshot, layout, Math.random);
  }, [snapshot, world]);

  // requestAnimationFrame loop, paused while off-screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // No 2D backend (e.g. jsdom): the DOM pen buttons remain fully usable.

    let frameId = 0;
    let looping = false;
    let onScreen = true;
    let last = 0;

    const frame = (now: number) => {
      if (!onScreen) {
        looping = false;
        return;
      }
      // Clamp dt to 50 ms so resuming a background tab never teleports hops or walkers.
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      const layout = layoutRef.current;
      if (layout) {
        stepWorld(world, dt, layout, Math.random);
        renderScene(ctx, layout, world, backgroundRef.current, adapter, {
          shiftRunning: runningRef.current,
          hoverUid: hoverRef.current,
        });
      }
      frameId = requestAnimationFrame(frame);
    };
    const start = () => {
      if (looping) return;
      looping = true;
      last = 0;
      frameId = requestAnimationFrame(frame);
    };
    const setOnScreen = (visible: boolean) => {
      onScreen = visible;
      if (visible) start();
    };

    // content-visibility:auto tells us when the browser skips rendering this subtree.
    const onVisibilityState = (event: Event) => setOnScreen(!(event as Event & { skipped?: boolean }).skipped);
    let observer: IntersectionObserver | null = null;
    if ('contentVisibility' in document.documentElement.style) {
      host.addEventListener('contentvisibilityautostatechange', onVisibilityState);
    } else if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) setOnScreen(entry.isIntersecting);
        },
        { rootMargin: '200px' },
      );
      observer.observe(host);
    }
    start();

    return () => {
      onScreen = false;
      cancelAnimationFrame(frameId);
      host.removeEventListener('contentvisibilityautostatechange', onVisibilityState);
      observer?.disconnect();
    };
  }, [world, adapter]);

  /** Converts client (CSS) coordinates into backing-store pixels (× canvas.width / rect.width). */
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
    const uid = pt && layout ? hitTestPokemon(world, layout, pt.x, pt.y) : null;
    hoverRef.current = uid;
    event.currentTarget.style.cursor = uid ? 'pointer' : 'default';
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const pt = toBackingPoint(event.clientX, event.clientY);
    const layout = layoutRef.current;
    const uid = pt && layout ? hitTestPokemon(world, layout, pt.x, pt.y) : null;
    if (uid) onInspectPokemon(uid);
  };

  const cssHeight = computeShopCssHeight(cssWidth > 0 ? cssWidth : 960, penCapacity);
  const label = describeFloor(pokemon, customers);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto none auto ${cssHeight}px` }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        data-testid="shop-floor-canvas"
        className="pixel-art block w-full touch-manipulation rounded-lg"
        style={{ height: `${cssHeight}px` }}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
      >
        {label}
      </canvas>
    </div>
  );
}
