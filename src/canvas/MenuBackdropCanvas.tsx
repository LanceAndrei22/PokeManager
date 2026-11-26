/**
 * Full-viewport live animated outdoor PokéMart-in-nature pixel scene behind the Main Menu.
 *
 * Uses decoded `pret/pokeemerald` outdoor tilesets (`grass`, `grass-tuft`, `flowers`,
 * `path`, `water`, `fence`, `signpost`, `tree`, `pokemart-building`), drifting pixel clouds
 * and blossom petals, 4 strolling Human Trainers, and 8 multi-frame PMD SpriteCollab Pokémon
 * wandering, hopping (`Hop-Anim.png`), and napping (`Sleep-Anim.png` + `Zzz`).
 */
import { useEffect, useRef, useState } from 'react';
import { getHumanNpcFrame, preloadAllHumanNpcs, type CardinalDirection } from './humanNpcAnimator';
import { clampDpr } from './layout';
import { LETTER_Z, ICON_COLORS, drawBitmap } from './pixelArt';
import { vectorToPmdDirection } from './pmdAnimator';
import { createPmdSpriteAdapter } from './pmdLoader';
import { getTileImage, onTilesetUpdate, preloadTilesets } from './tilesetLoader';
import type { PmdDirection, PokemonAnimState } from './types';
import { usePrefersReducedMotion } from './useReducedMotion';

interface NaturePokemon {
  speciesId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: PmdDirection;
  state: PokemonAnimState;
  stateTimer: number;
  phase: number;
  sleeper?: boolean;
}

interface NatureWalker {
  npcId: string;
  minX: number;
  maxX: number;
  y: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  distance: number;
}

interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

const INITIAL_POKEMON: Omit<NaturePokemon, 'dir' | 'state' | 'stateTimer'>[] = [
  { speciesId: 133, x: 0.48, y: 0.62, vx: 0.018, vy: 0.006, phase: 0.2 },
  { speciesId: 25, x: 0.59, y: 0.56, vx: -0.017, vy: 0.007, phase: 1.1 },
  { speciesId: 1, x: 0.41, y: 0.42, vx: 0.014, vy: -0.007, phase: 2.0 },
  { speciesId: 4, x: 0.69, y: 0.46, vx: -0.015, vy: 0.008, phase: 2.9 },
  { speciesId: 7, x: 0.52, y: 0.80, vx: 0.019, vy: -0.005, phase: 3.7 },
  { speciesId: 393, x: 0.82, y: 0.72, vx: -0.014, vy: -0.006, phase: 4.5 },
  { speciesId: 54, x: 0.63, y: 0.79, vx: 0.013, vy: 0.004, phase: 1.6 },
  { speciesId: 143, x: 0.88, y: 0.44, vx: 0, vy: 0, phase: 0.4, sleeper: true },
];

const INITIAL_TRAINERS: NatureWalker[] = [
  { npcId: 'camper', minX: 0.36, maxX: 0.68, y: 0.37, x: 0.44, dir: 1, speed: 0.022, distance: 0 },
  { npcId: 'lass', minX: 0.54, maxX: 0.84, y: 0.51, x: 0.72, dir: -1, speed: 0.019, distance: 0 },
  { npcId: 'picnicker', minX: 0.33, maxX: 0.56, y: 0.74, x: 0.39, dir: 1, speed: 0.016, distance: 0 },
  { npcId: 'steven', minX: 0.66, maxX: 0.90, y: 0.63, x: 0.80, dir: -1, speed: 0.015, distance: 0 },
];

const INITIAL_PETALS: PetalParticle[] = Array.from({ length: 16 }, (_, idx) => ({
  x: ((idx * 37) % 100) / 100,
  y: ((idx * 53) % 100) / 100,
  vx: 0.006 + (idx % 3) * 0.002,
  vy: 0.014 + (idx % 4) * 0.004,
  color: idx % 3 === 0 ? '#ffd84d' : idx % 2 === 0 ? '#ff9ebb' : '#fff3ad',
}));

function tileHash(col: number, row: number): number {
  let h = Math.imul((col + 31) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 17, 0xc2b2ae35);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Paints the static outdoor PokéMart-in-nature scenery onto an offscreen canvas. */
function buildNatureBackdrop(width: number, height: number, dpr: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  const u = Math.max(2, Math.round((width / dpr < 640 ? 1.5 : 2) * dpr));
  const tile = u * 16;
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);

  const grassImg = getTileImage('outdoor', 'grass');
  const tuftImg = getTileImage('outdoor', 'grass-tuft');
  const flowersImg = getTileImage('outdoor', 'flowers');
  const pathImg = getTileImage('outdoor', 'path');
  const waterImg = getTileImage('outdoor', 'water');
  const fenceImg = getTileImage('outdoor', 'fence');
  const signpostImg = getTileImage('outdoor', 'signpost');
  const treeImg = getTileImage('outdoor', 'tree');
  const martImg = getTileImage('outdoor', 'pokemart-building');

  const isPortrait = width < height;
  const martScale = Math.max(2, Math.round(u * (isPortrait ? 1.15 : 1.55)));
  const martW = 64 * martScale;
  const martH = 64 * martScale;
  const martX = Math.round(width * (isPortrait ? 0.56 : 0.72) - martW / 2);
  const martY = Math.round(height * (isPortrait ? 0.14 : 0.14));
  const doorCenterCol = Math.floor((martX + martW * 0.5) / tile);
  const doorBottomRow = Math.floor((martY + martH) / tile);

  // Pond region in bottom-left/lower clearing away from the Main Menu left hub
  const pondMinCol = Math.floor(cols * (isPortrait ? 0.06 : 0.44));
  const pondMaxCol = Math.floor(cols * (isPortrait ? 0.44 : 0.62));
  const pondMinRow = Math.floor(rows * 0.72);
  const pondMaxRow = Math.floor(rows * 0.90);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const h = tileHash(c, r);
      const x = c * tile;
      const y = r * tile;

      const inPond =
        c >= pondMinCol &&
        c <= pondMaxCol &&
        r >= pondMinRow &&
        r <= pondMaxRow &&
        !(c === pondMinCol && r === pondMinRow) &&
        !(c === pondMaxCol && r === pondMaxRow);

      // Cobblestone road connecting left meadow edge up to the PokéMart doorway
      const mainRoadRow = doorBottomRow + 1;
      const diagCol = cols * 0.52 - (r - rows * 0.58) * 0.35;
      const onDoorSpur = c >= doorCenterCol - 1 && c <= doorCenterCol && r >= doorBottomRow - 1 && r <= mainRoadRow + 1;
      const onHorizontalRoad = r >= mainRoadRow && r <= mainRoadRow + 1 && c >= Math.floor(cols * 0.28) && c <= Math.ceil(cols * 0.9);
      const onSouthPath = r > mainRoadRow + 1 && r < rows - 1 && Math.abs(c - diagCol) <= 1.0 && !inPond;
      const onPath = onDoorSpur || onHorizontalRoad || onSouthPath;

      if (inPond) {
        if (waterImg) {
          ctx.drawImage(waterImg, x, y, tile, tile);
        } else {
          ctx.fillStyle = '#3b82d6';
          ctx.fillRect(x, y, tile, tile);
        }
      } else if (onPath) {
        if (pathImg) {
          ctx.drawImage(pathImg, x, y, tile, tile);
        } else {
          ctx.fillStyle = h % 2 === 0 ? '#a8875a' : '#9c7b4f';
          ctx.fillRect(x, y, tile, tile);
        }
      } else {
        if (grassImg) {
          ctx.drawImage(grassImg, x, y, tile, tile);
        } else {
          ctx.fillStyle = h % 2 === 0 ? '#4d8a4b' : '#457e43';
          ctx.fillRect(x, y, tile, tile);
        }

        if (h % 9 === 0 && flowersImg) {
          ctx.drawImage(flowersImg, x, y, tile, tile);
        } else if (h % 5 === 1 && tuftImg) {
          ctx.drawImage(tuftImg, x, y, tile, tile);
        }
      }
    }
  }

  // Wooden pasture fence bordering the side clearing next to the shop
  const fenceRow = doorBottomRow + 2;
  const fenceStartCol = Math.max(doorCenterCol + 2, Math.floor(cols * 0.78));
  const fenceEndCol = Math.min(cols - 2, fenceStartCol + 4);
  for (let c = fenceStartCol; c <= fenceEndCol; c += 1) {
    if (fenceImg) {
      ctx.drawImage(fenceImg, c * tile, fenceRow * tile, tile, tile);
    }
  }

  // Background oak/pine tree framing along horizon, pond bank & outer clearing
  const treeW = tile * 2;
  const treeH = tile * 2;
  const drawTreeAt = (px: number, py: number) => {
    if (treeImg) {
      ctx.drawImage(treeImg, Math.round(px), Math.round(py), treeW, treeH);
    } else {
      ctx.fillStyle = '#24592c';
      ctx.fillRect(Math.round(px), Math.round(py), treeW, treeH);
    }
  };

  for (let c = 0; c < cols; c += 2) {
    const px = c * tile;
    if (px + treeW < martX - tile * 0.5 || px > martX + martW) {
      drawTreeAt(px, Math.round(tile * 0.15));
    }
  }
  drawTreeAt(martX - treeW + u * 3, martY + tile * 0.4);
  drawTreeAt(martX + martW - u * 4, martY + tile * 0.4);
  drawTreeAt(width - treeW - u * 2, height * 0.54);
  drawTreeAt(width - treeW * 1.4, height * 0.80);

  // PokéMart outdoor building & wooden signpost beside doorway
  if (martImg) {
    ctx.drawImage(martImg, martX, martY, martW, martH);
  } else {
    ctx.fillStyle = '#2d5ca8';
    ctx.fillRect(martX, martY, martW, Math.round(martH * 0.42));
    ctx.fillStyle = '#eee8d8';
    ctx.fillRect(martX + u * 2, martY + Math.round(martH * 0.42), martW - u * 4, Math.round(martH * 0.56));
  }
  if (signpostImg) {
    ctx.drawImage(signpostImg, martX - tile - u * 2, martY + martH - tile, tile, tile);
  }

  // Soft directional left-side contrast veil so Main Menu panels pop while meadow gleams right
  const scrim = ctx.createLinearGradient(0, 0, width, 0);
  scrim.addColorStop(0, 'rgba(8, 16, 40, 0.36)');
  scrim.addColorStop(0.55, 'rgba(8, 16, 40, 0.16)');
  scrim.addColorStop(1, 'rgba(8, 16, 40, 0.06)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  return off;
}

/** Animated full-viewport outdoor PokéMart-in-nature backdrop behind the Main Menu. */
export function MenuBackdropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adapter] = useState(createPmdSpriteAdapter);
  const reducedMotion = usePrefersReducedMotion();

  const pokemonRef = useRef<NaturePokemon[]>(
    INITIAL_POKEMON.map((e) => ({
      ...e,
      dir: vectorToPmdDirection(e.vx, e.vy, 0, 0.001),
      state: e.sleeper ? 'sleep' : 'walk',
      stateTimer: 1.5 + e.phase,
    })),
  );
  const trainersRef = useRef<NatureWalker[]>(INITIAL_TRAINERS.map((t) => ({ ...t })));
  const petalsRef = useRef<PetalParticle[]>(INITIAL_PETALS.map((p) => ({ ...p })));
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    void preloadTilesets();
    preloadAllHumanNpcs();
    return onTilesetUpdate(() => {
      const { w, h, dpr } = sizeRef.current;
      if (w > 0 && h > 0) {
        bgRef.current = buildNatureBackdrop(w, h, dpr);
      }
    });
  }, []);

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
      bgRef.current = buildNatureBackdrop(w, h, dpr);
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
      const u = Math.max(2, Math.round((w / dpr < 640 ? 1.5 : 2) * dpr));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      if (bgRef.current) {
        ctx.drawImage(bgRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#457e43';
        ctx.fillRect(0, 0, w, h);
      }

      // Gentle drifting cloud shadow & pond sparkle highlights
      if (!reducedMotion) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < 4; i += 1) {
          const cx = ((elapsed * 14 + i * w * 0.27) % (w + u * 24)) - u * 12;
          const cy = h * (0.08 + (i % 2) * 0.05);
          ctx.fillRect(Math.round(cx), Math.round(cy), u * 14, u * 4);
          ctx.fillRect(Math.round(cx + u * 3), Math.round(cy - u * 2), u * 8, u * 2);
        }

        // Floating meadow petals
        for (const p of petalsRef.current) {
          p.x = (p.x + p.vx * dt) % 1;
          p.y = (p.y + p.vy * dt) % 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x * w), Math.round(p.y * h), u * 2, u);
        }
      }

      const pokemonList = pokemonRef.current;
      const trainerList = trainersRef.current;

      if (!reducedMotion) {
        for (const mon of pokemonList) {
          if (mon.sleeper) {
            mon.state = 'sleep';
            mon.dir = 0;
            continue;
          }
          mon.stateTimer -= dt;
          if (mon.stateTimer <= 0) {
            if (mon.state === 'walk') {
              mon.state = 'hop';
              mon.stateTimer = 0.9;
            } else if (mon.state === 'hop') {
              mon.state = 'idle';
              mon.stateTimer = 0.7;
            } else {
              mon.state = 'walk';
              mon.stateTimer = 2.6 + (mon.phase % 1.4);
            }
          }
          if (mon.state !== 'idle') {
            mon.x += mon.vx * dt;
            mon.y += mon.vy * dt;
            if (mon.x < 0.26 || mon.x > 0.92) mon.vx *= -1;
            if (mon.y < 0.34 || mon.y > 0.88) mon.vy *= -1;
            mon.x = Math.min(0.92, Math.max(0.26, mon.x));
            mon.y = Math.min(0.88, Math.max(0.34, mon.y));
            mon.dir = vectorToPmdDirection(mon.vx, mon.vy, mon.dir, 0.001);
          }
        }

        for (const tr of trainerList) {
          const prevX = tr.x * w;
          tr.x += tr.dir * tr.speed * dt;
          if (tr.x >= tr.maxX) {
            tr.x = tr.maxX;
            tr.dir = -1;
          } else if (tr.x <= tr.minX) {
            tr.x = tr.minX;
            tr.dir = 1;
          }
          tr.distance += Math.abs(tr.x * w - prevX);
        }
      }

      const drawQueue: Array<{ y: number; draw: () => void }> = [];

      for (const mon of pokemonList) {
        const px = Math.round(mon.x * w);
        const py = Math.round(mon.y * h);
        drawQueue.push({
          y: py,
          draw: () => {
            const activeState = reducedMotion ? (mon.sleeper ? 'sleep' : 'idle') : mon.state;
            const hopLift =
              activeState === 'hop' && !reducedMotion
                ? -Math.round(Math.abs(Math.sin(elapsed * 7 + mon.phase)) * u * 3)
                : 0;
            const frameRect = adapter.getFrame(
              mon.speciesId,
              false,
              activeState,
              reducedMotion ? 0 : elapsed + mon.phase,
              mon.dir,
            );
            if (!frameRect) return;
            const scale = Math.max(1, Math.round(u * 1.15));
            const drawW = frameRect.sw * scale;
            const drawH = frameRect.sh * scale;

            ctx.fillStyle = 'rgba(7, 13, 31, 0.34)';
            ctx.fillRect(
              Math.round(px - drawW * 0.28),
              Math.round(py - u),
              Math.round(drawW * 0.56),
              u * 2,
            );
            ctx.drawImage(
              frameRect.image,
              frameRect.sx,
              frameRect.sy,
              frameRect.sw,
              frameRect.sh,
              Math.round(px - drawW / 2),
              Math.round(py - drawH + u + hopLift),
              drawW,
              drawH,
            );

            if (activeState === 'sleep' && !reducedMotion) {
              const floatZ = Math.round(((elapsed + mon.phase) % 2) * u * 3);
              drawBitmap(
                ctx,
                LETTER_Z,
                Math.round(px + drawW * 0.25),
                Math.round(py - drawH * 0.72 - floatZ),
                Math.max(1, Math.round(u * 0.75)),
                ICON_COLORS,
              );
            }
          },
        });
      }

      for (const tr of trainerList) {
        const px = Math.round(tr.x * w);
        const py = Math.round(tr.y * h);
        drawQueue.push({
          y: py,
          draw: () => {
            const cardinal: CardinalDirection = tr.dir > 0 ? 'right' : 'left';
            const frame = getHumanNpcFrame(tr.npcId, cardinal, !reducedMotion, tr.distance);
            if (!frame) return;
            const scale = Math.max(1, Math.round(u * 1.15));
            const drawW = frame.sw * scale;
            const drawH = frame.sh * scale;

            ctx.fillStyle = 'rgba(7, 13, 31, 0.34)';
            ctx.fillRect(
              Math.round(px - drawW * 0.32),
              Math.round(py - u),
              Math.round(drawW * 0.64),
              u * 2,
            );
            ctx.drawImage(
              frame.image,
              frame.sx,
              frame.sy,
              frame.sw,
              frame.sh,
              Math.round(px - drawW / 2),
              Math.round(py - drawH + u),
              drawW,
              drawH,
            );
          },
        });
      }

      drawQueue.sort((a, b) => a.y - b.y);
      for (const item of drawQueue) {
        item.draw();
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
    <div aria-hidden="true" className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#2b532f]">
      <canvas ref={canvasRef} className="pixel-art block h-full w-full" />
    </div>
  );
}
