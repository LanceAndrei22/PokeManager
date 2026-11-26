/**
 * Core domain types for PokéMart: Low Cortisol Shift (v2 Tycoon Overhaul).
 * Covers all 493 Gen 1–4 species, PMD SpriteCollab animations, 3 difficulties,
 * live-clock counter haggling, daily rent/upkeep, Debt Grace, Liquidation, and Bankruptcy.
 */

/** All 18 canonical Pokémon elemental types present in the 493 Pokédex. */
export type PokemonType =
  | 'normal'
  | 'fighting'
  | 'flying'
  | 'poison'
  | 'ground'
  | 'rock'
  | 'bug'
  | 'ghost'
  | 'steel'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'ice'
  | 'dragon'
  | 'dark'
  | 'fairy';

/** Temperament traits interacting with daily Market Trends and collector preferences. */
export type ChillTrait = 'Docile' | 'Sleepy' | 'Unbothered' | 'Cozy' | 'Lucky';

/** Standard Pokémon Egg Groups across Gen 1–4. */
export type EggGroup =
  | 'Monster'
  | 'Water 1'
  | 'Water 2'
  | 'Water 3'
  | 'Bug'
  | 'Flying'
  | 'Field'
  | 'Fairy'
  | 'Grass'
  | 'Human-Like'
  | 'Mineral'
  | 'Amorphous'
  | 'Ditto'
  | 'Dragon'
  | 'Undiscovered';

/** Rarity classification driving Wholesale rank gating, pricing, and VIP contracts. */
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'pseudo' | 'legendary' | 'mythical';

/** Six iconic Gen 1–4 Starter Mascots bundled locally for New Trainer profiles. */
export const STARTER_MASCOT_IDS = [133, 25, 1, 4, 7, 393] as const;

/** Union of selectable Starter Mascot Pokédex IDs. */
export type StarterMascotId = (typeof STARTER_MASCOT_IDS)[number];

/** Three playable tycoon difficulty modes stored per Shift Manager profile. */
export type DifficultyId = 'relaxed' | 'standard' | 'high-stakes';

/** Difficulty balance curve parameters. */
export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  tagline: string;
  startingCash: number;
  baseRent: number;
  rentPerShift: number;
  upkeepPerPen: number;
  upkeepPerBed: number;
  debtGraceShifts: number;
  /** Multiplier applied to shopper patience durations at the register. */
  patienceMultiplier: number;
  /** Additive bonus/penalty applied to haggle success probability. */
  haggleSuccessModifier: number;
  /** Shop XP deducted when a queued customer walks out at 0 patience. */
  walkoutXpPenalty: number;
  wholesaleCostMultiplier: number;
  /** Bonus additive shiny rate & VIP Legendary weight. */
  shinyBonus: number;
  vipRankFloor: number;
  vipPayoutMultiplier: number;
}

/** Curated item slugs matching PNGs in `public/assets/items/`. */
export type ItemSlug =
  | 'poke-ball'
  | 'heal-ball'
  | 'friend-ball'
  | 'luxury-ball'
  | 'cherish-ball'
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
  | 'sun-stone'
  | 'shiny-stone'
  | 'dusk-stone'
  | 'dawn-stone'
  | 'lucky-egg'
  | 'egg';

/** All 9 Gen 1–4 Evolution Stones. */
export type EvolutionStoneSlug =
  | 'fire-stone'
  | 'water-stone'
  | 'thunder-stone'
  | 'leaf-stone'
  | 'moon-stone'
  | 'sun-stone'
  | 'shiny-stone'
  | 'dusk-stone'
  | 'dawn-stone';

/** Poké Balls selectable as checkout gift wrap. */
export type GiftBallSlug =
  | 'poke-ball'
  | 'heal-ball'
  | 'friend-ball'
  | 'luxury-ball'
  | 'cherish-ball';

/** Functional item classification for bag filtering and wholesale shelves. */
export type ItemCategory = 'stone' | 'care' | 'candy' | 'ball' | 'egg';

/** Supported PMD SpriteCollab spritesheet animation names. */
export type PmdAnimKey = 'Walk' | 'Idle' | 'Sleep' | 'Hop';

/** Pre-verified PMD SpriteCollab asset availability from `tracker.json`. */
export interface PmdAnimAvailability {
  normal: PmdAnimKey[];
  shiny: PmdAnimKey[];
  portrait: boolean;
  shinyPortrait: boolean;
}

/** Primary stats governing valuation, shop appeal, and breeding inheritance. */
export interface PokemonStats {
  cute: number;
  comfort: number;
  rarity: number;
}

/** Static catalog definition for one of the 493 Gen 1–4 National Dex species. */
export interface SpeciesDefinition {
  id: number;
  paddedId: string;
  name: string;
  types: PokemonType[];
  eggGroups: EggGroup[];
  basePrice: number;
  baseStats: PokemonStats;
  rarityTier: RarityTier;
  /** Minimum Shop Rank (1–10) required for Wholesale offers. */
  unlockRank: number;
  isLegendary: boolean;
  isMythical: boolean;
  canBreed: boolean;
  /** Base species ID hatched when breeding this line (Manaphy #490 -> Phione #489). */
  babySpeciesId: number;
  /** Optional mapping of Evolution Stone slug -> evolved target species ID. */
  evolutions?: Partial<Record<EvolutionStoneSlug, number>>;
  /** Optional Rare Candy next-stage evolution target within #1–#493. */
  levelEvolutionId?: number;
  cozyNote: string;
  pmdAnims: PmdAnimAvailability;
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
  penIndex: number | null;
  /** Healing readiness from 0 to 100 (`100` means rested and display-ready). */
  healingProgress: number;
  needsRecovery: boolean;
  acquiredAtShift: number;
  origin: 'starter' | 'wholesale' | 'rescue' | 'hatched' | 'evolved' | 'vip-contract';
}

/** Five shop visitor archetypes including high-roller VIP Seekers. */
export type CustomerArchetypeId =
  | 'cozy-collector'
  | 'bargain-browser'
  | 'trend-fan'
  | 'shiny-seeker'
  | 'vip-seeker';

/** Metadata describing how a customer archetype evaluates Pokémon, markup, and haggling. */
export interface CustomerArchetype {
  id: CustomerArchetypeId;
  name: string;
  badgeLabel: string;
  shortTag: string;
  accentClass: string;
  description: string;
  markupTolerance: number;
  bonusMultiplier: number;
  /** Base patience ticks at Kecleon's counter before difficulty scaling. */
  basePatience: number;
  /** Base haggle resistance offset (negative = tougher negotiator). */
  haggleEase: number;
}

/** Active customer browsing a shop display pen before heading to Kecleon's counter. */
export interface ShopCustomer {
  uid: string;
  archetypeId: CustomerArchetypeId;
  npcSpeciesId: number;
  npcPaddedId: string;
  name: string;
  targetPenIndex: number;
  statusText: string;
  ticksRemaining: number;
}

/** Live-clock customer queued at Kecleon's register awaiting Accept, Haggle, or Decline. */
export interface CounterOffer {
  uid: string;
  customerUid: string;
  archetypeId: CustomerArchetypeId;
  npcSpeciesId: number;
  npcPaddedId: string;
  customerName: string;
  pokemonUid: string;
  speciesId: number;
  isShiny: boolean;
  penIndex: number;
  fairValue: number;
  initialOffer: number;
  currentOffer: number;
  haggleAttempts: number;
  maxHaggleAttempts: number;
  /** Live countdown ticking down while the shift clock runs; 0 triggers a walk-out. */
  patience: number;
  maxPatience: number;
  trendMatched: boolean;
  archetypeMatched: boolean;
  isVip: boolean;
  lastActionNote?: string;
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

/** Rotating offer on the daily Wholesale, Rescue, or VIP Legendary Contract shelf. */
export interface WholesaleOffer {
  uid: string;
  kind: 'healthy' | 'stray' | 'egg' | 'vip-contract';
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

/** Per-species record inside the player's 493-species Adoption Dex. */
export interface AdoptionDexEntry {
  speciesId: number;
  seenNormal: boolean;
  seenShiny: boolean;
  adoptedCount: number;
  hatchedCount: number;
  evolvedCount: number;
}

/** Discrete phase of the active shift cycle. */
export type ShiftPhase = 'prep' | 'open' | 'settlement-debt' | 'summary' | 'bankrupt';

/** Itemized shift settlement including daily store rent and pen/bed upkeep. */
export interface ShiftSettlement {
  shiftNumber: number;
  revenue: number;
  expenses: number;
  tipsEarned: number;
  dailyRent: number;
  penUpkeep: number;
  bedUpkeep: number;
  totalDues: number;
  netBeforeDues: number;
  cashAfterDues: number;
  adoptionsCount: number;
  walkoutsCount: number;
  eggsHatched: number;
  straysHealed: number;
  cozyXpEarned: number;
  trendTitle: string;
  closedEarly: boolean;
  usedDebtGrace: boolean;
  debtGraceRemaining: number;
}

/** Final run scorecard captured if a profile goes bankrupt. */
export interface BankruptcySummary {
  shiftNumber: number;
  totalRevenue: number;
  totalAdoptions: number;
  highestSale: number;
  dexDiscovered: number;
  difficulty: DifficultyId;
}

/** Single entry in the shop activity log. */
export interface ActivityEntry {
  id: string;
  shift: number;
  text: string;
  tone: 'info' | 'sale' | 'heal' | 'breed' | 'shiny' | 'warning';
}

/** Complete serializable v2 game state for a single local Shift Manager profile. */
export interface GameState {
  version: 2;
  profileId: string;
  profileName: string;
  difficulty: DifficultyId;
  muted: boolean;
  cash: number;
  shiftNumber: number;
  shiftTick: number;
  shiftDurationTicks: number;
  shiftPhase: ShiftPhase;
  shiftRunning: boolean;
  shiftSpeed: 1 | 2;
  cozyXp: number;
  debtGraceDaysRemaining: number;
  isBankrupt: boolean;
  bankruptcySummary: BankruptcySummary | null;
  activeTrendId: string;
  globalMarkup: number;
  penMarkups: Record<number, number | null>;
  activeGiftBall: GiftBallSlug;
  /** UID of the player's featured Store Mascot shown on the Main Menu spotlight card. */
  mascotUid?: string;
  pokemon: PokemonInstance[];
  eggs: EggInstance[];
  inventory: Partial<Record<ItemSlug, number>>;
  wholesaleCatalog: WholesaleOffer[];
  customers: ShopCustomer[];
  /** Live-clock shoppers waiting at Kecleon's counter to be accepted, haggled, or declined. */
  counterQueue: CounterOffer[];
  upgrades: Record<ShopUpgradeId, number>;
  recentSpeciesSales: Record<number, number>;
  dex: Record<number, AdoptionDexEntry>;
  shiftStats: {
    revenue: number;
    expenses: number;
    tipsEarned: number;
    adoptionsCount: number;
    walkoutsCount: number;
    eggsHatched: number;
    straysHealed: number;
    cozyXpEarned: number;
  };
  lifetimeStats: {
    totalRevenue: number;
    totalAdoptions: number;
    highestSale: number;
  };
  pendingSettlement: ShiftSettlement | null;
  lastShiftSummary: ShiftSettlement | null;
  activityLog: ActivityEntry[];
  seedCounter: number;
  updatedAt: number;
}

/** Lightweight metadata entry stored in the v2 multi-profile index. */
export interface ProfileMeta {
  id: string;
  name: string;
  difficulty: DifficultyId;
  /** Species ID of the profile's chosen or promoted Store Mascot portrait. */
  mascotSpeciesId?: number;
  createdAt: number;
  updatedAt: number;
}

/** Root index stored under `pokemart-low-cortisol:v2:index`. */
export interface ProfileIndex {
  version: 2;
  activeProfileId: string;
  profiles: ProfileMeta[];
}

/** Checksum-protected wrapper used for Base64 Save Export/Import. */
export interface SaveEnvelope {
  format: 'pokemart-low-cortisol-save';
  version: 2;
  checksum: string;
  exportedAt: string;
  state: GameState;
}
