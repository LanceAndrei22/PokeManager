/**
 * Unit tests for active shop items: Evolution Stones (all 5 Eevee branches + Kanto classics),
 * Care Berries/Drinks healing & stat boosts, Rare Candy, and invalid-target guards.
 */
import { describe, expect, it } from 'vitest';
import type { EvolutionStoneSlug } from '../../src/data/types';
import {
  createInitialGameState,
  useItemAction,
} from '../../src/engine/simulation';
import { canUseItemOnPokemon, getEvolutionTarget } from '../../src/engine/items';

describe('Shop Items & Evolution System', () => {
  it('evolves Eevee with all 5 stones and boosts stats, Dex, and Cozy XP', () => {
    const stoneCases: Array<[EvolutionStoneSlug, number]> = [
      ['water-stone', 134],
      ['thunder-stone', 135],
      ['fire-stone', 136],
      ['moon-stone', 197],
      ['leaf-stone', 470],
    ];

    for (const [stone, expectedId] of stoneCases) {
      let state = createInitialGameState('p1', 'Trainer');
      state = {
        ...state,
        inventory: { ...state.inventory, [stone]: 1 },
      };

      const res = useItemAction(state, 'mon-starter-eevee', stone);
      expect(res.ok).toBe(true);
      expect(res.sfx).toBe('evolve');

      const evolved = res.state.pokemon.find((p) => p.uid === 'mon-starter-eevee')!;
      expect(evolved.speciesId).toBe(expectedId);
      expect(evolved.origin).toBe('evolved');
      expect(evolved.stats.rarity).toBeGreaterThan(64);
      expect(res.state.dex[expectedId]?.evolvedCount).toBe(1);
      expect(res.state.cozyXp).toBe(24);
      expect(res.state.inventory[stone]).toBeUndefined();
    }
  });

  it('supports all 9 Gen 1-4 Evolution Stones across curated lines', () => {
    expect(getEvolutionTarget(25, 'thunder-stone')).toBe(26);
    expect(getEvolutionTarget(37, 'fire-stone')).toBe(38);
    expect(getEvolutionTarget(58, 'fire-stone')).toBe(59);
    expect(getEvolutionTarget(39, 'moon-stone')).toBe(40);
    expect(getEvolutionTarget(191, 'sun-stone')).toBe(192);
    expect(getEvolutionTarget(176, 'shiny-stone')).toBe(468);
    expect(getEvolutionTarget(198, 'dusk-stone')).toBe(430);
    expect(getEvolutionTarget(281, 'dawn-stone')).toBe(475);
    expect(getEvolutionTarget(79, 'fire-stone')).toBeNull();
  });

  it('heals napping strays with Care items and auto-promotes to open display pen', () => {
    let state = createInitialGameState('p1', 'Trainer');
    // Starter Psyduck starts at 45% in nap bed; Moomoo Milk adds +75% -> 100% rested
    const res = useItemAction(state, 'mon-starter-psyduck', 'moomoo-milk');
    expect(res.ok).toBe(true);
    expect(res.sfx).toBe('heal');

    const psyduck = res.state.pokemon.find((p) => p.uid === 'mon-starter-psyduck')!;
    expect(psyduck.needsRecovery).toBe(false);
    expect(psyduck.healingProgress).toBe(100);
    expect(psyduck.location).toBe('pen');
    expect(psyduck.penIndex).toBe(2); // Pen 0 (Eevee) and Pen 1 (Slowpoke) occupied -> Pen 2
    expect(res.state.shiftStats.straysHealed).toBe(1);
  });

  it('triggers standard evolution or boosts Rarity with Rare Candy and rejects evolving recovering strays', () => {
    let state = createInitialGameState('p1', 'Trainer');
    state = {
      ...state,
      inventory: { ...state.inventory, 'rare-candy': 2 },
      pokemon: [
        ...state.pokemon,
        {
          uid: 'mon-snorlax',
          speciesId: 143,
          isShiny: false,
          trait: 'Sleepy',
          stats: { cute: 80, comfort: 90, rarity: 70 },
          location: 'reserve',
          penIndex: null,
          healingProgress: 100,
          needsRecovery: false,
          acquiredAtShift: 1,
          origin: 'wholesale',
        },
      ],
    };

    // Rare Candy evolves Slowpoke (#79) -> Slowbro (#80)
    const evoCandyRes = useItemAction(state, 'mon-starter-slowpoke', 'rare-candy');
    expect(evoCandyRes.ok).toBe(true);
    expect(evoCandyRes.sfx).toBe('evolve');
    const slowbro = evoCandyRes.state.pokemon.find((p) => p.uid === 'mon-starter-slowpoke')!;
    expect(slowbro.speciesId).toBe(80);

    // Rare Candy boosts Rarity (+10) on fully evolved Snorlax (#143)
    const boostCandyRes = useItemAction(evoCandyRes.state, 'mon-snorlax', 'rare-candy');
    expect(boostCandyRes.ok).toBe(true);
    const snorlax = boostCandyRes.state.pokemon.find((p) => p.uid === 'mon-snorlax')!;
    expect(snorlax.stats.rarity).toBe(80);

    const tiredCheck = canUseItemOnPokemon(
      state.pokemon.find((p) => p.uid === 'mon-starter-psyduck')!,
      'water-stone',
    );
    expect(tiredCheck.ok).toBe(false);
  });
});
