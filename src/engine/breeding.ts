/**
 * Breeding compatibility, genetic stat inheritance, egg incubation, and shiny rolls.
 */
import { getSpecies } from '../data/species';
import type { ChillTrait, EggInstance, PokemonInstance, PokemonStats } from '../data/types';
import { clamp, pickRandom, randomInt, type RngFn } from './rng';

const CHILL_TRAITS: readonly ChillTrait[] = ['Docile', 'Sleepy', 'Unbothered', 'Cozy', 'Lucky'];

/**
 * Checks whether two owned Pokémon can share a warm incubator.
 * Both must be rested, not currently incubating, and share a species or Egg Group.
 */
export function areCompatibleParents(parentA: PokemonInstance, parentB: PokemonInstance): boolean {
  if (parentA.uid === parentB.uid) return false;
  if (parentA.needsRecovery || parentB.needsRecovery) return false;
  if (parentA.location === 'breeding' || parentB.location === 'breeding') return false;
  if (parentA.speciesId === parentB.speciesId) return true;

  const speciesA = getSpecies(parentA.speciesId);
  const speciesB = getSpecies(parentB.speciesId);
  return speciesA.eggGroups.some((group) => speciesB.eggGroups.includes(group));
}

/**
 * Computes bounded genetic stat inheritance from two parents (`[35, 100]`).
 */
export function inheritStatsFromParents(
  statsA: PokemonStats,
  statsB: PokemonStats,
  rng: RngFn,
): PokemonStats {
  const inheritStat = (a: number, b: number) =>
    clamp(Math.round((a + b) / 2) + randomInt(-4, 6, rng), 35, 100);

  return {
    cute: inheritStat(statsA.cute, statsB.cute),
    comfort: inheritStat(statsA.comfort, statsB.comfort),
    rarity: inheritStat(statsA.rarity, statsB.rarity),
  };
}

/**
 * Creates a new EggInstance from two compatible parents.
 * Shiny chance = 5% base + 2% per Lucky Egg Delivery upgrade + 5% if either parent is Shiny (cap 25%).
 */
export function createEggFromParents(
  parentA: PokemonInstance,
  parentB: PokemonInstance,
  mysteryShipmentLevel: number,
  rng: RngFn,
  uid: string,
): EggInstance {
  if (!areCompatibleParents(parentA, parentB)) {
    throw new Error('Selected Pokémon are not compatible for cozy breeding.');
  }

  const spA = getSpecies(parentA.speciesId);
  const spB = getSpecies(parentB.speciesId);
  const chosenSpecies = rng() < 0.5 ? spA : spB;
  const babySpeciesId = chosenSpecies.babySpeciesId;

  const traitRoll = rng();
  const trait =
    traitRoll < 0.4
      ? parentA.trait
      : traitRoll < 0.8
        ? parentB.trait
        : pickRandom(CHILL_TRAITS, rng);

  const parentShinyBonus = parentA.isShiny || parentB.isShiny ? 0.05 : 0;
  const shinyChance = clamp(0.05 + mysteryShipmentLevel * 0.02 + parentShinyBonus, 0.05, 0.25);
  const isShiny = rng() < shinyChance;

  return {
    uid,
    speciesId: babySpeciesId,
    parentNames: [spA.name, spB.name],
    isShiny,
    trait,
    inheritedStats: inheritStatsFromParents(parentA.stats, parentB.stats, rng),
    progress: 0,
    readyToHatch: false,
  };
}

/** Advances incubation progress on active eggs each live shop tick. */
export function advanceEggsTick(
  eggs: EggInstance[],
  extraIncubatorLevel: number,
): { updatedEggs: EggInstance[]; newlyReadyCount: number } {
  const step = 4 + extraIncubatorLevel * 1.5;
  let newlyReadyCount = 0;

  const updatedEggs = eggs.map((egg) => {
    if (egg.readyToHatch) return egg;
    const nextProgress = clamp(Math.round((egg.progress + step) * 10) / 10, 0, 100);
    const readyToHatch = nextProgress >= 100;
    if (readyToHatch) {
      newlyReadyCount += 1;
    }
    return {
      ...egg,
      progress: nextProgress,
      readyToHatch,
    };
  });

  return { updatedEggs, newlyReadyCount };
}

/** Finds the first unoccupied display pen index up to `penCapacity - 1`, or `null`. */
export function findOpenPenIndex(
  pokemon: readonly PokemonInstance[],
  penCapacity: number,
): number | null {
  const occupied = new Set(
    pokemon
      .filter((mon) => mon.location === 'pen' && mon.penIndex !== null)
      .map((mon) => mon.penIndex as number),
  );
  for (let i = 0; i < penCapacity; i += 1) {
    if (!occupied.has(i)) return i;
  }
  return null;
}

/** Converts a matured EggInstance into a new shop Pokémon placed in a pen or reserve. */
export function hatchEggToPokemon(
  egg: EggInstance,
  pokemonList: readonly PokemonInstance[],
  penCapacity: number,
  shiftNumber: number,
  uid: string,
): PokemonInstance {
  const openPen = findOpenPenIndex(pokemonList, penCapacity);
  return {
    uid,
    speciesId: egg.speciesId,
    isShiny: egg.isShiny,
    trait: egg.trait,
    stats: { ...egg.inheritedStats },
    location: openPen !== null ? 'pen' : 'reserve',
    penIndex: openPen,
    healingProgress: 100,
    needsRecovery: false,
    acquiredAtShift: shiftNumber,
    origin: 'hatched',
  };
}
