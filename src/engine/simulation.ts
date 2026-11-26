/**
 * Pure simulation reducer & relaxed live-tick engine for PokéMart: Low Cortisol Shift.
 * All shop actions and tick transitions are pure functions returning updated GameState
 * plus optional Web Audio cue tags for React UI integration and deterministic testing.
 */
import { CUSTOMER_ARCHETYPES, CUSTOMER_FIRST_NAMES } from '../data/customers';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import { MARKET_TRENDS, getMarketTrend } from '../data/trends';
import { UPGRADES_BY_ID, getUpgradeCost } from '../data/upgrades';
import type {
  ActivityEntry,
  CustomerArchetypeId,
  GameState,
  GiftBallSlug,
  ItemSlug,
  PokemonInstance,
  ShopCustomer,
  ShopUpgradeId,
} from '../data/types';
import {
  advanceEggsTick,
  areCompatibleParents,
  createEggFromParents,
  findOpenPenIndex,
  hatchEggToPokemon,
} from './breeding';
import { generateWholesaleCatalog } from './catalog';
import { getCozyRankInfo, recordDexDiscovery } from './dex';
import {
  calculateBuyProbability,
  calculatePokemonValuation,
  getEffectiveMarkup,
  resolveCheckoutGiftBall,
} from './economy';
import {
  advanceHealingTick,
  getIncubatorCapacity,
  getNapBedCapacity,
  getPenCapacity,
} from './healing';
import { applyItemToPokemon, canUseItemOnPokemon } from './items';
import { clamp, createSeededRng, pickRandom, randomInt, type RngFn } from './rng';

export type SfxCue = 'bell' | 'sale' | 'evolve' | 'hatch' | 'heal' | 'click' | 'shiny';

export interface ActionResult {
  state: GameState;
  ok: boolean;
  message: string;
  sfx?: SfxCue;
}

export interface TickResult {
  state: GameState;
  sfxCues: SfxCue[];
}

function appendLog(
  log: ActivityEntry[],
  shift: number,
  text: string,
  tone: ActivityEntry['tone'],
  idSuffix: string,
): ActivityEntry[] {
  const entry: ActivityEntry = {
    id: `log-${shift}-${idSuffix}`,
    shift,
    text,
    tone,
  };
  return [entry, ...log].slice(0, 28);
}

function nextRng(state: GameState, providedRng?: RngFn): { rng: RngFn; nextSeed: number } {
  const nextSeed = (state.seedCounter + 1) >>> 0;
  return {
    rng: providedRng ?? createSeededRng(0x504f4b45 ^ nextSeed ^ (state.shiftNumber * 997)),
    nextSeed,
  };
}

/**
 * Creates a fresh starting state for a new local Shift Manager profile.
 * Starts with Eevee & Slowpoke on display, a napping Psyduck stray, starter supplies
 * (including a Water Stone), and active Shift 1 Market Trend + Wholesale Catalog.
 */
export function createInitialGameState(
  profileId: string,
  profileName: string,
  muted = false,
  seed = 1042,
): GameState {
  const rng = createSeededRng(seed);
  const starterPokemon: PokemonInstance[] = [
    {
      uid: 'mon-starter-eevee',
      speciesId: 133,
      isShiny: false,
      trait: 'Cozy',
      stats: { cute: 91, comfort: 84, rarity: 64 },
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
      stats: { cute: 82, comfort: 96, rarity: 48 },
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
      stats: { cute: 80, comfort: 78, rarity: 44 },
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
    version: 1,
    profileId,
    profileName,
    muted,
    cash: 1800,
    shiftNumber: 1,
    shiftTick: 0,
    shiftDurationTicks: 100,
    shiftRunning: false,
    shiftSpeed: 1,
    cozyXp: 0,
    activeTrendId: MARKET_TRENDS[0].id,
    globalMarkup: 100,
    penMarkups: {},
    activeGiftBall: 'poke-ball',
    pokemon: starterPokemon,
    eggs: [],
    inventory: {
      'poke-ball': 99,
      'water-stone': 1,
      'oran-berry': 3,
      'moomoo-milk': 1,
      'friend-ball': 2,
    },
    wholesaleCatalog: generateWholesaleCatalog(1, 0, 1, rng),
    customers: [],
    upgrades: {
      'extra-pen': 0,
      'extra-incubator': 0,
      'extra-nap-bed': 0,
      'cafe-decor': 0,
      'mystery-shipment': 0,
    },
    recentSpeciesSales: {},
    dex,
    shiftStats: {
      revenue: 0,
      expenses: 0,
      tipsEarned: 0,
      adoptionsCount: 0,
      eggsHatched: 0,
      straysHealed: 0,
      cozyXpEarned: 0,
    },
    lastShiftSummary: null,
    activityLog: [
      {
        id: 'log-1-welcome',
        shift: 1,
        text: `Welcome to ${profileName}'s PokéMart! Open Shop whenever you feel ready.`,
        tone: 'info',
      },
    ],
    seedCounter: 1,
    updatedAt: Date.now(),
  };
}

/** Toggles between Open Shop (running) and Paused. */
export function toggleShiftRunning(state: GameState): ActionResult {
  if (state.lastShiftSummary) {
    return {
      state,
      ok: false,
      message: 'Review the Shift Summary and start the next shift first.',
    };
  }
  const nextRunning = !state.shiftRunning;
  return {
    state: {
      ...state,
      shiftRunning: nextRunning,
      updatedAt: Date.now(),
    },
    ok: true,
    message: nextRunning ? 'Shop doors opened! Customers are strolling in.' : 'Shop paused for a calm breather.',
    sfx: nextRunning ? 'bell' : 'click',
  };
}

/** Switches live-tick speed between 1× and 2×. */
export function setShiftSpeed(state: GameState, speed: 1 | 2): GameState {
  return {
    ...state,
    shiftSpeed: speed,
    updatedAt: Date.now(),
  };
}

/** Updates global shop markup percentage (clamped cleanly to 80%–160%). */
export function setGlobalMarkup(state: GameState, markup: number): GameState {
  return {
    ...state,
    globalMarkup: clamp(Math.round(markup), 80, 160),
    updatedAt: Date.now(),
  };
}

/** Sets or clears a pen-specific markup override (80%–160%, or `null` to inherit global). */
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

/** Selects the active gift-wrap Poké Ball used at checkout. */
export function setActiveGiftBall(state: GameState, ball: GiftBallSlug): ActionResult {
  if (ball !== 'poke-ball' && (state.inventory[ball] ?? 0) <= 0) {
    return {
      state,
      ok: false,
      message: `No ${getItemDefinition(ball).name}s in your bag yet.`,
    };
  }
  return {
    state: {
      ...state,
      activeGiftBall: ball,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Checkout ribbon set to ${getItemDefinition(ball).name}.`,
    sfx: 'click',
  };
}

/** Toggles per-profile Web Audio SFX mute preference. */
export function toggleMuteAction(state: GameState): GameState {
  return {
    ...state,
    muted: !state.muted,
    updatedAt: Date.now(),
  };
}

/** Purchases an offer from the daily Wholesale & Rescue Catalog. */
export function buyWholesaleOffer(state: GameState, offerUid: string): ActionResult {
  const offerIndex = state.wholesaleCatalog.findIndex((o) => o.uid === offerUid);
  if (offerIndex === -1) {
    return { state, ok: false, message: 'Wholesale offer no longer exists.' };
  }
  const offer = state.wholesaleCatalog[offerIndex];
  if (offer.purchased) {
    return { state, ok: false, message: 'Already adopted from today’s shipment.' };
  }
  if (state.cash < offer.cost) {
    return { state, ok: false, message: `Need ₽${offer.cost.toLocaleString()} for this offer.` };
  }

  const species = getSpecies(offer.speciesId);

  if (offer.kind === 'egg') {
    const cap = getIncubatorCapacity(state.upgrades);
    if (state.eggs.length >= cap) {
      return {
        state,
        ok: false,
        message: `All ${cap} egg incubator(s) are occupied. Hatch or upgrade first!`,
      };
    }

    const updatedCatalog = state.wholesaleCatalog.map((item) =>
      item.uid === offerUid ? { ...item, purchased: true } : item,
    );
    const nextEgg = {
      uid: `egg-${state.shiftNumber}-${state.seedCounter + 1}`,
      speciesId: offer.speciesId,
      parentNames: ['Mystery Courier', 'Sinnoh Daycare'] as [string, string],
      isShiny: offer.isShiny,
      trait: offer.trait,
      inheritedStats: { ...offer.stats },
      progress: 0,
      readyToHatch: false,
    };

    return {
      state: {
        ...state,
        cash: state.cash - offer.cost,
        eggs: [...state.eggs, nextEgg],
        wholesaleCatalog: updatedCatalog,
        shiftStats: {
          ...state.shiftStats,
          expenses: state.shiftStats.expenses + offer.cost,
        },
        activityLog: appendLog(
          state.activityLog,
          state.shiftNumber,
          `Adopted a Mystery Egg into the warm incubator (₽${offer.cost}).`,
          'breed',
          `buy-${state.seedCounter + 1}`,
        ),
        seedCounter: state.seedCounter + 1,
        updatedAt: Date.now(),
      },
      ok: true,
      message: 'Mystery Egg tucked into a warm incubator!',
      sfx: 'click',
    };
  }

  // Healthy or Stray Pokémon placement
  const penCap = getPenCapacity(state.upgrades);
  const bedCap = getNapBedCapacity(state.upgrades);
  const currentHealingCount = state.pokemon.filter((p) => p.location === 'healing').length;

  let location: PokemonInstance['location'] = 'reserve';
  let penIndex: number | null = null;
  const needsRecovery = offer.kind === 'stray';

  if (needsRecovery) {
    if (currentHealingCount >= bedCap) {
      return {
        state,
        ok: false,
        message: `All ${bedCap} plush nap bed(s) are occupied right now.`,
      };
    }
    location = 'healing';
  } else {
    const openPen = findOpenPenIndex(state.pokemon, penCap);
    if (openPen !== null) {
      location = 'pen';
      penIndex = openPen;
    }
  }

  const newMon: PokemonInstance = {
    uid: `mon-${state.shiftNumber}-${state.seedCounter + 1}`,
    speciesId: offer.speciesId,
    isShiny: offer.isShiny,
    trait: offer.trait,
    stats: { ...offer.stats },
    location,
    penIndex,
    healingProgress: needsRecovery ? offer.initialHealingProgress : 100,
    needsRecovery,
    acquiredAtShift: state.shiftNumber,
    origin: needsRecovery ? 'rescue' : 'wholesale',
  };

  const updatedCatalog = state.wholesaleCatalog.map((item) =>
    item.uid === offerUid ? { ...item, purchased: true } : item,
  );
  const updatedDex = recordDexDiscovery(state.dex, newMon.speciesId, {
    isShiny: newMon.isShiny,
    event: 'seen',
  });

  const placementNote = needsRecovery
    ? 'into a plush nap bed'
    : penIndex !== null
      ? `into Display Pen #${penIndex + 1}`
      : 'into the Reserve Kennel';

  return {
    state: {
      ...state,
      cash: state.cash - offer.cost,
      pokemon: [...state.pokemon, newMon],
      wholesaleCatalog: updatedCatalog,
      dex: updatedDex,
      shiftStats: {
        ...state.shiftStats,
        expenses: state.shiftStats.expenses + offer.cost,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${newMon.isShiny ? '✨ Shiny ' : ''}${species.name} welcomed ${placementNote} (₽${offer.cost}).`,
        newMon.isShiny ? 'shiny' : needsRecovery ? 'heal' : 'info',
        `buy-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${species.name} welcomed ${placementNote}!`,
    sfx: newMon.isShiny ? 'shiny' : 'click',
  };
}

/** Purchases shop items from the Supply Shelf into the Item Bag. */
export function buySupplyItem(state: GameState, itemSlug: ItemSlug, quantity = 1): ActionResult {
  const item = getItemDefinition(itemSlug);
  const totalCost = item.cost * quantity;
  if (totalCost <= 0) {
    return { state, ok: false, message: `${item.name} is always complimentary.` };
  }
  if (state.cash < totalCost) {
    return { state, ok: false, message: `Need ₽${totalCost.toLocaleString()} for ${item.name}.` };
  }

  return {
    state: {
      ...state,
      cash: state.cash - totalCost,
      inventory: {
        ...state.inventory,
        [itemSlug]: (state.inventory[itemSlug] ?? 0) + quantity,
      },
      shiftStats: {
        ...state.shiftStats,
        expenses: state.shiftStats.expenses + totalCost,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Stocked ${quantity}× ${item.name} (₽${totalCost}).`,
        'info',
        `supply-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Purchased ${quantity}× ${item.name}.`,
    sfx: 'click',
  };
}

/** Moves an owned Pokémon cleanly between Display Pen, Reserve Kennel, and Nap Station. */
export function movePokemonLocation(
  state: GameState,
  pokemonUid: string,
  destination: 'pen' | 'reserve' | 'healing',
  targetPenIndex?: number,
): ActionResult {
  const mon = state.pokemon.find((p) => p.uid === pokemonUid);
  if (!mon) {
    return { state, ok: false, message: 'Pokémon not found.' };
  }
  if (mon.location === 'breeding') {
    return { state, ok: false, message: 'Cannot move while paired in the breeding incubator.' };
  }

  const penCap = getPenCapacity(state.upgrades);
  const bedCap = getNapBedCapacity(state.upgrades);

  if (destination === 'pen') {
    if (mon.needsRecovery) {
      return { state, ok: false, message: 'Strays must finish resting before entering display pens.' };
    }
    const desiredIndex =
      targetPenIndex !== undefined
        ? targetPenIndex
        : findOpenPenIndex(state.pokemon, penCap);
    if (desiredIndex === null || desiredIndex < 0 || desiredIndex >= penCap) {
      return { state, ok: false, message: 'All display pens are currently full.' };
    }
    const occupied = state.pokemon.some(
      (p) => p.uid !== mon.uid && p.location === 'pen' && p.penIndex === desiredIndex,
    );
    if (occupied) {
      return { state, ok: false, message: `Display Pen #${desiredIndex + 1} is already occupied.` };
    }

    return {
      state: {
        ...state,
        pokemon: state.pokemon.map((p) =>
          p.uid === mon.uid ? { ...p, location: 'pen', penIndex: desiredIndex } : p,
        ),
        updatedAt: Date.now(),
      },
      ok: true,
      message: `${getSpecies(mon.speciesId).name} moved to Display Pen #${desiredIndex + 1}.`,
      sfx: 'click',
    };
  }

  if (destination === 'healing') {
    const healingCount = state.pokemon.filter((p) => p.location === 'healing').length;
    if (mon.location !== 'healing' && healingCount >= bedCap) {
      return { state, ok: false, message: 'All plush nap beds are full.' };
    }
    return {
      state: {
        ...state,
        pokemon: state.pokemon.map((p) =>
          p.uid === mon.uid ? { ...p, location: 'healing', penIndex: null } : p,
        ),
        updatedAt: Date.now(),
      },
      ok: true,
      message: `${getSpecies(mon.speciesId).name} tucked into a plush nap bed.`,
      sfx: 'heal',
    };
  }

  // Reserve kennel
  if (mon.needsRecovery) {
    return { state, ok: false, message: 'Keep tired strays resting in a nap bed until recovered.' };
  }
  return {
    state: {
      ...state,
      pokemon: state.pokemon.map((p) =>
        p.uid === mon.uid ? { ...p, location: 'reserve', penIndex: null } : p,
      ),
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${getSpecies(mon.speciesId).name} moved to the Reserve Kennel.`,
    sfx: 'click',
  };
}

/** Consumes one item from the bag to evolve, heal, or boost a Pokémon. */
export function useItemAction(
  state: GameState,
  pokemonUid: string,
  itemSlug: ItemSlug,
): ActionResult {
  const count = state.inventory[itemSlug] ?? 0;
  if (count <= 0) {
    return { state, ok: false, message: `No ${getItemDefinition(itemSlug).name} left in bag.` };
  }

  const targetMon = state.pokemon.find((p) => p.uid === pokemonUid);
  if (!targetMon) {
    return { state, ok: false, message: 'Pokémon not found.' };
  }

  const check = canUseItemOnPokemon(targetMon, itemSlug);
  if (!check.ok) {
    return { state, ok: false, message: check.reason ?? 'Item cannot be used here.' };
  }

  const outcome = applyItemToPokemon(targetMon, itemSlug);
  const penCap = getPenCapacity(state.upgrades);
  let nextPokemonList = state.pokemon.map((p) =>
    p.uid === pokemonUid ? outcome.updatedPokemon : p,
  );

  // Automatically move a fully healed stray out of the nap bed into an open pen (or reserve).
  if (outcome.fullyHealed) {
    const openPen = findOpenPenIndex(nextPokemonList, penCap);
    nextPokemonList = nextPokemonList.map((p) =>
      p.uid === pokemonUid
        ? {
            ...p,
            location: openPen !== null ? 'pen' : 'reserve',
            penIndex: openPen,
          }
        : p,
    );
  }

  let nextDex = state.dex;
  if (outcome.evolvedToId) {
    nextDex = recordDexDiscovery(nextDex, outcome.evolvedToId, {
      isShiny: outcome.updatedPokemon.isShiny,
      event: 'evolved',
    });
  }

  const nextBagCount = count - 1;
  const nextInventory = { ...state.inventory };
  if (nextBagCount <= 0) {
    delete nextInventory[itemSlug];
  } else {
    nextInventory[itemSlug] = nextBagCount;
  }

  const tone: ActivityEntry['tone'] = outcome.evolvedToId
    ? 'shiny'
    : outcome.fullyHealed
      ? 'heal'
      : 'info';

  return {
    state: {
      ...state,
      pokemon: nextPokemonList,
      inventory: nextInventory,
      dex: nextDex,
      cozyXp: state.cozyXp + outcome.xpBonus,
      shiftStats: {
        ...state.shiftStats,
        straysHealed: state.shiftStats.straysHealed + (outcome.fullyHealed ? 1 : 0),
        cozyXpEarned: state.shiftStats.cozyXpEarned + outcome.xpBonus,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        outcome.message,
        tone,
        `item-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: outcome.message,
    sfx: outcome.evolvedToId ? 'evolve' : outcome.fullyHealed ? 'heal' : 'click',
  };
}

/** Pairs two compatible Pokémon in a warm incubator to produce an Egg. */
export function startBreedingAction(
  state: GameState,
  parentAUid: string,
  parentBUid: string,
  providedRng?: RngFn,
): ActionResult {
  const cap = getIncubatorCapacity(state.upgrades);
  if (state.eggs.length >= cap) {
    return {
      state,
      ok: false,
      message: `All ${cap} egg incubator(s) are busy. Hatch an egg or upgrade first!`,
    };
  }

  const parentA = state.pokemon.find((p) => p.uid === parentAUid);
  const parentB = state.pokemon.find((p) => p.uid === parentBUid);
  if (!parentA || !parentB) {
    return { state, ok: false, message: 'Select two valid parents.' };
  }
  if (!areCompatibleParents(parentA, parentB)) {
    return {
      state,
      ok: false,
      message: 'Parents must be rested and share a species or Egg Group.',
    };
  }

  const { rng, nextSeed } = nextRng(state, providedRng);
  const egg = createEggFromParents(
    parentA,
    parentB,
    state.upgrades['mystery-shipment'],
    rng,
    `egg-${state.shiftNumber}-${nextSeed}`,
  );
  const babyName = getSpecies(egg.speciesId).name;

  return {
    state: {
      ...state,
      eggs: [...state.eggs, egg],
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${getSpecies(parentA.speciesId).name} & ${getSpecies(parentB.speciesId).name} tucked a cozy ${babyName} Egg into the incubator!`,
        'breed',
        `breed-${nextSeed}`,
      ),
      seedCounter: nextSeed,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Incubating a ${babyName} Egg!`,
    sfx: 'click',
  };
}

/** Hatches a matured Egg (`readyToHatch === true`) into the shop and updates the Dex. */
export function claimHatchedEggAction(state: GameState, eggUid: string): ActionResult {
  const egg = state.eggs.find((e) => e.uid === eggUid);
  if (!egg) {
    return { state, ok: false, message: 'Egg not found.' };
  }
  if (!egg.readyToHatch) {
    return { state, ok: false, message: 'Egg is still warming up!' };
  }

  const penCap = getPenCapacity(state.upgrades);
  const newMon = hatchEggToPokemon(
    egg,
    state.pokemon,
    penCap,
    state.shiftNumber,
    `mon-hatch-${state.shiftNumber}-${state.seedCounter + 1}`,
  );
  const species = getSpecies(newMon.speciesId);
  const nextDex = recordDexDiscovery(state.dex, newMon.speciesId, {
    isShiny: newMon.isShiny,
    event: 'hatched',
  });
  const xpReward = newMon.isShiny ? 40 : 18;

  return {
    state: {
      ...state,
      pokemon: [...state.pokemon, newMon],
      eggs: state.eggs.filter((e) => e.uid !== eggUid),
      dex: nextDex,
      cozyXp: state.cozyXp + xpReward,
      shiftStats: {
        ...state.shiftStats,
        eggsHatched: state.shiftStats.eggsHatched + 1,
        cozyXpEarned: state.shiftStats.cozyXpEarned + xpReward,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${newMon.isShiny ? '✨ Shiny ' : ''}${species.name} hatched happily (${newMon.trait})!`,
        newMon.isShiny ? 'shiny' : 'breed',
        `hatch-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${newMon.isShiny ? '✨ Shiny ' : ''}${species.name} hatched!`,
    sfx: newMon.isShiny ? 'shiny' : 'hatch',
  };
}

/** Purchases one level of a persistent shop expansion upgrade. */
export function purchaseUpgradeAction(state: GameState, upgradeId: ShopUpgradeId): ActionResult {
  const def = UPGRADES_BY_ID[upgradeId];
  const level = state.upgrades[upgradeId] ?? 0;
  if (level >= def.maxLevel) {
    return { state, ok: false, message: `${def.name} is already at max level!` };
  }
  const cost = getUpgradeCost(upgradeId, level);
  if (state.cash < cost) {
    return { state, ok: false, message: `Need ₽${cost.toLocaleString()} for ${def.name}.` };
  }

  return {
    state: {
      ...state,
      cash: state.cash - cost,
      upgrades: {
        ...state.upgrades,
        [upgradeId]: level + 1,
      },
      cozyXp: state.cozyXp + 20,
      shiftStats: {
        ...state.shiftStats,
        expenses: state.shiftStats.expenses + cost,
        cozyXpEarned: state.shiftStats.cozyXpEarned + 20,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Upgraded ${def.name} to Lv.${level + 1}!`,
        'info',
        `upg-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${def.name} upgraded to Lv.${level + 1}!`,
    sfx: 'click',
  };
}

function buildShiftSummary(state: GameState, closedEarly: boolean) {
  const trend = getMarketTrend(state.activeTrendId);
  return {
    shiftNumber: state.shiftNumber,
    revenue: state.shiftStats.revenue,
    expenses: state.shiftStats.expenses,
    tipsEarned: state.shiftStats.tipsEarned,
    adoptionsCount: state.shiftStats.adoptionsCount,
    eggsHatched: state.shiftStats.eggsHatched,
    straysHealed: state.shiftStats.straysHealed,
    cozyXpEarned: state.shiftStats.cozyXpEarned,
    trendTitle: trend.title,
    closedEarly,
  };
}

/** Gently closes the current shift early so the player can rest & start the next shift. */
export function closeShiftEarly(state: GameState): GameState {
  if (state.lastShiftSummary) return state;
  return {
    ...state,
    shiftRunning: false,
    customers: [],
    lastShiftSummary: buildShiftSummary(state, true),
    updatedAt: Date.now(),
  };
}

/** Transitions from the Shift Summary modal into the next cozy shift with fresh trends & stock. */
export function startNextShift(state: GameState, providedRng?: RngFn): GameState {
  const { rng, nextSeed } = nextRng(state, providedRng);
  const nextShiftNumber = state.shiftNumber + 1;
  const rankInfo = getCozyRankInfo(state.cozyXp);

  // Decay recent species sales by 1 each shift so oversupply saturation gently clears.
  const decayedSales: Record<number, number> = {};
  for (const [spId, count] of Object.entries(state.recentSpeciesSales)) {
    if (count > 1) {
      decayedSales[Number(spId)] = count - 1;
    }
  }

  const nextTrend = pickRandom(MARKET_TRENDS, rng);
  const nextCatalog = generateWholesaleCatalog(
    rankInfo.rank,
    state.upgrades['mystery-shipment'],
    nextShiftNumber,
    rng,
  );

  return {
    ...state,
    shiftNumber: nextShiftNumber,
    shiftTick: 0,
    shiftRunning: false,
    activeTrendId: nextTrend.id,
    wholesaleCatalog: nextCatalog,
    customers: [],
    recentSpeciesSales: decayedSales,
    shiftStats: {
      revenue: 0,
      expenses: 0,
      tipsEarned: 0,
      adoptionsCount: 0,
      eggsHatched: 0,
      straysHealed: 0,
      cozyXpEarned: 0,
    },
    lastShiftSummary: null,
    activityLog: appendLog(
      state.activityLog,
      nextShiftNumber,
      `Shift #${nextShiftNumber} ready! Today's Trend: ${nextTrend.title}.`,
      'info',
      `start-${nextSeed}`,
    ),
    seedCounter: nextSeed,
    updatedAt: Date.now(),
  };
}

/**
 * Advances the relaxed 1-second live-tick simulation by one tick:
 * - Advances napping strays and incubating eggs
 * - Resolves browsing customers & completes cozy adoptions (zero harsh penalties)
 * - Spawns new strolling shoppers when display pens have companions
 * - Closes shift cleanly when `shiftTick` reaches `shiftDurationTicks`
 */
export function advanceShiftTick(state: GameState, providedRng?: RngFn): TickResult {
  if (!state.shiftRunning || state.lastShiftSummary) {
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

  const penCap = getPenCapacity(nextState.upgrades);
  const trend = getMarketTrend(nextState.activeTrendId);

  // 1. Heal napping strays
  const healingOutcome = advanceHealingTick(
    nextState.pokemon,
    nextState.upgrades['extra-nap-bed'],
    penCap,
  );
  nextState.pokemon = healingOutcome.updatedPokemon;
  if (healingOutcome.healedNames.length > 0) {
    sfxCues.push('heal');
    nextState.cozyXp += 14 * healingOutcome.healedNames.length;
    nextState.shiftStats = {
      ...nextState.shiftStats,
      straysHealed: nextState.shiftStats.straysHealed + healingOutcome.healedNames.length,
      cozyXpEarned: nextState.shiftStats.cozyXpEarned + 14 * healingOutcome.healedNames.length,
    };
    nextState.activityLog = appendLog(
      nextState.activityLog,
      nextState.shiftNumber,
      `${healingOutcome.healedNames.join(', ')} woke up rested and ready for adoption!`,
      'heal',
      `heal-${nextState.shiftTick}`,
    );
  }

  // 2. Advance incubating eggs
  const eggOutcome = advanceEggsTick(nextState.eggs, nextState.upgrades['extra-incubator']);
  nextState.eggs = eggOutcome.updatedEggs;
  if (eggOutcome.newlyReadyCount > 0) {
    sfxCues.push('hatch');
    nextState.activityLog = appendLog(
      nextState.activityLog,
      nextState.shiftNumber,
      `An egg in your incubator is shaking gently — ready to hatch!`,
      'breed',
      `egg-ready-${nextState.shiftTick}`,
    );
  }

  // 3. Resolve existing browsing customers
  const remainingCustomers: ShopCustomer[] = [];
  for (const customer of nextState.customers) {
    const nextTimer = customer.ticksRemaining - 1;
    if (nextTimer > 0) {
      remainingCustomers.push({ ...customer, ticksRemaining: nextTimer });
      continue;
    }

    const penMon = nextState.pokemon.find(
      (mon) => mon.location === 'pen' && mon.penIndex === customer.targetPenIndex,
    );
    if (!penMon) {
      continue;
    }

    const markup = getEffectiveMarkup(nextState, customer.targetPenIndex);
    const recentSales = nextState.recentSpeciesSales[penMon.speciesId] ?? 0;
    const valuation = calculatePokemonValuation(
      penMon,
      trend,
      customer.archetypeId,
      recentSales,
      markup,
    );
    const buyChance = calculateBuyProbability(
      customer.archetypeId,
      markup,
      valuation.breakdown.archetypeMatched,
      valuation.breakdown.trendMatched,
    );

    if (rng() <= buyChance) {
      const ballBonus = resolveCheckoutGiftBall(nextState.activeGiftBall, nextState.inventory);
      const decorTip = nextState.upgrades['cafe-decor'] * 35;
      const totalTip = ballBonus.tipBonus + decorTip;
      const totalEarned = valuation.askingPrice + totalTip;
      const xpGain = (penMon.isShiny ? 45 : 18) + ballBonus.xpBonus;

      // Consume specialty gift-wrap ball if used
      if (ballBonus.consumed) {
        const remainingBalls = (nextState.inventory[ballBonus.ballUsed] ?? 1) - 1;
        const nextInv = { ...nextState.inventory };
        if (remainingBalls <= 0) {
          delete nextInv[ballBonus.ballUsed];
          nextState.activeGiftBall = 'poke-ball';
        } else {
          nextInv[ballBonus.ballUsed] = remainingBalls;
        }
        nextState.inventory = nextInv;
      }

      const spName = getSpecies(penMon.speciesId).name;
      nextState.pokemon = nextState.pokemon.filter((mon) => mon.uid !== penMon.uid);
      nextState.cash += totalEarned;
      nextState.cozyXp += xpGain;
      nextState.recentSpeciesSales = {
        ...nextState.recentSpeciesSales,
        [penMon.speciesId]: recentSales + 1,
      };
      nextState.dex = recordDexDiscovery(nextState.dex, penMon.speciesId, {
        isShiny: penMon.isShiny,
        event: 'adopted',
      });
      nextState.shiftStats = {
        ...nextState.shiftStats,
        revenue: nextState.shiftStats.revenue + valuation.askingPrice,
        tipsEarned: nextState.shiftStats.tipsEarned + totalTip,
        adoptionsCount: nextState.shiftStats.adoptionsCount + 1,
        cozyXpEarned: nextState.shiftStats.cozyXpEarned + xpGain,
      };

      const cue: SfxCue = penMon.isShiny ? 'shiny' : 'sale';
      sfxCues.push(cue);
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${customer.name} (${CUSTOMER_ARCHETYPES[customer.archetypeId].badgeLabel}) adopted ${penMon.isShiny ? '✨ Shiny ' : ''}${spName} for ₽${valuation.askingPrice.toLocaleString()}${totalTip > 0 ? ` (+₽${totalTip} tip)` : ''}!`,
        penMon.isShiny ? 'shiny' : 'sale',
        `sale-${nextState.shiftTick}-${customer.uid}`,
      );
    } else {
      // Polite, stress-free browse exit without any penalty.
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${customer.name} smiled at ${getSpecies(penMon.speciesId).name} and waved goodbye.`,
        'info',
        `browse-${nextState.shiftTick}-${customer.uid}`,
      );
    }
  }
  nextState.customers = remainingCustomers;

  // 4. Spawn a gentle new shopper if pens have adoptables and room exists
  const maxShoppers = 2 + Math.min(2, nextState.upgrades['cafe-decor']);
  const spawnInterval = Math.max(2, 4 - Math.floor(nextState.upgrades['cafe-decor'] / 2));
  const stockedPens = nextState.pokemon.filter((p) => p.location === 'pen' && p.penIndex !== null);

  if (
    stockedPens.length > 0 &&
    nextState.customers.length < maxShoppers &&
    nextState.shiftTick % spawnInterval === 1
  ) {
    const targetMon = pickRandom(stockedPens, rng);
    const archetypeRoll = rng();
    const archetypeId: CustomerArchetypeId =
      archetypeRoll < 0.34
        ? 'cozy-collector'
        : archetypeRoll < 0.66
          ? 'bargain-browser'
          : archetypeRoll < 0.9
            ? 'trend-fan'
            : 'shiny-seeker';

    const firstName = pickRandom(CUSTOMER_FIRST_NAMES[archetypeId], rng);
    const spName = getSpecies(targetMon.speciesId).name;
    const newCustomer: ShopCustomer = {
      uid: `cust-${nextState.shiftNumber}-${nextState.shiftTick}-${randomInt(10, 99, rng)}`,
      archetypeId,
      name: firstName,
      targetPenIndex: targetMon.penIndex as number,
      statusText: `Admiring ${spName}...`,
      ticksRemaining: randomInt(3, 5, rng),
    };
    nextState.customers = [...nextState.customers, newCustomer];
  }

  // 5. Auto-close shift peacefully at closing time
  if (nextState.shiftTick >= nextState.shiftDurationTicks) {
    nextState.shiftRunning = false;
    nextState.customers = [];
    nextState.lastShiftSummary = buildShiftSummary(nextState, false);
  }

  return { state: nextState, sfxCues };
}
