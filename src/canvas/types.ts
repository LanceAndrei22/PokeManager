/**
 * Shared types for the PokéMart HTML5 2D Canvas shop floor using PMD SpriteCollab sheets.
 *
 * Coordinate convention: every position and size below is in canvas *backing-store*
 * pixels (CSS px × devicePixelRatio).
 */
import type { CustomerArchetypeId } from '../data/types';

/**
 * Standard PMD 8-directional spritesheet row index (ordered clockwise from South):
 * 0 = South, 1 = SE, 2 = East, 3 = NE, 4 = North, 5 = NW, 6 = West, 7 = SW.
 */
export type PmdDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

/** Interactive click target resolved by `hitTestIndoorScene`. */
export type CanvasHitTarget =
  | { kind: 'pokemon'; uid: string; label: string }
  | { kind: 'counter-offer'; offerUid: string; label: string }
  | { kind: 'empty-pen'; penIndex: number; label: string }
  | { kind: 'station'; station: 'wholesale' | 'breeding' | 'healing' | 'upgrades'; label: string };

/** Fully resolved shop floor geometry for one canvas size / pen count / DPR combination. */
export interface ShopLayout {
  cssWidth: number;
  cssHeight: number;
  /** Backing-store width (`canvas.width`). */
  width: number;
  /** Backing-store height (`canvas.height`). */
  height: number;
  dpr: number;
  /** Desktop resolution scale factor (1.0 at 1280×760, ~1.42 at 1920×1080, ~1.89 at 2560×1440). */
  resScale: number;
  /** Size of one procedural "art pixel" (tiles, particles, UI accents) in backing px. */
  unit: number;
  /** Integer base scale factor derived from pen size. */
  spriteScale: number;
  /** Nominal sprite reference box edge length. */
  spriteSize: number;
  wall: Rect;
  door: Rect;
  /** Stone tile entrance mat below the sliding glass doors. */
  foyer: Rect;
  /** Where shoppers appear/disappear (just inside the door, on the floor). */
  doorSpot: Point;
  counter: Rect;
  /** Queue positions standing in front of Clerk Leo's register (up to 4). */
  counterQueueSpots: Point[];
  window: Rect;
  /** Horizontal walkway directly below the back wall. */
  aisleY: number;
  pens: PenRect[];
  napArea: Rect;
  beds: Rect[];
  /** Clickable Glowing Egg Incubator Bench bounds. */
  incubatorStation: Rect;
  /** Clickable Blinking Wholesale PC Terminal bounds. */
  pcStation: Rect;
  /** Clickable Wooden Upgrades Board bounds. */
  upgradesStation: Rect;
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
  npcId: string;
  targetPenIndex: number;
}

/** Minimal queued register offer rendered in front of the PokéMart counter. */
export interface FloorCounterOffer {
  uid: string;
  customerUid?: string;
  npcId: string;
  customerName: string;
  archetypeId: CustomerArchetypeId;
  patience: number;
  maxPatience: number;
  currentOffer: number;
  isVip: boolean;
  penIndex: number;
}

/** Immutable snapshot of simulation state diffed by the canvas world each update. */
export interface FloorSnapshot {
  profileId: string;
  cash: number;
  shiftSpeed: 1 | 2;
  pokemon: FloorPokemon[];
  customers: FloorCustomer[];
  /** Customers waiting at Kecleon's counter with live Patience Bars. */
  counterQueue: FloorCounterOffer[];
  counterQueueCount?: number;
  eggCount?: number;
  readyEggCount?: number;
  hasVipContract?: boolean;
}

/** Animation state of a Pokémon entity on the floor. */
export type PokemonAnimState = 'idle' | 'hop' | 'sleep' | 'walk';

/** A drawable source rectangle returned by a sprite adapter. */
export interface SpriteFrame {
  image: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** True when the spritesheet already contains directional rows (PMD sheets). */
  usesDirectionRow?: boolean;
  /** Fallback hint for static left-facing sheets without directional rows. */
  facesLeft: boolean;
}

/**
 * Pluggable sprite source supporting multi-frame, 8-directional PMD SpriteCollab
 * sheets (`Walk`, `Idle`, `Sleep`, `Hop`) as well as lightweight test stubs.
 */
export interface SpriteEntityAdapter {
  getFrame(
    speciesId: number,
    isShiny: boolean,
    state: PokemonAnimState,
    timeSec: number,
    direction?: PmdDirection,
  ): SpriteFrame | null;
}
