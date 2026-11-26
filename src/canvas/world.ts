/**
 * Canvas world state machine for the full-screen Indoor PokéMart shop floor.
 *
 * The world mirrors simulation snapshots into grounded animated entities:
 * - Store Pokémon in pens (100% PMD SpriteCollab): cycle smoothly between grounded
 *   `walk` (`Walk-Anim.png`), calm `idle` (`Idle-Anim.png`), and curious turns toward
 *   visiting shoppers (zero jumping/hopping arcs).
 * - Store Pokémon in nap beds (100% PMD SpriteCollab): `sleep` (`Sleep-Anim.png` + `Zzz`).
 * - Human Trainer shoppers (`npcId`): walk 4-directionally from sliding glass doors
 *   → pens → exit, while queued buyers wait in front of Clerk Leo's counter with
 *   live Patience Bars, bouncing `!` offer bubbles, and sweat drops.
 */
import type {
  CounterOffer,
  CustomerArchetypeId,
  EggInstance,
  PokemonInstance,
  ShopCustomer,
  WholesaleOffer,
} from '../data/types';
import { resolveHumanNpcFallback } from '../data/npcs';
import { getSpecies } from '../data/species';
import { clamp, type RngFn } from '../engine/rng';
import { easeInOutSine, facingForDelta, lerp } from './animation';
import { vectorToCardinalDirection, type CardinalDirection } from './humanNpcAnimator';
import {
  buildCounterRoute,
  buildEntryRoute,
  buildExitFromPointRoute,
  dedupePath,
  getBedAnchor,
  getCounterQueueSpot,
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
  spawnSweatDrop,
  spawnZzz,
  updateParticles,
  type Particle,
} from './particles';
import { vectorToPmdDirection } from './pmdAnimator';
import type {
  CanvasHitTarget,
  FloorSnapshot,
  PmdDirection,
  Point,
  PokemonAnimState,
  Rect,
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
  facing: 1 | -1;
  direction: PmdDirection;
  phase: number;
  ambientTimer: number;
}

/** Shopper walker lifecycle states. */
export type WalkerState = 'entering' | 'browsing' | 'leaving';

/** Animated Human Trainer shopper visiting a pen. */
export interface CustomerWalker {
  uid: string;
  archetypeId: CustomerArchetypeId;
  npcId: string;
  penIndex: number;
  visitorIndex: number;
  state: WalkerState;
  path: Point[];
  pathLength: number;
  progress: number;
  x: number;
  y: number;
  facing: 1 | -1;
  direction: PmdDirection;
  cardinalDir: CardinalDirection;
  distance: number;
  happy: boolean;
  time: number;
  look: number;
}

/** Animated Human Trainer standing at or walking toward the PokéMart counter. */
export interface QueuedShopperEntity {
  offerUid: string;
  customerUid?: string;
  npcId: string;
  customerName: string;
  archetypeId: CustomerArchetypeId;
  patience: number;
  maxPatience: number;
  currentOffer: number;
  isVip: boolean;
  penIndex: number;
  queueIndex: number;
  state: 'walking-to-counter' | 'waiting';
  path: Point[];
  pathLength: number;
  progress: number;
  cardinalDir: CardinalDirection;
  distance: number;
  x: number;
  y: number;
  time: number;
  sweatTimer: number;
}

/** Mutable world owned by one shop floor canvas. */
export interface ShopWorld {
  profileId: string | null;
  time: number;
  pokemon: Map<string, PokemonEntity>;
  walkers: Map<string, CustomerWalker>;
  queuedShoppers: Map<string, QueuedShopperEntity>;
  particles: Particle[];
  lastCash: number | null;
  shiftSpeed: 1 | 2;
  eggCount: number;
  readyEggCount: number;
  hasVipContract: boolean;
  doorOpenAmount: number;
  clerkWaveTimer: number;
  eggWobblePhase: number;
  reducedMotion: boolean;
  motionPaused: boolean;
}

/** Counts of feedback events detected during one `syncWorld` call. */
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
    queuedShoppers: new Map(),
    particles: [],
    lastCash: null,
    shiftSpeed: 1,
    eggCount: 0,
    readyEggCount: 0,
    hasVipContract: false,
    doorOpenAmount: 0,
    clerkWaveTimer: 0,
    eggWobblePhase: 0,
    reducedMotion: false,
    motionPaused: false,
  };
}

/** Converts engine state into the minimal canvas floor snapshot. */
export function buildFloorSnapshot(
  profileId: string,
  cash: number,
  shiftSpeed: 1 | 2,
  pokemon: readonly PokemonInstance[],
  customers: readonly ShopCustomer[],
  counterQueue: readonly CounterOffer[] = [],
  eggs: readonly EggInstance[] = [],
  wholesaleCatalog: readonly WholesaleOffer[] = [],
): FloorSnapshot {
  let bedSlot = 0;
  return {
    profileId,
    cash,
    shiftSpeed,
    counterQueueCount: counterQueue.length,
    eggCount: eggs.length,
    readyEggCount: eggs.filter((e) => e.readyToHatch).length,
    hasVipContract: wholesaleCatalog.some((o) => !o.purchased && o.kind === 'vip-contract'),
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
      npcId: c.npcId || resolveHumanNpcFallback(c.archetypeId).id,
      targetPenIndex: c.targetPenIndex,
    })),
    counterQueue: counterQueue.map((q) => ({
      uid: q.uid,
      customerUid: q.customerUid,
      npcId: q.npcId || resolveHumanNpcFallback(q.archetypeId).id,
      customerName: q.customerName,
      archetypeId: q.archetypeId,
      patience: q.patience,
      maxPatience: q.maxPatience,
      currentOffer: q.currentOffer,
      isVip: q.isVip,
      penIndex: q.penIndex,
    })),
  };
}

function randomIn(min: number, max: number, rng: RngFn): number {
  return max <= min ? min : min + rng() * (max - min);
}

function placeEntity(ent: PokemonEntity, layout: ShopLayout, rng: RngFn): boolean {
  if (ent.mode === 'bed') {
    const anchor = getBedAnchor(layout, ent.slot);
    if (!anchor) return false;
    ent.x = ent.fromX = ent.toX = anchor.x;
    ent.y = ent.fromY = ent.toY = anchor.y;
    ent.state = 'sleep';
    ent.direction = 0;
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
  ent.stateDuration = 0.5 + rng() * 0.9;
  ent.ambientTimer = 0.3 + rng() * 0.6;
  return true;
}

function spriteCenter(ent: PokemonEntity, layout: ShopLayout): Point {
  return { x: ent.x, y: ent.y - layout.unit * 10 };
}

function startWalk(ent: PokemonEntity, layout: ShopLayout, rng: RngFn): void {
  const bounds = getPenWanderBounds(layout, ent.slot);
  if (!bounds) return;
  const maxStep = Math.max(layout.unit * 14, layout.spriteSize * 0.85);
  const tx = clamp(ent.x + (rng() * 2 - 1) * maxStep, bounds.x, bounds.x + bounds.w);
  const ty = clamp(ent.y + (rng() * 2 - 1) * maxStep * 0.45, bounds.y, bounds.y + bounds.h);
  ent.fromX = ent.x;
  ent.fromY = ent.y;
  ent.toX = tx;
  ent.toY = ty;
  const dx = tx - ent.x;
  const dy = ty - ent.y;
  const dist = Math.hypot(dx, dy);
  ent.facing = facingForDelta(dx, ent.facing, layout.unit);
  ent.direction = vectorToPmdDirection(dx, dy, ent.direction, layout.unit * 0.35);
  ent.state = 'walk';
  ent.stateTime = 0;
  ent.stateDuration = clamp(dist / Math.max(22, layout.spriteSize * 0.55), 0.8, 1.75);
}

function createWalker(
  world: ShopWorld,
  uid: string,
  archetypeId: CustomerArchetypeId,
  npcId: string,
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
    npcId,
    penIndex: safePen,
    visitorIndex,
    state: instant ? 'browsing' : 'entering',
    path,
    pathLength: pathLength(path),
    progress: instant ? 1 : 0,
    x: instant ? spot.x : layout.doorSpot.x,
    y: instant ? spot.y : layout.doorSpot.y,
    facing: 1,
    direction: instant ? 4 : 0,
    cardinalDir: instant ? 'up' : 'down',
    distance: 0,
    happy: false,
    time: 0,
    look: rng(),
  };
}

function startLeaving(walker: CustomerWalker, layout: ShopLayout, happy: boolean): void {
  const route = buildEntryRoute(layout, walker.penIndex, { x: walker.x, y: walker.y });
  const path = dedupePath([{ x: walker.x, y: walker.y }, ...route.slice(0, -1).reverse()]);
  walker.state = 'leaving';
  walker.path = path;
  walker.pathLength = pathLength(path);
  walker.progress = 0;
  walker.happy = happy;
}

/** Diffs a new simulation snapshot into the animated canvas world. */
export function syncWorld(
  world: ShopWorld,
  snapshot: FloorSnapshot,
  layout: ShopLayout,
  rng: RngFn,
): SyncEvents {
  const events: SyncEvents = { sales: 0, heals: 0, evolutions: 0, hatches: 0 };
  const firstSync = world.profileId !== snapshot.profileId;
  if (firstSync) {
    world.profileId = snapshot.profileId;
    world.pokemon.clear();
    world.walkers.clear();
    world.queuedShoppers.clear();
    world.particles = [];
    world.lastCash = snapshot.cash;
  }
  world.shiftSpeed = snapshot.shiftSpeed;
  world.eggCount = snapshot.eggCount ?? 0;
  world.readyEggCount = snapshot.readyEggCount ?? 0;
  world.hasVipContract = snapshot.hasVipContract ?? false;

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
        facing: rng() < 0.5 ? 1 : -1,
        direction: rng() < 0.5 ? 0 : rng() < 0.5 ? 1 : 7,
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

  // 3. Browsing shoppers: new uids walk in; handed-off counter shoppers transition cleanly; others walk out.
  const customerUids = new Set(snapshot.customers.map((c) => c.uid));
  const queuedByCustomerUid = new Map<string, Point>();
  for (const q of snapshot.counterQueue ?? []) {
    if (q.customerUid) {
      const existingWalker = world.walkers.get(q.customerUid);
      if (existingWalker) {
        queuedByCustomerUid.set(q.customerUid, { x: existingWalker.x, y: existingWalker.y });
        world.walkers.delete(q.customerUid);
      }
    }
  }

  for (const c of snapshot.customers) {
    if (!world.walkers.has(c.uid)) {
      world.walkers.set(
        c.uid,
        createWalker(world, c.uid, c.archetypeId, c.npcId, c.targetPenIndex, layout, rng),
      );
      if (!firstSync) {
        world.clerkWaveTimer = 1.25;
      }
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

  // 4. Queued counter shoppers in front of Clerk Leo's register (walk cleanly from pen -> counter -> door).
  const queueUids = new Set((snapshot.counterQueue ?? []).map((q) => q.uid));
  for (const [uid, queued] of world.queuedShoppers) {
    if (!queueUids.has(uid)) {
      const soldHere = !firstSync && cashDelta > 0;
      if (soldHere) {
        newParticles.push(spawnCoin(queued.x, queued.y - u * 8, u, `+₽${cashDelta.toLocaleString()}`));
        newParticles.push(...spawnHearts(queued.x, queued.y - u * 6, u, rng, 2));
      }
      if (!firstSync && !world.reducedMotion) {
        const exitPath = buildExitFromPointRoute(layout, { x: queued.x, y: queued.y });
        world.walkers.set(`exit-${queued.offerUid}`, {
          uid: `exit-${queued.offerUid}`,
          archetypeId: queued.archetypeId,
          npcId: queued.npcId,
          penIndex: queued.penIndex,
          visitorIndex: 0,
          state: 'leaving',
          path: exitPath,
          pathLength: pathLength(exitPath),
          progress: 0,
          x: queued.x,
          y: queued.y,
          facing: 1,
          direction: 2,
          cardinalDir: 'right',
          distance: 0,
          happy: soldHere,
          time: 0,
          look: rng(),
        });
      }
      world.queuedShoppers.delete(uid);
    }
  }

  (snapshot.counterQueue ?? []).forEach((q, idx) => {
    const spot = getCounterQueueSpot(layout, idx);
    const existing = world.queuedShoppers.get(q.uid);
    if (existing) {
      const prevIdx = existing.queueIndex;
      existing.patience = q.patience;
      existing.maxPatience = q.maxPatience;
      existing.currentOffer = q.currentOffer;
      existing.queueIndex = idx;
      if (world.reducedMotion) {
        existing.x = spot.x;
        existing.y = spot.y;
        existing.state = 'waiting';
        existing.progress = 1;
        existing.cardinalDir = 'up';
      } else if (prevIdx !== idx && Math.hypot(existing.x - spot.x, existing.y - spot.y) > u * 2) {
        const slidePath = dedupePath([{ x: existing.x, y: existing.y }, { ...spot }]);
        existing.path = slidePath;
        existing.pathLength = pathLength(slidePath);
        existing.progress = 0;
        existing.state = 'walking-to-counter';
      }
    } else {
      if (!firstSync) {
        world.clerkWaveTimer = 1.25;
      }
      const instant = firstSync || world.reducedMotion;
      const startPt =
        (q.customerUid ? queuedByCustomerUid.get(q.customerUid) : undefined) ??
        getCustomerSpot(layout, q.penIndex, 0);
      const route = buildCounterRoute(layout, q.penIndex, startPt, spot);
      world.queuedShoppers.set(q.uid, {
        offerUid: q.uid,
        customerUid: q.customerUid,
        npcId: q.npcId,
        customerName: q.customerName,
        archetypeId: q.archetypeId,
        patience: q.patience,
        maxPatience: q.maxPatience,
        currentOffer: q.currentOffer,
        isVip: q.isVip,
        penIndex: q.penIndex,
        queueIndex: idx,
        state: instant ? 'waiting' : 'walking-to-counter',
        path: route,
        pathLength: pathLength(route),
        progress: instant ? 1 : 0,
        cardinalDir: instant ? 'up' : 'right',
        distance: 0,
        x: instant ? spot.x : startPt.x,
        y: instant ? spot.y : startPt.y,
        time: 0,
        sweatTimer: 0.25,
      });
    }
  });

  world.particles = addParticles(world.particles, newParticles);
  world.lastCash = snapshot.cash;
  return events;
}

/** Re-fits every entity after a resize or pen-count change. */
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
    walker.direction = 4;
    walker.cardinalDir = 'up';
    walker.x = spot.x;
    walker.y = spot.y;
  }
  for (const q of world.queuedShoppers.values()) {
    const spot = getCounterQueueSpot(layout, q.queueIndex);
    q.path = [spot];
    q.pathLength = 0;
    q.progress = 1;
    q.state = 'waiting';
    q.cardinalDir = 'up';
    q.x = spot.x;
    q.y = spot.y;
  }
  world.particles = [];
}

function stepPokemon(
  world: ShopWorld,
  ent: PokemonEntity,
  dt: number,
  layout: ShopLayout,
  rng: RngFn,
): Particle[] {
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
        spawned.push(
          spawnZzz(ent.x + layout.spriteSize * 0.18, ent.y - layout.spriteSize * 0.55, u, rng),
        );
      }
    }
    return spawned;
  }

  if (world.reducedMotion) {
    ent.state = 'idle';
    return spawned;
  }

  if (ent.state === 'idle') {
    // Turn curiously toward browsing shoppers admiring this pen
    for (const w of world.walkers.values()) {
      if (w.state === 'browsing' && w.penIndex === ent.slot) {
        ent.direction = vectorToPmdDirection(w.x - ent.x, w.y - ent.y, ent.direction, layout.unit);
        ent.facing = facingForDelta(w.x - ent.x, ent.facing, layout.unit);
        break;
      }
    }
    if (ent.stateTime >= ent.stateDuration) {
      startWalk(ent, layout, rng);
    }
  } else if (ent.state === 'walk') {
    const p = ent.stateTime / Math.max(0.05, ent.stateDuration);
    if (p >= 1) {
      ent.x = ent.toX;
      ent.y = ent.toY;
      ent.state = 'idle';
      ent.stateTime = 0;
      ent.stateDuration = 0.7 + rng() * 1.1;
    } else {
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
  walker.progress = Math.min(1, walker.progress + (dt * world.shiftSpeed) / WALK_DURATION);
  const pt = pointAlongPath(walker.path, walker.pathLength, walker.progress);
  walker.x = pt.x;
  walker.y = pt.y;
  const dx = walker.x - prevX;
  const dy = walker.y - prevY;
  walker.facing = facingForDelta(dx, walker.facing, 0.01);
  walker.direction = vectorToPmdDirection(dx, dy, walker.direction, 0.01);
  walker.cardinalDir = vectorToCardinalDirection(dx, dy, walker.cardinalDir, 0.01);
  walker.distance += Math.hypot(dx, dy);
  if (walker.progress >= 1) {
    if (walker.state === 'leaving') return false;
    walker.state = 'browsing';
    walker.facing = 1;
    walker.direction = 4;
    walker.cardinalDir = 'up';
  }
  return true;
}

/** Advances the world by `dt` seconds unless `motionPaused` is true. */
export function stepWorld(
  world: ShopWorld,
  dt: number,
  layout: ShopLayout,
  rng: RngFn,
): void {
  if (world.motionPaused) return;
  world.time += dt;
  world.clerkWaveTimer = Math.max(0, world.clerkWaveTimer - dt);
  if (!world.reducedMotion) {
    world.eggWobblePhase = (world.eggWobblePhase + dt * 4.2) % (Math.PI * 2);
  }

  let spawned: Particle[] = [];
  for (const ent of world.pokemon.values()) {
    const extra = stepPokemon(world, ent, dt, layout, rng);
    if (extra.length > 0) spawned = spawned.concat(extra);
  }
  for (const [uid, walker] of world.walkers) {
    if (!stepWalker(world, walker, dt)) world.walkers.delete(uid);
  }
  for (const q of world.queuedShoppers.values()) {
    q.time += dt;
    if (q.state === 'walking-to-counter' && !world.reducedMotion) {
      const prevX = q.x;
      const prevY = q.y;
      q.progress = Math.min(1, q.progress + (dt * world.shiftSpeed) / WALK_DURATION);
      const pt = pointAlongPath(q.path, q.pathLength, q.progress);
      q.x = pt.x;
      q.y = pt.y;
      const dx = q.x - prevX;
      const dy = q.y - prevY;
      q.cardinalDir = vectorToCardinalDirection(dx, dy, q.cardinalDir, 0.01);
      q.distance += Math.hypot(dx, dy);
      if (q.progress >= 1) {
        q.state = 'waiting';
        q.cardinalDir = 'up';
      }
    }
    const ratio = q.maxPatience > 0 ? q.patience / q.maxPatience : 1;
    if (!world.reducedMotion && ratio < 0.35) {
      q.sweatTimer -= dt;
      if (q.sweatTimer <= 0) {
        q.sweatTimer = 0.55 + rng() * 0.35;
        const humanScale = Math.max(2, layout.unit);
        spawned.push(spawnSweatDrop(q.x, q.y - humanScale * 18, layout.unit, rng));
      }
    }
  }

  let doorTraffic = false;
  const thresholdRadius = Math.max(layout.door.w * 1.15, layout.unit * 26);
  for (const w of world.walkers.values()) {
    if (Math.hypot(w.x - layout.doorSpot.x, w.y - layout.doorSpot.y) <= thresholdRadius) {
      doorTraffic = true;
      break;
    }
  }
  if (!doorTraffic) {
    for (const q of world.queuedShoppers.values()) {
      if (Math.hypot(q.x - layout.doorSpot.x, q.y - layout.doorSpot.y) <= thresholdRadius) {
        doorTraffic = true;
        break;
      }
    }
  }
  const targetDoor = doorTraffic ? 1 : 0;
  if (world.reducedMotion) {
    world.doorOpenAmount = targetDoor;
  } else {
    world.doorOpenAmount = clamp(
      world.doorOpenAmount + (targetDoor - world.doorOpenAmount) * Math.min(1, dt * 6),
      0,
      1,
    );
  }

  world.particles = updateParticles(addParticles(world.particles, spawned), dt);
}

function pointInRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Hit-tests a backing-store point against Pokémon sprites on the floor. */
export function hitTestPokemon(
  world: ShopWorld,
  layout: ShopLayout,
  x: number,
  y: number,
): string | null {
  const s = layout.spriteSize;
  const u = layout.unit;
  const sorted = [...world.pokemon.values()].sort((a, b) => b.y - a.y);
  for (const ent of sorted) {
    const halfW = Math.max(u * 14, s * 0.24);
    const topH = Math.max(u * 28, s * 0.56);
    if (
      x >= ent.x - halfW &&
      x <= ent.x + halfW &&
      y >= ent.y - topH &&
      y <= ent.y + u * 2
    ) {
      return ent.uid;
    }
  }
  return null;
}

/**
 * Resolves clicks on queued counter shoppers (`!` bubble or body), Pokémon,
 * interactive shop stations (Wholesale PC, Egg Incubator, Healing Corner,
 * Upgrades Board), or empty display pens.
 */
export function hitTestIndoorScene(
  world: ShopWorld,
  layout: ShopLayout,
  x: number,
  y: number,
): CanvasHitTarget | null {
  const u = layout.unit;

  // 1. Queued shoppers at Clerk Leo's register (sprite + tightly anchored patience/! bubble)
  const humanScale = Math.max(2, u);
  const sortedQueue = [...world.queuedShoppers.values()].sort((a, b) => b.y - a.y);
  for (const q of sortedQueue) {
    const halfW = Math.max(u * 10, humanScale * 9);
    const topY = q.y - humanScale * 22 - u * 13;
    if (x >= q.x - halfW && x <= q.x + halfW && y >= topY && y <= q.y + u * 4) {
      return {
        kind: 'counter-offer',
        offerUid: q.offerUid,
        label: `Negotiate with ${q.customerName} (₽${q.currentOffer.toLocaleString()})`,
      };
    }
  }

  // 2. Store Pokémon on pens or beds
  const monUid = hitTestPokemon(world, layout, x, y);
  if (monUid) {
    const mon = world.pokemon.get(monUid);
    const name = mon ? getSpecies(mon.speciesId).name : 'Companion';
    return {
      kind: 'pokemon',
      uid: monUid,
      label: mon?.mode === 'bed' ? `${name} (Resting)` : `${name} — Inspect & Care`,
    };
  }

  // 3. Interactive stations
  if (pointInRect(layout.pcStation, x, y)) {
    return {
      kind: 'station',
      station: 'wholesale',
      label: world.hasVipContract ? 'Wholesale PC (VIP Contract!)' : 'Wholesale PC Terminal',
    };
  }
  if (pointInRect(layout.incubatorStation, x, y)) {
    return {
      kind: 'station',
      station: 'breeding',
      label:
        world.readyEggCount > 0
          ? `Egg Incubator (${world.readyEggCount} Ready!)`
          : `Egg Incubator (${world.eggCount} Warming)`,
    };
  }
  if (pointInRect(layout.upgradesStation, x, y)) {
    return {
      kind: 'station',
      station: 'upgrades',
      label: 'Shop Upgrades Board',
    };
  }
  if (pointInRect(layout.napArea, x, y)) {
    return {
      kind: 'station',
      station: 'healing',
      label: 'Healing Corner & Nap Beds',
    };
  }

  // 4. Empty Display Pen slot -> open Pens / Reserve Manager
  for (const pen of layout.pens) {
    if (pointInRect(pen, x, y)) {
      return {
        kind: 'empty-pen',
        penIndex: pen.index,
        label: `Display Pen #${pen.index + 1}`,
      };
    }
  }

  return null;
}
