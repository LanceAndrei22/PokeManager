/**
 * Rotating daily Wholesale & Rescue Catalog generator.
 * Guarantees healthy adoptables, discounted tired strays, and a Mystery Egg each shift.
 */
import { SPECIES_CATALOG } from '../data/species';
import type { ChillTrait, PokemonStats, WholesaleOffer } from '../data/types';
import { clamp, pickRandom, randomInt, type RngFn } from './rng';

const CHILL_TRAITS: readonly ChillTrait[] = ['Docile', 'Sleepy', 'Unbothered', 'Cozy', 'Lucky'];

function rollStats(base: PokemonStats, variance: number, rng: RngFn): PokemonStats {
  return {
    cute: clamp(base.cute + randomInt(-variance, variance + 3, rng), 30, 99),
    comfort: clamp(base.comfort + randomInt(-variance, variance + 3, rng), 30, 99),
    rarity: clamp(base.rarity + randomInt(-variance, variance + 2, rng), 25, 99),
  };
}

/**
 * Generates 5 rotating offers for the current shift, filtered by Cozy Rank unlocks:
 * - 2 healthy adoptables
 * - 2 discounted rescued strays (need nap recovery)
 * - 1 Mystery Egg with elevated shiny chance
 */
export function generateWholesaleCatalog(
  cozyRank: number,
  mysteryShipmentLevel: number,
  shiftNumber: number,
  rng: RngFn,
): WholesaleOffer[] {
  const unlocked = SPECIES_CATALOG.filter((sp) => sp.minCozyRank <= cozyRank);
  const pool = unlocked.length > 0 ? unlocked : SPECIES_CATALOG.slice(0, 6);
  const shinyChance = clamp(0.06 + mysteryShipmentLevel * 0.02, 0.06, 0.2);

  const offers: WholesaleOffer[] = [];

  for (let i = 0; i < 2; i += 1) {
    const species = pickRandom(pool, rng);
    const isShiny = rng() < shinyChance;
    const stats = rollStats(species.baseStats, 5, rng);
    const wholesaleCost = Math.round(species.basePrice * (isShiny ? 1.55 : 0.72));
    offers.push({
      uid: `offer-h-${shiftNumber}-${i}-${randomInt(100, 999, rng)}`,
      kind: 'healthy',
      speciesId: species.id,
      isShiny,
      trait: pickRandom(CHILL_TRAITS, rng),
      stats,
      cost: wholesaleCost,
      initialHealingProgress: 100,
      purchased: false,
    });
  }

  for (let i = 0; i < 2; i += 1) {
    const species = pickRandom(pool, rng);
    const isShiny = rng() < shinyChance * 0.8;
    const stats = rollStats(species.baseStats, 6, rng);
    // Strays cost ~48% of base price because they need nap care before adoption.
    const rescueCost = Math.max(140, Math.round(species.basePrice * (isShiny ? 1.15 : 0.48)));
    offers.push({
      uid: `offer-s-${shiftNumber}-${i}-${randomInt(100, 999, rng)}`,
      kind: 'stray',
      speciesId: species.id,
      isShiny,
      trait: pickRandom(CHILL_TRAITS, rng),
      stats,
      cost: rescueCost,
      initialHealingProgress: randomInt(20, 45, rng),
      purchased: false,
    });
  }

  const eggSource = pickRandom(pool, rng);
  const eggBabyId = eggSource.babySpeciesId;
  const eggStats = rollStats(eggSource.baseStats, 7, rng);
  const eggShiny = rng() < clamp(shinyChance + 0.04, 0.08, 0.25);

  offers.push({
    uid: `offer-e-${shiftNumber}-${randomInt(100, 999, rng)}`,
    kind: 'egg',
    speciesId: eggBabyId,
    isShiny: eggShiny,
    trait: pickRandom(CHILL_TRAITS, rng),
    stats: eggStats,
    cost: 340,
    initialHealingProgress: 0,
    purchased: false,
  });

  return offers;
}
