/**
 * Tycoon economy formulas: valuations, push-your-luck counter haggling, daily rent
 * and upkeep dues, Emergency Liquidation (50% base value), and gift-wrap ball tips.
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getDifficultyConfig } from '../data/difficulties';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type {
  CounterOffer,
  CustomerArchetypeId,
  DifficultyId,
  GameState,
  GiftBallSlug,
  MarketTrend,
  PokemonInstance,
} from '../data/types';
import { getNapBedCapacity, getPenCapacity } from './healing';
import { clamp, type RngFn } from './rng';

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
  fairValue: number;
  askingPrice: number;
  breakdown: ValuationBreakdown;
}

/** Resolves effective markup % for a display pen, inheriting `globalMarkup` when unset. */
export function getEffectiveMarkup(
  state: Pick<GameState, 'globalMarkup' | 'penMarkups'>,
  penIndex: number | null,
): number {
  if (penIndex === null) return state.globalMarkup;
  return state.penMarkups[penIndex] ?? state.globalMarkup;
}

/**
 * Gentle oversupply saturation curve:
 * - 0..2 recent sales: 1.00 (no penalty)
 * - Each sale above 2 trims 8% valuation, capped at 0.70 (-30%).
 */
export function getSaturationMultiplier(recentSpeciesSales: number): number {
  if (recentSpeciesSales <= 2) return 1.0;
  return Number(clamp(1 - (recentSpeciesSales - 2) * 0.08, 0.7, 1.0).toFixed(2));
}

/** Checks whether an archetype feels special affinity for a given Pokémon. */
export function doesArchetypeMatchPokemon(
  archetypeId: CustomerArchetypeId,
  pokemon: PokemonInstance,
  trendMatched: boolean,
): boolean {
  const species = getSpecies(pokemon.speciesId);
  switch (archetypeId) {
    case 'cozy-collector':
      return (
        pokemon.trait === 'Sleepy' ||
        pokemon.trait === 'Docile' ||
        pokemon.trait === 'Cozy' ||
        pokemon.stats.cute >= 82
      );
    case 'trend-fan':
      return trendMatched;
    case 'shiny-seeker':
      return pokemon.isShiny || pokemon.stats.rarity >= 70;
    case 'vip-seeker':
      return (
        species.isLegendary ||
        species.isMythical ||
        species.rarityTier === 'pseudo' ||
        pokemon.stats.rarity >= 80
      );
    case 'bargain-browser':
    case 'normal':
      return false;
  }
}

/** Computes transparent appraisal breakdown for Inspect Modal and customer counter offers. */
export function calculatePokemonValuation(
  pokemon: PokemonInstance,
  trend: MarketTrend,
  archetypeId: CustomerArchetypeId,
  recentSpeciesSales: number,
  markupPercent: number,
): ValuationResult {
  const species = getSpecies(pokemon.speciesId);

  const rawStatMult =
    1 +
    (pokemon.stats.cute - 65) * 0.004 +
    (pokemon.stats.comfort - 65) * 0.004 +
    (pokemon.stats.rarity - 45) * 0.005;
  const statMultiplier = Number(clamp(rawStatMult, 0.85, 1.7).toFixed(3));
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

/** Computes whether a browsing shopper decides to step up to Kecleon's counter. */
export function calculateBuyProbability(
  archetypeId: CustomerArchetypeId,
  markupPercent: number,
  archetypeMatched: boolean,
  trendMatched: boolean,
): number {
  const archetype = CUSTOMER_ARCHETYPES[archetypeId];
  const baseChance =
    archetypeId === 'bargain-browser' ? 0.88 : archetypeId === 'normal' ? 0.84 : 0.8;
  const discountBoost = markupPercent < 100 ? (100 - markupPercent) * 0.005 : 0;
  const overTolerance = Math.max(0, markupPercent - archetype.markupTolerance);
  const markupPenalty = overTolerance * (archetypeId === 'bargain-browser' ? 0.022 : 0.015);
  const affinityBoost = (archetypeMatched ? 0.1 : 0) + (trendMatched ? 0.06 : 0);

  return Number(
    clamp(baseChance + discountBoost + affinityBoost - markupPenalty, 0.1, 0.98).toFixed(2),
  );
}

/** Emergency Liquidation payout: 50% of species base market value. */
export function getLiquidationValue(pokemon: PokemonInstance): number {
  const species = getSpecies(pokemon.speciesId);
  return Math.max(50, Math.round(species.basePrice * 0.5));
}

export interface ShiftDuesBreakdown {
  dailyRent: number;
  penUpkeep: number;
  bedUpkeep: number;
  totalDues: number;
}

/**
 * Computes itemized end-of-shift rent & facility upkeep for the profile's difficulty:
 * `dailyRent = baseRent + (shiftNumber - 1) * rentPerShift`
 * `penUpkeep = penCapacity * upkeepPerPen`, `bedUpkeep = bedCapacity * upkeepPerBed`.
 */
export function calculateShiftDues(
  state: Pick<GameState, 'difficulty' | 'shiftNumber' | 'upgrades'>,
): ShiftDuesBreakdown {
  const diff = getDifficultyConfig(state.difficulty);
  const penCount = getPenCapacity(state.upgrades);
  const bedCount = getNapBedCapacity(state.upgrades);

  const dailyRent = diff.baseRent + Math.max(0, state.shiftNumber - 1) * diff.rentPerShift;
  const penUpkeep = penCount * diff.upkeepPerPen;
  const bedUpkeep = bedCount * diff.upkeepPerBed;

  return {
    dailyRent,
    penUpkeep,
    bedUpkeep,
    totalDues: dailyRent + penUpkeep + bedUpkeep,
  };
}

export interface HaggleOutcome {
  accepted: boolean;
  walkedOut: boolean;
  newOffer: number;
  newPatience: number;
  successChance: number;
  note: string;
}

/**
 * Push-your-luck counter negotiation (up to 2 haggles per shopper):
 * - `+15%`: safer bump (~68% baseline), mild patience cost on fail.
 * - `+30%`: greedy bump (~44% baseline), steep patience hit or immediate walk-out.
 */
export function evaluateHaggleAttempt(
  offer: CounterOffer,
  boostPct: 15 | 30,
  difficulty: DifficultyId,
  rng: RngFn,
): HaggleOutcome {
  const diff = getDifficultyConfig(difficulty);
  const arch = CUSTOMER_ARCHETYPES[offer.archetypeId];
  const baseChance = boostPct === 15 ? 0.68 : 0.44;
  const affinity = (offer.trendMatched ? 0.08 : 0) + (offer.archetypeMatched ? 0.08 : 0);
  const patienceFactor = (offer.patience / Math.max(1, offer.maxPatience) - 0.5) * 0.14;
  const repeatPenalty = offer.haggleAttempts * -0.15;

  const successChance = Number(
    clamp(
      baseChance +
        arch.haggleEase +
        affinity +
        patienceFactor +
        repeatPenalty +
        diff.haggleSuccessModifier,
      0.1,
      0.92,
    ).toFixed(2),
  );

  if (rng() <= successChance) {
    const newOffer = Math.round(offer.currentOffer * (1 + boostPct / 100));
    const patienceSpent = boostPct === 15 ? 1 : 2;
    const newPatience = Math.max(1, offer.patience - patienceSpent);
    return {
      accepted: true,
      walkedOut: false,
      newOffer,
      newPatience,
      successChance,
      note: `${offer.customerName} agreed to ₽${newOffer.toLocaleString()}!`,
    };
  }

  // Failure drops patience sharply or triggers immediate walk-out on greedy push
  const patienceHit =
    boostPct === 30
      ? Math.max(4, Math.ceil(offer.maxPatience * 0.6))
      : Math.max(2, Math.ceil(offer.maxPatience * 0.35));
  const newPatience = Math.max(0, offer.patience - patienceHit);
  const criticalWalkout = boostPct === 30 && rng() < 0.45;
  const walkedOut = criticalWalkout || newPatience <= 0;

  return {
    accepted: false,
    walkedOut,
    newOffer: offer.currentOffer,
    newPatience: walkedOut ? 0 : newPatience,
    successChance,
    note: walkedOut
      ? `${offer.customerName} frowned at the price and left the counter!`
      : `${offer.customerName} shook their head — patience dropped!`,
  };
}

export interface GiftBallCheckoutResult {
  ballUsed: GiftBallSlug;
  tipBonus: number;
  xpBonus: number;
  consumed: boolean;
}

/** Resolves optional checkout gift-wrap Poké Ball tips, falling back to free Poké Ball. */
export function resolveCheckoutGiftBall(
  activeBall: GiftBallSlug,
  inventory: Partial<Record<string, number>>,
): GiftBallCheckoutResult {
  if (activeBall === 'poke-ball' || (inventory[activeBall] ?? 0) <= 0) {
    return { ballUsed: 'poke-ball', tipBonus: 0, xpBonus: 0, consumed: false };
  }
  const def = getItemDefinition(activeBall);
  return {
    ballUsed: activeBall,
    tipBonus: def.tipBonus ?? 0,
    xpBonus: def.xpBonus ?? 0,
    consumed: true,
  };
}
