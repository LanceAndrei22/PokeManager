/**
 * Shared types for the PokéMart HTML5 2D Canvas shop floor.
 *
 * Coordinate convention: every position and size below is in canvas *backing-store*
 * pixels (CSS px × devicePixelRatio). The renderer never applies a global scale
 * transform, so 80×80 Platinum sprites can be blitted at exact integer multiples
 * and stay crisp on HiDPI screens.
 */
import type { CustomerArchetypeId } from '../data/types';

/** 2D point in backing-store pixels. */
export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle in backing-store pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A display pen's outer frame plus the straw-bedded interior Pokémon may wander in. */
export interface PenRect extends Rect {
  index: number;
  inner: Rect;
}

/** Fully resolved shop floor geometry for one canvas size / pen count / DPR combination. */
export interface ShopLayout {
  cssWidth: number;
  cssHeight: number;
  /** Backing-store width (`canvas.width`). */
  width: number;
  /** Backing-store height (`canvas.height`). */
  height: number;
  dpr: number;
  /** Size of one procedural "art pixel" (tiles, particles, shoppers) in backing px. */
  unit: number;
  /** Integer multiplier applied to 80×80 Platinum sprites (1 source px → k×k backing px). */
  spriteScale: number;
  /** Rendered sprite box edge length (`80 × spriteScale`). */
  spriteSize: number;
  wall: Rect;
  door: Rect;
  /** Where shoppers appear/disappear (just inside the door, on the floor). */
  doorSpot: Point;
  counter: Rect;
  window: Rect;
  /** Horizontal walkway directly below the back wall. */
  aisleY: number;
  pens: PenRect[];
  napArea: Rect;
  beds: Rect[];
  /** Pendant lamp centres used for warm lighting glows. */
  lamps: Point[];
}

/** Minimal Pokémon info the canvas needs (decoupled from the full GameState). */
export interface FloorPokemon {
  uid: string;
  speciesId: number;
  isShiny: boolean;
  /** `hidden` = owned but off-floor (Reserve Kennel / breeding), distinct from adopted. */
  location: 'pen' | 'healing' | 'hidden';
  /** Pen index for `pen`, nap-bed index for `healing`, `null` when hidden. */
  slot: number | null;
  needsRecovery: boolean;
  origin: string;
}

/** Minimal browsing-customer info the canvas needs. */
export interface FloorCustomer {
  uid: string;
  archetypeId: CustomerArchetypeId;
  targetPenIndex: number;
}

/** Immutable snapshot of simulation state diffed by the canvas world each update. */
export interface FloorSnapshot {
  profileId: string;
  cash: number;
  shiftSpeed: 1 | 2;
  pokemon: FloorPokemon[];
  customers: FloorCustomer[];
}

/** Animation state of a Pokémon entity on the floor. */
export type PokemonAnimState = 'idle' | 'hop' | 'sleep';

/** A drawable source rectangle returned by a sprite adapter. */
export interface SpriteFrame {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Whether the source art faces left (Platinum front sprites do). Drives `scaleX(-1)` flips. */
  facesLeft: boolean;
}

/**
 * Pluggable sprite source. Phase 5 ships a static Platinum front-sprite adapter;
 * an optional PMD overworld spritesheet adapter can later return per-state, per-time
 * frames without any change to `src/engine/` or the world state machine.
 */
export interface SpriteEntityAdapter {
  getFrame(
    speciesId: number,
    isShiny: boolean,
    state: PokemonAnimState,
    timeSec: number,
  ): SpriteFrame | null;
}
