/**
 * Shopper & Counter Negotiation subsystem for PokéMart: Low Cortisol Shift.
 *
 * Responsibilities:
 * - Spawning Human Trainer shoppers with archetype weighting (~40% Normal Shopper, ~60%
 *   specialists + VIP Collectors when Legendaries/Mythicals are on display),
 * - Resolving pen browsing into counter-queue offers (zero automatic sales; Normal Shoppers
 *   never bid on Legendaries/Mythicals),
 * - Multi-clerk live-clock patience scaling and walk-out resolution,
 * - Counter checkout actions (`Accept`, `+15%`/`+30%` live haggling, `Decline`).
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getDifficultyConfig } from '../data/difficulties';
import { pickShopperNpc } from '../data/npcs';
import { getSpecies } from '../data/species';
import { getMarketTrend } from '../data/trends';
import type {
  CounterOffer,
  CustomerArchetypeId,
  GameState,
  ShopCustomer,
} from '../data/types';
import { recordDexDiscovery } from './dex';
import {
  calculateBuyProbability,
  calculatePokemonValuation,
  evaluateHaggleAttempt,
  getEffectiveMarkup,
  resolveCheckoutGiftBall,
} from './economy';
import { pickRandom, randomInt, type RngFn } from './rng';
import { appendLog, nextRng, type ActionResult, type SfxCue } from './simulationHelpers';

/**
 * Accepts a queued customer's offer at the Human Clerk counter, completes checkout with
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

/** Politely declines a queued shopper at the Human Clerk counter without XP penalty. */
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
 * Advances live-clock shopper simulation for a single `open` tick:
 * 1. Ticks down patience meters for queued counter offers (scaled by hired clerks),
 * 2. Moves finished pen browsers into `counterQueue` (zero automatic sales),
 * 3. Spawns new Human Trainer shoppers weighted across Normal & Specialist archetypes.
 */
export function stepShopperTick(
  nextState: GameState,
  sfxCues: SfxCue[],
  rng: RngFn,
): GameState {
  const diff = getDifficultyConfig(nextState.difficulty);
  const trend = getMarketTrend(nextState.activeTrendId);

  // 1. Live-clock Patience countdown for shoppers queued at the PokéMart counter.
  // Extra hired shopkeepers slow how quickly queued shoppers expire before walking out:
  // 0 extra clerks = decays every tick; 1 extra clerk = skips every 3rd tick (~33% slower);
  // 2+ extra clerks = skips every 2nd tick (50% slower).
  const extraClerks = Math.max(
    0,
    (nextState.shopkeepers?.length ?? 1) - 1,
    nextState.upgrades['hire-clerk'] ?? 0,
  );
  const shouldDecayPatience =
    extraClerks <= 0
      ? true
      : extraClerks === 1
        ? nextState.shiftTick % 3 !== 0
        : nextState.shiftTick % 2 !== 0;

  const activeQueue: CounterOffer[] = [];
  for (const offer of nextState.counterQueue) {
    // Only keep queue offers whose Pokémon is still on display
    const stillOwned = nextState.pokemon.some((m) => m.uid === offer.pokemonUid);
    if (!stillOwned) continue;

    if (!shouldDecayPatience) {
      activeQueue.push(offer);
      continue;
    }

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

  // 2. Resolve pen browsers -> queue at the Human Clerk counter (ZERO auto-sales!)
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
      const clerkBonus = extraClerks * 5;
      const maxPatience = Math.max(
        6,
        Math.round(arch.basePatience * diff.patienceMultiplier) + clerkBonus,
      );

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

  // 3. Spawn new Human Trainer shoppers (~40% Normal Shopper + ~60% Specialists)
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

  return nextState;
}
