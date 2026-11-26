/**
 * Unit tests for v2 active tycoon mechanics: zero automatic sales, live-clock counter
 * haggling & patience walk-outs, 3 difficulties, rent/upkeep, Emergency Liquidation,
 * Debt Grace, Bankruptcy, and VIP Legendary Contracts.
 */
import { describe, expect, it } from 'vitest';
import { getDifficultyConfig } from '../../src/data/difficulties';
import { getSpecies } from '../../src/data/species';
import type { CounterOffer } from '../../src/data/types';
import { generateWholesaleCatalog } from '../../src/engine/catalog';
import {
  calculateBuyProbability,
  calculateShiftDues,
  getLiquidationValue,
} from '../../src/engine/economy';
import { createSeededRng } from '../../src/engine/rng';
import {
  acceptCounterOfferAction,
  advanceShiftTick,
  closeShiftEarly,
  createInitialGameState,
  declineCounterOfferAction,
  finalizeDebtSettlement,
  haggleCounterOfferAction,
  liquidatePokemonAction,
  toggleShiftRunning,
} from '../../src/engine/simulation';

function makeQueuedOffer(overrides: Partial<CounterOffer> = {}): CounterOffer {
  return {
    uid: 'offer-test-1',
    customerUid: 'cust-1',
    archetypeId: 'cozy-collector',
    npcId: 'pokefan_f',
    npcPortraitUrl: './assets/npcs/portraits/pokefanf-gen4.png',
    customerName: 'Poké Fan Mina',
    pokemonUid: 'mon-starter-eevee',
    speciesId: 133,
    isShiny: false,
    penIndex: 0,
    fairValue: 1000,
    initialOffer: 1000,
    currentOffer: 1000,
    haggleAttempts: 0,
    maxHaggleAttempts: 2,
    patience: 8,
    maxPatience: 8,
    trendMatched: true,
    archetypeMatched: true,
    isVip: false,
    ...overrides,
  };
}

describe('Live-Clock Counter Haggling & Zero Auto-Selling', () => {
  it('never auto-sells during live ticks and queues interested browsers at the counter', () => {
    let state = toggleShiftRunning(createInitialGameState('p1', 'Host', 'standard')).state;
    const startingCash = state.cash;
    const rng = () => 0.1; // Guarantees shoppers want to step up to the counter

    for (let i = 0; i < 8; i += 1) {
      state = advanceShiftTick(state, rng).state;
    }

    // Zero automatic sales: cash stays equal to startingCash, and shoppers queue at counter
    expect(state.cash).toBe(startingCash);
    expect(state.shiftStats.adoptionsCount).toBe(0);
    expect(state.counterQueue.length).toBeGreaterThan(0);
  });

  it('decays queued counter patience on live ticks and deducts XP on walk-out', () => {
    let state = toggleShiftRunning(createInitialGameState('p1', 'Host', 'standard')).state;
    state = {
      ...state,
      cozyXp: 50,
      counterQueue: [makeQueuedOffer({ patience: 2, maxPatience: 8 })],
    };

    state = advanceShiftTick(state, createSeededRng(1)).state;
    expect(state.counterQueue[0].patience).toBe(1);

    const walkoutTick = advanceShiftTick(state, createSeededRng(2));
    expect(walkoutTick.sfxCues).toContain('walkout');
    expect(walkoutTick.state.counterQueue).toHaveLength(0);
    expect(walkoutTick.state.shiftStats.walkoutsCount).toBe(1);
    expect(walkoutTick.state.cozyXp).toBe(50 - getDifficultyConfig('standard').walkoutXpPenalty);
  });

  it('supports Accept, Haggle +15%/+30% (up to 2 attempts), critical walk-out, and Decline', () => {
    let state = createInitialGameState('p1', 'Host', 'standard');
    state = {
      ...state,
      activeGiftBall: 'friend-ball',
      counterQueue: [makeQueuedOffer()],
    };

    // Deterministic RNG returning 0.1 succeeds Haggle +15% and Haggle +30%
    const h1 = haggleCounterOfferAction(state, 'offer-test-1', 15, () => 0.1);
    expect(h1.ok).toBe(true);
    expect(h1.state.counterQueue[0].currentOffer).toBe(1150);
    expect(h1.state.counterQueue[0].haggleAttempts).toBe(1);

    const h2 = haggleCounterOfferAction(h1.state, 'offer-test-1', 30, () => 0.1);
    expect(h2.ok).toBe(true);
    expect(h2.state.counterQueue[0].currentOffer).toBe(Math.round(1150 * 1.3));
    expect(h2.state.counterQueue[0].haggleAttempts).toBe(2);

    // Third haggle blocked at 2/2
    const blocked = haggleCounterOfferAction(h2.state, 'offer-test-1', 15, () => 0.1);
    expect(blocked.ok).toBe(false);

    // Accepting completes sale + Friend Ball tip (+85)
    const sold = acceptCounterOfferAction(h2.state, 'offer-test-1');
    expect(sold.ok).toBe(true);
    expect(sold.state.cash).toBe(2000 + Math.round(1150 * 1.3) + 85);
    expect(sold.state.counterQueue).toHaveLength(0);
    expect(sold.state.pokemon.some((p) => p.uid === 'mon-starter-eevee')).toBe(false);

    // Critical haggle fail (+30% with high RNG) causes immediate walk-out
    const failState = {
      ...state,
      counterQueue: [makeQueuedOffer({ patience: 5 })],
    };
    const critFail = haggleCounterOfferAction(failState, 'offer-test-1', 30, () => 0.99);
    expect(critFail.ok).toBe(false);
    expect(critFail.state.counterQueue).toHaveLength(0);
    expect(critFail.state.shiftStats.walkoutsCount).toBe(1);

    // Polite Decline removes offer without walk-out penalty
    const declined = declineCounterOfferAction(failState, 'offer-test-1');
    expect(declined.ok).toBe(true);
    expect(declined.state.counterQueue).toHaveLength(0);
    expect(declined.state.shiftStats.walkoutsCount).toBe(0);
  });
});

describe('3 Difficulties, Rent, Emergency Liquidation, Bankruptcy & VIP Contracts', () => {
  it('applies distinct starting cash, rent/upkeep, and Debt Grace across 3 difficulties', () => {
    const relaxed = createInitialGameState('r', 'Relaxed Host', 'relaxed');
    const standard = createInitialGameState('s', 'Standard Host', 'standard');
    const hard = createInitialGameState('h', 'Hard Host', 'high-stakes');

    expect(relaxed.cash).toBe(3500);
    expect(standard.cash).toBe(2000);
    expect(hard.cash).toBe(1200);

    expect(relaxed.debtGraceDaysRemaining).toBe(1);
    expect(standard.debtGraceDaysRemaining).toBe(1);
    expect(hard.debtGraceDaysRemaining).toBe(0);

    expect(calculateShiftDues(relaxed).totalDues).toBeLessThan(
      calculateShiftDues(standard).totalDues,
    );
    expect(calculateShiftDues(standard).totalDues).toBeLessThan(calculateShiftDues(hard).totalDues);
  });

  it('triggers settlement-debt -> Emergency Liquidation (50% base) -> Debt Grace -> Bankruptcy', () => {
    // Standard starts with 1 Debt Grace shift and dues = 350 + 3*55 + 2*35 = 585
    let stdState = createInitialGameState('s', 'Standard', 'standard');
    const dues = calculateShiftDues(stdState).totalDues;
    expect(dues).toBe(585);

    stdState = { ...stdState, cash: 100 };
    const debtClose = closeShiftEarly(stdState);
    expect(debtClose.shiftPhase).toBe('settlement-debt');
    expect(debtClose.pendingSettlement?.cashAfterDues).toBe(100 - 585);

    // Liquidate Eevee for 50% basePrice
    const expectedLiq = getLiquidationValue(
      debtClose.pokemon.find((p) => p.uid === 'mon-starter-eevee')!,
    );
    expect(expectedLiq).toBe(Math.round(getSpecies(133).basePrice * 0.5));
    const afterLiq = liquidatePokemonAction(debtClose, 'mon-starter-eevee').state;
    expect(afterLiq.cash).toBe(100 + expectedLiq);

    // Still short of 585 -> invokes 1 Debt Grace shift instead of immediate bankruptcy
    const graced = finalizeDebtSettlement(afterLiq);
    expect(graced.isBankrupt).toBe(false);
    expect(graced.shiftPhase).toBe('summary');
    expect(graced.debtGraceDaysRemaining).toBe(0);
    expect(graced.lastShiftSummary?.usedDebtGrace).toBe(true);

    // High Stakes starts with 0 Debt Grace shifts -> unpaid deficit triggers Bankruptcy immediately
    let hardState = createInitialGameState('h', 'Hard', 'high-stakes');
    hardState = { ...hardState, cash: 50 };
    const hardDebt = closeShiftEarly(hardState);
    expect(hardDebt.shiftPhase).toBe('settlement-debt');

    const bankrupt = finalizeDebtSettlement(hardDebt);
    expect(bankrupt.isBankrupt).toBe(true);
    expect(bankrupt.shiftPhase).toBe('bankrupt');
    expect(bankrupt.bankruptcySummary?.difficulty).toBe('high-stakes');
  });

  it('unlocks VIP Legendary Contracts earlier on High Stakes than Standard', () => {
    const rank4Standard = generateWholesaleCatalog(4, 0, 2, createSeededRng(7), 'standard');
    const rank4Hard = generateWholesaleCatalog(4, 0, 2, createSeededRng(7), 'high-stakes');
    const rank6Standard = generateWholesaleCatalog(6, 0, 2, createSeededRng(7), 'standard');

    expect(rank4Standard.some((o) => o.kind === 'vip-contract')).toBe(false);
    expect(rank4Hard.some((o) => o.kind === 'vip-contract')).toBe(true);
    expect(rank6Standard.some((o) => o.kind === 'vip-contract')).toBe(true);

    const vipOffer = rank6Standard.find((o) => o.kind === 'vip-contract')!;
    const sp = getSpecies(vipOffer.speciesId);
    expect(sp.isLegendary || sp.isMythical).toBe(true);
  });

  it('has Normal Shopper buy non-Legendaries fairly while never offering on Legendaries or Mythicals', () => {
    const buyProb = calculateBuyProbability('normal', 100, false, false);
    expect(buyProb).toBeGreaterThanOrEqual(0.8);

    // 1. Store holding ONLY Legendary #150 Mewtwo -> Normal Shopper must NEVER queue an offer
    let legState = toggleShiftRunning(createInitialGameState('leg', 'VIP Shop', 'standard')).state;
    legState = {
      ...legState,
      pokemon: [
        {
          ...legState.pokemon[0],
          uid: 'mon-mewtwo',
          speciesId: 150,
          penIndex: 0,
        },
      ],
    };
    const seenNormalOnLeg: CounterOffer[] = [];
    for (let t = 0; t < 70; t += 1) {
      legState = advanceShiftTick(legState).state;
      for (const offer of legState.counterQueue) {
        if (offer.archetypeId === 'normal' && offer.speciesId === 150) {
          seenNormalOnLeg.push(offer);
        }
      }
      // Keep queue unblocked so later customers keep rolling
      if (legState.counterQueue.length >= 2) {
        legState = declineCounterOfferAction(legState, legState.counterQueue[0].uid).state;
      }
    }
    expect(seenNormalOnLeg).toHaveLength(0);

    // 2. Store holding non-Legendary #133 Eevee -> Normal Shopper spawns with Human Trainer fields
    let regState = toggleShiftRunning(createInitialGameState('reg', 'Cozy Shop', 'standard')).state;
    const seenNormal: CounterOffer[] = [];
    for (let t = 0; t < 70; t += 1) {
      regState = advanceShiftTick(regState).state;
      for (const offer of regState.counterQueue) {
        if (offer.archetypeId === 'normal') {
          seenNormal.push(offer);
        }
      }
      if (regState.counterQueue.length >= 2) {
        regState = declineCounterOfferAction(regState, regState.counterQueue[0].uid).state;
      }
    }
    expect(seenNormal.length).toBeGreaterThan(0);
    expect(seenNormal[0].npcId).toBeTruthy();
    expect(seenNormal[0].npcPortraitUrl).toContain('./assets/npcs/portraits/');
  });
});
