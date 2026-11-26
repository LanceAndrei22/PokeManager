/**
 * Full-viewport seamlessly rolling organic pixel-art nature meadow behind the Main Menu.
 *
 * Modeled after PokéSurvivor's lush Shady Forest cohesion:
 * - Pre-renders a horizontally periodic organic terrain strip (`organicTerrain.ts`) with
 *   subtly mottled grass, Bayer-dithered irregular dirt clearings/trails, and scattered
 *   2–3px wildflowers — scrolling smoothly with zero grid seams or popping tiles.
 * - Y-depth-sorts dark-outlined tall grass clusters, nestled slate boulders, corner tree
 *   canopies, and 12 grounded PMD SpriteCollab Pokémon (walking & idling only, zero jumping)
 *   with tight pixel-oval contact shadows directly beneath every sprite's feet.
 */
import { useEffect, useRef, useState } from 'react';
import { clampDpr, computeDesktopResScale } from './layout';
import {
  buildOrganicMeadowStrip,
  drawMeadowProp,
  type OrganicMeadowStrip,
} from './organicTerrain';
import { drawPixelShadow } from './pixelArt';
import { vectorToPmdDirection } from './pmdAnimator';
import { createPmdSpriteAdapter } from './pmdLoader';
import { getTileImage, preloadTilesets } from './tilesetLoader';
import type { PmdDirection, PokemonAnimState } from './types';

interface RollingMeadowPokemon {
  speciesId: number;
  /** Normalized viewport X in [0.05, 0.96]. */
  x: number;
  /** Normalized viewport Y in [0.20, 0.88]. */
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
  { speciesId: 133, x: 0.44, y: 0.34, vx: 0.020, vy: 0.005, phase: 0.2 }, // Eevee
  { speciesId: 25, x: 0.62, y: 0.56, vx: 0.023, vy: -0.006, phase: 0.9 }, // Pikachu
  { speciesId: 1, x: 0.24, y: 0.28, vx: 0.015, vy: 0.005, phase: 1.6 }, // Bulbasaur
  { speciesId: 4, x: 0.74, y: 0.38, vx: -0.016, vy: 0.006, phase: 2.3 }, // Charmander
  { speciesId: 7, x: 0.52, y: 0.78, vx: 0.018, vy: -0.004, phase: 3.1 }, // Squirtle
  { speciesId: 393, x: 0.85, y: 0.66, vx: -0.015, vy: -0.006, phase: 3.8 }, // Piplup
  { speciesId: 54, x: 0.34, y: 0.74, vx: 0.014, vy: 0.004, phase: 4.4 }, // Psyduck
  { speciesId: 79, x: 0.69, y: 0.82, vx: 0.011, vy: -0.003, phase: 5.0 }, // Slowpoke
  { speciesId: 40, x: 0.14, y: 0.48, vx: 0.017, vy: 0.005, phase: 0.6 }, // Wigglytuff
  { speciesId: 263, x: 0.88, y: 0.32, vx: -0.021, vy: 0.007, phase: 1.9 }, // Zigzagoon
  { speciesId: 399, x: 0.56, y: 0.26, vx: 0.014, vy: 0.006, phase: 2.7 }, // Bidoof
  { speciesId: 417, x: 0.79, y: 0.52, vx: 0.022, vy: -0.004, phase: 4.1 }, // Pachirisu
];

const INITIAL_PETALS: PetalParticle[] = Array.from({ length: 18 }, (_, idx) => ({
  x: ((idx * 37) % 100) / 100,
  y: ((idx * 53) % 100) / 100,
  vx: -(0.012 + (idx % 4) * 0.003),
  vy: 0.010 + (idx % 3) * 0.003,
  color: idx % 3 === 0 ? '#ffd84d' : idx % 2 === 0 ? '#f0a8c2' : '#fff5c4',
}));

/** Animated full-viewport seamless rolling organic meadow behind the Main Menu. */
export function MenuBackdropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adapter] = useState(createPmdSpriteAdapter);

  const pokemonRef = useRef<RollingMeadowPokemon[]>(
    INITIAL_ROAMERS.map((e) => ({
      ...e,
      dir: vectorToPmdDirection(e.vx, e.vy, 2, 0.001),
      state: 'walk',
      stateTimer: 1.8 + (e.phase % 2.2),
    })),
  );
  const petalsRef = useRef<PetalParticle[]>(INITIAL_PETALS.map((p) => ({ ...p })));
  const stripRef = useRef<OrganicMeadowStrip | null>(null);
  const sizeRef = useRef<{ w: number; h: number; cssW: number; cssH: number; dpr: number; u: number }>({
    w: 0,
    h: 0,
    cssW: 1280,
    cssH: 800,
    dpr: 1,
    u: 2,
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
      const resScale = computeDesktopResScale(cssW, cssH);
      const u = Math.max(2, Math.round(2 * resScale * dpr));

      if (
        sizeRef.current.w === w &&
        sizeRef.current.h === h &&
        sizeRef.current.dpr === dpr &&
        stripRef.current
      ) {
        return;
      }
      canvas.width = w;
      canvas.height = h;
      sizeRef.current = { w, h, cssW, cssH, dpr, u };

      // Build seamless periodic art-pixel strip wide enough to exceed 16:9 screens cleanly
      const stripW = Math.max(640, Math.ceil(w / u) + 32);
      const stripH = Math.max(200, Math.ceil(h / u) + 2);
      stripRef.current = buildOrganicMeadowStrip(stripW, stripH);
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let last = 0;
    let elapsed = 0;
    let scrollArtPx = 0;

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      elapsed += dt;

      const { w, h, u } = sizeRef.current;
      const strip = stripRef.current;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;

      // Gentle pixel-snapped horizontal camera pan (~11 art-px/sec)
      scrollArtPx += 11 * dt;

      if (strip) {
        const drawW = strip.stripW * u;
        const drawH = strip.stripH * u;
        const offsetArt = Math.floor(scrollArtPx) % strip.stripW;
        const offsetPx = -offsetArt * u;

        // Blit two wrapping copies side-by-side: guaranteed zero seam line
        ctx.drawImage(strip.canvas, offsetPx, 0, drawW, drawH);
        ctx.drawImage(strip.canvas, offsetPx + drawW, 0, drawW, drawH);

        // Queue Y-sorted organic props (tall grass clusters, boulders, edge trees) + grounded Pokémon
        const drawQueue: Array<{ y: number; draw: () => void }> = [];
        const treeImg = getTileImage('outdoor', 'tree');

        for (const prop of strip.props) {
          let sx = (prop.x - offsetArt) * u;
          if (sx < -u * 36) sx += drawW;
          if (sx > w + u * 36) continue;
          const sy = prop.y * u;
          drawQueue.push({
            y: sy,
            draw: () => drawMeadowProp(ctx, prop, sx, sy, u, treeImg),
          });
        }

        // Step & queue 12 grounded PMD Pokémon (Walk & Idle only — zero jumping)
        const worldDriftNorm = (11 * u * dt) / Math.max(1, w);
        for (const mon of pokemonRef.current) {
          mon.stateTimer -= dt;
          if (mon.stateTimer <= 0) {
            if (mon.state === 'walk') {
              mon.state = 'idle';
              mon.stateTimer = 0.85 + (mon.phase % 0.85);
            } else {
              mon.state = 'walk';
              mon.stateTimer = 2.6 + (mon.phase % 1.8);
              const turnAngle = Math.sin(elapsed * 0.65 + mon.phase * 3.1) * 0.35;
              const speed = Math.hypot(mon.vx, mon.vy) || 0.017;
              const baseAngle = Math.atan2(mon.vy, mon.vx) + turnAngle;
              mon.vx = Math.cos(baseAngle) * speed;
              mon.vy = Math.sin(baseAngle) * speed * 0.55;
            }
          }

          if (mon.state === 'walk') {
            mon.x += mon.vx * dt;
            mon.y += mon.vy * dt;
            mon.dir = vectorToPmdDirection(mon.vx, mon.vy, mon.dir, 0.001);
          } else {
            // Stay anchored naturally to the rolling ground during calm idle pauses
            mon.x -= worldDriftNorm;
          }

          if (mon.x < -0.05) mon.x = 1.04;
          else if (mon.x > 1.05) mon.x = -0.04;
          if (mon.y < 0.18) {
            mon.y = 0.18;
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
              const drawWMon = frameRect.sw * u;
              const drawHMon = frameRect.sh * u;
              const visW = frameRect.visibleWidthPx ?? Math.round(frameRect.sw * 0.56);
              const footPad = Math.round(
                (frameRect.bottomPadPx ?? Math.round(frameRect.sh * 0.28)) * u,
              );

              // Tight grounded pixel-oval contact shadow directly beneath the Pokémon's feet
              drawPixelShadow(ctx, px, py, Math.max(u * 6, Math.round(visW * u * 0.76)), u, 0.40);
              ctx.drawImage(
                frameRect.image,
                frameRect.sx,
                frameRect.sy,
                frameRect.sw,
                frameRect.sh,
                Math.round(px - drawWMon / 2),
                Math.round(py - drawHMon + footPad),
                drawWMon,
                drawHMon,
              );
            },
          });
        }

        drawQueue.sort((a, b) => a.y - b.y);
        for (const item of drawQueue) {
          item.draw();
        }
      } else {
        ctx.fillStyle = '#387234';
        ctx.fillRect(0, 0, w, h);
      }

      // Subtle sunlit parallax cloud wisps & drifting blossom petals
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      const cloudSpan = w + u * 56;
      for (let i = 0; i < 4; i += 1) {
        const rawX = (i * (cloudSpan / 4) - elapsed * u * 16) % cloudSpan;
        const cx = Math.round(rawX < 0 ? rawX + cloudSpan : rawX) - u * 28;
        const cy = Math.round(h * (0.08 + (i % 3) * 0.15));
        ctx.fillRect(cx, cy, u * 18, u * 4);
        ctx.fillRect(cx + u * 4, cy - u * 2, u * 10, u * 2);
      }

      for (const p of petalsRef.current) {
        p.x = (p.x + p.vx * dt + 1) % 1;
        p.y = (p.y + p.vy * dt + 1) % 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x * w), Math.round(p.y * h), u * 2, u);
      }

      // Soft left-side contrast veil so the Royal Navy Menu Hub & gold logo stay ultra-crisp
      const scrim = ctx.createLinearGradient(0, 0, w, 0);
      scrim.addColorStop(0, 'rgba(8, 16, 40, 0.30)');
      scrim.addColorStop(0.52, 'rgba(8, 16, 40, 0.12)');
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
    <div aria-hidden="true" className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#2e5d2c]">
      <canvas ref={canvasRef} data-testid="menu-backdrop-canvas" className="pixel-art block h-full w-full" />
    </div>
  );
}
