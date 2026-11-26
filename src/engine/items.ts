/**
 * Active item application logic across all 493 Gen 1–4 species:
 * - All 9 Evolution Stones (`fire`, `water`, `thunder`, `leaf`, `moon`, `sun`, `shiny`, `dusk`, `dawn`)
 * - `Rare Candy` triggers standard level-up/friendship/trade next-stage evolutions when available,
 *   or boosts Rarity (+10) & Cute (+4) when fully evolved
 * - Care Drinks & Berries speed stray nap recovery and boost Comfort/Cute stats.
 */
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type { EvolutionStoneSlug, ItemSlug, PokemonInstance } from '../data/types';
import { clamp } from './rng';

export interface ItemEligibility {
  ok: boolean;
  reason?: string;
  targetSpeciesId?: number;
}

/** Returns the target evolved species ID if a stone evolves `speciesId`, else `null`. */
export function getEvolutionTarget(
  speciesId: number,
  stoneSlug: EvolutionStoneSlug,
): number | null {
  const species = getSpecies(speciesId);
  return species.evolutions?.[stoneSlug] ?? null;
}

/** Checks whether an item can currently be used on a Pokémon instance. */
export function canUseItemOnPokemon(
  pokemon: PokemonInstance,
  itemSlug: ItemSlug,
): ItemEligibility {
  const item = getItemDefinition(itemSlug);
  const species = getSpecies(pokemon.speciesId);

  if (item.category === 'ball' || item.category === 'egg') {
    return { ok: false, reason: 'Equipped at checkout rather than fed directly.' };
  }
  if (pokemon.location === 'breeding') {
    return { ok: false, reason: 'Finish egg incubation before using items on parents.' };
  }

  if (item.category === 'stone') {
    if (pokemon.needsRecovery) {
      return { ok: false, reason: 'Let this stray rest completely before evolving.' };
    }
    const targetId = getEvolutionTarget(pokemon.speciesId, itemSlug as EvolutionStoneSlug);
    if (!targetId) {
      return { ok: false, reason: `${species.name} cannot evolve with ${item.name}.` };
    }
    return { ok: true, targetSpeciesId: targetId };
  }

  if (item.category === 'care') {
    const canHeal = pokemon.needsRecovery && pokemon.healingProgress < 100;
    const canPamper = pokemon.stats.cute < 100 || pokemon.stats.comfort < 100;
    if (!canHeal && !canPamper) {
      return { ok: false, reason: 'Already fully rested with maxed Cute & Comfort!' };
    }
    return { ok: true };
  }

  if (item.category === 'candy') {
    if (!pokemon.needsRecovery && species.levelEvolutionId) {
      return { ok: true, targetSpeciesId: species.levelEvolutionId };
    }
    if (pokemon.stats.rarity >= 100 && pokemon.stats.cute >= 100) {
      return { ok: false, reason: 'Rarity and Cute are already maxed at 100!' };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported item category.' };
}

export interface AppliedItemOutcome {
  updatedPokemon: PokemonInstance;
  evolvedFromId?: number;
  evolvedToId?: number;
  fullyHealed: boolean;
  xpBonus: number;
  message: string;
}

/** Purely applies an eligible item to a Pokémon instance. */
export function applyItemToPokemon(
  pokemon: PokemonInstance,
  itemSlug: ItemSlug,
): AppliedItemOutcome {
  const check = canUseItemOnPokemon(pokemon, itemSlug);
  if (!check.ok) {
    throw new Error(check.reason ?? 'Item cannot be used on this Pokémon.');
  }

  const item = getItemDefinition(itemSlug);
  const currentSpecies = getSpecies(pokemon.speciesId);

  if (check.targetSpeciesId && (item.category === 'stone' || item.category === 'candy')) {
    const evolvedSpecies = getSpecies(check.targetSpeciesId);
    const updatedPokemon: PokemonInstance = {
      ...pokemon,
      speciesId: evolvedSpecies.id,
      origin: 'evolved',
      stats: {
        cute: clamp(pokemon.stats.cute + 4, 1, 100),
        comfort: clamp(pokemon.stats.comfort + 5, 1, 100),
        rarity: clamp(Math.max(pokemon.stats.rarity + 14, evolvedSpecies.baseStats.rarity), 1, 100),
      },
    };
    return {
      updatedPokemon,
      evolvedFromId: currentSpecies.id,
      evolvedToId: evolvedSpecies.id,
      fullyHealed: false,
      xpBonus: 24,
      message: `${currentSpecies.name} glowed gently with ${item.name} and evolved into ${evolvedSpecies.name}!`,
    };
  }

  if (item.category === 'care') {
    const nextProgress = pokemon.needsRecovery
      ? clamp(pokemon.healingProgress + (item.healBoost ?? 35), 0, 100)
      : 100;
    const fullyHealed = pokemon.needsRecovery && nextProgress >= 100;
    const updatedPokemon: PokemonInstance = {
      ...pokemon,
      healingProgress: nextProgress,
      needsRecovery: fullyHealed ? false : pokemon.needsRecovery,
      stats: {
        ...pokemon.stats,
        cute: clamp(pokemon.stats.cute + (item.cuteBoost ?? 0), 1, 100),
        comfort: clamp(pokemon.stats.comfort + (item.comfortBoost ?? 0), 1, 100),
      },
    };
    return {
      updatedPokemon,
      fullyHealed,
      xpBonus: fullyHealed ? 14 : 6,
      message: fullyHealed
        ? `${currentSpecies.name} enjoyed ${item.name} and finished resting!`
        : `${currentSpecies.name} enjoyed ${item.name} and feels extra cozy.`,
    };
  }

  // Rare Candy on fully evolved / recovering Pokémon boosts Rarity & Cute
  const updatedPokemon: PokemonInstance = {
    ...pokemon,
    stats: {
      ...pokemon.stats,
      cute: clamp(pokemon.stats.cute + (item.cuteBoost ?? 4), 1, 100),
      rarity: clamp(pokemon.stats.rarity + (item.rarityBoost ?? 10), 1, 100),
    },
  };
  return {
    updatedPokemon,
    fullyHealed: false,
    xpBonus: 12,
    message: `${currentSpecies.name} nibbled a ${item.name} (+${item.rarityBoost ?? 10} Rarity)!`,
  };
}
