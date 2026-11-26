/**
 * Deterministic PRNG and numeric helpers used across breeding, market rolls,
 * and automated Vitest verification.
 */

/** Random generator returning floats in [0, 1). */
export type RngFn = () => number;

/**
 * Mulberry32 deterministic seeded PRNG so tests and shift rolls stay reproducible.
 */
export function createSeededRng(seed: number): RngFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamps a number inclusively between `min` and `max`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Returns a random integer between `minInclusive` and `maxInclusive`. */
export function randomInt(minInclusive: number, maxInclusive: number, rng: RngFn): number {
  return Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

/** Picks a random item from a non-empty array using the provided RNG. */
export function pickRandom<T>(items: readonly T[], rng: RngFn): T {
  if (items.length === 0) {
    throw new Error('Cannot pickRandom from an empty array.');
  }
  return items[Math.floor(rng() * items.length)];
}
