/**
 * Pure v2 tycoon simulation engine for PokéMart: Low Cortisol Shift.
 * Implements timed shifts (`prep -> open -> settlement-debt -> summary / bankrupt`),
 * live-clock counter haggling with patience decay (zero automatic sales), 3 difficulty
 * modes, daily rent & upkeep, Emergency Liquidation, Debt Grace, Bankruptcy,
 * 493-species evolution/breeding, and VIP Legendary Contracts.
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getDifficultyConfig } from '../data/difficulties';
import { getItemDefinition } from '../data/items';
import { pickShopperNpc } from '../data/npcs';
import { getSpecies } from '../data/species';
import { MARKET_TRENDS, getMarketTrend } from '../data/trends';
import { UPGRADES_BY_ID, getUpgradeCost } from '../data/upgrades';
import {
  STARTER_MASCOT_IDS,
  type ActivityEntry,
  type CounterOffer,
  type CustomerArchetypeId,
  type DifficultyId,
  type GameState,
  type GiftBallSlug,
  type ItemSlug,
  type PokemonInstance,
  type ShiftSettlement,
  type ShopCustomer,
  type ShopUpgradeId,
} from '../data/types';
import {
  advanceEggsTick,
  areCompatibleParents,
  createEggFromParents,
  findOpenPenIndex,
  hatchEggToPokemon,
} from './breeding';
import { generateWholesaleCatalog } from './catalog';
import { getDexSummary, getShopRankInfo, recordDexDiscovery } from './dex';
import {
  calculateBuyProbability,
  calculatePokemonValuation,
  calculateShiftDues,
  evaluateHaggleAttempt,
  getEffectiveMarkup,
  getLiquidationValue,
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

export type SfxCue =
  | 'bell'
  | 'sale'
  | 'evolve'
  | 'hatch'
  | 'heal'
  | 'click'
  | 'shiny'
  | 'walkout';

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
  return [entry, ...log].slice(0, 32);
}

function nextRng(state: GameState, providedRng?: RngFn): { rng: RngFn; nextSeed: number } {
  const nextSeed = (state.seedCounter + 1) >>> 0;
  return {
    rng: providedRng ?? createSeededRng(0x504f4b45 ^ nextSeed ^ (state.shiftNumber * 997)),
    nextSeed,
  };
}

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
): GameState {
  const diff = getDifficultyConfig(difficulty);
  const rng = createSeededRng(seed);
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

/** Toggles between Open Shop (`open`) and Paused (`prep`), blocked during settlement or bankruptcy. */
export function toggleShiftRunning(state: GameState): ActionResult {
  if (state.isBankrupt || state.shiftPhase === 'bankrupt') {
    return { state, ok: false, message: 'This shop is bankrupt. Reset or start a new profile.' };
  }
  if (state.shiftPhase === 'settlement-debt' || state.shiftPhase === 'summary') {
    return {
      state,
      ok: false,
      message: 'Finish shift settlement before reopening the shop.',
    };
  }
  const nextRunning = !state.shiftRunning;
  return {
    state: {
      ...state,
      shiftRunning: nextRunning,
      shiftPhase: nextRunning ? 'open' : 'prep',
      updatedAt: Date.now(),
    },
    ok: true,
    message: nextRunning
      ? 'Shop doors opened! Human trainers will browse pens and queue at the PokéMart counter.'
      : 'Shop paused cleanly.',
    sfx: nextRunning ? 'bell' : 'click',
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

/** Selects the active gift-wrap Poké Ball used when accepting offers at Kecleon's counter. */
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

/** Promotes any owned Pokémon to be the featured Store Mascot on the Main Menu spotlight. */
export function setShopMascotAction(state: GameState, pokemonUid: string): ActionResult {
  const target = state.pokemon.find((mon) => mon.uid === pokemonUid);
  if (!target) {
    return { state, ok: false, message: 'Pokémon not found in your shop.' };
  }
  const species = getSpecies(target.speciesId);
  return {
    state: {
      ...state,
      mascotUid: pokemonUid,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${target.isShiny ? '✨ Shiny ' : ''}${species.name} is now your Store Mascot!`,
    sfx: 'click',
  };
}

/** Purchases an offer from Wholesale, Rescue, Mystery Eggs, or VIP Legendary Contracts. */
export function buyWholesaleOffer(state: GameState, offerUid: string): ActionResult {
  if (state.isBankrupt) {
    return { state, ok: false, message: 'Cannot purchase stock while bankrupt.' };
  }
  const offer = state.wholesaleCatalog.find((o) => o.uid === offerUid);
  if (!offer) return { state, ok: false, message: 'Wholesale offer no longer exists.' };
  if (offer.purchased) return { state, ok: false, message: 'Already adopted from today’s shipment.' };
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
      parentNames: ['Mystery Courier', 'Wigglytuff Guild'] as [string, string],
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
        shiftStats: { ...state.shiftStats, expenses: state.shiftStats.expenses + offer.cost },
        activityLog: appendLog(
          state.activityLog,
          state.shiftNumber,
          `Adopted a Mystery Egg into the warm incubator (₽${offer.cost.toLocaleString()}).`,
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

  const penCap = getPenCapacity(state.upgrades);
  const bedCap = getNapBedCapacity(state.upgrades);
  const currentHealingCount = state.pokemon.filter((p) => p.location === 'healing').length;
  const needsRecovery = offer.kind === 'stray';

  let location: PokemonInstance['location'] = 'reserve';
  let penIndex: number | null = null;
  if (needsRecovery) {
    if (currentHealingCount >= bedCap) {
      return { state, ok: false, message: `All ${bedCap} plush nap bed(s) are occupied right now.` };
    }
    location = 'healing';
  } else {
    const openPen = findOpenPenIndex(state.pokemon, penCap);
    if (openPen !== null) {
      location = 'pen';
      penIndex = openPen;
    }
  }

  const origin: PokemonInstance['origin'] =
    offer.kind === 'vip-contract' ? 'vip-contract' : needsRecovery ? 'rescue' : 'wholesale';

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
    origin,
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
      shiftStats: { ...state.shiftStats, expenses: state.shiftStats.expenses + offer.cost },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${offer.kind === 'vip-contract' ? '👑 VIP Contract: ' : ''}${newMon.isShiny ? '✨ Shiny ' : ''}${species.name} placed ${placementNote} (₽${offer.cost.toLocaleString()}).`,
        newMon.isShiny || offer.kind === 'vip-contract' ? 'shiny' : needsRecovery ? 'heal' : 'info',
        `buy-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `${species.name} welcomed ${placementNote}!`,
    sfx: newMon.isShiny || offer.kind === 'vip-contract' ? 'shiny' : 'click',
  };
}

/** Purchases shop items from the Supply Shelf into the Item Bag. */
export function buySupplyItem(state: GameState, itemSlug: ItemSlug, quantity = 1): ActionResult {
  const item = getItemDefinition(itemSlug);
  const totalCost = item.cost * quantity;
  if (totalCost <= 0) return { state, ok: false, message: `${item.name} is always complimentary.` };
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
      shiftStats: { ...state.shiftStats, expenses: state.shiftStats.expenses + totalCost },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Stocked ${quantity}× ${item.name} (₽${totalCost.toLocaleString()}).`,
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
  if (!mon) return { state, ok: false, message: 'Pokémon not found.' };
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
      targetPenIndex !== undefined ? targetPenIndex : findOpenPenIndex(state.pokemon, penCap);
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

/** Consumes one item from the bag to evolve (Stone or Rare Candy), heal, or boost a Pokémon. */
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
  if (!targetMon) return { state, ok: false, message: 'Pokémon not found.' };

  const check = canUseItemOnPokemon(targetMon, itemSlug);
  if (!check.ok) {
    return { state, ok: false, message: check.reason ?? 'Item cannot be used here.' };
  }

  const outcome = applyItemToPokemon(targetMon, itemSlug);
  const penCap = getPenCapacity(state.upgrades);
  let nextPokemonList = state.pokemon.map((p) =>
    p.uid === pokemonUid ? outcome.updatedPokemon : p,
  );

  if (outcome.fullyHealed) {
    const openPen = findOpenPenIndex(nextPokemonList, penCap);
    nextPokemonList = nextPokemonList.map((p) =>
      p.uid === pokemonUid
        ? { ...p, location: openPen !== null ? 'pen' : 'reserve', penIndex: openPen }
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
  if (nextBagCount <= 0) delete nextInventory[itemSlug];
  else nextInventory[itemSlug] = nextBagCount;

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

/** Pairs two compatible Pokémon in a warm incubator. */
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
  if (!parentA || !parentB) return { state, ok: false, message: 'Select two valid parents.' };
  if (!areCompatibleParents(parentA, parentB)) {
    return {
      state,
      ok: false,
      message: 'Parents must be breedable, rested, and share an Egg Group (or Ditto).',
    };
  }

  const diff = getDifficultyConfig(state.difficulty);
  const { rng, nextSeed } = nextRng(state, providedRng);
  const egg = createEggFromParents(
    parentA,
    parentB,
    state.upgrades['mystery-shipment'],
    rng,
    `egg-${state.shiftNumber}-${nextSeed}`,
    diff.shinyBonus,
  );
  const babyName = getSpecies(egg.speciesId).name;

  return {
    state: {
      ...state,
      eggs: [...state.eggs, egg],
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${getSpecies(parentA.speciesId).name} & ${getSpecies(parentB.speciesId).name} tucked a ${babyName} Egg into the incubator!`,
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
  if (!egg) return { state, ok: false, message: 'Egg not found.' };
  if (!egg.readyToHatch) return { state, ok: false, message: 'Egg is still warming up!' };

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
      upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
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

/**
 * Accepts a queued customer's offer at Kecleon's counter, completes checkout with
 * optional Gift-Wrap Ball tips, awards Shop XP, and updates lifetime tycoon stats.
 */
export function acceptCounterOfferAction(state: GameState, offerUid: string): ActionResult {
  const offer = state.counterQueue.find((q) => q.uid === offerUid);
  if (!offer) return { state, ok: false, message: 'Customer is no longer at the counter.' };

  const targetMon = state.pokemon.find((mon) => mon.uid === offer.pokemonUid);
  if (!targetMon) {
    return {
      state: { ...state, counterQueue: state.counterQueue.filter((q) => q.uid !== offerUid) },
      ok: false,
      message: 'That Pokémon is no longer available.',
    };
  }

  const ballBonus = resolveCheckoutGiftBall(state.activeGiftBall, state.inventory);
  const decorTip = state.upgrades['cafe-decor'] * 35;
  const totalTip = ballBonus.tipBonus + decorTip;
  const totalEarned = offer.currentOffer + totalTip;
  const xpGain =
    (targetMon.isShiny ? 45 : offer.isVip ? 55 : 20) + ballBonus.xpBonus;

  const nextInv = { ...state.inventory };
  let nextActiveBall = state.activeGiftBall;
  if (ballBonus.consumed) {
    const remainingBalls = (nextInv[ballBonus.ballUsed] ?? 1) - 1;
    if (remainingBalls <= 0) {
      delete nextInv[ballBonus.ballUsed];
      nextActiveBall = 'poke-ball';
    } else {
      nextInv[ballBonus.ballUsed] = remainingBalls;
    }
  }

  const spName = getSpecies(targetMon.speciesId).name;
  const recentSales = state.recentSpeciesSales[targetMon.speciesId] ?? 0;
  const remainingPokemon = state.pokemon.filter((mon) => mon.uid !== targetMon.uid);
  const nextMascotUid =
    state.mascotUid === targetMon.uid ? remainingPokemon[0]?.uid : state.mascotUid;

  return {
    state: {
      ...state,
      cash: state.cash + totalEarned,
      cozyXp: state.cozyXp + xpGain,
      inventory: nextInv,
      activeGiftBall: nextActiveBall,
      mascotUid: nextMascotUid,
      pokemon: remainingPokemon,
      counterQueue: state.counterQueue.filter(
        (q) => q.uid !== offerUid && q.pokemonUid !== targetMon.uid,
      ),
      recentSpeciesSales: { ...state.recentSpeciesSales, [targetMon.speciesId]: recentSales + 1 },
      dex: recordDexDiscovery(state.dex, targetMon.speciesId, {
        isShiny: targetMon.isShiny,
        event: 'adopted',
      }),
      shiftStats: {
        ...state.shiftStats,
        revenue: state.shiftStats.revenue + offer.currentOffer,
        tipsEarned: state.shiftStats.tipsEarned + totalTip,
        adoptionsCount: state.shiftStats.adoptionsCount + 1,
        cozyXpEarned: state.shiftStats.cozyXpEarned + xpGain,
      },
      lifetimeStats: {
        totalRevenue: state.lifetimeStats.totalRevenue + totalEarned,
        totalAdoptions: state.lifetimeStats.totalAdoptions + 1,
        highestSale: Math.max(state.lifetimeStats.highestSale, totalEarned),
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `${offer.customerName} (${CUSTOMER_ARCHETYPES[offer.archetypeId].badgeLabel}) adopted ${targetMon.isShiny ? '✨ Shiny ' : ''}${spName} for ₽${offer.currentOffer.toLocaleString()}${totalTip > 0 ? ` (+₽${totalTip} tip)` : ''}!`,
        targetMon.isShiny || offer.isVip ? 'shiny' : 'sale',
        `sale-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Sold ${spName} for ₽${totalEarned.toLocaleString()}!`,
    sfx: targetMon.isShiny || offer.isVip ? 'shiny' : 'sale',
  };
}

/**
 * Push-your-luck counter negotiation (`+15%` or `+30%`, max 2 attempts per shopper).
 * On success, raises `currentOffer`; on critical fail or 0 patience, triggers walk-out!
 */
export function haggleCounterOfferAction(
  state: GameState,
  offerUid: string,
  boostPct: 15 | 30,
  providedRng?: RngFn,
): ActionResult {
  const offer = state.counterQueue.find((q) => q.uid === offerUid);
  if (!offer) return { state, ok: false, message: 'Customer is no longer at the counter.' };
  if (offer.haggleAttempts >= offer.maxHaggleAttempts) {
    return {
      state,
      ok: false,
      message: `${offer.customerName} already reached max counter haggles (2/2).`,
    };
  }

  const diff = getDifficultyConfig(state.difficulty);
  const { rng, nextSeed } = nextRng(state, providedRng);
  const outcome = evaluateHaggleAttempt(offer, boostPct, state.difficulty, rng);

  if (outcome.walkedOut) {
    const nextXp = Math.max(0, state.cozyXp - diff.walkoutXpPenalty);
    return {
      state: {
        ...state,
        cozyXp: nextXp,
        counterQueue: state.counterQueue.filter((q) => q.uid !== offerUid),
        shiftStats: {
          ...state.shiftStats,
          walkoutsCount: state.shiftStats.walkoutsCount + 1,
          cozyXpEarned: state.shiftStats.cozyXpEarned - diff.walkoutXpPenalty,
        },
        activityLog: appendLog(
          state.activityLog,
          state.shiftNumber,
          `${outcome.note}${diff.walkoutXpPenalty > 0 ? ` (-${diff.walkoutXpPenalty} XP)` : ''}`,
          'warning',
          `haggle-fail-${nextSeed}`,
        ),
        seedCounter: nextSeed,
        updatedAt: Date.now(),
      },
      ok: false,
      message: outcome.note,
      sfx: 'walkout',
    };
  }

  const updatedQueue = state.counterQueue.map((q) =>
    q.uid === offerUid
      ? {
          ...q,
          currentOffer: outcome.newOffer,
          patience: outcome.newPatience,
          haggleAttempts: q.haggleAttempts + 1,
          lastActionNote: outcome.note,
        }
      : q,
  );

  return {
    state: {
      ...state,
      counterQueue: updatedQueue,
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        outcome.note,
        outcome.accepted ? 'sale' : 'warning',
        `haggle-${nextSeed}`,
      ),
      seedCounter: nextSeed,
      updatedAt: Date.now(),
    },
    ok: outcome.accepted,
    message: outcome.note,
    sfx: outcome.accepted ? 'click' : 'walkout',
  };
}

/** Politely declines a queued shopper at Kecleon's counter without XP penalty. */
export function declineCounterOfferAction(state: GameState, offerUid: string): ActionResult {
  const offer = state.counterQueue.find((q) => q.uid === offerUid);
  if (!offer) return { state, ok: false, message: 'Customer already left.' };
  return {
    state: {
      ...state,
      counterQueue: state.counterQueue.filter((q) => q.uid !== offerUid),
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Politely declined ${offer.customerName}'s offer at the register.`,
        'info',
        `decline-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Declined ${offer.customerName}'s offer.`,
    sfx: 'click',
  };
}

/**
 * Emergency Liquidation: sells an owned Reserve/Display Pen Pokémon back to Wholesale
 * for 50% of base market value—usable anytime including during `settlement-debt`.
 */
export function liquidatePokemonAction(state: GameState, pokemonUid: string): ActionResult {
  if (state.isBankrupt) {
    return { state, ok: false, message: 'Cannot liquidate after bankruptcy.' };
  }
  const target = state.pokemon.find((mon) => mon.uid === pokemonUid);
  if (!target) return { state, ok: false, message: 'Pokémon not found.' };
  if (target.location === 'breeding') {
    return { state, ok: false, message: 'Finish breeding incubation before liquidating.' };
  }

  const payout = getLiquidationValue(target);
  const spName = getSpecies(target.speciesId).name;
  const nextCash = state.cash + payout;
  const remainingPokemon = state.pokemon.filter((p) => p.uid !== pokemonUid);
  const nextMascotUid =
    state.mascotUid === pokemonUid ? remainingPokemon[0]?.uid : state.mascotUid;

  const updatedPending: ShiftSettlement | null = state.pendingSettlement
    ? {
        ...state.pendingSettlement,
        revenue: state.pendingSettlement.revenue + payout,
        netBeforeDues: state.pendingSettlement.netBeforeDues + payout,
        cashAfterDues: nextCash - state.pendingSettlement.totalDues,
      }
    : null;

  return {
    state: {
      ...state,
      cash: nextCash,
      mascotUid: nextMascotUid,
      pokemon: remainingPokemon,
      counterQueue: state.counterQueue.filter((q) => q.pokemonUid !== pokemonUid),
      pendingSettlement: updatedPending,
      shiftStats: {
        ...state.shiftStats,
        revenue: state.shiftStats.revenue + payout,
      },
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Emergency liquidation: returned ${spName} to Wholesale for ₽${payout.toLocaleString()}.`,
        'warning',
        `liq-${state.seedCounter + 1}`,
      ),
      seedCounter: state.seedCounter + 1,
      updatedAt: Date.now(),
    },
    ok: true,
    message: `Liquidated ${spName} for ₽${payout.toLocaleString()}!`,
    sfx: 'sale',
  };
}

function buildPendingSettlement(state: GameState, closedEarly: boolean): ShiftSettlement {
  const trend = getMarketTrend(state.activeTrendId);
  const dues = calculateShiftDues(state);
  const netBeforeDues =
    state.shiftStats.revenue + state.shiftStats.tipsEarned - state.shiftStats.expenses;
  const cashAfterDues = state.cash - dues.totalDues;

  return {
    shiftNumber: state.shiftNumber,
    revenue: state.shiftStats.revenue,
    expenses: state.shiftStats.expenses,
    tipsEarned: state.shiftStats.tipsEarned,
    dailyRent: dues.dailyRent,
    penUpkeep: dues.penUpkeep,
    bedUpkeep: dues.bedUpkeep,
    totalDues: dues.totalDues,
    netBeforeDues,
    cashAfterDues,
    adoptionsCount: state.shiftStats.adoptionsCount,
    walkoutsCount: state.shiftStats.walkoutsCount,
    eggsHatched: state.shiftStats.eggsHatched,
    straysHealed: state.shiftStats.straysHealed,
    cozyXpEarned: state.shiftStats.cozyXpEarned,
    trendTitle: trend.title,
    closedEarly,
    usedDebtGrace: false,
    debtGraceRemaining: state.debtGraceDaysRemaining,
  };
}

function resolveShiftEnd(state: GameState, closedEarly: boolean): GameState {
  if (state.isBankrupt || state.shiftPhase === 'summary' || state.shiftPhase === 'settlement-debt') {
    return state;
  }

  const settlement = buildPendingSettlement(state, closedEarly);
  if (settlement.cashAfterDues < 0) {
    // Pause in `settlement-debt` so player can liquidate stock before rent hits!
    return {
      ...state,
      shiftRunning: false,
      shiftPhase: 'settlement-debt',
      customers: [],
      counterQueue: [],
      pendingSettlement: settlement,
      updatedAt: Date.now(),
    };
  }

  return {
    ...state,
    cash: settlement.cashAfterDues,
    shiftRunning: false,
    shiftPhase: 'summary',
    customers: [],
    counterQueue: [],
    pendingSettlement: null,
    lastShiftSummary: settlement,
    updatedAt: Date.now(),
  };
}

/** Gently closes the current shift early for Shift Settlement & Rent. */
export function closeShiftEarly(state: GameState): GameState {
  return resolveShiftEnd(state, true);
}

/**
 * Confirms shift-end rent payment from `settlement-debt` (after any Emergency Liquidation):
 * - Covered (`cashAfterDues >= 0`): transitions cleanly to `summary`.
 * - Short (`cashAfterDues < 0`) with `debtGraceDaysRemaining > 0`: uses 1 Debt Grace shift.
 * - Short (`cashAfterDues < 0`) with 0 Debt Grace: triggers **Bankruptcy** (`isBankrupt = true`).
 */
export function finalizeDebtSettlement(state: GameState): GameState {
  if (state.shiftPhase !== 'settlement-debt' || !state.pendingSettlement) {
    return state;
  }

  const settlement = state.pendingSettlement;
  const cashAfterDues = state.cash - settlement.totalDues;

  if (cashAfterDues >= 0) {
    const finalized: ShiftSettlement = {
      ...settlement,
      cashAfterDues,
      usedDebtGrace: false,
      debtGraceRemaining: state.debtGraceDaysRemaining,
    };
    return {
      ...state,
      cash: cashAfterDues,
      shiftPhase: 'summary',
      pendingSettlement: null,
      lastShiftSummary: finalized,
      updatedAt: Date.now(),
    };
  }

  if (state.debtGraceDaysRemaining > 0) {
    const remainingGrace = state.debtGraceDaysRemaining - 1;
    const graceSummary: ShiftSettlement = {
      ...settlement,
      cashAfterDues,
      usedDebtGrace: true,
      debtGraceRemaining: remainingGrace,
    };
    return {
      ...state,
      cash: cashAfterDues,
      debtGraceDaysRemaining: remainingGrace,
      shiftPhase: 'summary',
      pendingSettlement: null,
      lastShiftSummary: graceSummary,
      activityLog: appendLog(
        state.activityLog,
        state.shiftNumber,
        `Debt Grace invoked! End next shift ≥ ₽0 to avoid foreclosure.`,
        'warning',
        `grace-${state.shiftNumber}`,
      ),
      updatedAt: Date.now(),
    };
  }

  // Foreclosure / Bankruptcy!
  const dexSummary = getDexSummary(state.dex);
  return {
    ...state,
    cash: cashAfterDues,
    isBankrupt: true,
    shiftPhase: 'bankrupt',
    shiftRunning: false,
    pendingSettlement: null,
    lastShiftSummary: null,
    bankruptcySummary: {
      shiftNumber: state.shiftNumber,
      totalRevenue: state.lifetimeStats.totalRevenue,
      totalAdoptions: state.lifetimeStats.totalAdoptions,
      highestSale: state.lifetimeStats.highestSale,
      dexDiscovered: dexSummary.discoveredSpecies,
      difficulty: state.difficulty,
    },
    updatedAt: Date.now(),
  };
}

/** Transitions from Shift Summary into the next shift's Prep phase. */
export function startNextShift(state: GameState, providedRng?: RngFn): GameState {
  if (state.isBankrupt || state.shiftPhase === 'settlement-debt') {
    return state;
  }
  const { rng, nextSeed } = nextRng(state, providedRng);
  const nextShiftNumber = state.shiftNumber + 1;
  const rankInfo = getShopRankInfo(state.cozyXp);

  const decayedSales: Record<number, number> = {};
  for (const [spId, count] of Object.entries(state.recentSpeciesSales)) {
    if (count > 1) decayedSales[Number(spId)] = count - 1;
  }

  const nextTrend = pickRandom(MARKET_TRENDS, rng);
  const nextCatalog = generateWholesaleCatalog(
    rankInfo.rank,
    state.upgrades['mystery-shipment'],
    nextShiftNumber,
    rng,
    state.difficulty,
  );

  return {
    ...state,
    shiftNumber: nextShiftNumber,
    shiftTick: 0,
    shiftPhase: 'prep',
    shiftRunning: false,
    activeTrendId: nextTrend.id,
    wholesaleCatalog: nextCatalog,
    customers: [],
    counterQueue: [],
    pendingSettlement: null,
    lastShiftSummary: null,
    recentSpeciesSales: decayedSales,
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
 * Advances the live-tick tycoon simulation by one tick (`open` phase):
 * 1. Advances napping strays and incubating eggs
 * 2. Ticks down live Patience meters for every customer queued at Kecleon's counter
 * 3. Moves finished browsers from display pens into `counterQueue` (NO auto-selling!)
 * 4. Spawns new PMD Pokémon shoppers with archetype-matched species
 * 5. Triggers `resolveShiftEnd` on closing time
 */
export function advanceShiftTick(state: GameState, providedRng?: RngFn): TickResult {
  if (!state.shiftRunning || state.isBankrupt || state.shiftPhase !== 'open') {
    return { state, sfxCues: [] };
  }

  const diff = getDifficultyConfig(state.difficulty);
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

  // 3. Live-clock Patience countdown for shoppers queued at Kecleon's counter
  const activeQueue: CounterOffer[] = [];
  for (const offer of nextState.counterQueue) {
    // Only keep queue offers whose Pokémon is still on display
    const stillOwned = nextState.pokemon.some((m) => m.uid === offer.pokemonUid);
    if (!stillOwned) continue;

    const nextPatience = offer.patience - 1;
    if (nextPatience <= 0) {
      sfxCues.push('walkout');
      nextState.cozyXp = Math.max(0, nextState.cozyXp - diff.walkoutXpPenalty);
      nextState.shiftStats = {
        ...nextState.shiftStats,
        walkoutsCount: nextState.shiftStats.walkoutsCount + 1,
        cozyXpEarned: nextState.shiftStats.cozyXpEarned - diff.walkoutXpPenalty,
      };
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${offer.customerName} ran out of patience at the register and walked out!${diff.walkoutXpPenalty > 0 ? ` (-${diff.walkoutXpPenalty} XP)` : ''}`,
        'warning',
        `walkout-${nextState.shiftTick}-${offer.uid}`,
      );
    } else {
      activeQueue.push({ ...offer, patience: nextPatience });
    }
  }
  nextState.counterQueue = activeQueue;

  // 4. Resolve pen browsers -> queue at Kecleon's counter (ZERO auto-sales!)
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
    if (!penMon) continue;

    // Avoid queuing two offers simultaneously for the same Pokémon
    const alreadyQueued = nextState.counterQueue.some((q) => q.pokemonUid === penMon.uid);
    if (alreadyQueued) continue;

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

    const species = getSpecies(penMon.speciesId);
    const isVipSpecies = species.isLegendary || species.isMythical;

    // Normal Shoppers provide everyday foot traffic on non-Legendary Pokémon, but
    // never make purchase offers on Legendaries or Mythicals (VIP Collectors only).
    if (customer.archetypeId === 'normal' && isVipSpecies) {
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${customer.name} marveled at ${species.name} — only VIP Collectors can adopt Legendaries!`,
        'info',
        `browse-vip-${nextState.shiftTick}-${customer.uid}`,
      );
      continue;
    }

    const isVip = isVipSpecies || customer.archetypeId === 'vip-seeker';

    if (rng() <= buyChance && nextState.counterQueue.length < 4) {
      const offerAmount = Math.round(
        valuation.askingPrice * (isVip ? diff.vipPayoutMultiplier : 1),
      );
      const arch = CUSTOMER_ARCHETYPES[customer.archetypeId];
      const maxPatience = Math.max(6, Math.round(arch.basePatience * diff.patienceMultiplier));

      const counterOffer: CounterOffer = {
        uid: `offer-${nextState.shiftNumber}-${nextState.shiftTick}-${customer.uid}`,
        customerUid: customer.uid,
        archetypeId: customer.archetypeId,
        npcId: customer.npcId,
        npcPortraitUrl: customer.npcPortraitUrl,
        customerName: customer.name,
        pokemonUid: penMon.uid,
        speciesId: penMon.speciesId,
        isShiny: penMon.isShiny,
        penIndex: customer.targetPenIndex,
        fairValue: valuation.fairValue,
        initialOffer: offerAmount,
        currentOffer: offerAmount,
        haggleAttempts: 0,
        maxHaggleAttempts: 2,
        patience: maxPatience,
        maxPatience,
        trendMatched: valuation.breakdown.trendMatched,
        archetypeMatched: valuation.breakdown.archetypeMatched,
        isVip,
      };

      nextState.counterQueue = [...nextState.counterQueue, counterOffer];
      sfxCues.push('bell');
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${customer.name} brought ${penMon.isShiny ? '✨ Shiny ' : ''}${species.name} to the PokéMart counter (Offering ₽${offerAmount.toLocaleString()}).`,
        isVip ? 'shiny' : 'info',
        `queue-${nextState.shiftTick}-${customer.uid}`,
      );
    } else {
      nextState.activityLog = appendLog(
        nextState.activityLog,
        nextState.shiftNumber,
        `${customer.name} smiled at ${species.name} and continued browsing.`,
        'info',
        `browse-${nextState.shiftTick}-${customer.uid}`,
      );
    }
  }
  nextState.customers = remainingCustomers;

  // 5. Spawn new Human Trainer shoppers (~40% Normal Shopper + ~60% Specialists)
  const maxShoppers = 2 + Math.min(2, nextState.upgrades['cafe-decor']);
  const spawnInterval = Math.max(2, 4 - Math.floor(nextState.upgrades['cafe-decor'] / 2));
  const stockedPens = nextState.pokemon.filter((p) => p.location === 'pen' && p.penIndex !== null);

  if (
    stockedPens.length > 0 &&
    nextState.customers.length < maxShoppers &&
    nextState.shiftTick % spawnInterval === 1
  ) {
    const targetMon = pickRandom(stockedPens, rng);
    const targetSpecies = getSpecies(targetMon.speciesId);
    const hasVipOnFloor = targetSpecies.isLegendary || targetSpecies.isMythical;

    const roll = rng();
    let archetypeId: CustomerArchetypeId;
    if (hasVipOnFloor && roll < 0.48) {
      archetypeId = 'vip-seeker';
    } else if (hasVipOnFloor) {
      archetypeId = roll < 0.72 ? 'normal' : roll < 0.86 ? 'cozy-collector' : 'trend-fan';
    } else if (roll < 0.4) {
      archetypeId = 'normal';
    } else if (roll < 0.56) {
      archetypeId = 'cozy-collector';
    } else if (roll < 0.72) {
      archetypeId = 'bargain-browser';
    } else if (roll < 0.86) {
      archetypeId = 'trend-fan';
    } else if (roll < 0.94) {
      archetypeId = 'shiny-seeker';
    } else {
      archetypeId = 'vip-seeker';
    }

    const npc = pickShopperNpc(archetypeId, rng);

    const newCustomer: ShopCustomer = {
      uid: `cust-${nextState.shiftNumber}-${nextState.shiftTick}-${randomInt(10, 99, rng)}`,
      archetypeId,
      npcId: npc.id,
      npcPortraitUrl: npc.portraitUrl,
      name: npc.name,
      targetPenIndex: targetMon.penIndex as number,
      statusText: `Admiring ${targetSpecies.name}...`,
      ticksRemaining: randomInt(2, 4, rng),
    };
    nextState.customers = [...nextState.customers, newCustomer];
  }

  // 6. Shift closing time -> Settlement & Rent
  if (nextState.shiftTick >= nextState.shiftDurationTicks) {
    nextState = resolveShiftEnd(nextState, false);
  }

  return { state: nextState, sfxCues };
}
