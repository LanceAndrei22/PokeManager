/**
 * Pure grounded sprite-animation math for the PokéMart shop floor: subtle grounded
 * breathing scale, sleepy nap squish, smooth walk interpolation, facing flips, and
 * shopper walk cycles. Zero artificial vertical bounce or jumping arcs so every sprite
 * stays physically planted on its contact shadow.
 */

/** Per-frame transform applied around a sprite's feet anchor. */
export interface Pose {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

/** Identity pose (used when motion is paused or reduced). */
export const STATIC_POSE: Pose = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

/** Static sleeping squish used when motion is paused or reduced. */
export const STATIC_SLEEP_POSE: Pose = { offsetX: 0, offsetY: 0, scaleX: 1.06, scaleY: 0.9 };

/** Seconds per idle breath cycle. */
export const IDLE_BREATH_PERIOD = 2.6;
/** Seconds per (slower) sleeping breath cycle. */
export const SLEEP_BREATH_PERIOD = 3.2;

/** Clamps a value to [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Gentle ease-in-out used for smooth floor walking travel. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

/**
 * Grounded idle breathing: keeps `offsetY = 0` so feet stay firmly planted on the contact
 * shadow while gently trading width for height (±1.0% / ±1.4%).
 * `phase` de-syncs neighbours so pens never breathe in lockstep.
 */
export function breathingPose(timeSec: number, phase: number): Pose {
  const wave = Math.sin((timeSec / IDLE_BREATH_PERIOD) * Math.PI * 2 + phase);
  return {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1 - wave * 0.01,
    scaleY: 1 + wave * 0.014,
  };
}

/**
 * Sleepy nap squish: grounded (`offsetY = 0`) and gently flattened with a slow deep breath.
 */
export function sleepPose(timeSec: number, phase: number): Pose {
  const wave = Math.sin((timeSec / SLEEP_BREATH_PERIOD) * Math.PI * 2 + phase);
  return { offsetX: 0, offsetY: 0, scaleX: 1.06 + wave * 0.02, scaleY: 0.9 - wave * 0.025 };
}

/**
 * Facing for a horizontal move. Convention: `1` keeps the native left-facing art,
 * `-1` mirrors it (`scaleX(-1)`) to face right. Tiny moves keep the current facing
 * so sprites don't jitter-flip on near-vertical paths.
 */
export function facingForDelta(dx: number, current: 1 | -1, threshold = 0.5): 1 | -1 {
  if (dx > threshold) return -1;
  if (dx < -threshold) return 1;
  return current;
}

/** Two-frame walk cycle index driven by distance travelled (`stride` px per frame). */
export function walkFrame(distance: number, stride: number): 0 | 1 {
  if (stride <= 0) return 0;
  return Math.floor(distance / stride) % 2 === 0 ? 0 : 1;
}
