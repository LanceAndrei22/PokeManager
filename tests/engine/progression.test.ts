/**
 * Unit tests for Adoption Dex discovery, Cozy Rank progression, live-tick stray
 * healing completion, and shop upgrades.
 */
import { describe, expect, it } from 'vitest';
import { getCozyRankInfo, getDexSummary, recordDexDiscovery } from '../../src/engine/dex';
import { getIncubatorCapacity, getNapBedCapacity, getPenCapacity } from '../../src/engine/healing';
import { createSeededRng } from '../../src/engine/rng';
import {
  advanceShiftTick,
  createInitialGameState,
  purchaseUpgradeAction,
  toggleShiftRunning,
} from '../../src/engine/simulation';

describe('Adoption Dex, Cozy Rank, Healing & Upgrades', () => {
  it('tracks Normal and Shiny discoveries cleanly in Adoption Dex', () => {
    let dex = recordDexDiscovery({}, 133, { isShiny: false, event: 'seen' });
    dex = recordDexDiscovery(dex, 133, { isShiny: true, event: 'adopted' });
    dex = recordDexDiscovery(dex, 79, { isShiny: false, event: 'hatched' });

    const summary = getDexSummary(dex);
    expect(summary.totalSpecies).toBe(493);
    expect(summary.discoveredSpecies).toBe(2);
    expect(summary.shinySpecies).toBe(1);
    expect(summary.totalAdoptions).toBe(1);
    expect(summary.totalHatched).toBe(1);
  });

  it('levels up Shop Rank across 10 tiers and unlocks all 493 species', () => {
    const rank1 = getCozyRankInfo(0);
    const rank5 = getCozyRankInfo(650);
    const rank10 = getCozyRankInfo(3500);

    expect(rank1.rank).toBe(1);
    expect(rank5.rank).toBe(5);
    expect(rank10.rank).toBe(10);
    expect(rank5.unlockedSpeciesCount).toBeGreaterThan(rank1.unlockedSpeciesCount);
    expect(rank10.unlockedSpeciesCount).toBe(493);
  });

  it('completes stray nap healing over live ticks and moves rested stray to pen', () => {
    let state = toggleShiftRunning(createInitialGameState('p1', 'Trainer')).state;
    // Starter Psyduck starts at 45% -> needs 11 ticks at +5%/tick
    for (let i = 0; i < 12; i += 1) {
      state = advanceShiftTick(state, createSeededRng(300 + i)).state;
    }

    const psyduck = state.pokemon.find((p) => p.uid === 'mon-starter-psyduck')!;
    expect(psyduck.needsRecovery).toBe(false);
    expect(psyduck.healingProgress).toBe(100);
    expect(psyduck.location).not.toBe('healing');
    expect(state.shiftStats.straysHealed).toBeGreaterThanOrEqual(1);
  });

  it('purchases shop upgrades cleanly and enforces affordability and max levels', () => {
    let state = createInitialGameState('p1', 'Trainer');
    expect(getPenCapacity(state.upgrades)).toBe(3);

    const penUpgrade = purchaseUpgradeAction(state, 'extra-pen');
    expect(penUpgrade.ok).toBe(true);
    expect(getPenCapacity(penUpgrade.state.upgrades)).toBe(4);
    expect(penUpgrade.state.cash).toBe(2000 - 750);

    // Exhaust incubators up to max level 2 with ample cash
    let richState = { ...penUpgrade.state, cash: 10000 };
    richState = purchaseUpgradeAction(richState, 'extra-incubator').state;
    richState = purchaseUpgradeAction(richState, 'extra-incubator').state;
    expect(getIncubatorCapacity(richState.upgrades)).toBe(3);

    const overMax = purchaseUpgradeAction(richState, 'extra-incubator');
    expect(overMax.ok).toBe(false);

    richState = purchaseUpgradeAction(richState, 'extra-nap-bed').state;
    expect(getNapBedCapacity(richState.upgrades)).toBe(3);
  });

  it('supports choosing initial shopkeeper, hiring random extra clerks, and slowing counter expiration', () => {
    // Choose initial shopkeeper on profile creation
    let state = createInitialGameState('p-clerk', 'Dawn', 'standard', false, 2025, 133, 'woman_2');
    expect(state.shopkeepers).toEqual(['woman_2']);
    expect(state.upgrades['hire-clerk']).toBe(0);

    // Hire 1st and 2nd random additional shopkeepers (all unique, up to 3 total)
    state = { ...state, cash: 5000 };
    const hire1 = purchaseUpgradeAction(state, 'hire-clerk', createSeededRng(7));
    expect(hire1.ok).toBe(true);
    expect(hire1.state.upgrades['hire-clerk']).toBe(1);
    expect(hire1.state.shopkeepers).toHaveLength(2);
    expect(new Set(hire1.state.shopkeepers).size).toBe(2);

    const hire2 = purchaseUpgradeAction(hire1.state, 'hire-clerk', createSeededRng(13));
    expect(hire2.ok).toBe(true);
    expect(hire2.state.upgrades['hire-clerk']).toBe(2);
    expect(hire2.state.shopkeepers).toHaveLength(3);
    expect(new Set(hire2.state.shopkeepers).size).toBe(3);

    // Capped at maxLevel 2 (3 total shopkeepers)
    const hire3 = purchaseUpgradeAction(hire2.state, 'hire-clerk', createSeededRng(19));
    expect(hire3.ok).toBe(false);

    // Verify 2 extra clerks slow counter patience decay by 50% compared to 0 extra clerks
    const offerBase = {
      uid: 'offer-patience-test',
      customerUid: 'cust-1',
      archetypeId: 'normal' as const,
      npcId: 'camper',
      npcPortraitUrl: './assets/npcs/portraits/camper.png',
      customerName: 'Camper Liam',
      pokemonUid: 'mon-starter-eevee',
      speciesId: 133,
      isShiny: false,
      penIndex: 0,
      fairValue: 1000,
      initialOffer: 1000,
      currentOffer: 1000,
      haggleAttempts: 0,
      maxHaggleAttempts: 2,
      patience: 20,
      maxPatience: 20,
      trendMatched: false,
      archetypeMatched: true,
      isVip: false,
    };

    let soloState = toggleShiftRunning({
      ...createInitialGameState('p-solo', 'Solo'),
      counterQueue: [offerBase],
    }).state;
    let staffedState = toggleShiftRunning({
      ...hire2.state,
      counterQueue: [{ ...offerBase }],
    }).state;

    for (let i = 0; i < 6; i += 1) {
      soloState = advanceShiftTick(soloState, createSeededRng(500 + i)).state;
      staffedState = advanceShiftTick(staffedState, createSeededRng(500 + i)).state;
    }

    const soloRemaining = soloState.counterQueue[0]?.patience ?? 0;
    const staffedRemaining = staffedState.counterQueue[0]?.patience ?? 0;
    // Solo loses 6 patience in 6 ticks (20 -> 14); 2 extra clerks skip every 2nd tick (20 -> 17)
    expect(soloRemaining).toBe(14);
    expect(staffedRemaining).toBe(17);
  });
});
