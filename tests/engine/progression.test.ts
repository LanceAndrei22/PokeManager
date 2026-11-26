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
    expect(summary.totalSpecies).toBe(45);
    expect(summary.discoveredSpecies).toBe(2);
    expect(summary.shinySpecies).toBe(1);
    expect(summary.totalAdoptions).toBe(1);
    expect(summary.totalHatched).toBe(1);
  });

  it('levels up Cozy Rank and unlocks more species tiers', () => {
    const rank1 = getCozyRankInfo(0);
    const rank3 = getCozyRankInfo(340);
    const rank5 = getCozyRankInfo(1200);

    expect(rank1.rank).toBe(1);
    expect(rank3.rank).toBe(3);
    expect(rank5.rank).toBe(5);
    expect(rank3.unlockedSpeciesCount).toBeGreaterThan(rank1.unlockedSpeciesCount);
    expect(rank5.unlockedSpeciesCount).toBe(45);
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
    expect(penUpgrade.state.cash).toBe(1800 - 750);

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
});
