/**
 * Four distinct PokéMart visitor archetypes with visible badges and pricing rules.
 */
import type { CustomerArchetype, CustomerArchetypeId } from './types';

export const CUSTOMER_ARCHETYPES: Record<CustomerArchetypeId, CustomerArchetype> = {
  'cozy-collector': {
    id: 'cozy-collector',
    name: 'Cozy Collector',
    badgeLabel: 'Cozy Collector',
    shortTag: 'Loves Sleepy/Docile/Cozy & Cute (+25%)',
    accentClass: 'bg-berry-100 text-wood-900 border-berry-500',
    description:
      'Pays +25% for Sleepy, Docile, or Cozy traits and high Cute stats.',
    markupTolerance: 128,
    bonusMultiplier: 1.25,
  },
  'bargain-browser': {
    id: 'bargain-browser',
    name: 'Bargain Browser',
    badgeLabel: 'Bargain Browser',
    shortTag: 'Buys fast near base price',
    accentClass: 'bg-sage-100 text-sage-800 border-sage-600',
    description:
      'Adopts quickly at fair 80%–105% markups; politely browses elsewhere on steep markups.',
    markupTolerance: 105,
    bonusMultiplier: 1.0,
  },
  'trend-fan': {
    id: 'trend-fan',
    name: 'Trend Fan',
    badgeLabel: 'Trend Fan',
    shortTag: 'Chases Shift Trend (+30%)',
    accentClass: 'bg-honey-100 text-wood-900 border-honey-600',
    description:
      'Offers an extra +30% bonus when a Pokémon matches the active Shift Market Trend.',
    markupTolerance: 132,
    bonusMultiplier: 1.3,
  },
  'shiny-seeker': {
    id: 'shiny-seeker',
    name: 'Shiny Seeker',
    badgeLabel: 'Shiny Seeker',
    shortTag: 'Premiums for Shiny & Rare (+35%)',
    accentClass: 'bg-lavender-100 text-lavender-600 border-lavender-600',
    description:
      'Rare collector thrilled to pay +35% extra for Shiny Pokémon or Rarity 70+.',
    markupTolerance: 148,
    bonusMultiplier: 1.35,
  },
};

export const CUSTOMER_FIRST_NAMES: Record<CustomerArchetypeId, string[]> = {
  'cozy-collector': ['Mina', 'Lana', 'Cyrus Jr.', 'Hana', 'Mallow'],
  'bargain-browser': ['Joey', 'Benny', 'Pip', 'Nori', 'Sam'],
  'trend-fan': ['Cheryl', 'Dawn', 'Lucas', 'Sora', 'Mei'],
  'shiny-seeker': ['Steven', 'Cynthia', 'Jasmine', 'Riley', 'Volo'],
};
