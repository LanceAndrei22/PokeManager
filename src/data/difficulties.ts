/**
 * Three tycoon difficulty presets stored per Shift Manager profile.
 * Governs starting capital, daily rent/upkeep scaling, shopper patience,
 * counter haggle odds, Debt Grace shifts, and High Stakes VIP/Shiny rewards.
 */
import type { DifficultyConfig, DifficultyId } from './types';

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  relaxed: {
    id: 'relaxed',
    name: 'Relaxed',
    tagline: 'Generous ₽3,500 budget, gentle rent, patient browsers & 1 Debt Grace shift.',
    startingCash: 3500,
    baseRent: 150,
    rentPerShift: 25,
    upkeepPerPen: 30,
    upkeepPerBed: 20,
    debtGraceShifts: 1,
    patienceMultiplier: 1.45,
    haggleSuccessModifier: 0.14,
    walkoutXpPenalty: 0,
    wholesaleCostMultiplier: 0.9,
    shinyBonus: 0,
    vipRankFloor: 6,
    vipPayoutMultiplier: 1.0,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'Balanced ₽2,000 capital, scaling rent, fair haggling & 1 Debt Grace shift.',
    startingCash: 2000,
    baseRent: 350,
    rentPerShift: 60,
    upkeepPerPen: 55,
    upkeepPerBed: 35,
    debtGraceShifts: 1,
    patienceMultiplier: 1.0,
    haggleSuccessModifier: 0,
    walkoutXpPenalty: 8,
    wholesaleCostMultiplier: 1.0,
    shinyBonus: 0,
    vipRankFloor: 6,
    vipPayoutMultiplier: 1.0,
  },
  'high-stakes': {
    id: 'high-stakes',
    name: 'High Stakes',
    tagline: 'Lean ₽1,200 start, steep rent, 0 Debt Grace — plus boosted Shiny & VIP payouts.',
    startingCash: 1200,
    baseRent: 550,
    rentPerShift: 95,
    upkeepPerPen: 85,
    upkeepPerBed: 50,
    debtGraceShifts: 0,
    patienceMultiplier: 0.72,
    haggleSuccessModifier: -0.12,
    walkoutXpPenalty: 16,
    wholesaleCostMultiplier: 1.12,
    shinyBonus: 0.04,
    vipRankFloor: 4,
    vipPayoutMultiplier: 1.35,
  },
};

export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTIES.relaxed,
  DIFFICULTIES.standard,
  DIFFICULTIES['high-stakes'],
];

/** Resolves a difficulty configuration safely, defaulting to `standard`. */
export function getDifficultyConfig(difficulty: DifficultyId): DifficultyConfig {
  return DIFFICULTIES[difficulty] ?? DIFFICULTIES.standard;
}
