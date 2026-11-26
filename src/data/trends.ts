/**
 * Daily Shift Market Trends rolled at the start of every PokéMart shift.
 * Covers all 18 Pokémon types across the 493 Gen 1–4 Pokédex and chill traits.
 */
import type { MarketTrend } from './types';

export const MARKET_TRENDS: MarketTrend[] = [
  {
    id: 'rainy-afternoon-nap',
    title: 'Rainy Afternoon Nap',
    description: 'Soft rain taps the awning — Water & Normal-type companions fetch +40%.',
    badge: 'Water / Normal +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species) =>
      species.types.includes('water') || species.types.includes('normal'),
  },
  {
    id: 'tea-club-visit',
    title: 'Tea Club Visit',
    description: 'Local chamomile fans seek Sleepy & Docile traits (+45%).',
    badge: 'Sleepy / Docile +45%',
    bonusMultiplier: 1.45,
    matchesPokemon: (_species, pokemon) =>
      pokemon.trait === 'Sleepy' || pokemon.trait === 'Docile',
  },
  {
    id: 'sinnoh-park-stroll',
    title: 'Sinnoh Park Stroll',
    description: 'Picnic shoppers adore Grass, Bug & Fairy-types (+40%).',
    badge: 'Grass / Bug / Fairy +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species) =>
      species.types.includes('grass') ||
      species.types.includes('bug') ||
      species.types.includes('fairy'),
  },
  {
    id: 'hearth-fireplace-hour',
    title: 'Hearth & Cocoa Hour',
    description: 'Chilly breeze draws crowds to Fire, Fighting & Cozy companions (+40%).',
    badge: 'Fire / Fighting / Cozy +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species, pokemon) =>
      species.types.includes('fire') ||
      species.types.includes('fighting') ||
      pokemon.trait === 'Cozy',
  },
  {
    id: 'lofi-study-night',
    title: 'Lo-Fi Study Night',
    description: 'Students love Electric, Psychic & Unbothered study buddies (+42%).',
    badge: 'Electric / Psychic / Unbothered +42%',
    bonusMultiplier: 1.42,
    matchesPokemon: (species, pokemon) =>
      species.types.includes('electric') ||
      species.types.includes('psychic') ||
      pokemon.trait === 'Unbothered',
  },
  {
    id: 'twilight-mystery-hour',
    title: 'Twilight Mystery Hour',
    description: 'Dusk explorers prize Ghost, Dark & Poison-types (+42%).',
    badge: 'Ghost / Dark / Poison +42%',
    bonusMultiplier: 1.42,
    matchesPokemon: (species) =>
      species.types.includes('ghost') ||
      species.types.includes('dark') ||
      species.types.includes('poison'),
  },
  {
    id: 'mineral-forge-expo',
    title: 'Oreburgh Forge Expo',
    description: 'Collectors seek Rock, Ground & Steel companions (+40%).',
    badge: 'Rock / Ground / Steel +40%',
    bonusMultiplier: 1.4,
    matchesPokemon: (species) =>
      species.types.includes('rock') ||
      species.types.includes('ground') ||
      species.types.includes('steel'),
  },
  {
    id: 'snowpoint-gala',
    title: 'Snowpoint Frost Gala',
    description: 'Winter travelers adore Ice, Flying & Dragon companions (+44%).',
    badge: 'Ice / Flying / Dragon +44%',
    bonusMultiplier: 1.44,
    matchesPokemon: (species) =>
      species.types.includes('ice') ||
      species.types.includes('flying') ||
      species.types.includes('dragon'),
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
];

export const TRENDS_BY_ID: Record<string, MarketTrend> = Object.fromEntries(
  MARKET_TRENDS.map((trend) => [trend.id, trend]),
);

/** Returns a market trend by ID, safely defaulting to the first trend. */
export function getMarketTrend(trendId: string): MarketTrend {
  return TRENDS_BY_ID[trendId] ?? MARKET_TRENDS[0];
}
