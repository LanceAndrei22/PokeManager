/**
 * Core domain types for PokéMart: Low Cortisol Shift.
 * Defines species metadata, Pokémon instances, market trends, customer archetypes,
 * breeding eggs, shop upgrades, Adoption Dex tracking, and per-profile save envelopes.
 */

/** Elemental types used by the curated Gen 1–4 shop roster and market trends. */
export type PokemonType =
  | 'normal'
  | 'grass'
  | 'fire'
  | 'water'
  | 'electric'
  | 'fairy'
  | 'psychic'
  | 'dark'
  | 'fighting'
  | 'dragon';

/** Low-stress temperament traits that interact with market trends and collectors. */
export type ChillTrait = 'Docile' | 'Sleepy' | 'Unbothered' | 'Cozy' | 'Lucky';

/** Breeding compatibility groups shared across curated Gen 1–4 species. */
export type EggGroup =
  | 'Field'
  | 'Water'
  | 'Monster'
  | 'Fairy'
  | 'Grass'
  | 'Amorphous'
  | 'Dragon';

/** Curated item slugs matching PNGs fetched into `public/assets/items/`. */
export type ItemSlug =
  | 'poke-ball'
  | 'heal-ball'
  | 'friend-ball'
  | 'luxury-ball'
  | 'potion'
  | 'fresh-water'
  | 'moomoo-milk'
  | 'oran-berry'
  | 'sitrus-berry'
  | 'rare-candy'
  | 'fire-stone'
  | 'water-stone'
  | 'thunder-stone'
  | 'leaf-stone'
  | 'moon-stone'
  | 'lucky-egg'
  | 'egg';

/** Evolution stone subset used to trigger stone evolutions in the shop. */
export type EvolutionStoneSlug =
  | 'fire-stone'
  | 'water-stone'
  | 'thunder-stone'
  | 'leaf-stone'
  | 'moon-stone';

/** Specialty Poké Ball subset selectable as optional checkout gift wrap. */
export type GiftBallSlug = 'poke-ball' | 'heal-ball' | 'friend-ball' | 'luxury-ball';

/** Functional item classification for bag filtering and wholesale shelves. */
export type ItemCategory = 'stone' | 'care' | 'candy' | 'ball' | 'egg';

/** Primary stats governing valuation, cozy appeal, and breeding inheritance. */
export interface PokemonStats {
  cute: number;
  comfort: number;
  rarity: number;
}

/** Static catalog definition for one of the 45 curated Platinum species. */
export interface SpeciesDefinition {
  id: number;
  name: string;
  types: PokemonType[];
  eggGroups: EggGroup[];
  basePrice: number;
  baseStats: PokemonStats;
  /** Minimum Cozy Rank (1–5) required for this species to appear in Wholesale offers. */
  minCozyRank: number;
  /** Optional mapping of evolution stone slug to evolved target species ID. */
  evolutions?: Partial<Record<EvolutionStoneSlug, number>>;
  /** Base species ID hatched when breeding this line. */
  babySpeciesId: number;
  cozyNote: string;
}

/** Shop inventory item metadata and mechanical effect parameters. */
export interface ItemDefinition {
  slug: ItemSlug;
  name: string;
  category: ItemCategory;
  cost: number;
  description: string;
  healBoost?: number;
  cuteBoost?: number;
  comfortBoost?: number;
  rarityBoost?: number;
  tipBonus?: number;
  xpBonus?: number;
}

/** Where a Pokémon currently resides inside the shop. */
export type PokemonLocation = 'pen' | 'reserve' | 'healing' | 'breeding';

/** Individual Pokémon instance owned by the current Shift Manager profile. */
export interface PokemonInstance {
  uid: string;
  speciesId: number;
  nickname?: string;
  isShiny: boolean;
  trait: ChillTrait;
  stats: PokemonStats;
  location: PokemonLocation;
  /** Assigned pen slot (0-based) when `location === 'pen'`. */
  penIndex: number | null;
  /** Healing readiness from 0 to 100 (`100` means rested and display-ready). */
  healingProgress: number;
  needsRecovery: boolean;
  acquiredAtShift: number;
  origin: 'starter' | 'wholesale' | 'rescue' | 'hatched' | 'evolved';
}

/** Four shop visitor archetypes with distinct preference badges and pricing rules. */
export type CustomerArchetypeId =
  | 'cozy-collector'
  | 'bargain-browser'
  | 'trend-fan'
  | 'shiny-seeker';

/** Metadata describing how a customer archetype evaluates Pokémon and markup. */
export interface CustomerArchetype {
  id: CustomerArchetypeId;
  name: string;
  badgeLabel: string;
  shortTag: string;
  accentClass: string;
  description: string;
  /** Maximum comfortable markup percentage before buy chance decays quickly. */
  markupTolerance: number;
  bonusMultiplier: number;
}

/** Active customer currently browsing a shop display pen during an open shift. */
export interface ShopCustomer {
  uid: string;
  archetypeId: CustomerArchetypeId;
  name: string;
  targetPenIndex: number;
  statusText: string;
  ticksRemaining: number;
}

/** Daily shift market trend boosting demand for matching types or chill traits. */
export interface MarketTrend {
  id: string;
  title: string;
  description: string;
  badge: string;
  bonusMultiplier: number;
  matchesPokemon: (species: SpeciesDefinition, pokemon: PokemonInstance) => boolean;
}

/** Rotating offer on the daily Wholesale & Rescue shelf. */
export interface WholesaleOffer {
  uid: string;
  kind: 'healthy' | 'stray' | 'egg';
  speciesId: number;
  isShiny: boolean;
  trait: ChillTrait;
  stats: PokemonStats;
  cost: number;
  initialHealingProgress: number;
  purchased: boolean;
}

/** Incubating Pokémon egg awaiting live-tick maturation. */
export interface EggInstance {
  uid: string;
  speciesId: number;
  parentNames: [string, string];
  isShiny: boolean;
  trait: ChillTrait;
  inheritedStats: PokemonStats;
  /** Incubation progress from 0 to 100. */
  progress: number;
  readyToHatch: boolean;
}

/** Persistent shop expansion upgrades purchasable with shop profits. */
export type ShopUpgradeId =
  | 'extra-pen'
  | 'extra-incubator'
  | 'extra-nap-bed'
  | 'cafe-decor'
  | 'mystery-shipment';

/** Static definition for a shop upgrade track. */
export interface ShopUpgrade {
  id: ShopUpgradeId;
  name: string;
  description: string;
  baseCost: number;
  costStep: number;
  maxLevel: number;
}

/** Per-species record inside the player's Adoption Dex. */
export interface AdoptionDexEntry {
  speciesId: number;
  seenNormal: boolean;
  seenShiny: boolean;
  adoptedCount: number;
  hatchedCount: number;
  evolvedCount: number;
}

/** Summary shown at the cozy close of each shift. */
export interface ShiftSummary {
  shiftNumber: number;
  revenue: number;
  expenses: number;
  tipsEarned: number;
  adoptionsCount: number;
  eggsHatched: number;
  straysHealed: number;
  cozyXpEarned: number;
  trendTitle: string;
  closedEarly: boolean;
}

/** Single entry in the cozy shop activity log. */
export interface ActivityEntry {
  id: string;
  shift: number;
  text: string;
  tone: 'info' | 'sale' | 'heal' | 'breed' | 'shiny';
}

/** Complete serializable game state for a single local Shift Manager profile. */
export interface GameState {
  version: 1;
  profileId: string;
  profileName: string;
  muted: boolean;
  cash: number;
  shiftNumber: number;
  shiftTick: number;
  shiftDurationTicks: number;
  shiftRunning: boolean;
  shiftSpeed: 1 | 2;
  cozyXp: number;
  activeTrendId: string;
  globalMarkup: number;
  penMarkups: Record<number, number | null>;
  activeGiftBall: GiftBallSlug;
  pokemon: PokemonInstance[];
  eggs: EggInstance[];
  inventory: Partial<Record<ItemSlug, number>>;
  wholesaleCatalog: WholesaleOffer[];
  customers: ShopCustomer[];
  upgrades: Record<ShopUpgradeId, number>;
  /** Tracks recent shift adoptions per species for gentle oversupply saturation. */
  recentSpeciesSales: Record<number, number>;
  dex: Record<number, AdoptionDexEntry>;
  shiftStats: {
    revenue: number;
    expenses: number;
    tipsEarned: number;
    adoptionsCount: number;
    eggsHatched: number;
    straysHealed: number;
    cozyXpEarned: number;
  };
  lastShiftSummary: ShiftSummary | null;
  activityLog: ActivityEntry[];
  seedCounter: number;
  updatedAt: number;
}

/** Lightweight metadata entry stored in the multi-profile index. */
export interface ProfileMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Root index stored under `pokemart-low-cortisol:v1:index`. */
export interface ProfileIndex {
  version: 1;
  activeProfileId: string;
  profiles: ProfileMeta[];
}

/** Checksum-protected wrapper used for Base64 Save Export/Import. */
export interface SaveEnvelope {
  format: 'pokemart-low-cortisol-save';
  version: 1;
  checksum: string;
  exportedAt: string;
  state: GameState;
}
