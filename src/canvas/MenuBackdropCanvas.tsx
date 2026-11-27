/**
 * Full-viewport seamlessly rolling organic pixel-art nature meadow behind the Main Menu.
 *
 * Modeled after PokéSurvivor's lush Shady Forest cohesion:
 * - Pre-renders a horizontally periodic organic terrain strip (`organicTerrain.ts`) with
 *   subtly mottled grass, Bayer-dithered irregular dirt clearings/trails, and scattered
 *   2–3px wildflowers — scrolling smoothly with zero grid seams or popping tiles.
 * - Y-depth-sorts dark-outlined tall grass clusters, nestled slate boulders, corner tree
 *   canopies, and 12 randomized grounded PMD SpriteCollab Pokémon walking strictly
 *   left-to-right across staggered lanes with tight pixel-oval contact shadows directly
 *   beneath every sprite's feet (zero jumping/hopping, zero pop-in, zero 404s).
 */
import { useEffect, useRef, useState } from 'react';
import { clampDpr, computeDesktopResScale } from './layout';
import {
  BUNDLED_WALK_SPECIES_POOL,
  MEADOW_ROAMER_COUNT,
  MEADOW_WALK_SPECIES_POOL,
  MEADOW_WRAP_LEFT_X,
  createInitialMeadowRoamers,
  stepMeadowRoamers,
  wrapMeadowRoamer,
  type RollingMeadowPokemon,
} from './menuRoamers';
import {
  buildOrganicMeadowStrip,
  drawMeadowProp,
  type OrganicMeadowStrip,
} from './organicTerrain';
import { drawPixelShadow } from './pixelArt';
import { getSharedPmdSpriteAdapter, preloadPmdPokemon } from './pmdLoader';
import { getTileImage, preloadTilesets } from './tilesetLoader';

export type { RollingMeadowPokemon };
export {
  BUNDLED_WALK_SPECIES_POOL,
  MEADOW_ROAMER_COUNT,
  MEADOW_WALK_SPECIES_POOL,
  createInitialMeadowRoamers,
  stepMeadowRoamers,
  wrapMeadowRoamer,
};

interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

const INITIAL_PETALS: PetalParticle[] = Array.from({ length: 18 }, (_, idx) => ({
  x: ((idx * 37) % 100) / 100,
  y: ((idx * 53) % 100) / 100,
  vx: -(0.024 + (idx % 4) * 0.005),
  vy: 0.013 + (idx % 3) * 0.004,
  color: idx % 3 === 0 ? '#ffd84d' : idx % 2 === 0 ? '#f0a8c2' : '#fff5c4',
}));

/** Animated full-viewport seamless rolling organic meadow behind the Main Menu. */
export function MenuBackdropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adapter] = useState(getSharedPmdSpriteAdapter);

  const pokemonRef = useRef<RollingMeadowPokemon[] | null>(null);
  if (pokemonRef.current === null) {
    pokemonRef.current = createInitialMeadowRoamers();
  }

  const petalsRef = useRef<PetalParticle[]>(INITIAL_PETALS.map((p) => ({ ...p })));
  const stripRef = useRef<OrganicMeadowStrip | null>(null);
  const scaledStripRef = useRef<HTMLCanvasElement | null>(null);
  const scrimRef = useRef<CanvasGradient | null>(null);
  const sizeRef = useRef<{
    w: number;
    h: number;
    cssW: number;
    cssH: number;
    dpr: number;
    u: number;
    resScale: number;
  }>({
    w: 0,
    h: 0,
    cssW: 1280,
    cssH: 800,
    dpr: 1,
    u: 2,
    resScale: 1,
  });

  // Preload tilesets, initial random roamer roster (Walk sheets only), and local fallbacks
  useEffect(() => {
    void preloadTilesets();
    const initial = pokemonRef.current ?? [];
    preloadPmdPokemon(
      [
        ...initial.map((mon) => ({ speciesId: mon.speciesId, isShiny: false })),
        ...BUNDLED_WALK_SPECIES_POOL.slice(0, 6).map((speciesId) => ({ speciesId, isShiny: false })),
      ],
      ['walk'],
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const syncRoamerDataset = (roamers: readonly RollingMeadowPokemon[]) => {
      canvas.dataset.roamerSpecies = roamers.map((r) => r.speciesId).join(',');
    };
    syncRoamerDataset(pokemonRef.current ?? []);

    const isSpriteReady = (speciesId: number): boolean =>
      adapter.getFrame(speciesId, false, 'walk', 0, 2) !== null;

    const onPreloadSpecies = (speciesId: number): void => {
      preloadPmdPokemon([{ speciesId, isShiny: false }], ['walk']);
    };

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
      sizeRef.current = { w, h, cssW, cssH, dpr, u, resScale };

      // Build seamless periodic art-pixel strip and pre-scale once for fast 1:1 60/144 FPS blits
      const stripW = Math.max(640, Math.ceil(w / u) + 32);
      const stripH = Math.max(200, Math.ceil(h / u) + 2);
      const built = buildOrganicMeadowStrip(stripW, stripH);
      stripRef.current = built;

      if (built && typeof document !== 'undefined') {
        const scaled = document.createElement('canvas');
        scaled.width = built.stripW * u;
        scaled.height = built.stripH * u;
        const sctx = scaled.getContext('2d');
        if (sctx) {
          sctx.imageSmoothingEnabled = false;
          sctx.drawImage(built.canvas, 0, 0, scaled.width, scaled.height);
          scaledStripRef.current = scaled;
        }
      }

      const scrim = ctx.createLinearGradient(0, 0, w, 0);
      scrim.addColorStop(0, 'rgba(8, 16, 40, 0.30)');
      scrim.addColorStop(0.52, 'rgba(8, 16, 40, 0.12)');
      scrim.addColorStop(1, 'rgba(8, 16, 40, 0.04)');
      scrimRef.current = scrim;
    };

    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    let last = 0;
    let elapsed = 0;
    let scrollPx = 0;

    const frame = (now: number) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        last = 0;
        rafId = requestAnimationFrame(frame);
        return;
      }
      const dt = last === 0 ? 0 : Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      elapsed += dt;

      const { w, h, u, resScale, dpr } = sizeRef.current;
      const strip = stripRef.current;
      const scaledStrip = scaledStripRef.current;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;

      // Smooth 60/144 FPS pan in backing pixels (~52 px/s @ 1280x800, ~74 px/s @ 1920x1080)
      const scrollSpeedPx = 52 * resScale * dpr;
      scrollPx += scrollSpeedPx * dt;

      if (strip) {
        const drawW = strip.stripW * u;
        const drawH = strip.stripH * u;
        const scrollMod = ((Math.round(scrollPx) % drawW) + drawW) % drawW;
        const offsetPx = -scrollMod;

        // Blit two pre-scaled wrapping copies side-by-side at 1:1 pixel ratio (zero seam, max FPS)
        if (scaledStrip) {
          ctx.drawImage(scaledStrip, offsetPx, 0);
          ctx.drawImage(scaledStrip, offsetPx + drawW, 0);
        } else {
          ctx.drawImage(strip.canvas, offsetPx, 0, drawW, drawH);
          ctx.drawImage(strip.canvas, offsetPx + drawW, 0, drawW, drawH);
        }

        // Queue Y-sorted organic props (tall grass clusters, boulders, edge trees) + grounded Pokémon
        const drawQueue: Array<{ y: number; draw: () => void }> = [];
        const treeImg = getTileImage('outdoor', 'tree');

        for (const prop of strip.props) {
          let sx = Math.round(prop.x * u - scrollMod);
          if (sx < -u * 36) sx += drawW;
          if (sx > w + u * 36) continue;
          const sy = prop.y * u;
          drawQueue.push({
            y: sy,
            draw: () => drawMeadowProp(ctx, prop, sx, sy, u, treeImg),
          });
        }

        // Step & queue 12 randomized grounded PMD Pokémon walking strictly left-to-right
        const roamers = pokemonRef.current ?? [];
        const rosterChanged = stepMeadowRoamers(roamers, dt, {
          pool: MEADOW_WALK_SPECIES_POOL,
          fallbackPool: BUNDLED_WALK_SPECIES_POOL,
          isSpriteReady,
          onPreloadSpecies,
        });
        if (rosterChanged) {
          syncRoamerDataset(roamers);
        }

        for (const mon of roamers) {
          // Never draw a roamer parked off-screen awaiting preload (prevents pop-in)
          if (mon.awaitingPreload || mon.x < MEADOW_WRAP_LEFT_X - 0.04) continue;

          const px = Math.round(mon.x * w);
          const py = Math.round(mon.y * h);
          const monSnap = mon;
          drawQueue.push({
            y: py,
            draw: () => {
              const frameRect = adapter.getFrame(
                monSnap.speciesId,
                false,
                'walk',
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
        const rawX = (i * (cloudSpan / 4) - elapsed * scrollSpeedPx * 1.35) % cloudSpan;
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

      // Soft left-side contrast veil (cached once on resize)
      if (scrimRef.current) {
        ctx.fillStyle = scrimRef.current;
        ctx.fillRect(0, 0, w, h);
      }

      rafId = requestAnimationFrame(frame);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        last = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [adapter]);

  return (
    <div aria-hidden="true" className="fixed inset-0 h-dvh w-screen overflow-hidden bg-[#2e5d2c]">
      <canvas ref={canvasRef} data-testid="menu-backdrop-canvas" className="pixel-art block h-full w-full" />
    </div>
  );
}
