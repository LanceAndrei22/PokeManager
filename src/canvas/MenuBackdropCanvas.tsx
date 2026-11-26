/**
 * Full-viewport continuously rolling pixel-art nature meadow behind the Main Menu.
 *
 * Replaces the old static PokéMart building and pond with a seamless scrolling countryside:
 * - Decoded `pret/pokeemerald` outdoor meadow tiles (`grass`, `grass-tuft`, `flowers`,
 *   winding country dirt `path`, and layered `tree` groves) scrolling smoothly across the screen
 *   at crisp integer pixel scales (`1280×800` → `1920×1080` → `2560×1440+`).
 * - Parallax drifting pixel clouds and sunlit blossom petals.
 * - 12 bundled PMD SpriteCollab Pokémon actively roaming, walking (8 directions), and
 *   hopping (`Hop-Anim.png`) with Y-depth sorting against the scrolling trees.
 */
import { useEffect, useRef, useState } from 'react';
import { clampDpr, computeDesktopResScale } from './layout';
import { drawPixelShadow } from './pixelArt';
import { vectorToPmdDirection } from './pmdAnimator';
import { createPmdSpriteAdapter } from './pmdLoader';
import { getTileImage, preloadTilesets } from './tilesetLoader';
import type { PmdDirection, PokemonAnimState } from './types';

interface RollingMeadowPokemon {
  speciesId: number;
  /** Normalized viewport X in [0.05, 0.96]. */
  x: number;
  /** Normalized viewport Y in [0.22, 0.88]. */
  y: number;
  vx: number;
  vy: number;
  dir: PmdDirection;
  state: PokemonAnimState;
  stateTimer: number;
  phase: number;
}

interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

/** 12 locally bundled PMD SpriteCollab species (zero network latency, 0 404s). */
const INITIAL_ROAMERS: Omit<RollingMeadowPokemon, 'dir' | 'state' | 'stateTimer'>[] = [
  { speciesId: 133, x: 0.44, y: 0.34, vx: 0.022, vy: 0.005, phase: 0.2 }, // Eevee
  { speciesId: 25, x: 0.62, y: 0.56, vx: 0.025, vy: -0.006, phase: 0.9 }, // Pikachu
  { speciesId: 1, x: 0.24, y: 0.28, vx: 0.017, vy: 0.006, phase: 1.6 }, // Bulbasaur
  { speciesId: 4, x: 0.74, y: 0.38, vx: -0.018, vy: 0.007, phase: 2.3 }, // Charmander
  { speciesId: 7, x: 0.52, y: 0.78, vx: 0.020, vy: -0.005, phase: 3.1 }, // Squirtle
  { speciesId: 393, x: 0.85, y: 0.66, vx: -0.016, vy: -0.007, phase: 3.8 }, // Piplup
  { speciesId: 54, x: 0.34, y: 0.74, vx: 0.016, vy: 0.005, phase: 4.4 }, // Psyduck
  { speciesId: 79, x: 0.69, y: 0.82, vx: 0.012, vy: -0.004, phase: 5.0 }, // Slowpoke
  { speciesId: 40, x: 0.14, y: 0.48, vx: 0.019, vy: 0.006, phase: 0.6 }, // Wigglytuff
  { speciesId: 263, x: 0.88, y: 0.32, vx: -0.023, vy: 0.008, phase: 1.9 }, // Zigzagoon
  { speciesId: 399, x: 0.56, y: 0.26, vx: 0.015, vy: 0.007, phase: 2.7 }, // Bidoof
  { speciesId: 417, x: 0.79, y: 0.52, vx: 0.024, vy: -0.005, phase: 4.1 }, // Pachirisu
];

const INITIAL_PETALS: PetalParticle[] = Array.from({ length: 22 }, (_, idx) => ({
  x: ((idx * 37) % 100) / 100,
  y: ((idx * 53) % 100) / 100,
  vx: -(0.014 + (idx % 4) * 0.004),
  vy: 0.012 + (idx % 3) * 0.004,
  color: idx % 3 === 0 ? '#ffd84d' : idx % 2 === 0 ? '#ff9ebb' : '#fff3ad',
}));

function tileHash(col: number, row: number): number {
  let h = Math.imul((col + 31) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 17, 0xc2b2ae35);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Deterministic gently winding dirt-path center row for a given world column. */
function pathCenterRowForCol(worldCol: number, totalRows: number): number {
  const base = totalRows * 0.56;
  const wave = Math.sin(worldCol * 0.22) * 1.45 + Math.cos(worldCol * 0.11) * 0.6;
  return Math.max(3, Math.min(totalRows - 4, Math.round(base + wave)));
}

/** Animated full-viewport rolling pixel-art nature meadow behind the Main Menu. */
export function MenuBackdropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adapter] = useState(createPmdSpriteAdapter);

  const pokemonRef = useRef<RollingMeadowPokemon[]>(
    INITIAL_ROAMERS.map((e) => ({
      ...e,
      dir: vectorToPmdDirection(e.vx, e.vy, 2, 0.001),
      state: 'walk',
      stateTimer: 1.6 + (e.phase % 2.2),
    })),
  );
  const petalsRef = useRef<PetalParticle[]>(INITIAL_PETALS.map((p) => ({ ...p })));
  const sizeRef = useRef<{ w: number; h: number; cssW: number; cssH: number; dpr: number }>({
    w: 0,
    h: 0,
    cssW: 1280,
    cssH: 800,
    dpr: 1,
  });

  useEffect(() => {
    void preloadTilesets();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = clampDpr(window.devicePixelRatio || 1);
      const cssW = Math.max(960, window.innerWidth);
      const cssH = Math.max(600, window.innerHeight);
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (sizeRef.current.w === w && sizeRef.current.h === h && sizeRef.current.dpr === dpr) {
        return;
      }
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w, h, cssW, cssH, dpr };
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let last = 0;
    let elapsed = 0;
    let scrollPx = 0;

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      elapsed += dt;

      const { w, h, cssW, cssH, dpr } = sizeRef.current;
      const resScale = computeDesktopResScale(cssW, cssH);
      // Crisp integer art-pixel scale: 2 @ 1280×800, 3 @ 1920×1080, 4 @ 2560×1440 (at 1× DPR)
      const u = Math.max(2, Math.round(2 * resScale * dpr));
      const tile = u * 16;

      // Smooth continuous horizontal meadow pan (~0.75 tiles/sec), snapped to whole backing px
      scrollPx += tile * 0.75 * dt;
      const snappedScroll = Math.floor(scrollPx);
      const startWorldCol = Math.floor(snappedScroll / tile);
      const offsetX = -(snappedScroll % tile);

      const colsVisible = Math.ceil(w / tile) + 3;
      const rows = Math.ceil(h / tile) + 1;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const grassImg = getTileImage('outdoor', 'grass');
      const tuftImg = getTileImage('outdoor', 'grass-tuft');
      const flowersImg = getTileImage('outdoor', 'flowers');
      const pathImg = getTileImage('outdoor', 'path');
      const treeImg = getTileImage('outdoor', 'tree');

      // 1. Continuously scrolling lush meadow ground + winding country dirt road
      for (let r = 0; r < rows; r += 1) {
        const y = r * tile;
        for (let c = -1; c < colsVisible; c += 1) {
          const worldCol = startWorldCol + c;
          const x = offsetX + c * tile;
          const pathRow = pathCenterRowForCol(worldCol, rows);
          const onPath = r === pathRow || r === pathRow + 1;

          if (onPath) {
            if (pathImg) {
              ctx.drawImage(pathImg, x, y, tile, tile);
            } else {
              ctx.fillStyle = (worldCol + r) % 2 === 0 ? '#a8875a' : '#9c7b4f';
              ctx.fillRect(x, y, tile, tile);
            }
          } else {
            const hVal = tileHash(worldCol, r);
            if (grassImg) {
              ctx.drawImage(grassImg, x, y, tile, tile);
            } else {
              ctx.fillStyle = hVal % 2 === 0 ? '#4d8a4b' : '#457e43';
              ctx.fillRect(x, y, tile, tile);
            }

            if (hVal % 8 === 0 && flowersImg) {
              ctx.drawImage(flowersImg, x, y, tile, tile);
            } else if (hVal % 5 === 1 && tuftImg) {
              ctx.drawImage(tuftImg, x, y, tile, tile);
            }
          }
        }
      }

      // 2. Collect Y-depth-sorted rolling pixel tree groves + actively roaming PMD Pokémon
      const drawQueue: Array<{ y: number; draw: () => void }> = [];
      const treeW = tile * 2;
      const treeH = tile * 2;

      const pushTree = (tx: number, ty: number) => {
        drawQueue.push({
          y: ty + treeH - u * 3,
          draw: () => {
            if (treeImg) {
              ctx.drawImage(treeImg, Math.round(tx), Math.round(ty), treeW, treeH);
            } else {
              ctx.fillStyle = '#24592c';
              ctx.fillRect(Math.round(tx), Math.round(ty), treeW, treeH);
            }
          },
        });
      };

      // Top horizon forest canopy + scattered mid-meadow copses + lower framing grove
      for (let c = -2; c < colsVisible + 1; c += 1) {
        const worldCol = startWorldCol + c;
        const x = offsetX + c * tile;

        // Dense lush top tree line (staggered every 2 world columns)
        if (((worldCol % 2) + 2) % 2 === 0) {
          pushTree(x, -Math.round(tile * 0.35));
        }

        // Occasional lush secondary canopy tree slightly below the top border
        const topDeco = tileHash(worldCol, 101);
        if (topDeco % 7 === 0) {
          pushTree(x, Math.round(tile * 0.85));
        }

        // Scattered meadow oak groves well clear of the winding dirt path
        const midDeco = tileHash(worldCol, 211);
        if (midDeco % 13 === 0) {
          const pathRow = pathCenterRowForCol(worldCol, rows);
          const candidateRow = midDeco % 2 === 0 ? Math.max(2, pathRow - 3) : Math.min(rows - 3, pathRow + 3);
          if (Math.abs(candidateRow - pathRow) >= 3) {
            pushTree(x, candidateRow * tile);
          }
        }

        // Bottom framing trees along the meadow edge
        const botDeco = tileHash(worldCol, 307);
        if (botDeco % 5 === 0) {
          pushTree(x, h - treeH + Math.round(tile * 0.45));
        }
      }

      // 3. Step & queue 12 actively roaming, walking & hopping PMD SpriteCollab Pokémon
      const worldDriftNorm = (tile * 0.25 * dt) / Math.max(1, w);
      for (const mon of pokemonRef.current) {
        mon.stateTimer -= dt;
        if (mon.stateTimer <= 0) {
          if (mon.state === 'walk') {
            mon.state = 'idle';
            mon.stateTimer = 0.8 + (mon.phase % 0.8);
          } else {
            mon.state = 'walk';
            mon.stateTimer = 2.6 + (mon.phase % 1.8);
            // Gently vary heading on new walk stride so roamers weave organically
            const turnAngle = Math.sin(elapsed * 0.7 + mon.phase * 3.1) * 0.35;
            const speed = Math.hypot(mon.vx, mon.vy) || 0.018;
            const baseAngle = Math.atan2(mon.vy, mon.vx) + turnAngle;
            mon.vx = Math.cos(baseAngle) * speed;
            mon.vy = Math.sin(baseAngle) * speed * 0.55;
          }
        }

        if (mon.state !== 'idle') {
          mon.x += mon.vx * dt;
          mon.y += mon.vy * dt;
          mon.dir = vectorToPmdDirection(mon.vx, mon.vy, mon.dir, 0.001);
        } else {
          // Gently drift with the scrolling grass during brief idle pauses
          mon.x -= worldDriftNorm;
        }

        // Seamless edge wrap / vertical bounce across the entire widescreen meadow
        if (mon.x < -0.05) {
          mon.x = 1.04;
        } else if (mon.x > 1.05) {
          mon.x = -0.04;
        }
        if (mon.y < 0.20) {
          mon.y = 0.20;
          mon.vy = Math.abs(mon.vy);
        } else if (mon.y > 0.89) {
          mon.y = 0.89;
          mon.vy = -Math.abs(mon.vy);
        }

        const px = Math.round(mon.x * w);
        const py = Math.round(mon.y * h);
        const monSnap = mon;
        drawQueue.push({
          y: py,
          draw: () => {
            const frameRect = adapter.getFrame(
              monSnap.speciesId,
              false,
              monSnap.state,
              elapsed + monSnap.phase,
              monSnap.dir,
            );
            if (!frameRect) return;
            const drawW = frameRect.sw * u;
            const drawH = frameRect.sh * u;
            const visW = frameRect.visibleWidthPx ?? Math.round(frameRect.sw * 0.56);
            const footPad = Math.round(
              (frameRect.bottomPadPx ?? Math.round(frameRect.sh * 0.28)) * u,
            );

            drawPixelShadow(ctx, px, py, Math.max(u * 6, Math.round(visW * u * 0.76)), u, 0.36);
            ctx.drawImage(
              frameRect.image,
              frameRect.sx,
              frameRect.sy,
              frameRect.sw,
              frameRect.sh,
              Math.round(px - drawW / 2),
              Math.round(py - drawH + footPad),
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

      // 4. Parallax drifting pixel clouds & sunlit blossom petals
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      const cloudSpan = w + u * 56;
      for (let i = 0; i < 5; i += 1) {
        const rawX = (i * (cloudSpan / 5) - elapsed * tile * 1.15) % cloudSpan;
        const cx = Math.round(rawX < 0 ? rawX + cloudSpan : rawX) - u * 28;
        const cy = Math.round(h * (0.09 + (i % 3) * 0.14));
        ctx.fillRect(cx, cy, u * 18, u * 4);
        ctx.fillRect(cx + u * 4, cy - u * 2, u * 10, u * 2);
      }

      for (const p of petalsRef.current) {
        p.x = (p.x + p.vx * dt + 1) % 1;
        p.y = (p.y + p.vy * dt + 1) % 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x * w), Math.round(p.y * h), u * 2, u);
      }

      // 5. Subtle left-side scrim so the Royal Navy Menu Hub & gold logo pop with high contrast
      const scrim = ctx.createLinearGradient(0, 0, w, 0);
      scrim.addColorStop(0, 'rgba(8, 16, 40, 0.34)');
      scrim.addColorStop(0.52, 'rgba(8, 16, 40, 0.14)');
      scrim.addColorStop(1, 'rgba(8, 16, 40, 0.04)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, w, h);

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [adapter]);

  return (
    <div aria-hidden="true" className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#2b532f]">
      <canvas ref={canvasRef} data-testid="menu-backdrop-canvas" className="pixel-art block h-full w-full" />
    </div>
  );
}
