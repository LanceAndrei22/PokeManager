/**
 * Full-viewport live animated PMD pixel backdrop for the Main Menu / Title Screen.
 * Renders lush Mystery Dungeon grass tiles, a warm cobblestone trail, shop lantern glow,
 * and 10 multi-frame 8-directional PMD Pokémon wandering gently across the clearing.
 */
import { useEffect, useRef, useState } from 'react';
import { clampDpr } from './layout';
import { usePrefersReducedMotion } from './ShopFloorCanvas';
import { createPmdSpriteAdapter } from './pmdLoader';
import { vectorToPmdDirection } from './pmdAnimator';
import type { PmdDirection } from './types';

interface BackdropEntity {
  speciesId: number;
  x: number; // Normalized 0..1 of viewport width
  y: number; // Normalized 0..1 of viewport height
  vx: number;
  vy: number;
  dir: PmdDirection;
  isShiny?: boolean;
  phase: number;
}

const INITIAL_WANDERERS: Omit<BackdropEntity, 'dir'>[] = [
  { speciesId: 133, x: 0.44, y: 0.62, vx: 0.014, vy: 0.005, phase: 0.2 },
  { speciesId: 25, x: 0.56, y: 0.54, vx: -0.015, vy: 0.004, phase: 1.1 },
  { speciesId: 1, x: 0.36, y: 0.44, vx: 0.012, vy: -0.006, phase: 2.0 },
  { speciesId: 4, x: 0.68, y: 0.39, vx: -0.011, vy: 0.008, phase: 2.9 },
  { speciesId: 7, x: 0.51, y: 0.78, vx: 0.016, vy: -0.005, phase: 3.7 },
  { speciesId: 393, x: 0.77, y: 0.68, vx: -0.013, vy: -0.006, phase: 4.5 },
  { speciesId: 352, x: 0.29, y: 0.24, vx: 0.008, vy: 0.003, phase: 0.8 },
  { speciesId: 40, x: 0.63, y: 0.26, vx: 0.01, vy: 0.005, phase: 1.9 },
  { speciesId: 143, x: 0.21, y: 0.77, vx: 0.005, vy: -0.002, phase: 5.1 },
  { speciesId: 279, x: 0.85, y: 0.23, vx: -0.017, vy: 0.004, phase: 3.1, isShiny: false },
];

function tileHash(col: number, row: number): number {
  let h = Math.imul((col + 31) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 17, 0xc2b2ae35);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Paints the procedural PMD meadow & cobblestone path background tile layer once per resize. */
function buildMeadowBackdrop(width: number, height: number, dpr: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  const u = Math.max(2, Math.round(2 * dpr));
  const tile = u * 16;
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const h = tileHash(c, r);
      const x = c * tile;
      const y = r * tile;

      // Diagonal sandy PMD dirt trail crossing behind the cards
      const pathCenter = cols * 0.56 - (r - rows * 0.5) * 0.22;
      const onPath = Math.abs(c - pathCenter) <= 1.25;

      if (onPath) {
        ctx.fillStyle = h % 3 === 0 ? '#9e7c52' : '#94724a';
        ctx.fillRect(x, y, tile, tile);
        if (h % 4 === 0) {
          ctx.fillStyle = '#b49266';
          ctx.fillRect(x + u * 3, y + u * 5, u * 4, u * 2);
        }
        if (h % 5 === 1) {
          ctx.fillStyle = '#7c5d3a';
          ctx.fillRect(x + u * 9, y + u * 10, u * 3, u * 2);
        }
      } else {
        ctx.fillStyle = h % 2 === 0 ? '#3e7741' : '#386e3b';
        ctx.fillRect(x, y, tile, tile);

        // Tall grass clusters inspired by Mystery Dungeon clearing tiles
        if (h % 5 < 3) {
          const gx = x + u * (2 + (h % 4));
          const gy = y + u * (3 + ((h >>> 3) % 4));
          ctx.fillStyle = '#254f28';
          ctx.fillRect(gx, gy + u * 4, u * 9, u * 2);
          ctx.fillStyle = '#5da14f';
          ctx.fillRect(gx + u, gy + u, u * 2, u * 4);
          ctx.fillRect(gx + u * 4, gy, u * 2, u * 5);
          ctx.fillRect(gx + u * 7, gy + u * 2, u * 2, u * 3);
        }

        // Tiny blossoms & pebbles
        if (h % 11 === 0) {
          ctx.fillStyle = h % 2 === 0 ? '#ffd84d' : '#ff9eb5';
          ctx.fillRect(x + u * 10, y + u * 4, u * 2, u * 2);
        } else if (h % 17 === 0) {
          ctx.fillStyle = '#68768c';
          ctx.fillRect(x + u * 4, y + u * 11, u * 5, u * 3);
          ctx.fillStyle = '#8b99b0';
          ctx.fillRect(x + u * 5, y + u * 11, u * 3, u);
        }
      }
    }
  }

  // Deep atmospheric navy vignette around edges so Royal Navy UI pops clearly
  const grad = ctx.createRadialGradient(
    width * 0.52,
    height * 0.45,
    Math.min(width, height) * 0.18,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  grad.addColorStop(0, 'rgba(12, 23, 51, 0.08)');
  grad.addColorStop(1, 'rgba(7, 14, 34, 0.58)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  return off;
}

/** Animated full-viewport PMD pixel clearing behind the Main Menu. */
export function MenuBackdropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adapter] = useState(createPmdSpriteAdapter);
  const reducedMotion = usePrefersReducedMotion();
  const entitiesRef = useRef<BackdropEntity[]>(
    INITIAL_WANDERERS.map((e) => ({
      ...e,
      dir: vectorToPmdDirection(e.vx, e.vy, 0, 0.001),
    })),
  );
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = clampDpr(window.devicePixelRatio || 1);
      const cssW = Math.max(320, window.innerWidth);
      const cssH = Math.max(480, window.innerHeight);
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (sizeRef.current.w === w && sizeRef.current.h === h && sizeRef.current.dpr === dpr) return;
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w, h, dpr };
      bgRef.current = buildMeadowBackdrop(w, h, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let last = 0;
    let elapsed = 0;

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      if (!reducedMotion) {
        elapsed += dt;
      }

      const { w, h, dpr } = sizeRef.current;
      const u = Math.max(2, Math.round(2 * dpr));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      if (bgRef.current) {
        ctx.drawImage(bgRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#386e3b';
        ctx.fillRect(0, 0, w, h);
      }

      const ents = entitiesRef.current;
      if (!reducedMotion) {
        for (const ent of ents) {
          ent.x += ent.vx * dt;
          ent.y += ent.vy * dt;
          if (ent.x < 0.14 || ent.x > 0.9) ent.vx *= -1;
          if (ent.y < 0.16 || ent.y > 0.88) ent.vy *= -1;
          ent.x = Math.min(0.92, Math.max(0.12, ent.x));
          ent.y = Math.min(0.9, Math.max(0.14, ent.y));
          ent.dir = vectorToPmdDirection(ent.vx, ent.vy, ent.dir, 0.001);
        }
      }

      const sorted = [...ents].sort((a, b) => a.y - b.y);
      for (const ent of sorted) {
        const px = Math.round(ent.x * w);
        const py = Math.round(ent.y * h);
        const frameRect = adapter.getFrame(
          ent.speciesId,
          Boolean(ent.isShiny),
          reducedMotion ? 'idle' : 'walk',
          reducedMotion ? 0 : elapsed + ent.phase,
          ent.dir,
        );
        if (!frameRect) continue;
        const scale = Math.max(1, Math.round(u * 1.1));
        const drawW = frameRect.sw * scale;
        const drawH = frameRect.sh * scale;

        // Ground shadow ellipse
        ctx.fillStyle = 'rgba(7, 13, 31, 0.35)';
        ctx.fillRect(Math.round(px - drawW * 0.3), Math.round(py - u), Math.round(drawW * 0.6), u * 2);

        ctx.drawImage(
          frameRect.image,
          frameRect.sx,
          frameRect.sy,
          frameRect.sw,
          frameRect.sh,
          Math.round(px - drawW / 2),
          Math.round(py - drawH + u),
          drawW,
          drawH,
        );
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [adapter, reducedMotion]);

  return (
    <div aria-hidden="true" className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#1b3622]">
      <canvas ref={canvasRef} className="pixel-art block h-full w-full" />
    </div>
  );
}
