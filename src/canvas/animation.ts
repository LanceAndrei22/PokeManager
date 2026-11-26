/**
 * Pure sprite-animation math for the cozy Platinum shop floor: idle breathing bobs,
 * squash-and-stretch hops, sleepy nap squish, facing flips, and shopper walk cycles.
 * Every function maps time/progress to a Pose, so motion is deterministic and testable.
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
export const STATIC_SLEEP_POSE: Pose = { offsetX: 0, offsetY: 0, scaleX: 1.08, scaleY: 0.88 };

/** Seconds per idle breath cycle. */
export const IDLE_BREATH_PERIOD = 2.4;
/** Seconds per (slower) sleeping breath cycle. */
export const SLEEP_BREATH_PERIOD = 3.2;
/** Seconds one hop takes from crouch to landing. */
export const HOP_DURATION = 0.42;

/** Clamps a value to [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Gentle ease-in-out used for horizontal hop travel. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

/**
 * Idle breathing bob: a slow sine wave lifts the sprite by up to `amplitude` px while
 * subtly trading width for height (volume-preserving feel) — ±1.2% / ±1.8%.
 * `phase` de-syncs neighbours so a pen never "breathes" in lockstep.
 */
export function breathingPose(timeSec: number, phase: number, amplitude: number): Pose {
  const wave = Math.sin((timeSec / IDLE_BREATH_PERIOD) * Math.PI * 2 + phase);
  return {
    offsetX: 0,
    offsetY: -Math.max(0, wave) * amplitude,
    scaleX: 1 - wave * 0.012,
    scaleY: 1 + wave * 0.018,
  };
}

/**
 * Squash-and-stretch hop, split into three phases of normalized progress `p`:
 * - 0.00–0.15 anticipation: crouch (wide & short) on the ground.
 * - 0.15–0.85 airborne: parabolic arc `y = -4h·q(1-q)` peaking at `height`, with a stretch
 *   proportional to vertical speed (tall & thin leaving/approaching the ground, round at apex).
 * - 0.85–1.00 landing: impact squash that settles back to identity.
 * All phase boundaries evaluate to scale 1, so the pose is continuous.
 */
export function hopPose(progress: number, height: number): Pose {
  const p = clamp01(progress);
  if (p < 0.15) {
    const k = Math.sin(Math.PI * (p / 0.15));
    return { offsetX: 0, offsetY: 0, scaleX: 1 + 0.12 * k, scaleY: 1 - 0.12 * k };
  }
  if (p <= 0.85) {
    const q = (p - 0.15) / 0.7;
    const arc = -4 * height * q * (1 - q);
    // |1-2q| ∝ vertical speed; sin(πq) fades the stretch to 0 at take-off/landing for continuity.
    const stretch = 0.2 * Math.sin(Math.PI * q) * Math.abs(1 - 2 * q);
    return { offsetX: 0, offsetY: arc, scaleX: 1 - stretch * 0.7, scaleY: 1 + stretch };
  }
  const k = Math.sin(Math.PI * ((p - 0.85) / 0.15));
  return { offsetX: 0, offsetY: 0, scaleX: 1 + 0.14 * k, scaleY: 1 - 0.14 * k };
}

/**
 * Sleepy nap squish: flattened (~1.08× wide, ~0.88× tall) with a slow, deep breath.
 */
export function sleepPose(timeSec: number, phase: number): Pose {
  const wave = Math.sin((timeSec / SLEEP_BREATH_PERIOD) * Math.PI * 2 + phase);
  return { offsetX: 0, offsetY: 0, scaleX: 1.08 + wave * 0.025, scaleY: 0.88 - wave * 0.03 };
}

/**
 * Facing for a horizontal move. Convention: `1` keeps the native left-facing art,
 * `-1` mirrors it (`scaleX(-1)`) to face right. Tiny moves keep the current facing
 * so sprites don't jitter-flip on near-vertical hops.
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
