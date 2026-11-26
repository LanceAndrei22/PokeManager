/**
 * Procedural pixel particle system: care hearts, floating nap `Zzz`, shiny gold
 * sparkles, and rising `+₽` adoption coins. Pure data + integration so it can be
 * unit-tested and rendered by any backend.
 */
import type { RngFn } from '../engine/rng';

/** Particle visual kinds. */
export type ParticleKind = 'heart' | 'zzz' | 'sparkle' | 'coin' | 'sweat';

/** One live particle (positions/velocities in backing px and px/s). */
export interface Particle {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Optional text (e.g. `+₽977` on adoption coins). */
  label?: string;
  /** Per-particle phase for side-to-side drift. */
  phase: number;
}

/** Hard cap so a long 2× shift can never grow the particle list unbounded. */
export const MAX_PARTICLES = 160;

let nextParticleId = 1;
function makeParticle(fields: Omit<Particle, 'id' | 'age'>): Particle {
  nextParticleId += 1;
  return { id: nextParticleId, age: 0, ...fields };
}

/**
 * Integrates particle motion by `dt` seconds and drops expired ones.
 * Coins and hearts decelerate exponentially (`v *= 0.35^dt`) so they "float" to a stop;
 * Zzz and sparkles drift at constant speed.
 */
export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const damping = Math.pow(0.35, dt);
  const next: Particle[] = [];
  for (const p of particles) {
    const age = p.age + dt;
    if (age >= p.life) continue;
    const decel = p.kind === 'coin' || p.kind === 'heart';
    next.push({
      ...p,
      age,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: decel ? p.vx * damping : p.vx,
      vy: decel ? p.vy * damping : p.vy,
    });
  }
  return next.length > MAX_PARTICLES ? next.slice(next.length - MAX_PARTICLES) : next;
}

/** Opacity envelope: quick 10% fade-in, hold, then fade out over the last 35% of life. */
export function particleAlpha(p: Particle): number {
  const t = p.life <= 0 ? 1 : p.age / p.life;
  if (t < 0.1) return t / 0.1;
  if (t > 0.65) return Math.max(0, (1 - t) / 0.35);
  return 1;
}

/** Appends particles while respecting `MAX_PARTICLES`. */
export function addParticles(list: Particle[], extra: Particle[]): Particle[] {
  const merged = list.concat(extra);
  return merged.length > MAX_PARTICLES ? merged.slice(merged.length - MAX_PARTICLES) : merged;
}

/** A small fan of rising hearts (care, healing, hatching, happy adoptions). */
export function spawnHearts(x: number, y: number, unit: number, rng: RngFn, count = 3): Particle[] {
  return Array.from({ length: count }, (_, i) =>
    makeParticle({
      kind: 'heart',
      x: x + (i - (count - 1) / 2) * unit * 4,
      y,
      vx: (rng() * 2 - 1) * unit * 4,
      vy: -(unit * 14 + rng() * unit * 8),
      life: 1.2 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
    }),
  );
}

/** Shiny gold sparkles scattered within `radius` of a point. */
export function spawnSparkles(
  x: number,
  y: number,
  radius: number,
  unit: number,
  rng: RngFn,
  count = 1,
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2;
    const r = rng() * radius;
    return makeParticle({
      kind: 'sparkle',
      x: x + Math.cos(angle) * r,
      y: y + Math.sin(angle) * r,
      vx: 0,
      vy: -unit * 3,
      life: 0.6 + rng() * 0.35,
      phase: rng() * Math.PI * 2,
    });
  });
}

/** One sleepy `Z` drifting up and to the right above a napping stray. */
export function spawnZzz(x: number, y: number, unit: number, rng: RngFn): Particle {
  return makeParticle({
    kind: 'zzz',
    x,
    y,
    vx: unit * 4,
    vy: -unit * 7,
    life: 2.2,
    phase: rng() * Math.PI * 2,
  });
}

/** A rising adoption coin with its `+₽` amount label. */
export function spawnCoin(x: number, y: number, unit: number, label: string): Particle {
  return makeParticle({ kind: 'coin', x, y, vx: 0, vy: -unit * 26, life: 1.8, label, phase: 0 });
}

/** An urgent cyan sweat drop arcing off an impatient shopper at the Human Clerk counter. */
export function spawnSweatDrop(x: number, y: number, unit: number, rng: RngFn): Particle {
  return makeParticle({
    kind: 'sweat',
    x,
    y,
    vx: (rng() < 0.5 ? -1 : 1) * unit * 10,
    vy: -unit * 6,
    life: 0.75,
    phase: rng() * Math.PI * 2,
  });
}
