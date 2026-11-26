/**
 * Canvas world state machine for the PokéMart shop floor.
 *
 * The world mirrors simulation snapshots (pure engine state) into animated entities:
 * - Pokémon in pens: `idle` (breathing bob) ⇄ `hop` chains (squash-and-stretch + facing flips).
 * - Pokémon in nap beds: `sleep` (squish + drifting `Zzz`).
 * - Shoppers: `entering` (walk from door) → `browsing` (thought bubble) → `leaving` → removed.
 *
 * It also diffs consecutive snapshots to spawn feedback particles (adoption coins,
 * heal/hatch hearts, evolution sparkles). For per-frame performance the world is a
 * mutable object owned by one canvas; all logic stays DOM-free and testable.
 */
import type { CustomerArchetypeId, PokemonInstance, ShopCustomer } from '../data/types';
import { clamp, type RngFn } from '../engine/rng';
import { HOP_DURATION, easeInOutSine, facingForDelta, lerp } from './animation';
import {
  buildEntryRoute,
  dedupePath,
  getBedAnchor,
  getCustomerSpot,
  getPenWanderBounds,
  pathLength,
  pointAlongPath,
} from './layout';
import {
  addParticles,
  spawnCoin,
  spawnHearts,
  spawnSparkles,
  spawnZzz,
  updateParticles,
  type Particle,
} from './particles';
import type {
  FloorSnapshot,
  Point,
  PokemonAnimState,
  ShopLayout,
} from './types';

/** Seconds a shopper takes to walk door → pen at 1× (halved at 2×). */
export const WALK_DURATION = 0.9;

/** Animated Pokémon on the floor. Positions are the sprite's feet anchor. */
export interface PokemonEntity {
  uid: string;
  speciesId: number;
  isShiny: boolean;
  needsRecovery: boolean;
  mode: 'pen' | 'bed';
  slot: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  state: PokemonAnimState;
  stateTime: number;
  stateDuration: number;
  hopsRemaining: number;
  /** `1` = native left-facing Platinum art, `-1` = mirrored to face right. */
  facing: 1 | -1;
  /** Random phase so neighbours never breathe in lockstep. */
  phase: number;
  /** Countdown to the next ambient particle (shiny sparkle or nap `Zzz`). */
  ambientTimer: number;
}

/** Shopper walker lifecycle states. */
export type WalkerState = 'entering' | 'browsing' | 'leaving';

/** Animated shopper visiting a pen. */
export interface CustomerWalker {
  uid: string;
  archetypeId: CustomerArchetypeId;
  penIndex: number;
  visitorIndex: number;
  state: WalkerState;
  path: Point[];
  pathLength: number;
  progress: number;
  x: number;
  y: number;
  facing: 1 | -1;
  /** Distance walked, driving the 2-frame leg cycle. */
  distance: number;
  /** True when leaving after adopting (shows a heart bubble). */
  happy: boolean;
  time: number;
  /** Stable 0..1 seed for hair colour variety. */
  look: number;
}

/** Mutable world owned by one shop floor canvas. */
export interface ShopWorld {
  profileId: string | null;
  time: number;
  pokemon: Map<string, PokemonEntity>;
  walkers: Map<string, CustomerWalker>;
  particles: Particle[];
  lastCash: number | null;
  shiftSpeed: 1 | 2;
  reducedMotion: boolean;
  /** When true (user pressed Pause animation), entities hold still but state still syncs. */
  motionPaused: boolean;
}

/** Counts of feedback events detected during one `syncWorld` call (useful for tests/SFX). */
export interface SyncEvents {
  sales: number;
  heals: number;
  evolutions: number;
  hatches: number;
}

/** Creates an empty world. */
export function createWorld(): ShopWorld {
  return {
    profileId: null,
    time: 0,
    pokemon: new Map(),
    walkers: new Map(),
    particles: [],
    lastCash: null,
    shiftSpeed: 1,
    reducedMotion: false,
    motionPaused: false,
  };
}

/**
 * Converts engine state into the canvas snapshot. Nap-bed slots are assigned in
 * array order among `healing` Pokémon (matching the Nap Station panel order).
 */
export function buildFloorSnapshot(
  profileId: string,
  cash: number,
  shiftSpeed: 1 | 2,
  pokemon: readonly PokemonInstance[],
  customers: readonly ShopCustomer[],
): FloorSnapshot {
  let bedSlot = 0;
  return {
    profileId,
    cash,
    shiftSpeed,
    pokemon: pokemon.map((mon) => {
      let location: 'pen' | 'healing' | 'hidden' = 'hidden';
      let slot: number | null = null;
      if (mon.location === 'pen' && mon.penIndex !== null) {
        location = 'pen';
        slot = mon.penIndex;
      } else if (mon.location === 'healing') {
        location = 'healing';
        slot = bedSlot;
        bedSlot += 1;
      }
      return {
        uid: mon.uid,
        speciesId: mon.speciesId,
        isShiny: mon.isShiny,
        location,
        slot,
        needsRecovery: mon.needsRecovery,
        origin: mon.origin,
      };
    }),
    customers: customers.map((c) => ({
      uid: c.uid,
      archetypeId: c.archetypeId,
      targetPenIndex: c.targetPenIndex,
    })),
  };
}

function randomIn(min: number, max: number, rng: RngFn): number {
  return max <= min ? min : min + rng() * (max - min);
}

/** Places an entity at a fresh spot for its slot. Returns false if the slot has no geometry. */
function placeEntity(ent: PokemonEntity, layout: ShopLayout, rng: RngFn): boolean {
  if (ent.mode === 'bed') {
    const anchor = getBedAnchor(layout, ent.slot);
    if (!anchor) return false;
    ent.x = ent.fromX = ent.toX = anchor.x;
    ent.y = ent.fromY = ent.toY = anchor.y;
    ent.state = 'sleep';
    ent.stateTime = 0;
    ent.ambientTimer = 0.4 + rng() * 1.2;
    return true;
  }
  const bounds = getPenWanderBounds(layout, ent.slot);
  if (!bounds) return false;
  ent.x = ent.fromX = ent.toX = randomIn(bounds.x, bounds.x + bounds.w, rng);
  ent.y = ent.fromY = ent.toY = randomIn(bounds.y, bounds.y + bounds.h, rng);
  ent.state = 'idle';
  ent.stateTime = 0;
  ent.stateDuration = 0.6 + rng() * 2.4;
  ent.hopsRemaining = 0;
  ent.ambientTimer = 0.3 + rng() * 0.6;
  return true;
}

/** Visual centre of a sprite (for particle anchors), relative to its feet. */
function spriteCenter(ent: PokemonEntity, layout: ShopLayout): Point {
  return { x: ent.x, y: ent.y - layout.spriteSize * 0.4 };
}

function startHop(ent: PokemonEntity, layout: ShopLayout, rng: RngFn): void {
  const bounds = getPenWanderBounds(layout, ent.slot);
  if (!bounds) return;
  // Each hop covers at most ~45% of a sprite width so movement stays gentle.
  const maxStep = Math.max(layout.unit * 6, layout.spriteSize * 0.45);
  const tx = clamp(ent.x + (rng() * 2 - 1) * maxStep, bounds.x, bounds.x + bounds.w);
  const ty = clamp(ent.y + (rng() * 2 - 1) * maxStep * 0.4, bounds.y, bounds.y + bounds.h);
  ent.fromX = ent.x;
  ent.fromY = ent.y;
  ent.toX = tx;
  ent.toY = ty;
  ent.facing = facingForDelta(tx - ent.x, ent.facing, layout.unit);
  ent.state = 'hop';
  ent.stateTime = 0;
  ent.stateDuration = HOP_DURATION;
}

function createWalker(
  world: ShopWorld,
  uid: string,
  archetypeId: CustomerArchetypeId,
  penIndex: number,
  layout: ShopLayout,
  rng: RngFn,
): CustomerWalker {
  const safePen = layout.pens[penIndex] ? penIndex : 0;
  let visitorIndex = 0;
  for (const w of world.walkers.values()) {
    if (w.penIndex === safePen && w.state !== 'leaving') visitorIndex += 1;
  }
  const spot = getCustomerSpot(layout, safePen, visitorIndex);
  const path = buildEntryRoute(layout, safePen, spot);
  const instant = world.reducedMotion;
  return {
    uid,
    archetypeId,
    penIndex: safePen,
    visitorIndex,
    state: instant ? 'browsing' : 'entering',
    path,
    pathLength: pathLength(path),
    progress: instant ? 1 : 0,
    x: instant ? spot.x : layout.doorSpot.x,
    y: instant ? spot.y : layout.doorSpot.y,
    facing: 1,
    distance: 0,
    happy: false,
    time: 0,
    look: rng(),
  };
}

function startLeaving(walker: CustomerWalker, layout: ShopLayout, happy: boolean): void {
  const route = buildEntryRoute(layout, walker.penIndex, { x: walker.x, y: walker.y });
  // Retrace the entry route backwards from wherever the shopper currently stands.
  const path = dedupePath([{ x: walker.x, y: walker.y }, ...route.slice(0, -1).reverse()]);
  walker.state = 'leaving';
  walker.path = path;
  walker.pathLength = pathLength(path);
  walker.progress = 0;
  walker.happy = happy;
}

/**
 * Diffs a new simulation snapshot into the world.
 * Adoption detection: a pen Pokémon vanished from the save entirely (not merely moved to
 * the Reserve Kennel) while cash rose in the same update → spawn `+₽` coins and hearts.
 */
export function syncWorld(
  world: ShopWorld,
  snapshot: FloorSnapshot,
  layout: ShopLayout,
  rng: RngFn,
): SyncEvents {
  const events: SyncEvents = { sales: 0, heals: 0, evolutions: 0, hatches: 0 };
  const firstSync = world.profileId !== snapshot.profileId;
  if (firstSync) {
    // Profile switch / first mount: rebuild silently, never celebrate pre-existing state.
    world.profileId = snapshot.profileId;
    world.pokemon.clear();
    world.walkers.clear();
    world.particles = [];
    world.lastCash = snapshot.cash;
  }
  world.shiftSpeed = snapshot.shiftSpeed;
  const cashDelta = world.lastCash === null ? 0 : snapshot.cash - world.lastCash;
  const u = layout.unit;
  const newParticles: Particle[] = [];

  const ownedUids = new Set(snapshot.pokemon.map((p) => p.uid));
  const visible = snapshot.pokemon.filter((p) => p.location !== 'hidden' && p.slot !== null);
  const visibleUids = new Set(visible.map((p) => p.uid));

  // 1. Removals (moved off-floor or adopted).
  const sold: PokemonEntity[] = [];
  for (const [uid, ent] of world.pokemon) {
    if (visibleUids.has(uid)) continue;
    if (!ownedUids.has(uid) && ent.mode === 'pen') sold.push(ent);
    world.pokemon.delete(uid);
  }
  const salePens = new Set<number>();
  if (!firstSync && cashDelta > 0 && sold.length > 0 && sold.length <= 3) {
    const share = Math.round(cashDelta / sold.length);
    for (const ent of sold) {
      const c = spriteCenter(ent, layout);
      newParticles.push(spawnCoin(c.x, c.y, u, `+₽${share.toLocaleString()}`));
      newParticles.push(...spawnHearts(c.x, c.y, u, rng, 2));
      salePens.add(ent.slot);
      events.sales += 1;
    }
  }

  // 2. Additions and updates.
  for (const mon of visible) {
    const mode: 'pen' | 'bed' = mon.location === 'healing' ? 'bed' : 'pen';
    const slot = mon.slot as number;
    let ent = world.pokemon.get(mon.uid);

    if (!ent) {
      ent = {
        uid: mon.uid,
        speciesId: mon.speciesId,
        isShiny: mon.isShiny,
        needsRecovery: mon.needsRecovery,
        mode,
        slot,
        x: 0,
        y: 0,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        state: 'idle',
        stateTime: 0,
        stateDuration: 1,
        hopsRemaining: 0,
        facing: rng() < 0.5 ? 1 : -1,
        phase: rng() * Math.PI * 2,
        ambientTimer: 1,
      };
      if (!placeEntity(ent, layout, rng)) continue;
      world.pokemon.set(mon.uid, ent);
      if (!firstSync && mon.origin === 'hatched') {
        const c = spriteCenter(ent, layout);
        newParticles.push(...spawnHearts(c.x, c.y, u, rng, 3));
        newParticles.push(...spawnSparkles(c.x, c.y, layout.spriteSize * 0.35, u, rng, 6));
        events.hatches += 1;
      }
      continue;
    }

    if (ent.mode !== mode || ent.slot !== slot) {
      ent.mode = mode;
      ent.slot = slot;
      if (!placeEntity(ent, layout, rng)) {
        world.pokemon.delete(mon.uid);
        continue;
      }
    }
    if (!firstSync && ent.needsRecovery && !mon.needsRecovery) {
      const c = spriteCenter(ent, layout);
      newParticles.push(...spawnHearts(c.x, c.y, u, rng, 3));
      events.heals += 1;
    }
    if (!firstSync && ent.speciesId !== mon.speciesId) {
      const c = spriteCenter(ent, layout);
      newParticles.push(...spawnSparkles(c.x, c.y, layout.spriteSize * 0.45, u, rng, 10));
      newParticles.push(...spawnHearts(c.x, c.y, u, rng, 2));
      events.evolutions += 1;
    }
    ent.speciesId = mon.speciesId;
    ent.isShiny = mon.isShiny;
    ent.needsRecovery = mon.needsRecovery;
  }

  // 3. Shoppers: new uids walk in; vanished uids walk out (happily if their pen just sold).
  const customerUids = new Set(snapshot.customers.map((c) => c.uid));
  for (const c of snapshot.customers) {
    if (!world.walkers.has(c.uid)) {
      world.walkers.set(c.uid, createWalker(world, c.uid, c.archetypeId, c.targetPenIndex, layout, rng));
    }
  }
  for (const walker of world.walkers.values()) {
    if (!customerUids.has(walker.uid) && walker.state !== 'leaving') {
      if (world.reducedMotion) {
        world.walkers.delete(walker.uid);
      } else {
        startLeaving(walker, layout, salePens.has(walker.penIndex));
      }
    }
  }

  world.particles = addParticles(world.particles, newParticles);
  world.lastCash = snapshot.cash;
  return events;
}

/**
 * Re-fits every entity after a resize / pen-count change: Pokémon get fresh spots in
 * their (moved) slot rectangles, browsing shoppers snap to their new spots, and
 * in-flight walkers are retired to avoid walking along stale geometry.
 */
export function relayoutWorld(world: ShopWorld, layout: ShopLayout, rng: RngFn): void {
  for (const [uid, ent] of world.pokemon) {
    if (!placeEntity(ent, layout, rng)) world.pokemon.delete(uid);
  }
  for (const [uid, walker] of world.walkers) {
    if (walker.state === 'leaving' || !layout.pens[walker.penIndex]) {
      world.walkers.delete(uid);
      continue;
    }
    const spot = getCustomerSpot(layout, walker.penIndex, walker.visitorIndex);
    walker.path = buildEntryRoute(layout, walker.penIndex, spot);
    walker.pathLength = pathLength(walker.path);
    walker.progress = 1;
    walker.state = 'browsing';
    walker.x = spot.x;
    walker.y = spot.y;
  }
  world.particles = [];
}

function stepPokemon(world: ShopWorld, ent: PokemonEntity, dt: number, layout: ShopLayout, rng: RngFn): Particle[] {
  const spawned: Particle[] = [];
  const u = layout.unit;
  ent.stateTime += dt;
  const ambient = !world.reducedMotion;

  if (ent.mode === 'bed') {
    ent.state = 'sleep';
    if (ambient) {
      ent.ambientTimer -= dt;
      if (ent.ambientTimer <= 0) {
        ent.ambientTimer = 1.5 + rng() * 0.9;
        spawned.push(spawnZzz(ent.x + layout.spriteSize * 0.18, ent.y - layout.spriteSize * 0.55, u, rng));
      }
    }
    return spawned;
  }

  if (world.reducedMotion) {
    ent.state = 'idle';
    return spawned;
  }

  if (ent.state === 'idle' && ent.stateTime >= ent.stateDuration) {
    ent.hopsRemaining = 1 + Math.floor(rng() * 3);
    startHop(ent, layout, rng);
  } else if (ent.state === 'hop') {
    const p = ent.stateTime / HOP_DURATION;
    if (p >= 1) {
      ent.x = ent.toX;
      ent.y = ent.toY;
      ent.hopsRemaining -= 1;
      if (ent.hopsRemaining > 0) {
        startHop(ent, layout, rng);
      } else {
        ent.state = 'idle';
        ent.stateTime = 0;
        ent.stateDuration = 1.4 + rng() * 2.6;
      }
    } else {
      // Horizontal travel eases in/out; the vertical arc comes from hopPose() at render time.
      const k = easeInOutSine(p);
      ent.x = lerp(ent.fromX, ent.toX, k);
      ent.y = lerp(ent.fromY, ent.toY, k);
    }
  }

  if (ent.isShiny && ambient) {
    ent.ambientTimer -= dt;
    if (ent.ambientTimer <= 0) {
      ent.ambientTimer = 0.45 + rng() * 0.4;
      const c = spriteCenter(ent, layout);
      spawned.push(...spawnSparkles(c.x, c.y, layout.spriteSize * 0.32, u, rng, 1));
    }
  }
  return spawned;
}

function stepWalker(world: ShopWorld, walker: CustomerWalker, dt: number): boolean {
  walker.time += dt;
  if (walker.state === 'browsing') return true;
  const prevX = walker.x;
  const prevY = walker.y;
  // Time-based walking: a full route always takes WALK_DURATION / shiftSpeed seconds,
  // so shoppers arrive before their browse timer (≥3 ticks) runs out at both speeds.
  walker.progress = Math.min(1, walker.progress + (dt * world.shiftSpeed) / WALK_DURATION);
  const pt = pointAlongPath(walker.path, walker.pathLength, walker.progress);
  walker.x = pt.x;
  walker.y = pt.y;
  walker.facing = facingForDelta(walker.x - prevX, walker.facing, 0.01);
  walker.distance += Math.hypot(walker.x - prevX, walker.y - prevY);
  if (walker.progress >= 1) {
    if (walker.state === 'leaving') return false;
    walker.state = 'browsing';
    // Spots sit at a pen's right edge, so browsing shoppers face left toward the Pokémon.
    walker.facing = 1;
  }
  return true;
}

/**
 * Advances the world by `dt` seconds: Pokémon state machines, shopper walks, ambient
 * particles, and particle integration. While `motionPaused`, nothing moves.
 */
export function stepWorld(world: ShopWorld, dt: number, layout: ShopLayout, rng: RngFn): void {
  if (world.motionPaused) return;
  world.time += dt;
  let spawned: Particle[] = [];
  for (const ent of world.pokemon.values()) {
    const extra = stepPokemon(world, ent, dt, layout, rng);
    if (extra.length > 0) spawned = spawned.concat(extra);
  }
  for (const [uid, walker] of world.walkers) {
    if (!stepWalker(world, walker, dt)) world.walkers.delete(uid);
  }
  world.particles = updateParticles(addParticles(world.particles, spawned), dt);
}

/**
 * Hit-tests a backing-store point against Pokémon sprites (front-most first) and
 * returns the uid under the pointer, if any.
 */
export function hitTestPokemon(world: ShopWorld, layout: ShopLayout, x: number, y: number): string | null {
  const s = layout.spriteSize;
  const sorted = [...world.pokemon.values()].sort((a, b) => b.y - a.y);
  for (const ent of sorted) {
    const halfW = s * 0.34;
    if (x >= ent.x - halfW && x <= ent.x + halfW && y >= ent.y - s * 0.82 && y <= ent.y + layout.unit * 2) {
      return ent.uid;
    }
  }
  return null;
}
