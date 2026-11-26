/**
 * Rotating daily Wholesale, Rescue, and VIP Legendary Contract catalog generator
 * across all 493 Gen 1–4 species gated by Shop Rank (`1–10`) and difficulty.
 */
import { getDifficultyConfig } from '../data/difficulties';
import { SPECIES_CATALOG } from '../data/species';
import type {
  ChillTrait,
  DifficultyId,
  PokemonStats,
  WholesaleOffer,
} from '../data/types';
import { clamp, pickRandom, randomInt, type RngFn } from './rng';

const CHILL_TRAITS: readonly ChillTrait[] = ['Docile', 'Sleepy', 'Unbothered', 'Cozy', 'Lucky'];

function rollStats(base: PokemonStats, variance: number, rng: RngFn): PokemonStats {
  return {
    cute: clamp(base.cute + randomInt(-variance, variance + 4, rng), 30, 99),
    comfort: clamp(base.comfort + randomInt(-variance, variance + 4, rng), 30, 99),
    rarity: clamp(base.rarity + randomInt(-variance, variance + 3, rng), 25, 99),
  };
}

/**
 * Generates rotating offers for the current shift:
 * - 2 healthy adoptables unlocked at `<= shopRank` (non-legendary)
 * - 2 discounted rescued strays needing nap care
 * - 1 Mystery Egg from unlocked breedable lines
 * - Optional VIP Legendary Contract (`#144–#151`, `#243–#251`, `#377–#386`, `#480–#493`)
 *   when `shopRank >= diff.vipRankFloor`.
 */
export function generateWholesaleCatalog(
  shopRank: number,
  mysteryShipmentLevel: number,
  shiftNumber: number,
  rng: RngFn,
  difficulty: DifficultyId = 'standard',
): WholesaleOffer[] {
  const diff = getDifficultyConfig(difficulty);
  const standardPool = SPECIES_CATALOG.filter(
    (sp) => !sp.isLegendary && !sp.isMythical && sp.unlockRank <= shopRank,
  );
  const pool = standardPool.length > 0 ? standardPool : SPECIES_CATALOG.slice(0, 12);
  const breedablePool = pool.filter((sp) => sp.canBreed);
  const eggPool = breedablePool.length > 0 ? breedablePool : pool;
  const shinyChance = clamp(0.06 + mysteryShipmentLevel * 0.02 + diff.shinyBonus, 0.06, 0.24);

  const offers: WholesaleOffer[] = [];

  for (let i = 0; i < 2; i += 1) {
    const species = pickRandom(pool, rng);
    const isShiny = rng() < shinyChance;
    const stats = rollStats(species.baseStats, 5, rng);
    const wholesaleCost = Math.round(
      species.basePrice * (isShiny ? 1.55 : 0.72) * diff.wholesaleCostMultiplier,
    );
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
    const rescueCost = Math.max(
      130,
      Math.round(species.basePrice * (isShiny ? 1.15 : 0.48) * diff.wholesaleCostMultiplier),
    );
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

  const eggSource = pickRandom(eggPool, rng);
  offers.push({
    uid: `offer-e-${shiftNumber}-${randomInt(100, 999, rng)}`,
    kind: 'egg',
    speciesId: eggSource.babySpeciesId,
    isShiny: rng() < clamp(shinyChance + 0.04, 0.08, 0.26),
    trait: pickRandom(CHILL_TRAITS, rng),
    stats: rollStats(eggSource.baseStats, 7, rng),
    cost: Math.round(340 * diff.wholesaleCostMultiplier),
    initialHealingProgress: 0,
    purchased: false,
  });

  // VIP Legendary Contract slot unlocked at Rank >= vipRankFloor (6 Relaxed/Standard, 4 High Stakes)
  if (shopRank >= diff.vipRankFloor) {
    const vipPool = SPECIES_CATALOG.filter((sp) => sp.isLegendary || sp.isMythical);
    if (vipPool.length > 0) {
      const vipSpecies = pickRandom(vipPool, rng);
      const isShiny = rng() < clamp(shinyChance + 0.03, 0.08, 0.25);
      const contractCost = Math.round(
        vipSpecies.basePrice * (isShiny ? 1.25 : 0.68) * diff.wholesaleCostMultiplier,
      );
      offers.push({
        uid: `offer-vip-${shiftNumber}-${randomInt(100, 999, rng)}`,
        kind: 'vip-contract',
        speciesId: vipSpecies.id,
        isShiny,
        trait: pickRandom(CHILL_TRAITS, rng),
        stats: rollStats(vipSpecies.baseStats, 4, rng),
        cost: contractCost,
        initialHealingProgress: 100,
        purchased: false,
      });
    }
  }

  return offers;
}
