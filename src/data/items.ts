/**
 * Static shop item definitions and mechanical effects for PokéMart: Low Cortisol Shift.
 */
import type { ItemDefinition, ItemSlug } from './types';

export const ITEMS_CATALOG: ItemDefinition[] = [
  // Evolution Stones
  {
    slug: 'water-stone',
    name: 'Water Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Eevee into Vaporeon and boosts Comfort.',
  },
  {
    slug: 'fire-stone',
    name: 'Fire Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Eevee, Vulpix, or Growlithe into cozy warmth.',
  },
  {
    slug: 'thunder-stone',
    name: 'Thunder Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Eevee or Pikachu into an electric icon.',
  },
  {
    slug: 'leaf-stone',
    name: 'Leaf Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Eevee into forest-scented Leafeon.',
  },
  {
    slug: 'moon-stone',
    name: 'Moon Stone',
    category: 'stone',
    cost: 440,
    description: 'Evolves Jigglypuff into Wigglytuff or Eevee into Umbreon.',
  },

  // Care Drinks & Berries
  {
    slug: 'oran-berry',
    name: 'Oran Berry',
    category: 'care',
    cost: 75,
    description: 'Restores +35% stray nap recovery or +4 Comfort.',
    healBoost: 35,
    comfortBoost: 4,
  },
  {
    slug: 'sitrus-berry',
    name: 'Sitrus Berry',
    category: 'care',
    cost: 140,
    description: 'Restores +60% stray nap recovery or +7 Comfort & +3 Cute.',
    healBoost: 60,
    comfortBoost: 7,
    cuteBoost: 3,
  },
  {
    slug: 'fresh-water',
    name: 'Fresh Water',
    category: 'care',
    cost: 90,
    description: 'Restores +40% stray nap recovery or +5 Cute.',
    healBoost: 40,
    cuteBoost: 5,
  },
  {
    slug: 'moomoo-milk',
    name: 'Moomoo Milk',
    category: 'care',
    cost: 170,
    description: 'Full cozy nourishment: +75% nap recovery or +8 Comfort & +5 Cute.',
    healBoost: 75,
    comfortBoost: 8,
    cuteBoost: 5,
  },
  {
    slug: 'potion',
    name: 'Potion',
    category: 'care',
    cost: 110,
    description: 'Gentle recovery spray: +55% stray nap recovery or +5 Comfort.',
    healBoost: 55,
    comfortBoost: 5,
  },

  // Specialty Rarity Boost
  {
    slug: 'rare-candy',
    name: 'Rare Candy',
    category: 'candy',
    cost: 340,
    description: 'Boosts Rarity (+10) and Cute (+4), raising shop appraisal value.',
    rarityBoost: 10,
    cuteBoost: 4,
  },

  // Checkout Gift-Wrap Balls
  {
    slug: 'poke-ball',
    name: 'Poké Ball Wrap',
    category: 'ball',
    cost: 0,
    description: 'Standard cheerful ribbon checkout (always free).',
    tipBonus: 0,
    xpBonus: 0,
  },
  {
    slug: 'heal-ball',
    name: 'Heal Ball Wrap',
    category: 'ball',
    cost: 65,
    description: 'Pink pastel gift wrap: +₽60 tip & +8 Cozy XP per adoption.',
    tipBonus: 60,
    xpBonus: 8,
  },
  {
    slug: 'friend-ball',
    name: 'Friend Ball Wrap',
    category: 'ball',
    cost: 85,
    description: 'Sage friendship ribbon: +₽85 tip & +12 Cozy XP per adoption.',
    tipBonus: 85,
    xpBonus: 12,
  },
  {
    slug: 'luxury-ball',
    name: 'Luxury Ball Wrap',
    category: 'ball',
    cost: 130,
    description: 'Gold velvet ribbon: +₽150 tip & +16 Cozy XP per adoption.',
    tipBonus: 150,
    xpBonus: 16,
  },
];

export const ITEMS_BY_SLUG: Record<string, ItemDefinition> = Object.fromEntries(
  ITEMS_CATALOG.map((item) => [item.slug, item]),
);

/** Returns a static item definition or throws if slug is missing. */
export function getItemDefinition(slug: ItemSlug): ItemDefinition {
  const item = ITEMS_BY_SLUG[slug];
  if (!item) {
    throw new Error(`Unknown shop item slug: ${slug}`);
  }
  return item;
}
