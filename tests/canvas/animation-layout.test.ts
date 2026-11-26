/**
 * Unit tests for PC desktop indoor shop layout geometry (1280×800, 1920×1080, 2560×1440+),
 * sprite animation math, and procedural pixel particle simulation (including sweat drops).
 */
import { describe, expect, it } from 'vitest';
import {
  HOP_DURATION,
  breathingPose,
  facingForDelta,
  hopPose,
  sleepPose,
  walkFrame,
} from '../../src/canvas/animation';
import {
  SPRITE_SOURCE_SIZE,
  buildEntryRoute,
  clampDpr,
  computeDesktopResScale,
  computeIndoorLayout,
  computeShopLayout,
  getBedAnchor,
  getCounterQueueSpot,
  getPenColumns,
  getPenWanderBounds,
  pathLength,
  pointAlongPath,
} from '../../src/canvas/layout';
import {
  MAX_PARTICLES,
  addParticles,
  particleAlpha,
  spawnCoin,
  spawnHearts,
  spawnSparkles,
  spawnSweatDrop,
  spawnZzz,
  updateParticles,
} from '../../src/canvas/particles';
import { createSeededRng } from '../../src/engine/rng';

describe('Canvas Shop Floor & High-Res Desktop Indoor Geometry', () => {
  it('clamps DPR to [1, 3], derives desktop resolution scale, and keeps 3-column desktop pens', () => {
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(5)).toBe(3);

    expect(computeDesktopResScale(1280, 800)).toBeCloseTo(1, 2);
    expect(computeDesktopResScale(1920, 1080)).toBeGreaterThan(1.35);
    expect(computeDesktopResScale(2560, 1440)).toBeGreaterThan(1.8);

    expect(getPenColumns(1280, 3)).toBe(3);
    expect(getPenColumns(1920, 6)).toBe(3);
    expect(getPenColumns(1280, 2)).toBe(2);
  });

  it('computes integer sprite scaling and valid pen/bed/walkway/station bounds', () => {
    const desktopLayout = computeShopLayout(900, 4, 2, 2);
    expect(desktopLayout.dpr).toBe(2);
    expect(desktopLayout.width).toBe(1800);
    expect(desktopLayout.spriteScale).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(desktopLayout.spriteScale)).toBe(true);
    expect(desktopLayout.spriteSize).toBe(SPRITE_SOURCE_SIZE * desktopLayout.spriteScale);
    expect(desktopLayout.pens).toHaveLength(4);
    expect(desktopLayout.beds).toHaveLength(2);
    expect(desktopLayout.lamps).toHaveLength(2);

    const bounds = getPenWanderBounds(desktopLayout, 0);
    expect(bounds).not.toBeNull();
    expect(bounds!.w).toBeGreaterThanOrEqual(0);
    expect(bounds!.h).toBeGreaterThanOrEqual(0);

    const anchor = getBedAnchor(desktopLayout, 1);
    expect(anchor).not.toBeNull();
    expect(anchor!.x).toBeGreaterThan(desktopLayout.beds[1].x);

    const route = buildEntryRoute(desktopLayout, 0, { x: 200, y: 260 });
    const len = pathLength(route);
    expect(len).toBeGreaterThan(0);
    expect(pointAlongPath(route, len, 0)).toEqual(desktopLayout.doorSpot);
    expect(pointAlongPath(route, len, 1)).toEqual({ x: 200, y: 260 });
  });

  it('scales desktop indoor layouts proportionally across 1280x800, 1920x1080, and 2560x1440', () => {
    const hd = computeIndoorLayout(1280, 800, 5, 2, 1);
    const fhd = computeIndoorLayout(1920, 1080, 5, 2, 1);
    const qhd = computeIndoorLayout(2560, 1440, 6, 3, 1);

    // Crisp integer art-pixel unit scales up across larger desktop monitors
    expect(hd.unit).toBe(2);
    expect(fhd.unit).toBe(3);
    expect(qhd.unit).toBe(4);
    expect(fhd.counter.w).toBeGreaterThan(hd.counter.w);
    expect(qhd.counter.w).toBeGreaterThan(fhd.counter.w);
    expect(fhd.pens[0].h).toBeGreaterThan(hd.pens[0].h);

    for (const layout of [hd, fhd, qhd]) {
      expect(layout.counterQueueSpots).toHaveLength(4);
      expect(layout.pcStation.x).toBeGreaterThan(layout.incubatorStation.x);
      expect(layout.upgradesStation.x).toBeGreaterThan(layout.pcStation.x);
      expect(layout.upgradesStation.x + layout.upgradesStation.w).toBeLessThanOrEqual(layout.width);
      expect(layout.napArea.y + layout.napArea.h).toBeLessThan(layout.height);
      const lastPen = layout.pens[layout.pens.length - 1];
      expect(lastPen.y + lastPen.h).toBeLessThanOrEqual(layout.napArea.y);
      expect(getCounterQueueSpot(layout, 1)).toEqual(layout.counterQueueSpots[1]);
    }
  });
});

describe('Sprite Animation Math', () => {
  it('computes idle breathing bobs, 3-phase squash-and-stretch hops, and sleep squish', () => {
    const breathPeak = breathingPose(0.6, 0, 2);
    expect(breathPeak.offsetY).toBeLessThan(0);
    expect(breathPeak.scaleY).toBeGreaterThan(1);

    const crouch = hopPose(0.075, 20);
    expect(crouch.offsetY).toBe(0);
    expect(crouch.scaleX).toBeGreaterThan(1);
    expect(crouch.scaleY).toBeLessThan(1);

    const apex = hopPose(0.5, 20);
    expect(apex.offsetY).toBeLessThan(-18);

    const landing = hopPose(0.925, 20);
    expect(landing.offsetY).toBe(0);
    expect(landing.scaleX).toBeGreaterThan(1);
    expect(landing.scaleY).toBeLessThan(1);
    expect(HOP_DURATION).toBeGreaterThan(0.2);

    const sleep = sleepPose(0, 0);
    expect(sleep.scaleX).toBeCloseTo(1.08, 2);
    expect(sleep.scaleY).toBeCloseTo(0.88, 2);
  });

  it('handles horizontal facing flips and 2-frame walk cadence', () => {
    expect(facingForDelta(8, 1)).toBe(-1);
    expect(facingForDelta(-8, -1)).toBe(1);
    expect(facingForDelta(0.2, -1, 0.5)).toBe(-1);

    expect(walkFrame(0, 8)).toBe(0);
    expect(walkFrame(9, 8)).toBe(1);
    expect(walkFrame(17, 8)).toBe(0);
  });
});

describe('Procedural Pixel Particles', () => {
  it('spawns, integrates, fades, prunes, and caps particle counts including sweat drops', () => {
    const rng = createSeededRng(77);
    const hearts = spawnHearts(100, 120, 2, rng, 3);
    const sparkles = spawnSparkles(100, 120, 18, 2, rng, 4);
    const zzz = spawnZzz(100, 120, 2, rng);
    const sweat = spawnSweatDrop(100, 120, 2, rng);
    const coin = spawnCoin(100, 120, 2, '+₽950');

    expect(hearts).toHaveLength(3);
    expect(sparkles).toHaveLength(4);
    expect(zzz.kind).toBe('zzz');
    expect(sweat.kind).toBe('sweat');
    expect(coin.label).toBe('+₽950');

    let pool = addParticles([], [...hearts, ...sparkles, zzz, sweat, coin]);
    expect(pool).toHaveLength(10);

    const startAlpha = particleAlpha(coin);
    expect(startAlpha).toBe(0);

    pool = updateParticles(pool, 0.4);
    const updatedCoin = pool.find((p) => p.kind === 'coin')!;
    expect(updatedCoin.y).toBeLessThan(120);
    expect(Math.abs(updatedCoin.vy)).toBeLessThan(2 * 26);
    expect(particleAlpha(updatedCoin)).toBe(1);

    pool = updateParticles(pool, 3.0);
    expect(pool).toHaveLength(0);

    const burst = Array.from({ length: MAX_PARTICLES + 30 }, (_, idx) =>
      spawnCoin(10, 10, 2, `+₽${idx}`),
    );
    const capped = addParticles([], burst);
    expect(capped).toHaveLength(MAX_PARTICLES);
  });
});
