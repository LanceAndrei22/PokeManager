/**
 * Unit tests for Main Menu rolling nature meadow roamer spawning, strictly left-to-right
 * movement, randomization, wrap re-rolling, and off-screen preload holding.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BUNDLED_WALK_SPECIES_POOL,
  MEADOW_ROAMER_COUNT,
  MEADOW_WALK_SPECIES_POOL,
  MEADOW_WRAP_LEFT_X,
  MEADOW_WRAP_RIGHT_X,
  MEADOW_Y_MAX,
  MEADOW_Y_MIN,
  createInitialMeadowRoamers,
  stepMeadowRoamers,
  wrapMeadowRoamer,
} from '../../src/canvas/menuRoamers';
import { createSeededRng } from '../../src/engine/rng';

const RIGHTWARD_DIRS = new Set([1, 2, 3]); // 1 = SE, 2 = E, 3 = NE

describe('Main Menu Rolling Meadow Roamers', () => {
  it('draws a verified full Gen 1-4 PMD Walk pool and spawns unique random left-to-right rosters', () => {
    expect(MEADOW_WALK_SPECIES_POOL.length).toBe(493);
    expect(BUNDLED_WALK_SPECIES_POOL.length).toBeGreaterThanOrEqual(20);

    const rosterA = createInitialMeadowRoamers({ rng: createSeededRng(101) });
    const rosterB = createInitialMeadowRoamers({ rng: createSeededRng(202) });

    expect(rosterA).toHaveLength(MEADOW_ROAMER_COUNT);
    expect(rosterB).toHaveLength(MEADOW_ROAMER_COUNT);

    // No duplicate species on screen in either roster
    expect(new Set(rosterA.map((r) => r.speciesId)).size).toBe(MEADOW_ROAMER_COUNT);
    expect(new Set(rosterB.map((r) => r.speciesId)).size).toBe(MEADOW_ROAMER_COUNT);

    // Different RNG seeds produce randomized rosters rather than a fixed hardcoded list
    expect(rosterA.map((r) => r.speciesId)).not.toEqual(rosterB.map((r) => r.speciesId));

    // Every roamer moves strictly left-to-right (vx > 0), faces East/NE/SE, and occupies a staggered lane
    const lanes = new Set<number>();
    for (const mon of rosterA) {
      expect(mon.vx).toBeGreaterThan(0);
      expect(RIGHTWARD_DIRS.has(mon.dir)).toBe(true);
      expect(mon.y).toBeGreaterThanOrEqual(MEADOW_Y_MIN);
      expect(mon.y).toBeLessThanOrEqual(MEADOW_Y_MAX);
      lanes.add(mon.laneIndex);
    }
    expect(lanes.size).toBe(MEADOW_ROAMER_COUNT);
  });

  it('strictly advances all ready roamers left-to-right without ever turning westward', () => {
    const rng = createSeededRng(42);
    const roamers = createInitialMeadowRoamers({
      rng,
      instantPool: [], // all roamers start ready on-screen
    });

    for (let step = 0; step < 60; step += 1) {
      const prevXs = roamers.map((r) => r.x);
      stepMeadowRoamers(roamers, 0.1, {
        rng,
        isSpriteReady: () => true,
      });

      roamers.forEach((mon, idx) => {
        expect(mon.vx).toBeGreaterThan(0);
        expect(RIGHTWARD_DIRS.has(mon.dir)).toBe(true);
        expect(mon.y).toBeGreaterThanOrEqual(MEADOW_Y_MIN);
        expect(mon.y).toBeLessThanOrEqual(MEADOW_Y_MAX);
        // Either advanced strictly rightward, or wrapped cleanly back to the left edge
        const advancedRight = mon.x > prevXs[idx];
        const wrappedToLeft = mon.x === MEADOW_WRAP_LEFT_X && prevXs[idx] > MEADOW_WRAP_RIGHT_X - 0.1;
        expect(advancedRight || wrappedToLeft).toBe(true);
      });
    }
  });

  it('wraps off the right edge back to off-screen left with a fresh non-duplicate species and triggers preload', () => {
    const rng = createSeededRng(777);
    const roamers = createInitialMeadowRoamers({
      rng,
      instantPool: [],
    });

    const target = roamers[0];
    const previousRosterIds = new Set(roamers.map((r) => r.speciesId));
    const preloadSpy = vi.fn();

    target.x = MEADOW_WRAP_RIGHT_X + 0.01;
    const changed = stepMeadowRoamers(roamers, 0.05, {
      rng,
      isSpriteReady: () => false,
      onPreloadSpecies: preloadSpy,
    });

    expect(changed).toBe(true);
    expect(target.x).toBe(MEADOW_WRAP_LEFT_X);
    expect(target.vx).toBeGreaterThan(0);
    expect(RIGHTWARD_DIRS.has(target.dir)).toBe(true);
    expect(previousRosterIds.has(target.speciesId)).toBe(false);
    expect(new Set(roamers.map((r) => r.speciesId)).size).toBe(MEADOW_ROAMER_COUNT);
    expect(preloadSpy).toHaveBeenCalledWith(target.speciesId);

    // Held safely off-screen left until preload completes (zero mid-screen pop-in)
    expect(target.awaitingPreload).toBe(true);
    stepMeadowRoamers(roamers, 0.2, {
      rng,
      isSpriteReady: () => false,
    });
    expect(target.x).toBe(MEADOW_WRAP_LEFT_X);

    // Once sprite finishes decoding, roamer immediately begins striding rightward
    stepMeadowRoamers(roamers, 0.2, {
      rng,
      isSpriteReady: () => true,
    });
    expect(target.awaitingPreload).toBe(false);
    stepMeadowRoamers(roamers, 0.2, {
      rng,
      isSpriteReady: () => true,
    });
    expect(target.x).toBeGreaterThan(MEADOW_WRAP_LEFT_X);
  });

  it('falls back cleanly to a bundled species if remote preload times out while offline', () => {
    const rng = createSeededRng(999);
    const roamers = createInitialMeadowRoamers({ rng, instantPool: [] });
    const target = roamers[0];

    // Force wrap to a remote species that never finishes loading
    wrapMeadowRoamer(target, roamers, {
      rng,
      pool: [493, 492, 491], // remote-only Legendaries/Mythicals
      isSpriteReady: () => false,
    });
    expect(target.awaitingPreload).toBe(true);

    const changed = stepMeadowRoamers(roamers, 3.0, {
      rng,
      fallbackPool: BUNDLED_WALK_SPECIES_POOL,
      isSpriteReady: (id) => BUNDLED_WALK_SPECIES_POOL.includes(id),
      preloadTimeoutSec: 2.5,
    });

    expect(changed).toBe(true);
    expect(BUNDLED_WALK_SPECIES_POOL).toContain(target.speciesId);
    expect(target.awaitingPreload).toBe(false);
  });
});
