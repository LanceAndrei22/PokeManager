/**
 * Shift Lifecycle, Rent/Upkeep Settlement, Emergency Liquidation, Debt Grace,
 * Bankruptcy & Next-Shift Rollover subsystem for PokéMart: Low Cortisol Shift.
 */
import { getSpecies } from '../data/species';
import { MARKET_TRENDS, getMarketTrend } from '../data/trends';
import type { GameState, ShiftSettlement } from '../data/types';
import { generateWholesaleCatalog } from './catalog';
import { getDexSummary, getShopRankInfo } from './dex';
import { calculateShiftDues, getLiquidationValue } from './economy';
import { pickRandom, type RngFn } from './rng';
import { appendLog, nextRng, type ActionResult } from './simulationHelpers';

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
      : 'The Shop is Closed',
    sfx: nextRunning ? 'bell' : 'click',
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

/** Transitions an active shift into either `settlement-debt` (if cash < dues) or `summary`. */
export function resolveShiftEnd(state: GameState, closedEarly: boolean): GameState {
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
