/**
 * Supply/demand economy formulas: shift market trends, oversupply saturation,
 * customer archetype valuation, markup buy probability, and gift-wrap ball tips.
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type {
  CustomerArchetypeId,
  GameState,
  GiftBallSlug,
  MarketTrend,
  PokemonInstance,
} from '../data/types';
import { clamp } from './rng';

export interface ValuationBreakdown {
  basePrice: number;
  statMultiplier: number;
  shinyMultiplier: number;
  trendMultiplier: number;
  archetypeMultiplier: number;
  saturationMultiplier: number;
  trendMatched: boolean;
  archetypeMatched: boolean;
}

export interface ValuationResult {
  /** Intrinsic shop appraisal before applying player markup %. */
  fairValue: number;
  /** Final ₽ amount offered by a matching customer at the current markup %. */
  askingPrice: number;
  breakdown: ValuationBreakdown;
}

/**
 * Resolves the active markup % for a pen, falling back to `state.globalMarkup`
 * when no pen-specific override is set.
 */
export function getEffectiveMarkup(
  state: Pick<GameState, 'globalMarkup' | 'penMarkups'>,
  penIndex: number | null,
): number {
  if (penIndex === null) {
    return state.globalMarkup;
  }
  return state.penMarkups[penIndex] ?? state.globalMarkup;
}

/**
 * Computes a gentle oversupply saturation multiplier when the shop sells too many
 * of the same species in recent shifts:
 * - 0..2 recent sales: 1.00 (no penalty)
 * - Each extra sale beyond 2 reduces value by 8%, capped gently at 0.70 (-30%).
 */
export function getSaturationMultiplier(recentSpeciesSales: number): number {
  if (recentSpeciesSales <= 2) {
    return 1.0;
  }
  return Number(clamp(1 - (recentSpeciesSales - 2) * 0.08, 0.7, 1.0).toFixed(2));
}

/**
 * Checks whether a customer archetype feels an extra affinity for a Pokémon
 * (or the active Shift Trend for Trend Fans).
 */
export function doesArchetypeMatchPokemon(
  archetypeId: CustomerArchetypeId,
  pokemon: PokemonInstance,
  trendMatched: boolean,
): boolean {
  switch (archetypeId) {
    case 'cozy-collector':
      return (
        pokemon.trait === 'Sleepy' ||
        pokemon.trait === 'Docile' ||
        pokemon.trait === 'Cozy' ||
        pokemon.stats.cute >= 85
      );
    case 'trend-fan':
      return trendMatched;
    case 'shiny-seeker':
      return pokemon.isShiny || pokemon.stats.rarity >= 70;
    case 'bargain-browser':
      return false;
  }
}

/**
 * Computes transparent valuation breakdown for Inspect Modal and customer checkout.
 */
export function calculatePokemonValuation(
  pokemon: PokemonInstance,
  trend: MarketTrend,
  archetypeId: CustomerArchetypeId,
  recentSpeciesSales: number,
  markupPercent: number,
): ValuationResult {
  const species = getSpecies(pokemon.speciesId);

  // Stat scaling rewards pampered Cute/Comfort stats and Rare Candy rarity boosts.
  const rawStatMult =
    1 +
    (pokemon.stats.cute - 70) * 0.004 +
    (pokemon.stats.comfort - 70) * 0.004 +
    (pokemon.stats.rarity - 50) * 0.005;
  const statMultiplier = Number(clamp(rawStatMult, 0.85, 1.65).toFixed(3));

  // Shiny Pokémon carry a crisp 3x valuation multiplier across all archetypes.
  const shinyMultiplier = pokemon.isShiny ? 3.0 : 1.0;

  const trendMatched = trend.matchesPokemon(species, pokemon);
  const trendMultiplier = trendMatched ? trend.bonusMultiplier : 1.0;

  const archetype = CUSTOMER_ARCHETYPES[archetypeId];
  const archetypeMatched = doesArchetypeMatchPokemon(archetypeId, pokemon, trendMatched);
  const archetypeMultiplier = archetypeMatched ? archetype.bonusMultiplier : 1.0;

  const saturationMultiplier = getSaturationMultiplier(recentSpeciesSales);

  const fairValue = Math.round(
    species.basePrice *
      statMultiplier *
      shinyMultiplier *
      trendMultiplier *
      archetypeMultiplier *
      saturationMultiplier,
  );

  const askingPrice = Math.round(fairValue * (markupPercent / 100));

  return {
    fairValue,
    askingPrice,
    breakdown: {
      basePrice: species.basePrice,
      statMultiplier,
      shinyMultiplier,
      trendMultiplier,
      archetypeMultiplier,
      saturationMultiplier,
      trendMatched,
      archetypeMatched,
    },
  };
}

/**
 * Calculates purchase probability for a browsing customer based on markup tolerance.
 * Bargain Browsers love ≤100% prices and politely pass on steep markups, while
 * collectors & seekers tolerate higher markups when their favorite bonus triggers.
 */
export function calculateBuyProbability(
  archetypeId: CustomerArchetypeId,
  markupPercent: number,
  archetypeMatched: boolean,
  trendMatched: boolean,
): number {
  const archetype = CUSTOMER_ARCHETYPES[archetypeId];
  const baseChance = archetypeId === 'bargain-browser' ? 0.88 : 0.78;
  const discountBoost = markupPercent < 100 ? (100 - markupPercent) * 0.005 : 0;
  const overTolerance = Math.max(0, markupPercent - archetype.markupTolerance);
  const markupPenalty = overTolerance * (archetypeId === 'bargain-browser' ? 0.022 : 0.015);
  const affinityBoost = (archetypeMatched ? 0.1 : 0) + (trendMatched ? 0.06 : 0);

  return Number(clamp(baseChance + discountBoost + affinityBoost - markupPenalty, 0.08, 0.98).toFixed(2));
}

export interface GiftBallCheckoutResult {
  ballUsed: GiftBallSlug;
  tipBonus: number;
  xpBonus: number;
  consumed: boolean;
}

/**
 * Resolves the optional checkout gift-wrap Poké Ball bonus.
 * Falls back cleanly to the complimentary `poke-ball` wrap if stock is empty.
 */
export function resolveCheckoutGiftBall(
  activeBall: GiftBallSlug,
  inventory: Partial<Record<string, number>>,
): GiftBallCheckoutResult {
  if (activeBall === 'poke-ball' || (inventory[activeBall] ?? 0) <= 0) {
    return {
      ballUsed: 'poke-ball',
      tipBonus: 0,
      xpBonus: 0,
      consumed: false,
    };
  }

  const def = getItemDefinition(activeBall);
  return {
    ballUsed: activeBall,
    tipBonus: def.tipBonus ?? 0,
    xpBonus: def.xpBonus ?? 0,
    consumed: true,
  };
}
