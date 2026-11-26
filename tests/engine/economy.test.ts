/**
 * Unit tests for supply/demand pricing, shift market trends, oversupply saturation,
 * customer archetype valuation, markup buy-chance math, and gift-wrap ball tips.
 */
import { describe, expect, it } from 'vitest';
import { getMarketTrend } from '../../src/data/trends';
import type { PokemonInstance } from '../../src/data/types';
import {
  calculateBuyProbability,
  calculatePokemonValuation,
  getSaturationMultiplier,
  resolveCheckoutGiftBall,
} from '../../src/engine/economy';

const sampleEevee: PokemonInstance = {
  uid: 'eevee-1',
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

describe('Cozy Economy, Trends, Saturation & Archetypes', () => {
  it('applies active shift trend multiplier and gentle capped saturation penalty', () => {
    const rainyTrend = getMarketTrend('rainy-afternoon-nap'); // Water & Normal +40%
    const normalVal = calculatePokemonValuation(sampleEevee, rainyTrend, 'bargain-browser', 0, 100);
    expect(normalVal.breakdown.trendMatched).toBe(true);
    expect(normalVal.breakdown.trendMultiplier).toBe(1.4);

    // Saturation starts only after > 2 recent sales and caps at 0.70 (-30%)
    expect(getSaturationMultiplier(0)).toBe(1.0);
    expect(getSaturationMultiplier(2)).toBe(1.0);
    expect(getSaturationMultiplier(3)).toBe(0.92);
    expect(getSaturationMultiplier(10)).toBe(0.7);

    const saturatedVal = calculatePokemonValuation(
      sampleEevee,
      rainyTrend,
      'bargain-browser',
      10,
      100,
    );
    expect(saturatedVal.fairValue).toBeLessThan(normalVal.fairValue);
  });

  it('gives distinct archetype bonuses across all 4 customer types and 3x for Shiny', () => {
    const teaTrend = getMarketTrend('tea-club-visit'); // Sleepy / Docile +45%
    const sleepyMon: PokemonInstance = {
      ...sampleEevee,
      trait: 'Sleepy',
      isShiny: false,
    };

    const collector = calculatePokemonValuation(sleepyMon, teaTrend, 'cozy-collector', 0, 100);
    const trendFan = calculatePokemonValuation(sleepyMon, teaTrend, 'trend-fan', 0, 100);
    const bargain = calculatePokemonValuation(sleepyMon, teaTrend, 'bargain-browser', 0, 100);

    expect(collector.breakdown.archetypeMultiplier).toBe(1.25);
    expect(trendFan.breakdown.archetypeMultiplier).toBe(1.3);
    expect(bargain.breakdown.archetypeMultiplier).toBe(1.0);
    expect(trendFan.fairValue).toBeGreaterThan(collector.fairValue);
    expect(collector.fairValue).toBeGreaterThan(bargain.fairValue);

    const shinyMon: PokemonInstance = { ...sleepyMon, isShiny: true };
    const shinySeeker = calculatePokemonValuation(shinyMon, teaTrend, 'shiny-seeker', 0, 100);
    expect(shinySeeker.breakdown.shinyMultiplier).toBe(3.0);
    expect(shinySeeker.breakdown.archetypeMultiplier).toBe(1.35);
    expect(shinySeeker.fairValue).toBeGreaterThan(bargain.fairValue * 3);
  });

  it('reduces buy probability gently as markup exceeds archetype tolerance', () => {
    const fairBargain = calculateBuyProbability('bargain-browser', 95, false, false);
    const steepBargain = calculateBuyProbability('bargain-browser', 150, false, false);
    const steepSeeker = calculateBuyProbability('shiny-seeker', 145, true, false);

    expect(fairBargain).toBeGreaterThan(0.85);
    expect(steepBargain).toBeLessThan(0.25);
    expect(steepSeeker).toBeGreaterThan(0.8);
  });

  it('applies specialty gift-wrap ball tips and falls back to Poke Ball when empty', () => {
    const luxury = resolveCheckoutGiftBall('luxury-ball', { 'luxury-ball': 2 });
    expect(luxury.consumed).toBe(true);
    expect(luxury.tipBonus).toBe(150);
    expect(luxury.xpBonus).toBe(16);

    const fallback = resolveCheckoutGiftBall('luxury-ball', { 'luxury-ball': 0 });
    expect(fallback.consumed).toBe(false);
    expect(fallback.ballUsed).toBe('poke-ball');
    expect(fallback.tipBonus).toBe(0);
  });
});
