/**
 * Randomized left-to-right wildlife parade state & helpers for the Main Menu
 * rolling nature meadow (`MenuBackdropCanvas.tsx`).
 *
 * Guarantees:
 * - Every roaming PMD Pokémon travels strictly left-to-right (`vx > 0`), matching its
 *   `Walk-Anim.png` facing row (`East`, with subtle `NorthEast` / `SouthEast` drift)
 *   so no Pokémon ever cancels out the scrolling meadow or appears stuck in place.
 * - Draws unique non-duplicate species from the verified Gen 1–4 PMD Walk pool
 *   (zero 404s) on every Main Menu mount and re-rolls a fresh non-duplicate species
 *   whenever a Pokémon wraps past the right edge of the viewport.
 * - Holds newly rolled remote species safely off-screen left (`awaitingPreload`)
 *   until their sprite sheet & `AnimData.xml` finish decoding (with a safe bundled
 *   fallback timeout if offline), preventing mid-screen pop-in or blank sprites.
 */
import rawCoreManifest from '../data/pmdCoreManifest.json';
import { SPECIES_CATALOG } from '../data/species';
import { vectorToPmdDirection } from './pmdAnimator';
import type { PmdDirection } from './types';

interface CoreManifestEntry {
  anims: string[];
  portrait: boolean;
}

const CORE_MANIFEST = rawCoreManifest as Record<string, CoreManifestEntry>;

/** Number of concurrent roaming Pokémon patrolling the Main Menu rolling meadow. */
export const MEADOW_ROAMER_COUNT = 12;

/** Normalized vertical corridor bounds keeping Pokémon clear of header/footer edges. */
export const MEADOW_Y_MIN = 0.2;
export const MEADOW_Y_MAX = 0.87;

/** Horizontal wrap thresholds (normalized viewport width with off-screen sprite margin). */
export const MEADOW_WRAP_LEFT_X = -0.06;
export const MEADOW_WRAP_RIGHT_X = 1.06;

/** Strictly positive rightward speed bounds (normalized viewport widths per second). */
export const MEADOW_VX_MIN = 0.028;
export const MEADOW_VX_MAX = 0.056;

/** Max seconds to wait off-screen for a remote species preload before falling back locally. */
export const MEADOW_PRELOAD_TIMEOUT_SEC = 2.5;

/** All Gen 1–4 species verified in `species.json` to have a `Walk-Anim.png` spritesheet. */
export const MEADOW_WALK_SPECIES_POOL: readonly number[] = SPECIES_CATALOG.filter((sp) =>
  sp.pmdAnims.normal.includes('Walk'),
).map((sp) => sp.id);

/** Locally bundled Gen 1–4 species with instant zero-latency `Walk-Anim.png` sheets. */
export const BUNDLED_WALK_SPECIES_POOL: readonly number[] = SPECIES_CATALOG.filter((sp) => {
  const local = CORE_MANIFEST[sp.paddedId];
  return Boolean(local?.anims.includes('Walk'));
}).map((sp) => sp.id);

/** Live state for a single grounded left-to-right roaming Pokémon on the Main Menu meadow. */
export interface RollingMeadowPokemon {
  speciesId: number;
  /** Normalized viewport X (`MEADOW_WRAP_LEFT_X` .. `MEADOW_WRAP_RIGHT_X`). */
  x: number;
  /** Normalized viewport Y (`MEADOW_Y_MIN` .. `MEADOW_Y_MAX`). */
  y: number;
  /** Strictly positive horizontal velocity (normalized viewport widths per second). */
  vx: number;
  /** Gentle vertical drift keeping direction strictly East / NorthEast / SouthEast. */
  vy: number;
  /** PMD 8-direction row (`1 = SE`, `2 = E`, `3 = NE`). */
  dir: PmdDirection;
  /** Assigned vertical lane slot (`0..count-1`) to keep wildlife evenly staggered. */
  laneIndex: number;
  /** Animation phase offset so neighboring Pokémon don't stride in unison. */
  phase: number;
  /** Parked safely off-screen left while `Walk-Anim.png` + `AnimData.xml` finish decoding. */
  awaitingPreload: boolean;
  /** Elapsed wait time (seconds) while `awaitingPreload` is true. */
  preloadWaitSec: number;
}

/** Injectable options for initial Main Menu roamer spawning. */
export interface CreateMeadowRoamersOptions {
  count?: number;
  pool?: readonly number[];
  instantPool?: readonly number[];
  rng?: () => number;
}

/** Injectable options for stepping and wrapping Main Menu roamers. */
export interface StepMeadowRoamersOptions {
  pool?: readonly number[];
  fallbackPool?: readonly number[];
  rng?: () => number;
  isSpriteReady?: (speciesId: number) => boolean;
  onPreloadSpecies?: (speciesId: number) => void;
  preloadTimeoutSec?: number;
}

/** Picks a random species from `pool` avoiding `excludeIds` whenever candidates remain. */
export function pickUniqueRandomSpecies(
  pool: readonly number[],
  excludeIds: ReadonlySet<number>,
  rng: () => number = Math.random,
): number {
  const available = pool.filter((id) => !excludeIds.has(id));
  const source = available.length > 0 ? available : pool;
  if (source.length === 0) return 133;
  const idx = Math.floor(rng() * source.length) % source.length;
  return source[idx];
}

/** Computes a non-clumping vertical Y position inside the given lane band. */
export function computeMeadowLaneY(
  laneIndex: number,
  laneCount: number,
  rng: () => number = Math.random,
): number {
  const safeCount = Math.max(1, laneCount);
  const clampedLane = ((laneIndex % safeCount) + safeCount) % safeCount;
  const bandHeight = (MEADOW_Y_MAX - MEADOW_Y_MIN) / safeCount;
  return MEADOW_Y_MIN + (clampedLane + 0.22 + rng() * 0.56) * bandHeight;
}

/**
 * Rolls a strictly rightward velocity (`vx > 0`) with optional gentle vertical drift
 * so the PMD 8-direction row is always `East` (`2`), `NorthEast` (`3`), or `SouthEast` (`1`).
 */
export function rollRightwardVelocity(rng: () => number = Math.random): {
  vx: number;
  vy: number;
  dir: PmdDirection;
} {
  const vx = MEADOW_VX_MIN + rng() * (MEADOW_VX_MAX - MEADOW_VX_MIN);
  // Keep vertical drift subtle (~55% mostly straight East, ~45% gentle NE/SE diagonal)
  // and strictly capped at `0.52 * vx` so `vectorToPmdDirection` never turns N, S, or W.
  const driftRoll = rng();
  let vy = 0;
  if (driftRoll < 0.225) {
    vy = -(0.43 + rng() * 0.09) * vx;
  } else if (driftRoll < 0.45) {
    vy = (0.43 + rng() * 0.09) * vx;
  } else {
    vy = (rng() * 2 - 1) * 0.14 * vx;
  }
  const dir = vectorToPmdDirection(vx, vy, 2, 0.001);
  return { vx, vy, dir };
}

function shuffleIndices(count: number, rng: () => number): number[] {
  const arr = Array.from({ length: count }, (_, idx) => idx);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Creates a randomized, non-duplicate initial roster of left-to-right meadow roamers.
 *
 * When `instantPool` overlaps `pool` (default on the live Main Menu), 5 staggered
 * on-screen starters draw randomly from the locally bundled instant-load pool so the
 * meadow is alive immediately without pop-in, while the remaining roamers draw randomly
 * from the full 493-species verified Walk pool staged off-screen left to stride in cleanly
 * once preloaded.
 */
export function createInitialMeadowRoamers(
  options: CreateMeadowRoamersOptions = {},
): RollingMeadowPokemon[] {
  const count = options.count ?? MEADOW_ROAMER_COUNT;
  const pool = options.pool ?? MEADOW_WALK_SPECIES_POOL;
  const rng = options.rng ?? Math.random;
  const poolSet = new Set(pool);
  const validInstantPool = (options.instantPool ?? BUNDLED_WALK_SPECIES_POOL).filter((id) =>
    poolSet.has(id),
  );

  const onScreenCount =
    validInstantPool.length > 0 ? Math.min(5, Math.floor(count / 2), validInstantPool.length) : 0;
  const lanes = shuffleIndices(count, rng);
  const usedSpecies = new Set<number>();
  const roamers: RollingMeadowPokemon[] = [];

  for (let i = 0; i < count; i += 1) {
    const isInstantOnScreen = i < onScreenCount;
    const drawPool = isInstantOnScreen ? validInstantPool : pool;
    const speciesId = pickUniqueRandomSpecies(drawPool, usedSpecies, rng);
    usedSpecies.add(speciesId);

    const laneIndex = lanes[i];
    const y = computeMeadowLaneY(laneIndex, count, rng);
    const { vx, vy, dir } = rollRightwardVelocity(rng);
    const phase = rng() * 6.28;

    let x: number;
    let awaitingPreload: boolean;
    if (isInstantOnScreen) {
      // Spread initial instant-load roamers evenly across the meadow without clumping
      const span = 0.78 / Math.max(1, onScreenCount);
      x = 0.08 + i * span + rng() * span * 0.55;
      awaitingPreload = false;
    } else if (onScreenCount === 0) {
      // Pure pool mode (e.g. unit tests passing a custom pool without instantPool)
      const span = 0.88 / Math.max(1, count);
      x = 0.04 + i * span + rng() * span * 0.5;
      awaitingPreload = false;
    } else {
      // Stagger full-493 random newcomers just off-screen left so they stride in smoothly
      const incomingIdx = i - onScreenCount;
      x = MEADOW_WRAP_LEFT_X - incomingIdx * 0.09 - rng() * 0.03;
      awaitingPreload = true;
    }

    roamers.push({
      speciesId,
      x,
      y,
      vx,
      vy,
      dir,
      laneIndex,
      phase,
      awaitingPreload,
      preloadWaitSec: 0,
    });
  }

  return roamers;
}

/**
 * Wraps a roamer that has crossed past the right edge back off-screen on the left edge
 * as a newly rolled random species (excluding all currently active species on screen),
 * with a fresh vertical lane coordinate and rightward speed.
 */
export function wrapMeadowRoamer(
  roamer: RollingMeadowPokemon,
  activeRoamers: readonly RollingMeadowPokemon[],
  options: StepMeadowRoamersOptions = {},
): RollingMeadowPokemon {
  const pool = options.pool ?? MEADOW_WALK_SPECIES_POOL;
  const rng = options.rng ?? Math.random;
  const isSpriteReady = options.isSpriteReady ?? (() => true);

  const excludeIds = new Set<number>(activeRoamers.map((r) => r.speciesId));
  const nextSpeciesId = pickUniqueRandomSpecies(pool, excludeIds, rng);
  const laneCount = Math.max(1, activeRoamers.length);
  const nextLane = Math.floor(rng() * laneCount) % laneCount;
  const { vx, vy, dir } = rollRightwardVelocity(rng);

  options.onPreloadSpecies?.(nextSpeciesId);
  const readyNow = isSpriteReady(nextSpeciesId);

  roamer.speciesId = nextSpeciesId;
  roamer.x = MEADOW_WRAP_LEFT_X;
  roamer.laneIndex = nextLane;
  roamer.y = computeMeadowLaneY(nextLane, laneCount, rng);
  roamer.vx = vx;
  roamer.vy = vy;
  roamer.dir = dir;
  roamer.phase = rng() * 6.28;
  roamer.awaitingPreload = !readyNow;
  roamer.preloadWaitSec = 0;

  return roamer;
}

/**
 * Advances all Main Menu meadow roamers strictly left-to-right by `dt` seconds.
 * Returns `true` if any roamer changed species (e.g. wrapped or fell back), useful for
 * lightweight telemetry/DOM inspection without per-frame React state updates.
 */
export function stepMeadowRoamers(
  roamers: RollingMeadowPokemon[],
  dt: number,
  options: StepMeadowRoamersOptions = {},
): boolean {
  const fallbackPool = options.fallbackPool ?? BUNDLED_WALK_SPECIES_POOL;
  const rng = options.rng ?? Math.random;
  const isSpriteReady = options.isSpriteReady ?? (() => true);
  const preloadTimeoutSec = options.preloadTimeoutSec ?? MEADOW_PRELOAD_TIMEOUT_SEC;

  let speciesChanged = false;

  for (const mon of roamers) {
    if (mon.awaitingPreload) {
      if (isSpriteReady(mon.speciesId)) {
        mon.awaitingPreload = false;
        mon.preloadWaitSec = 0;
      } else {
        mon.preloadWaitSec += dt;
        if (mon.preloadWaitSec >= preloadTimeoutSec && fallbackPool.length > 0) {
          const excludeIds = new Set<number>(roamers.map((r) => r.speciesId));
          const readyFallback = fallbackPool.filter(
            (id) => !excludeIds.has(id) && isSpriteReady(id),
          );
          const pickFrom = readyFallback.length > 0 ? readyFallback : fallbackPool;
          const nextFallback = pickUniqueRandomSpecies(pickFrom, excludeIds, rng);
          mon.speciesId = nextFallback;
          mon.preloadWaitSec = 0;
          options.onPreloadSpecies?.(nextFallback);
          mon.awaitingPreload = !isSpriteReady(nextFallback);
          speciesChanged = true;
        }
        continue;
      }
    }

    // Strictly positive left-to-right horizontal travel; never reverses or stalls
    mon.x += mon.vx * dt;
    mon.y += mon.vy * dt;

    if (mon.y < MEADOW_Y_MIN) {
      mon.y = MEADOW_Y_MIN;
      mon.vy = Math.abs(mon.vy);
    } else if (mon.y > MEADOW_Y_MAX) {
      mon.y = MEADOW_Y_MAX;
      mon.vy = -Math.abs(mon.vy);
    }

    mon.dir = vectorToPmdDirection(mon.vx, mon.vy, 2, 0.001);

    if (mon.x > MEADOW_WRAP_RIGHT_X) {
      wrapMeadowRoamer(mon, roamers, options);
      speciesChanged = true;
    }
  }

  return speciesChanged;
}
