/**
 * Unit tests for Phase 5 canvas layout geometry, sprite animation math,
 * and procedural pixel particle simulation.
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
  FLOOR_CSS,
  SPRITE_SOURCE_SIZE,
  buildEntryRoute,
  clampDpr,
  computeShopLayout,
  getBedAnchor,
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
  spawnZzz,
  updateParticles,
} from '../../src/canvas/particles';
import { createSeededRng } from '../../src/engine/rng';

describe('Canvas Shop Floor Layout & Geometry', () => {
  it('clamps DPR to [1, 3] and switches pen columns at the mobile breakpoint', () => {
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(5)).toBe(3);

    expect(getPenColumns(390, 3)).toBe(2);
    expect(getPenColumns(FLOOR_CSS.mobileBreakpoint, 3)).toBe(3);
    expect(getPenColumns(1000, 2)).toBe(2);
  });

  it('computes integer Platinum sprite scaling and valid pen/bed/walkway bounds', () => {
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
    // Positive dx (moving right) flips left-facing Platinum art via -1
    expect(facingForDelta(8, 1)).toBe(-1);
    // Negative dx (moving left) keeps native 1
    expect(facingForDelta(-8, -1)).toBe(1);
    // Tiny delta within threshold preserves existing facing
    expect(facingForDelta(0.2, -1, 0.5)).toBe(-1);

    expect(walkFrame(0, 8)).toBe(0);
    expect(walkFrame(9, 8)).toBe(1);
    expect(walkFrame(17, 8)).toBe(0);
  });
});

describe('Procedural Pixel Particles', () => {
  it('spawns, integrates, fades, prunes, and caps particle counts', () => {
    const rng = createSeededRng(77);
    const hearts = spawnHearts(100, 120, 2, rng, 3);
    const sparkles = spawnSparkles(100, 120, 18, 2, rng, 4);
    const zzz = spawnZzz(100, 120, 2, rng);
    const coin = spawnCoin(100, 120, 2, '+₽950');

    expect(hearts).toHaveLength(3);
    expect(sparkles).toHaveLength(4);
    expect(zzz.kind).toBe('zzz');
    expect(coin.label).toBe('+₽950');

    let pool = addParticles([], [...hearts, ...sparkles, zzz, coin]);
    expect(pool).toHaveLength(9);

    // Mid-life opacity is 1, near-zero age fades in, tail fades out
    const startAlpha = particleAlpha(coin);
    expect(startAlpha).toBe(0);

    pool = updateParticles(pool, 0.4);
    const updatedCoin = pool.find((p) => p.kind === 'coin')!;
    expect(updatedCoin.y).toBeLessThan(120);
    expect(Math.abs(updatedCoin.vy)).toBeLessThan(2 * 26); // Decelerates exponentially
    expect(particleAlpha(updatedCoin)).toBe(1);

    // Advancing past max lifetime clears all particles
    pool = updateParticles(pool, 3.0);
    expect(pool).toHaveLength(0);

    // Hard cap enforces MAX_PARTICLES
    const burst = Array.from({ length: MAX_PARTICLES + 30 }, (_, idx) =>
      spawnCoin(10, 10, 2, `+₽${idx}`),
    );
    const capped = addParticles([], burst);
    expect(capped).toHaveLength(MAX_PARTICLES);
  });
});
