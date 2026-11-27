/**
 * Per-user v2 local storage profile manager and Base64 Save Export/Import serializer.
 *
 * Uses isolated v2 keys (`pokemart-low-cortisol:v2:index` & `pokemart-low-cortisol:v2:save:<profileId>`)
 * so v1 data stays untouched, stores Difficulty per profile, validates exported saves
 * with an FNV-1a checksum, guards against oversized/malformed/prototype-polluted payloads,
 * and clamps imported fields into safe runtime bounds.
 */
import { DIFFICULTIES } from '../data/difficulties';
import { GIFT_BALL_OPTIONS, ITEMS_BY_SLUG } from '../data/items';
import { DEFAULT_CLERK_ID, getClerkById, resolveHumanNpcFallback } from '../data/npcs';
import { SPECIES_BY_ID } from '../data/species';
import { MARKET_TRENDS, TRENDS_BY_ID } from '../data/trends';
import type {
  ActivityEntry,
  AdoptionDexEntry,
  BankruptcySummary,
  ChillTrait,
  CounterOffer,
  CustomerArchetypeId,
  DifficultyId,
  EggInstance,
  GameState,
  GiftBallSlug,
  ItemSlug,
  PokemonInstance,
  PokemonLocation,
  PokemonStats,
  ProfileIndex,
  ProfileMeta,
  SaveEnvelope,
  ShiftSettlement,
  ShopUpgradeId,
  WholesaleOffer,
} from '../data/types';
import { SHOP_UPGRADES } from '../data/upgrades';
import { createInitialGameState } from './simulation';

export const PROFILE_INDEX_KEY = 'pokemart-low-cortisol:v2:index';
export const PROFILE_SAVE_PREFIX = 'pokemart-low-cortisol:v2:save:';

/** Hard upper bound (256 KB) on imported Base64 save codes before decoding or JSON parsing. */
export const MAX_IMPORT_CODE_LENGTH = 256 * 1024;

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_JSON_DEPTH = 14;
const MAX_IMPORT_POKEMON = 60;
const MAX_IMPORT_EGGS = 12;
const MAX_IMPORT_WHOLESALE = 24;
const MAX_IMPORT_COUNTER_QUEUE = 8;
const MAX_IMPORT_ACTIVITY_LOG = 32;
const MAX_IMPORT_SHOPKEEPERS = 3;

const VALID_TRAITS = new Set<ChillTrait>(['Docile', 'Sleepy', 'Unbothered', 'Cozy', 'Lucky']);
const VALID_LOCATIONS = new Set<PokemonLocation>(['pen', 'reserve', 'healing', 'breeding']);
const VALID_ORIGINS = new Set<PokemonInstance['origin']>([
  'starter',
  'wholesale',
  'rescue',
  'hatched',
  'evolved',
  'vip-contract',
]);
const VALID_ARCHETYPES = new Set<CustomerArchetypeId>([
  'normal',
  'cozy-collector',
  'bargain-browser',
  'trend-fan',
  'shiny-seeker',
  'vip-seeker',
]);
const VALID_WHOLESALE_KINDS = new Set<WholesaleOffer['kind']>([
  'healthy',
  'stray',
  'egg',
  'vip-contract',
]);
const VALID_LOG_TONES = new Set<ActivityEntry['tone']>([
  'info',
  'sale',
  'heal',
  'breed',
  'shiny',
  'warning',
]);
const VALID_GIFT_BALLS = new Set<GiftBallSlug>(GIFT_BALL_OPTIONS);

/** Minimal Storage interface so unit tests can pass mock or real window.localStorage. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  throw new Error('localStorage is unavailable in this environment.');
}

/** Computes a deterministic FNV-1a 32-bit hex checksum over a UTF-8 string. */
export function computeSaveChecksum(payload: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeUtf8Base64(encoded: string): string {
  const normalized = encoded.replace(/\s+/g, '');
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('Malformed Base64 characters.');
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  // Fatal UTF-8 decoding rejects truncated/corrupted multibyte sequences instead of U+FFFD
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively detects prototype-pollution keys (`__proto__`, `constructor`, `prototype`)
 * or excessive nesting depth in decoded JSON payloads before trusting imported objects.
 */
function hasForbiddenKeysOrExcessiveDepth(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return true;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasForbiddenKeysOrExcessiveDepth(item, depth + 1)) return true;
    }
    return false;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) return true;
      if (hasForbiddenKeysOrExcessiveDepth((value as Record<string, unknown>)[key], depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sanitizeShortText(value: unknown, fallback: string, maxLen: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().slice(0, maxLen);
  return cleaned || fallback;
}

function sanitizeStats(raw: unknown): PokemonStats {
  const obj = isPlainObject(raw) ? raw : {};
  return {
    cute: clampInt(obj.cute, 50, 1, 100),
    comfort: clampInt(obj.comfort, 50, 1, 100),
    rarity: clampInt(obj.rarity, 25, 1, 100),
  };
}

function sanitizeTrait(raw: unknown): ChillTrait {
  return typeof raw === 'string' && VALID_TRAITS.has(raw as ChillTrait)
    ? (raw as ChillTrait)
    : 'Docile';
}

function sanitizeDifficulty(raw: unknown): DifficultyId {
  return typeof raw === 'string' && raw in DIFFICULTIES ? (raw as DifficultyId) : 'standard';
}

function sanitizeSettlement(raw: unknown): ShiftSettlement | null {
  if (!isPlainObject(raw)) return null;
  return {
    shiftNumber: clampInt(raw.shiftNumber, 1, 1, 99_999),
    revenue: clampInt(raw.revenue, 0, 0, 999_999_999),
    expenses: clampInt(raw.expenses, 0, 0, 999_999_999),
    tipsEarned: clampInt(raw.tipsEarned, 0, 0, 999_999_999),
    dailyRent: clampInt(raw.dailyRent, 0, 0, 999_999_999),
    penUpkeep: clampInt(raw.penUpkeep, 0, 0, 999_999_999),
    bedUpkeep: clampInt(raw.bedUpkeep, 0, 0, 999_999_999),
    totalDues: clampInt(raw.totalDues, 0, 0, 999_999_999),
    netBeforeDues: clampInt(raw.netBeforeDues, 0, -999_999_999, 999_999_999),
    cashAfterDues: clampInt(raw.cashAfterDues, 0, -1_000_000, 999_999_999),
    adoptionsCount: clampInt(raw.adoptionsCount, 0, 0, 99_999),
    walkoutsCount: clampInt(raw.walkoutsCount, 0, 0, 99_999),
    eggsHatched: clampInt(raw.eggsHatched, 0, 0, 99_999),
    straysHealed: clampInt(raw.straysHealed, 0, 0, 99_999),
    cozyXpEarned: clampInt(raw.cozyXpEarned, 0, 0, 999_999),
    trendTitle: sanitizeShortText(raw.trendTitle, MARKET_TRENDS[0].title, 64),
    closedEarly: Boolean(raw.closedEarly),
    usedDebtGrace: Boolean(raw.usedDebtGrace),
    debtGraceRemaining: clampInt(raw.debtGraceRemaining, 0, 0, 10),
  };
}

function sanitizeBankruptcySummary(raw: unknown): BankruptcySummary | null {
  if (!isPlainObject(raw)) return null;
  return {
    shiftNumber: clampInt(raw.shiftNumber, 1, 1, 99_999),
    totalRevenue: clampInt(raw.totalRevenue, 0, 0, 999_999_999),
    totalAdoptions: clampInt(raw.totalAdoptions, 0, 0, 999_999),
    highestSale: clampInt(raw.highestSale, 0, 0, 999_999_999),
    dexDiscovered: clampInt(raw.dexDiscovered, 0, 0, 493),
    difficulty: sanitizeDifficulty(raw.difficulty),
  };
}

/**
 * Rebuilds and clamps an imported GameState into safe runtime bounds so tampered
 * save codes cannot inject invalid species IDs, extreme numbers, or oversized arrays.
 */
function sanitizeImportedGameState(
  raw: Record<string, unknown>,
  targetProfileId: string,
  targetProfileName?: string,
): GameState {
  const difficulty = sanitizeDifficulty(raw.difficulty);
  const shiftDurationTicks = clampInt(raw.shiftDurationTicks, 100, 20, 600);
  const shiftTick = clampInt(raw.shiftTick, 0, 0, shiftDurationTicks);
  const shiftNumber = clampInt(raw.shiftNumber, 1, 1, 99_999);
  const profileName = sanitizeShortText(targetProfileName ?? raw.profileName, 'Trainer', 24);

  // Rebuild upgrades map cleanly from known ShopUpgradeId definitions
  const rawUpgrades = raw.upgrades as Record<string, unknown>;
  const upgrades = {} as Record<ShopUpgradeId, number>;
  for (const def of SHOP_UPGRADES) {
    upgrades[def.id] = clampInt(rawUpgrades[def.id], 0, 0, def.maxLevel);
  }

  // Rebuild inventory keeping only known ItemSlug keys with safe non-negative counts
  const inventory: Partial<Record<ItemSlug, number>> = {};
  if (isPlainObject(raw.inventory)) {
    for (const [slug, qty] of Object.entries(raw.inventory)) {
      if (slug in ITEMS_BY_SLUG) {
        inventory[slug as ItemSlug] = clampInt(qty, 0, 0, 999);
      }
    }
  }

  // Rebuild penMarkups for valid pen slots 0..5
  const penMarkups: Record<number, number | null> = {};
  if (isPlainObject(raw.penMarkups)) {
    for (const [key, value] of Object.entries(raw.penMarkups)) {
      const penIdx = Number(key);
      if (Number.isInteger(penIdx) && penIdx >= 0 && penIdx <= 5) {
        penMarkups[penIdx] = value === null ? null : clampInt(value, 100, 80, 160);
      }
    }
  }

  // Sanitize owned Pokémon list (capped to prevent rendering DoS)
  const rawPokemon = raw.pokemon as unknown[];
  const pokemon: PokemonInstance[] = [];
  for (let i = 0; i < rawPokemon.length && pokemon.length < MAX_IMPORT_POKEMON; i += 1) {
    const entry = rawPokemon[i];
    if (!isPlainObject(entry)) continue;
    const speciesId = Number(entry.speciesId);
    if (!Number.isInteger(speciesId) || !SPECIES_BY_ID[speciesId]) continue;

    const location: PokemonLocation =
      typeof entry.location === 'string' && VALID_LOCATIONS.has(entry.location as PokemonLocation)
        ? (entry.location as PokemonLocation)
        : 'reserve';
    const penIndex =
      location === 'pen' && typeof entry.penIndex === 'number' && Number.isInteger(entry.penIndex)
        ? clampInt(entry.penIndex, 0, 0, 5)
        : null;
    const nickname =
      typeof entry.nickname === 'string' && entry.nickname.trim()
        ? entry.nickname.trim().slice(0, 24)
        : undefined;
    const origin: PokemonInstance['origin'] =
      typeof entry.origin === 'string' && VALID_ORIGINS.has(entry.origin as PokemonInstance['origin'])
        ? (entry.origin as PokemonInstance['origin'])
        : 'wholesale';

    pokemon.push({
      uid: sanitizeShortText(entry.uid, `mon-import-${i + 1}`, 64),
      speciesId,
      ...(nickname ? { nickname } : {}),
      isShiny: Boolean(entry.isShiny),
      trait: sanitizeTrait(entry.trait),
      stats: sanitizeStats(entry.stats),
      location: location === 'pen' && penIndex === null ? 'reserve' : location,
      penIndex,
      healingProgress: clampInt(entry.healingProgress, 100, 0, 100),
      needsRecovery: Boolean(entry.needsRecovery),
      acquiredAtShift: clampInt(entry.acquiredAtShift, 1, 1, 99_999),
      origin,
    });
  }

  // Sanitize incubating eggs list
  const rawEggs = raw.eggs as unknown[];
  const eggs: EggInstance[] = [];
  for (let i = 0; i < rawEggs.length && eggs.length < MAX_IMPORT_EGGS; i += 1) {
    const entry = rawEggs[i];
    if (!isPlainObject(entry)) continue;
    const speciesId = Number(entry.speciesId);
    if (!Number.isInteger(speciesId) || !SPECIES_BY_ID[speciesId]) continue;
    const rawParents = Array.isArray(entry.parentNames) ? entry.parentNames : [];
    const progress = clampInt(entry.progress, 0, 0, 100);

    eggs.push({
      uid: sanitizeShortText(entry.uid, `egg-import-${i + 1}`, 64),
      speciesId,
      parentNames: [
        sanitizeShortText(rawParents[0], 'Parent A', 24),
        sanitizeShortText(rawParents[1], 'Parent B', 24),
      ],
      isShiny: Boolean(entry.isShiny),
      trait: sanitizeTrait(entry.trait),
      inheritedStats: sanitizeStats(entry.inheritedStats),
      progress,
      readyToHatch: Boolean(entry.readyToHatch) || progress >= 100,
    });
  }

  // Sanitize wholesale catalog
  const wholesaleCatalog: WholesaleOffer[] = [];
  if (Array.isArray(raw.wholesaleCatalog)) {
    for (
      let i = 0;
      i < raw.wholesaleCatalog.length && wholesaleCatalog.length < MAX_IMPORT_WHOLESALE;
      i += 1
    ) {
      const entry: unknown = raw.wholesaleCatalog[i];
      if (!isPlainObject(entry)) continue;
      const speciesId = Number(entry.speciesId);
      if (!Number.isInteger(speciesId) || !SPECIES_BY_ID[speciesId]) continue;
      const kind: WholesaleOffer['kind'] =
        typeof entry.kind === 'string' && VALID_WHOLESALE_KINDS.has(entry.kind as WholesaleOffer['kind'])
          ? (entry.kind as WholesaleOffer['kind'])
          : 'healthy';

      wholesaleCatalog.push({
        uid: sanitizeShortText(entry.uid, `offer-import-${i + 1}`, 64),
        kind,
        speciesId,
        isShiny: Boolean(entry.isShiny),
        trait: sanitizeTrait(entry.trait),
        stats: sanitizeStats(entry.stats),
        cost: clampInt(entry.cost, 250, 0, 9_999_999),
        initialHealingProgress: clampInt(entry.initialHealingProgress, 100, 0, 100),
        purchased: Boolean(entry.purchased),
      });
    }
  }

  // Sanitize queued counter offers
  const counterQueue: CounterOffer[] = [];
  if (Array.isArray(raw.counterQueue)) {
    for (
      let i = 0;
      i < raw.counterQueue.length && counterQueue.length < MAX_IMPORT_COUNTER_QUEUE;
      i += 1
    ) {
      const entry: unknown = raw.counterQueue[i];
      if (!isPlainObject(entry)) continue;
      const speciesId = Number(entry.speciesId);
      if (!Number.isInteger(speciesId) || !SPECIES_BY_ID[speciesId]) continue;
      const archetypeId: CustomerArchetypeId =
        typeof entry.archetypeId === 'string' &&
        VALID_ARCHETYPES.has(entry.archetypeId as CustomerArchetypeId)
          ? (entry.archetypeId as CustomerArchetypeId)
          : 'normal';
      const resolvedNpc = resolveHumanNpcFallback(
        archetypeId,
        typeof entry.npcId === 'string' ? entry.npcId : undefined,
      );
      const maxPatience = clampInt(entry.maxPatience, 12, 1, 300);

      counterQueue.push({
        uid: sanitizeShortText(entry.uid, `counter-import-${i + 1}`, 64),
        customerUid: sanitizeShortText(entry.customerUid, `cust-import-${i + 1}`, 64),
        archetypeId,
        npcId: resolvedNpc.id,
        npcPortraitUrl: resolvedNpc.portraitUrl,
        customerName: sanitizeShortText(entry.customerName, resolvedNpc.name, 32),
        pokemonUid: sanitizeShortText(entry.pokemonUid, '', 64),
        speciesId,
        isShiny: Boolean(entry.isShiny),
        penIndex: clampInt(entry.penIndex, 0, 0, 5),
        fairValue: clampInt(entry.fairValue, 300, 1, 9_999_999),
        initialOffer: clampInt(entry.initialOffer, 300, 1, 9_999_999),
        currentOffer: clampInt(entry.currentOffer, 300, 1, 9_999_999),
        haggleAttempts: clampInt(entry.haggleAttempts, 0, 0, 10),
        maxHaggleAttempts: clampInt(entry.maxHaggleAttempts, 2, 0, 10),
        patience: clampInt(entry.patience, maxPatience, 0, maxPatience),
        maxPatience,
        trendMatched: Boolean(entry.trendMatched),
        archetypeMatched: Boolean(entry.archetypeMatched),
        isVip: Boolean(entry.isVip),
        ...(typeof entry.lastActionNote === 'string'
          ? { lastActionNote: entry.lastActionNote.trim().slice(0, 120) }
          : {}),
      });
    }
  }

  // Sanitize Adoption Dex keeping only valid species IDs 1..493
  const dex: Record<number, AdoptionDexEntry> = {};
  if (isPlainObject(raw.dex)) {
    for (const [key, entry] of Object.entries(raw.dex)) {
      const speciesId = Number(key);
      if (!Number.isInteger(speciesId) || !SPECIES_BY_ID[speciesId] || !isPlainObject(entry)) {
        continue;
      }
      dex[speciesId] = {
        speciesId,
        seenNormal: Boolean(entry.seenNormal),
        seenShiny: Boolean(entry.seenShiny),
        adoptedCount: clampInt(entry.adoptedCount, 0, 0, 99_999),
        hatchedCount: clampInt(entry.hatchedCount, 0, 0, 99_999),
        evolvedCount: clampInt(entry.evolvedCount, 0, 0, 99_999),
      };
    }
  }

  // Sanitize recentSpeciesSales
  const recentSpeciesSales: Record<number, number> = {};
  if (isPlainObject(raw.recentSpeciesSales)) {
    for (const [key, count] of Object.entries(raw.recentSpeciesSales)) {
      const speciesId = Number(key);
      if (Number.isInteger(speciesId) && SPECIES_BY_ID[speciesId]) {
        recentSpeciesSales[speciesId] = clampInt(count, 0, 0, 999);
      }
    }
  }

  // Sanitize shopkeepers (up to 3 hired clerks)
  const shopkeepers =
    Array.isArray(raw.shopkeepers) && raw.shopkeepers.length > 0
      ? raw.shopkeepers
          .slice(0, MAX_IMPORT_SHOPKEEPERS)
          .map((id) => getClerkById(typeof id === 'string' ? id : DEFAULT_CLERK_ID).id)
      : [DEFAULT_CLERK_ID];

  // Sanitize shift & lifetime stats
  const rawShiftStats = isPlainObject(raw.shiftStats) ? raw.shiftStats : {};
  const rawLifetimeStats = isPlainObject(raw.lifetimeStats) ? raw.lifetimeStats : {};

  // Sanitize activity log
  const activityLog: ActivityEntry[] = [];
  if (Array.isArray(raw.activityLog)) {
    for (
      let i = 0;
      i < raw.activityLog.length && activityLog.length < MAX_IMPORT_ACTIVITY_LOG;
      i += 1
    ) {
      const entry = raw.activityLog[i];
      if (!isPlainObject(entry)) continue;
      const tone: ActivityEntry['tone'] =
        typeof entry.tone === 'string' && VALID_LOG_TONES.has(entry.tone as ActivityEntry['tone'])
          ? (entry.tone as ActivityEntry['tone'])
          : 'info';
      activityLog.push({
        id: sanitizeShortText(entry.id, `log-import-${i + 1}`, 64),
        shift: clampInt(entry.shift, shiftNumber, 1, 99_999),
        text: sanitizeShortText(entry.text, 'Shop ledger entry', 240),
        tone,
      });
    }
  }

  const mascotUidCandidate = typeof raw.mascotUid === 'string' ? raw.mascotUid : undefined;
  const mascotUid =
    mascotUidCandidate && pokemon.some((mon) => mon.uid === mascotUidCandidate)
      ? mascotUidCandidate
      : pokemon[0]?.uid;

  const activeTrendId =
    typeof raw.activeTrendId === 'string' && raw.activeTrendId in TRENDS_BY_ID
      ? raw.activeTrendId
      : MARKET_TRENDS[0].id;

  const activeGiftBall: GiftBallSlug =
    typeof raw.activeGiftBall === 'string' &&
    VALID_GIFT_BALLS.has(raw.activeGiftBall as GiftBallSlug)
      ? (raw.activeGiftBall as GiftBallSlug)
      : 'poke-ball';

  const isBankrupt = Boolean(raw.isBankrupt);
  const pendingSettlement = sanitizeSettlement(raw.pendingSettlement);
  const lastShiftSummary = sanitizeSettlement(raw.lastShiftSummary);
  const bankruptcySummary = sanitizeBankruptcySummary(raw.bankruptcySummary);

  return {
    version: 2,
    profileId: targetProfileId,
    profileName,
    difficulty,
    muted: Boolean(raw.muted),
    bgmMuted: Boolean(raw.bgmMuted ?? false),
    sfxVolume: clampFloat(raw.sfxVolume, 0.65, 0, 1),
    bgmVolume: clampFloat(raw.bgmVolume, 0.35, 0, 1),
    cash: clampInt(raw.cash, 2000, -1_000_000, 999_999_999),
    shiftNumber,
    shiftTick,
    shiftDurationTicks,
    shiftPhase: isBankrupt ? 'bankrupt' : pendingSettlement ? 'settlement-debt' : 'prep',
    shiftRunning: false,
    shiftSpeed: raw.shiftSpeed === 2 ? 2 : 1,
    cozyXp: clampInt(raw.cozyXp, 0, 0, 9_999_999),
    debtGraceDaysRemaining: clampInt(raw.debtGraceDaysRemaining, 0, 0, 10),
    isBankrupt,
    bankruptcySummary,
    activeTrendId,
    globalMarkup: clampInt(raw.globalMarkup, 100, 80, 160),
    penMarkups,
    activeGiftBall,
    ...(mascotUid ? { mascotUid } : {}),
    shopkeepers,
    pokemon,
    eggs,
    inventory,
    wholesaleCatalog,
    customers: [],
    counterQueue,
    upgrades,
    recentSpeciesSales,
    dex,
    shiftStats: {
      revenue: clampInt(rawShiftStats.revenue, 0, 0, 999_999_999),
      expenses: clampInt(rawShiftStats.expenses, 0, 0, 999_999_999),
      tipsEarned: clampInt(rawShiftStats.tipsEarned, 0, 0, 999_999_999),
      adoptionsCount: clampInt(rawShiftStats.adoptionsCount, 0, 0, 99_999),
      walkoutsCount: clampInt(rawShiftStats.walkoutsCount, 0, 0, 99_999),
      eggsHatched: clampInt(rawShiftStats.eggsHatched, 0, 0, 99_999),
      straysHealed: clampInt(rawShiftStats.straysHealed, 0, 0, 99_999),
      cozyXpEarned: clampInt(rawShiftStats.cozyXpEarned, 0, 0, 999_999),
    },
    lifetimeStats: {
      totalRevenue: clampInt(rawLifetimeStats.totalRevenue, 0, 0, 999_999_999),
      totalAdoptions: clampInt(rawLifetimeStats.totalAdoptions, 0, 0, 999_999),
      highestSale: clampInt(rawLifetimeStats.highestSale, 0, 0, 999_999_999),
    },
    pendingSettlement,
    lastShiftSummary,
    activityLog,
    seedCounter: clampInt(raw.seedCounter, 1000, 0, 2_147_483_647),
    updatedAt: Date.now(),
  };
}

function createProfileId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug || 'trainer'}-${Date.now().toString(36)}-${rand}`;
}

export function getProfileSaveKey(profileId: string): string {
  return `${PROFILE_SAVE_PREFIX}${profileId}`;
}

export function loadProfileIndex(storage: StorageLike = getDefaultStorage()): ProfileIndex | null {
  const raw = storage.getItem(PROFILE_INDEX_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProfileIndex;
    if (
      parsed &&
      parsed.version === 2 &&
      Array.isArray(parsed.profiles) &&
      parsed.profiles.length > 0
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveProfileIndex(
  index: ProfileIndex,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
}

export function loadProfileGameState(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): GameState | null {
  const raw = storage.getItem(getProfileSaveKey(profileId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed && parsed.version === 2 && typeof parsed.cash === 'number') {
      return migrateLegacyGameState(parsed);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Safely migrates pre-v2.1 saves: maps stale Pokémon NPC entries in `customers` /
 * `counterQueue` to Human Trainer profiles and populates default BGM/SFX preferences.
 */
export function migrateLegacyGameState(state: GameState): GameState {
  const customers = (state.customers ?? []).map((cust) => {
    const resolved = resolveHumanNpcFallback(cust.archetypeId, cust.npcId);
    if (cust.npcId === resolved.id && cust.npcPortraitUrl === resolved.portraitUrl) {
      return cust;
    }
    return {
      ...cust,
      npcId: resolved.id,
      npcPortraitUrl: resolved.portraitUrl,
      name: cust.npcId ? cust.name : resolved.name,
    };
  });

  const counterQueue = (state.counterQueue ?? []).map((offer) => {
    const resolved = resolveHumanNpcFallback(offer.archetypeId, offer.npcId);
    if (offer.npcId === resolved.id && offer.npcPortraitUrl === resolved.portraitUrl) {
      return offer;
    }
    return {
      ...offer,
      npcId: resolved.id,
      npcPortraitUrl: resolved.portraitUrl,
      customerName: offer.npcId ? offer.customerName : resolved.name,
    };
  });

  const shopkeepers =
    Array.isArray(state.shopkeepers) && state.shopkeepers.length > 0
      ? state.shopkeepers.map((id) => getClerkById(id).id)
      : [DEFAULT_CLERK_ID];

  return {
    ...state,
    bgmMuted: state.bgmMuted ?? false,
    sfxVolume: typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.65,
    bgmVolume: typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.35,
    shopkeepers,
    upgrades: {
      ...state.upgrades,
      'hire-clerk': state.upgrades?.['hire-clerk'] ?? 0,
    },
    customers,
    counterQueue,
  };
}

export function saveProfileGameState(
  state: GameState,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(getProfileSaveKey(state.profileId), JSON.stringify(state));

  const mascotMon =
    state.pokemon.find((mon) => mon.uid === state.mascotUid) ?? state.pokemon[0];

  const index = loadProfileIndex(storage);
  if (index) {
    const nextProfiles = index.profiles.map((meta) =>
      meta.id === state.profileId
        ? {
            ...meta,
            name: state.profileName,
            difficulty: state.difficulty,
            mascotSpeciesId: mascotMon?.speciesId ?? meta.mascotSpeciesId ?? 133,
            clerkNpcId: state.shopkeepers?.[0] ?? meta.clerkNpcId ?? DEFAULT_CLERK_ID,
            updatedAt: Date.now(),
          }
        : meta,
    );
    saveProfileIndex({ ...index, profiles: nextProfiles }, storage);
  }
}

/** Ensures at least one v2 Shift Manager profile exists in local storage. */
export function ensureInitialProfileStore(storage: StorageLike = getDefaultStorage()): {
  index: ProfileIndex;
  activeState: GameState;
} {
  const existing = loadProfileIndex(storage);
  if (existing) {
    const activeMeta =
      existing.profiles.find((p) => p.id === existing.activeProfileId) ?? existing.profiles[0];
    const loadedState = loadProfileGameState(activeMeta.id, storage);
    if (loadedState) {
      if (existing.activeProfileId !== activeMeta.id) {
        const fixedIndex = { ...existing, activeProfileId: activeMeta.id };
        saveProfileIndex(fixedIndex, storage);
        return { index: fixedIndex, activeState: loadedState };
      }
      return { index: existing, activeState: loadedState };
    }
  }

  const now = Date.now();
  const defaultId = 'cozy-host-1';
  const defaultName = 'Cozy Host';
  const initialState = createInitialGameState(defaultId, defaultName, 'standard');
  const initialMeta: ProfileMeta = {
    id: defaultId,
    name: defaultName,
    difficulty: 'standard',
    mascotSpeciesId: 133,
    createdAt: now,
    updatedAt: now,
  };
  const index: ProfileIndex = {
    version: 2,
    activeProfileId: defaultId,
    profiles: [initialMeta],
  };

  saveProfileGameState(initialState, storage);
  saveProfileIndex(index, storage);
  return { index, activeState: initialState };
}

/** Creates a brand-new isolated v2 Shift Manager profile with chosen Difficulty, Starter Mascot & Initial Shopkeeper. */
export function createProfile(
  rawName: string,
  difficulty: DifficultyId = 'standard',
  storage: StorageLike = getDefaultStorage(),
  starterSpeciesId = 133,
  initialClerkId: string = DEFAULT_CLERK_ID,
): { index: ProfileIndex; activeState: GameState } {
  const trimmed = rawName.trim().slice(0, 24) || 'Trainer';
  const current = ensureInitialProfileStore(storage).index;
  const now = Date.now();
  const newId = createProfileId(trimmed);
  const resolvedClerk = getClerkById(initialClerkId);
  const newState = createInitialGameState(
    newId,
    trimmed,
    difficulty,
    false,
    (now ^ (trimmed.length * 131)) >>> 0,
    starterSpeciesId,
    resolvedClerk.id,
  );
  const resolvedStarterId = newState.pokemon[0]?.speciesId ?? 133;

  const nextIndex: ProfileIndex = {
    version: 2,
    activeProfileId: newId,
    profiles: [
      ...current.profiles,
      {
        id: newId,
        name: trimmed,
        difficulty,
        mascotSpeciesId: resolvedStarterId,
        clerkNpcId: resolvedClerk.id,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  saveProfileGameState(newState, storage);
  saveProfileIndex(nextIndex, storage);
  return { index: nextIndex, activeState: newState };
}

/** Switches active profile and loads its isolated v2 GameState. */
export function switchActiveProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): { index: ProfileIndex; activeState: GameState } {
  const current = ensureInitialProfileStore(storage).index;
  const targetMeta = current.profiles.find((p) => p.id === profileId);
  if (!targetMeta) throw new Error(`Profile ${profileId} not found.`);

  const nextIndex: ProfileIndex = { ...current, activeProfileId: profileId };
  saveProfileIndex(nextIndex, storage);

  const loaded =
    loadProfileGameState(profileId, storage) ??
    createInitialGameState(targetMeta.id, targetMeta.name, targetMeta.difficulty ?? 'standard');
  saveProfileGameState(loaded, storage);
  return { index: nextIndex, activeState: loaded };
}

/** Resets a single profile back to Shift 1 on its difficulty (or an explicit new difficulty). */
export function resetProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
  difficultyOverride?: DifficultyId,
): GameState {
  const current = ensureInitialProfileStore(storage).index;
  const targetMeta = current.profiles.find((p) => p.id === profileId);
  if (!targetMeta) throw new Error(`Profile ${profileId} not found.`);

  const prevState = loadProfileGameState(profileId, storage);
  const diff = difficultyOverride ?? prevState?.difficulty ?? targetMeta.difficulty ?? 'standard';
  const starterId = targetMeta.mascotSpeciesId ?? 133;
  const clerkId = targetMeta.clerkNpcId ?? prevState?.shopkeepers?.[0] ?? DEFAULT_CLERK_ID;
  const freshState = createInitialGameState(
    targetMeta.id,
    targetMeta.name,
    diff,
    prevState?.muted ?? false,
    1042,
    starterId,
    clerkId,
  );
  saveProfileGameState(freshState, storage);
  return freshState;
}

/** Deletes a non-last profile and returns the updated ProfileIndex + active GameState. */
export function deleteProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): { index: ProfileIndex; activeState: GameState } {
  const current = ensureInitialProfileStore(storage).index;
  if (current.profiles.length <= 1) {
    throw new Error('Keep at least one Shift Manager profile.');
  }
  const nextProfiles = current.profiles.filter((p) => p.id !== profileId);
  storage.removeItem(getProfileSaveKey(profileId));

  const nextActiveId =
    current.activeProfileId === profileId ? nextProfiles[0].id : current.activeProfileId;
  const nextIndex: ProfileIndex = {
    version: 2,
    activeProfileId: nextActiveId,
    profiles: nextProfiles,
  };
  saveProfileIndex(nextIndex, storage);

  const activeMeta = nextProfiles.find((p) => p.id === nextActiveId) ?? nextProfiles[0];
  const activeState =
    loadProfileGameState(activeMeta.id, storage) ??
    createInitialGameState(activeMeta.id, activeMeta.name, activeMeta.difficulty ?? 'standard');
  return { index: nextIndex, activeState };
}

/** Encodes a v2 GameState into a checksum-verified UTF-8 Base64 save string. */
export function exportSaveCode(state: GameState): string {
  const stateJson = JSON.stringify(state);
  const envelope: SaveEnvelope = {
    format: 'pokemart-low-cortisol-save',
    version: 2,
    checksum: computeSaveChecksum(stateJson),
    exportedAt: new Date().toISOString(),
    state,
  };
  return encodeUtf8Base64(JSON.stringify(envelope));
}

/** Validates, decodes, and sanitizes an exported v2 Base64 save code. */
export function importSaveCode(
  code: string,
  targetProfileId: string,
  targetProfileName?: string,
): GameState {
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error('Paste a save code before importing.');
  }

  const trimmed = code.trim();
  // Guard against oversized payloads BEFORE attempting Base64 decode or JSON.parse
  if (trimmed.length > MAX_IMPORT_CODE_LENGTH) {
    throw new Error('Save code is too large (exceeds 256 KB safety limit).');
  }

  let parsedEnvelope: unknown;
  try {
    parsedEnvelope = JSON.parse(decodeUtf8Base64(trimmed));
  } catch {
    throw new Error('Invalid save code format (could not decode Base64 UTF-8 JSON).');
  }

  if (hasForbiddenKeysOrExcessiveDepth(parsedEnvelope)) {
    throw new Error('Save payload contains disallowed object keys or excessive nesting.');
  }

  if (
    !isPlainObject(parsedEnvelope) ||
    parsedEnvelope.format !== 'pokemart-low-cortisol-save' ||
    parsedEnvelope.version !== 2 ||
    !isPlainObject(parsedEnvelope.state) ||
    typeof parsedEnvelope.checksum !== 'string'
  ) {
    throw new Error('Unrecognized or unsupported save file version (requires v2).');
  }

  const envelope = parsedEnvelope as unknown as SaveEnvelope;
  const recomputed = computeSaveChecksum(JSON.stringify(envelope.state));
  if (recomputed !== envelope.checksum) {
    throw new Error('Save code checksum mismatch — code may be corrupted or truncated.');
  }

  const imported = envelope.state as unknown as Record<string, unknown>;
  if (
    typeof imported.cash !== 'number' ||
    !Number.isFinite(imported.cash) ||
    !Array.isArray(imported.pokemon) ||
    !Array.isArray(imported.eggs) ||
    !isPlainObject(imported.upgrades) ||
    (imported.profileName !== undefined && typeof imported.profileName !== 'string') ||
    (imported.shiftNumber !== undefined &&
      (typeof imported.shiftNumber !== 'number' || !Number.isFinite(imported.shiftNumber)))
  ) {
    throw new Error('Save payload is missing required shop data or has invalid field types.');
  }

  return migrateLegacyGameState(
    sanitizeImportedGameState(imported, targetProfileId, targetProfileName),
  );
}
