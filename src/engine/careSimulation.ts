/**
 * Care, Pen/Kennel Transfers, Resting/Healing, Breeding, Item Usage, Stocking & Upgrades
 * subsystem for PokéMart: Low Cortisol Shift.
 *
 * Cleanly isolated so upcoming Resting Pen mechanics (fatigue, rehab, bond recovery)
 * plug directly into `movePokemonLocation` and `stepCareAndBreedingTick`.
 */
import { getDifficultyConfig } from '../data/difficulties';
import { getItemDefinition } from '../data/items';
import { DEFAULT_CLERK_ID, pickRandomAdditionalClerk } from '../data/npcs';
import { getSpecies } from '../data/species';
import { UPGRADES_BY_ID, getUpgradeCost } from '../data/upgrades';
import type {
  ActivityEntry,
  GameState,
  ItemSlug,
  PokemonInstance,
  ShopUpgradeId,
} from '../data/types';
import {
  advanceEggsTick,
  areCompatibleParents,
  createEggFromParents,
  findOpenPenIndex,
  hatchEggToPokemon,
} from './breeding';
import { recordDexDiscovery } from './dex';
import {
  advanceHealingTick,
  getIncubatorCapacity,
  getNapBedCapacity,
  getPenCapacity,
} from './healing';
import { applyItemToPokemon, canUseItemOnPokemon } from './items';
import type { RngFn } from './rng';
import { appendLog, nextRng, type ActionResult, type SfxCue } from './simulationHelpers';

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

/** Purchases one level of a persistent shop expansion upgrade (or hires a random counter clerk). */
export function purchaseUpgradeAction(
  state: GameState,
  upgradeId: ShopUpgradeId,
  providedRng?: RngFn,
): ActionResult {
  const def = UPGRADES_BY_ID[upgradeId];
  const level = state.upgrades[upgradeId] ?? 0;
  if (level >= def.maxLevel) {
    return { state, ok: false, message: `${def.name} is already at max level!` };
  }
  const cost = getUpgradeCost(upgradeId, level);
  if (state.cash < cost) {
    return { state, ok: false, message: `Need ₽${cost.toLocaleString()} for ${def.name}.` };
  }

  let nextShopkeepers = state.shopkeepers ?? [DEFAULT_CLERK_ID];
  let nextSeed = state.seedCounter + 1;
  let logText = `Upgraded ${def.name} to Lv.${level + 1}!`;
  let toastMessage = `${def.name} upgraded to Lv.${level + 1}!`;

  if (upgradeId === 'hire-clerk') {
    const rolled = nextRng(state, providedRng);
    nextSeed = rolled.nextSeed;
    const hired = pickRandomAdditionalClerk(nextShopkeepers, rolled.rng);
    nextShopkeepers = [...nextShopkeepers, hired.id];
    logText = `Hired ${hired.name} (${hired.role}) behind the counter — shoppers now stay patient longer!`;
    toastMessage = `Hired ${hired.name} to help at the counter!`;
  }

  return {
    state: {
      ...state,
      cash: state.cash - cost,
      shopkeepers: nextShopkeepers,
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
        logText,
        'info',
        `upg-${nextSeed}`,
      ),
      seedCounter: nextSeed,
      updatedAt: Date.now(),
    },
    ok: true,
    message: toastMessage,
    sfx: 'click',
  };
}

/**
 * Advances resting/healing nap beds and incubating eggs for a single `open` tick.
 * Designed as the single hook where future Resting Pen recovery ticks attach cleanly.
 */
export function stepCareAndBreedingTick(nextState: GameState, sfxCues: SfxCue[]): GameState {
  const penCap = getPenCapacity(nextState.upgrades);

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

  return nextState;
}
