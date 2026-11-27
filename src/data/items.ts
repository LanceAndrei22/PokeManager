/**
 * Static shop item definitions and mechanical effects for PokéMart v2.
 * Includes all 9 Gen 1–4 Evolution Stones, Rare Candy level-up evolution/boosts,
 * Care Drinks/Berries, and 5 checkout Gift-Wrap Poké Balls.
 */
import type { GiftBallSlug, ItemDefinition, ItemSlug } from './types';

/** Ordered list of checkout Gift-Wrap Poké Balls shared across Display Pens and Counter panels. */
export const GIFT_BALL_OPTIONS: readonly GiftBallSlug[] = [
  'poke-ball',
  'heal-ball',
  'friend-ball',
  'luxury-ball',
  'cherish-ball',
];

export const ITEMS_CATALOG: ItemDefinition[] = [
  // All 9 Gen 1–4 Evolution Stones
  {
    slug: 'water-stone',
    name: 'Water Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Water-stone Pokémon (Eevee → Vaporeon, Staryu, Poliwhirl, Lombre).',
  },
  {
    slug: 'fire-stone',
    name: 'Fire Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Fire-stone Pokémon (Eevee → Flareon, Vulpix, Growlithe).',
  },
  {
    slug: 'thunder-stone',
    name: 'Thunder Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Electric-stone Pokémon (Eevee → Jolteon, Pikachu → Raichu).',
  },
  {
    slug: 'leaf-stone',
    name: 'Leaf Stone',
    category: 'stone',
    cost: 420,
    description: 'Evolves Grass-stone Pokémon (Eevee → Leafeon, Gloom, Exeggcute, Nuzleaf).',
  },
  {
    slug: 'moon-stone',
    name: 'Moon Stone',
    category: 'stone',
    cost: 440,
    description: 'Evolves Moon-stone Pokémon (Clefairy, Jigglypuff, Skitty, Eevee → Umbreon).',
  },
  {
    slug: 'sun-stone',
    name: 'Sun Stone',
    category: 'stone',
    cost: 450,
    description: 'Evolves Sun-stone Pokémon (Gloom → Bellossom, Sunkern → Sunflora).',
  },
  {
    slug: 'shiny-stone',
    name: 'Shiny Stone',
    category: 'stone',
    cost: 520,
    description: 'Evolves Sinnoh light-stone lines (Togetic → Togekiss, Roselia → Roserade).',
  },
  {
    slug: 'dusk-stone',
    name: 'Dusk Stone',
    category: 'stone',
    cost: 520,
    description: 'Evolves Sinnoh shadow-stone lines (Murkrow → Honchkrow, Misdreavus → Mismagius).',
  },
  {
    slug: 'dawn-stone',
    name: 'Dawn Stone',
    category: 'stone',
    cost: 520,
    description: 'Evolves Sinnoh dawn-stone lines (Kirlia → Gallade, Snorunt → Froslass).',
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
    description: 'Full nourishment: +75% nap recovery or +8 Comfort & +5 Cute.',
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

  // Level-up Evolution / Rarity Boost
  {
    slug: 'rare-candy',
    name: 'Rare Candy',
    category: 'candy',
    cost: 340,
    description: 'Triggers standard next-stage evolution (e.g. Bulbasaur → Ivysaur) or +10 Rarity & +4 Cute.',
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
    description: 'Pink pastel gift wrap: +₽60 tip & +8 Shop XP per adoption.',
    tipBonus: 60,
    xpBonus: 8,
  },
  {
    slug: 'friend-ball',
    name: 'Friend Ball Wrap',
    category: 'ball',
    cost: 85,
    description: 'Sage friendship ribbon: +₽85 tip & +12 Shop XP per adoption.',
    tipBonus: 85,
    xpBonus: 12,
  },
  {
    slug: 'luxury-ball',
    name: 'Luxury Ball Wrap',
    category: 'ball',
    cost: 130,
    description: 'Gold velvet ribbon: +₽150 tip & +16 Shop XP per adoption.',
    tipBonus: 150,
    xpBonus: 16,
  },
  {
    slug: 'cherish-ball',
    name: 'Cherish Ball Wrap',
    category: 'ball',
    cost: 220,
    description: 'Royal crimson ribbon: +₽260 tip & +25 Shop XP (ideal for VIP Legendaries).',
    tipBonus: 260,
    xpBonus: 25,
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
