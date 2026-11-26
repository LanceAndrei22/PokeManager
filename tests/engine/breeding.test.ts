/**
 * Unit tests for breeding Egg Group compatibility, bounded genetic stat inheritance,
 * base-form inheritance, deterministic shiny rolls, incubation ticks, and hatching.
 */
import { describe, expect, it } from 'vitest';
import type { PokemonInstance } from '../../src/data/types';
import {
  areCompatibleParents,
  createEggFromParents,
  inheritStatsFromParents,
} from '../../src/engine/breeding';
import { createSeededRng } from '../../src/engine/rng';
import {
  advanceShiftTick,
  claimHatchedEggAction,
  createInitialGameState,
  startBreedingAction,
  toggleShiftRunning,
} from '../../src/engine/simulation';

const restedEevee: PokemonInstance = {
  uid: 'eevee-p',
  speciesId: 133,
  isShiny: false,
  trait: 'Cozy',
  stats: { cute: 90, comfort: 82, rarity: 62 },
  location: 'pen',
  penIndex: 0,
  healingProgress: 100,
  needsRecovery: false,
  acquiredAtShift: 1,
  origin: 'starter',
};

const restedVaporeon: PokemonInstance = {
  uid: 'vap-p',
  speciesId: 134,
  isShiny: true,
  trait: 'Sleepy',
  stats: { cute: 88, comfort: 90, rarity: 84 },
  location: 'pen',
  penIndex: 1,
  healingProgress: 100,
  needsRecovery: false,
  acquiredAtShift: 1,
  origin: 'evolved',
};

const bulbasaur: PokemonInstance = {
  uid: 'bulba-p',
  speciesId: 1,
  isShiny: false,
  trait: 'Docile',
  stats: { cute: 74, comfort: 78, rarity: 48 },
  location: 'reserve',
  penIndex: null,
  healingProgress: 100,
  needsRecovery: false,
  acquiredAtShift: 1,
  origin: 'wholesale',
};

describe('Breeding & Genetics Incubator', () => {
  it('checks egg group compatibility and blocks recovering or mismatched parents', () => {
    expect(areCompatibleParents(restedEevee, restedVaporeon)).toBe(true); // Field + Field
    expect(areCompatibleParents(restedEevee, restedEevee)).toBe(false); // Self
    expect(areCompatibleParents(restedEevee, bulbasaur)).toBe(false); // Field vs Monster/Grass

    const recovering: PokemonInstance = { ...restedVaporeon, needsRecovery: true };
    expect(areCompatibleParents(restedEevee, recovering)).toBe(false);
  });

  it('inherits baby base form, bounded stats, and deterministic seeded shiny roll', () => {
    const stats = inheritStatsFromParents(
      { cute: 40, comfort: 99, rarity: 99 },
      { cute: 40, comfort: 99, rarity: 99 },
      createSeededRng(123),
    );
    expect(stats.cute).toBeGreaterThanOrEqual(35);
    expect(stats.cute).toBeLessThanOrEqual(100);
    expect(stats.comfort).toBeLessThanOrEqual(100);

    // Both parents belong to Eevee's baby line (#133)
    // With RNG returning 0.01 (< 0.12), shiny roll succeeds deterministically!
    const shinyRng = () => 0.01;
    const shinyEgg = createEggFromParents(restedEevee, restedVaporeon, 1, shinyRng, 'egg-shiny');
    expect(shinyEgg.speciesId).toBe(133);
    expect(shinyEgg.isShiny).toBe(true);

    const normalRng = () => 0.9;
    const normalEgg = createEggFromParents(restedEevee, restedVaporeon, 1, normalRng, 'egg-norm');
    expect(normalEgg.isShiny).toBe(false);
  });

  it('incubates over live ticks and hatches into pen or reserve', () => {
    let state = createInitialGameState('p1', 'Trainer');
    state = {
      ...state,
      pokemon: [restedEevee, restedVaporeon],
    };

    const breedRes = startBreedingAction(
      state,
      restedEevee.uid,
      restedVaporeon.uid,
      createSeededRng(5),
    );
    expect(breedRes.ok).toBe(true);
    expect(breedRes.state.eggs).toHaveLength(1);

    state = toggleShiftRunning(breedRes.state).state;
    // 25 ticks * 4% per tick = 100% incubated
    for (let i = 0; i < 25; i += 1) {
      state = advanceShiftTick(state, createSeededRng(100 + i)).state;
    }

    expect(state.eggs[0].readyToHatch).toBe(true);
    const hatchRes = claimHatchedEggAction(state, state.eggs[0].uid);
    expect(hatchRes.ok).toBe(true);
    expect(hatchRes.state.eggs).toHaveLength(0);
    expect(hatchRes.state.shiftStats.eggsHatched).toBe(1);
    expect(hatchRes.state.dex[133]?.hatchedCount).toBe(1);
  });
});
