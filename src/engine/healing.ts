/**
 * Shop slot capacities and stray nap-station healing progression.
 */
import { getSpecies } from '../data/species';
import type { PokemonInstance, ShopUpgradeId } from '../data/types';
import { findOpenPenIndex } from './breeding';
import { clamp } from './rng';

/** Returns total display pen capacity (base 3 + up to 3 upgrades). */
export function getPenCapacity(upgrades: Record<ShopUpgradeId, number>): number {
  return 3 + (upgrades['extra-pen'] ?? 0);
}

/** Returns total egg incubator slots (base 1 + up to 2 upgrades). */
export function getIncubatorCapacity(upgrades: Record<ShopUpgradeId, number>): number {
  return 1 + (upgrades['extra-incubator'] ?? 0);
}

/** Returns total plush nap beds for recovering strays (base 2 + up to 2 upgrades). */
export function getNapBedCapacity(upgrades: Record<ShopUpgradeId, number>): number {
  return 2 + (upgrades['extra-nap-bed'] ?? 0);
}

/**
 * Advances recovery on napping strays each live shop tick and promotes rested
 * strays into an open Display Pen (or Reserve Kennel if all pens are full).
 */
export function advanceHealingTick(
  pokemonList: PokemonInstance[],
  extraNapBedLevel: number,
  penCapacity: number,
): { updatedPokemon: PokemonInstance[]; healedNames: string[] } {
  const recoveryStep = 5 + extraNapBedLevel * 2;
  const healedNames: string[] = [];
  const nextList = pokemonList.map((mon) => ({ ...mon }));

  for (let i = 0; i < nextList.length; i += 1) {
    const mon = nextList[i];
    if (mon.location !== 'healing' || !mon.needsRecovery) continue;

    const nextProgress = clamp(mon.healingProgress + recoveryStep, 0, 100);
    if (nextProgress >= 100) {
      const openPen = findOpenPenIndex(nextList, penCapacity);
      nextList[i] = {
        ...mon,
        healingProgress: 100,
        needsRecovery: false,
        location: openPen !== null ? 'pen' : 'reserve',
        penIndex: openPen,
      };
      healedNames.push(getSpecies(mon.speciesId).name);
    } else {
      nextList[i] = {
        ...mon,
        healingProgress: nextProgress,
      };
    }
  }

  return { updatedPokemon: nextList, healedNames };
}
