/**
 * Cozy Shift Market Trends rolled at the start of every PokéMart shift.
 * Trends boost customer valuations for matching Pokémon types or chill traits.
 */
import type { MarketTrend } from './types';

export const MARKET_TRENDS: MarketTrend[] = [
  {
    id: 'rainy-afternoon-nap',
    title: 'Rainy Afternoon Nap',
    description: 'Soft rain taps the awning — Water & Normal-type companions fetch +40% valuation.',
    badge: 'Water / Normal +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species) =>
      species.types.includes('water') || species.types.includes('normal'),
  },
  {
    id: 'tea-club-visit',
    title: 'Tea Club Visit',
    description: 'Local chamomile fans seek Sleepy & Docile traits (+45% valuation).',
    badge: 'Sleepy / Docile +45%',
    bonusMultiplier: 1.45,
    matchesPokemon: (_species, pokemon) =>
      pokemon.trait === 'Sleepy' || pokemon.trait === 'Docile',
  },
  {
    id: 'sinnoh-park-stroll',
    title: 'Sinnoh Park Stroll',
    description: 'Picnic shoppers adore Grass & Fairy-types (+40% valuation).',
    badge: 'Grass / Fairy +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species) =>
      species.types.includes('grass') || species.types.includes('fairy'),
  },
  {
    id: 'hearth-fireplace-hour',
    title: 'Hearth & Cocoa Hour',
    description: 'Chilly breeze outside draws crowds to Fire & Cozy companions (+40%).',
    badge: 'Fire / Cozy +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species, pokemon) =>
      species.types.includes('fire') || pokemon.trait === 'Cozy',
  },
  {
    id: 'lofi-study-night',
    title: 'Lo-Fi Study Night',
    description: 'Students love Electric, Psychic, and Unbothered study buddies (+42%).',
    badge: 'Electric / Psychic / Unbothered +42%',
    bonusMultiplier: 1.42,
    matchesPokemon: (species, pokemon) =>
      species.types.includes('electric') ||
      species.types.includes('psychic') ||
      pokemon.trait === 'Unbothered',
  },
  {
    id: 'starlight-bakery-rush',
    title: 'Starlight Bakery Rush',
    description: 'Sweet-toothed visitors fawn over Cute ≥ 85 companions (+38%).',
    badge: 'Cute 85+ +38%',
    bonusMultiplier: 1.38,
    matchesPokemon: (_species, pokemon) => pokemon.stats.cute >= 85,
  },
  {
    id: 'lucky-bell-festival',
    title: 'Lucky Bell Festival',
    description: 'Charm seekers prize Lucky traits and Rarity ≥ 70 companions (+45%).',
    badge: 'Lucky / Rare +45%',
    bonusMultiplier: 1.45,
    matchesPokemon: (_species, pokemon) =>
      pokemon.trait === 'Lucky' || pokemon.stats.rarity >= 70,
  },
  {
    id: 'soft-blanket-weekend',
    title: 'Soft Blanket Weekend',
    description: 'Everyone wants high-Comfort companions (Comfort ≥ 85, +40%).',
    badge: 'Comfort 85+ +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (_species, pokemon) => pokemon.stats.comfort >= 85,
  },
];

export const TRENDS_BY_ID: Record<string, MarketTrend> = Object.fromEntries(
  MARKET_TRENDS.map((trend) => [trend.id, trend]),
);

/** Returns a market trend by ID, safely defaulting to the first trend. */
export function getMarketTrend(trendId: string): MarketTrend {
  return TRENDS_BY_ID[trendId] ?? MARKET_TRENDS[0];
}
