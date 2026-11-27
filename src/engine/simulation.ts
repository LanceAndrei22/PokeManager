/**
 * Orchestrator for the pure v2 tycoon simulation engine of PokéMart: Low Cortisol Shift.
 *
 * Coordinates `createInitialGameState`, lightweight shop/audio settings, and
 * `advanceShiftTick`, delegating domain logic cleanly to cohesive submodules:
 * - `simulationHelpers.ts` — shared leaf types (`SfxCue`, `ActionResult`, `TickResult`) & RNG/log helpers
 * - `careSimulation.ts`    — wholesale/supply/upgrade acquisitions, pen/bed transfers, healing, breeding & items
 * - `shopperSimulation.ts` — shopper spawning, pen browsing, counter queue, patience scaling & haggling
 * - `shiftSettlement.ts`   — open/pause shift, emergency liquidation, rent/upkeep, debt grace & next shift
 *
 * Re-exports every historical public symbol so callers and tests require zero import changes.
 */
import { getDifficultyConfig } from '../data/difficulties';
import { getItemDefinition } from '../data/items';
import { DEFAULT_CLERK_ID, getClerkById } from '../data/npcs';
import { getSpecies } from '../data/species';
import { MARKET_TRENDS } from '../data/trends';
import {
  STARTER_MASCOT_IDS,
  type DifficultyId,
  type GameState,
  type GiftBallSlug,
  type PokemonInstance,
} from '../data/types';
import {
  buySupplyItem,
  buyWholesaleOffer,
  claimHatchedEggAction,
  movePokemonLocation,
  purchaseUpgradeAction,
  setShopMascotAction,
  startBreedingAction,
  stepCareAndBreedingTick,
  useItemAction,
} from './careSimulation';
import { generateWholesaleCatalog } from './catalog';
import { recordDexDiscovery } from './dex';
import { clamp, createSeededRng, type RngFn } from './rng';
import {
  closeShiftEarly,
  finalizeDebtSettlement,
  liquidatePokemonAction,
  resolveShiftEnd,
  startNextShift,
  toggleShiftRunning,
} from './shiftSettlement';
import {
  acceptCounterOfferAction,
  declineCounterOfferAction,
  haggleCounterOfferAction,
  stepShopperTick,
} from './shopperSimulation';
import {
  nextRng,
  type ActionResult,
  type SfxCue,
  type TickResult,
} from './simulationHelpers';

export type { ActionResult, SfxCue, TickResult };
export {
  acceptCounterOfferAction,
  buySupplyItem,
  buyWholesaleOffer,
  claimHatchedEggAction,
  closeShiftEarly,
  declineCounterOfferAction,
  finalizeDebtSettlement,
  haggleCounterOfferAction,
  liquidatePokemonAction,
  movePokemonLocation,
  purchaseUpgradeAction,
  setShopMascotAction,
  startBreedingAction,
  startNextShift,
  toggleShiftRunning,
  useItemAction,
};

/**
 * Creates a fresh v2 starting state for a local Shift Manager profile on the chosen
 * difficulty (`relaxed`, `standard`, or `high-stakes`) and Starter Mascot species.
 * Starts with chosen Starter Mascot (#133 Eevee default), Slowpoke (#79), and napping Psyduck (#54).
 */
export function createInitialGameState(
  profileId: string,
  profileName: string,
  difficulty: DifficultyId = 'standard',
  muted = false,
  seed = 1042,
  starterSpeciesId = 133,
  initialClerkId: string = DEFAULT_CLERK_ID,
): GameState {
  const diff = getDifficultyConfig(difficulty);
  const rng = createSeededRng(seed);
  const resolvedClerk = getClerkById(initialClerkId);
  const resolvedStarterId = STARTER_MASCOT_IDS.includes(
    starterSpeciesId as (typeof STARTER_MASCOT_IDS)[number],
  )
    ? starterSpeciesId
    : 133;
  const starterSpecies = getSpecies(resolvedStarterId);
  const starterUid =
    resolvedStarterId === 133 ? 'mon-starter-eevee' : `mon-starter-${resolvedStarterId}`;

  const starterPokemon: PokemonInstance[] = [
    {
      uid: starterUid,
      speciesId: resolvedStarterId,
      isShiny: false,
      trait: 'Cozy',
      stats:
        resolvedStarterId === 133
          ? { cute: 88, comfort: 82, rarity: 58 }
          : {
              cute: Math.max(82, starterSpecies.baseStats.cute),
              comfort: Math.max(80, starterSpecies.baseStats.comfort),
              rarity: Math.max(56, starterSpecies.baseStats.rarity),
            },
      location: 'pen',
      penIndex: 0,
      healingProgress: 100,
      needsRecovery: false,
      acquiredAtShift: 1,
      origin: 'starter',
    },
    {
      uid: 'mon-starter-slowpoke',
      speciesId: 79,
      isShiny: false,
      trait: 'Sleepy',
      stats: { cute: 80, comfort: 92, rarity: 46 },
      location: 'pen',
      penIndex: 1,
      healingProgress: 100,
      needsRecovery: false,
      acquiredAtShift: 1,
      origin: 'starter',
    },
    {
      uid: 'mon-starter-psyduck',
      speciesId: 54,
      isShiny: false,
      trait: 'Docile',
      stats: { cute: 78, comfort: 76, rarity: 44 },
      location: 'healing',
      penIndex: null,
      healingProgress: 45,
      needsRecovery: true,
      acquiredAtShift: 1,
      origin: 'rescue',
    },
  ];

  let dex = {};
  for (const mon of starterPokemon) {
    dex = recordDexDiscovery(dex, mon.speciesId, { isShiny: mon.isShiny, event: 'seen' });
  }

  return {
    version: 2,
    profileId,
    profileName,
    difficulty,
    muted,
    bgmMuted: false,
    sfxVolume: 0.65,
    bgmVolume: 0.35,
    cash: diff.startingCash,
    shiftNumber: 1,
    shiftTick: 0,
    shiftDurationTicks: 100,
    shiftPhase: 'prep',
    shiftRunning: false,
    shiftSpeed: 1,
    cozyXp: 0,
    debtGraceDaysRemaining: diff.debtGraceShifts,
    isBankrupt: false,
    bankruptcySummary: null,
    activeTrendId: MARKET_TRENDS[0].id,
    globalMarkup: 100,
    penMarkups: {},
    activeGiftBall: 'poke-ball',
    mascotUid: starterUid,
    shopkeepers: [resolvedClerk.id],
    pokemon: starterPokemon,
    eggs: [],
    inventory: {
      'poke-ball': 99,
      'water-stone': 1,
      'oran-berry': 3,
      'moomoo-milk': 1,
      'friend-ball': 2,
    },
    wholesaleCatalog: generateWholesaleCatalog(1, 0, 1, rng, difficulty),
    customers: [],
    counterQueue: [],
    upgrades: {
      'extra-pen': 0,
      'extra-incubator': 0,
      'extra-nap-bed': 0,
      'cafe-decor': 0,
      'mystery-shipment': 0,
      'hire-clerk': 0,
    },
    recentSpeciesSales: {},
    dex,
    shiftStats: {
      revenue: 0,
      expenses: 0,
      tipsEarned: 0,
      adoptionsCount: 0,
      walkoutsCount: 0,
      eggsHatched: 0,
      straysHealed: 0,
      cozyXpEarned: 0,
    },
    lifetimeStats: {
      totalRevenue: 0,
      totalAdoptions: 0,
      highestSale: 0,
    },
    pendingSettlement: null,
    lastShiftSummary: null,
    activityLog: [
      {
        id: 'log-1-welcome',
        shift: 1,
        text: `Welcome to ${profileName}'s PokéMart (${diff.name} Mode)! Prep your pens and open when ready.`,
        tone: 'info',
      },
    ],
    seedCounter: 1,
    updatedAt: Date.now(),
  };
}

/** Switches live-tick speed between 1× and 2×. */
export function setShiftSpeed(state: GameState, speed: 1 | 2): GameState {
  return { ...state, shiftSpeed: speed, updatedAt: Date.now() };
}

/** Updates global shop markup percentage (80%–160%). */
export function setGlobalMarkup(state: GameState, markup: number): GameState {
  return { ...state, globalMarkup: clamp(Math.round(markup), 80, 160), updatedAt: Date.now() };
}

/** Sets or clears a pen-specific markup override. */
export function setPenMarkup(
  state: GameState,
  penIndex: number,
  markup: number | null,
): GameState {
  return {
    ...state,
    penMarkups: {
      ...state.penMarkups,
      [penIndex]: markup === null ? null : clamp(Math.round(markup), 80, 160),
    },
    updatedAt: Date.now(),
  };
}

/** Selects the active gift-wrap Poké Ball used when accepting offers at the Human Clerk counter. */
export function setActiveGiftBall(state: GameState, ball: GiftBallSlug): ActionResult {
  if (ball !== 'poke-ball' && (state.inventory[ball] ?? 0) <= 0) {
    return { state, ok: false, message: `No ${getItemDefinition(ball).name}s in your bag yet.` };
  }
  return {
    state: { ...state, activeGiftBall: ball, updatedAt: Date.now() },
    ok: true,
    message: `Checkout ribbon set to ${getItemDefinition(ball).name}.`,
    sfx: 'click',
  };
}

/** Toggles per-profile Web Audio SFX mute preference. */
export function toggleMuteAction(state: GameState): GameState {
  return { ...state, muted: !state.muted, updatedAt: Date.now() };
}

/** Toggles per-profile background music mute preference. */
export function toggleBgmMuteAction(state: GameState): GameState {
  return { ...state, bgmMuted: !(state.bgmMuted ?? false), updatedAt: Date.now() };
}

/** Sets per-profile SFX volume (clamped 0..1). */
export function setSfxVolumeAction(state: GameState, volume: number): GameState {
  return { ...state, sfxVolume: clamp(volume, 0, 1), updatedAt: Date.now() };
}

/** Sets per-profile BGM volume (clamped 0..1). */
export function setBgmVolumeAction(state: GameState, volume: number): GameState {
  return { ...state, bgmVolume: clamp(volume, 0, 1), updatedAt: Date.now() };
}

/**
 * Advances the live-tick tycoon simulation by one tick (`open` phase):
 * 1. Advances napping strays and incubating eggs (`careSimulation`),
 * 2. Ticks counter patience, resolves pen browsers to `counterQueue`, and spawns shoppers (`shopperSimulation`),
 * 3. Triggers `resolveShiftEnd` on closing time (`shiftSettlement`).
 */
export function advanceShiftTick(state: GameState, providedRng?: RngFn): TickResult {
  if (!state.shiftRunning || state.isBankrupt || state.shiftPhase !== 'open') {
    return { state, sfxCues: [] };
  }

  const { rng, nextSeed } = nextRng(state, providedRng);
  const sfxCues: SfxCue[] = [];
  let nextState: GameState = {
    ...state,
    shiftTick: state.shiftTick + 1,
    seedCounter: nextSeed,
    updatedAt: Date.now(),
  };

  nextState = stepCareAndBreedingTick(nextState, sfxCues);
  nextState = stepShopperTick(nextState, sfxCues, rng);

  if (nextState.shiftTick >= nextState.shiftDurationTicks) {
    nextState = resolveShiftEnd(nextState, false);
  }

  return { state: nextState, sfxCues };
}
