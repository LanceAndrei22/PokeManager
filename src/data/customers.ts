/**
 * Five shop visitor archetypes governing pen appraisal, patience at Kecleon's
 * counter, and push-your-luck haggle tolerance.
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
    basePatience: 16,
    haggleEase: 0.08,
  },
  'bargain-browser': {
    id: 'bargain-browser',
    name: 'Bargain Browser',
    badgeLabel: 'Bargain Browser',
    shortTag: 'Buys fast near base price; tough haggler',
    accentClass: 'bg-sage-100 text-sage-800 border-sage-600',
    description:
      'Queues fast at 80%–105% prices, walks out quickly if pushed too far.',
    markupTolerance: 105,
    bonusMultiplier: 1.0,
    basePatience: 14,
    haggleEase: -0.14,
  },
  'trend-fan': {
    id: 'trend-fan',
    name: 'Trend Fan',
    badgeLabel: 'Trend Fan',
    shortTag: 'Chases Shift Trend (+30%)',
    accentClass: 'bg-honey-100 text-wood-900 border-honey-600',
    description:
      'Offers +30% extra when a Pokémon matches today’s active Market Trend.',
    markupTolerance: 132,
    bonusMultiplier: 1.3,
    basePatience: 15,
    haggleEase: 0.04,
  },
  'shiny-seeker': {
    id: 'shiny-seeker',
    name: 'Shiny Seeker',
    badgeLabel: 'Shiny Seeker',
    shortTag: 'Premiums for Shiny & Rare (+35%)',
    accentClass: 'bg-lavender-100 text-lavender-600 border-lavender-600',
    description:
      'Thrilled to pay +35% extra for Shiny Pokémon or Rarity 70+.',
    markupTolerance: 148,
    bonusMultiplier: 1.35,
    basePatience: 17,
    haggleEase: 0.12,
  },
  'vip-seeker': {
    id: 'vip-seeker',
    name: 'VIP Collector',
    badgeLabel: 'VIP Collector',
    shortTag: 'Seeks Legendaries, Mythicals & Pseudo-Legends (+45%)',
    accentClass: 'bg-honey-100 text-wood-900 border-wood-900',
    description:
      'High-roller patron paying huge premiums (+45%) for Legendary, Mythical, or Pseudo-Legendary companions.',
    markupTolerance: 155,
    bonusMultiplier: 1.45,
    basePatience: 18,
    haggleEase: 0.16,
  },
};

export const CUSTOMER_FIRST_NAMES: Record<CustomerArchetypeId, string[]> = {
  'cozy-collector': ['Mina', 'Lana', 'Hana', 'Mallow', 'Wally'],
  'bargain-browser': ['Joey', 'Benny', 'Pip', 'Nori', 'Sam'],
  'trend-fan': ['Cheryl', 'Dawn', 'Lucas', 'Sora', 'Mei'],
  'shiny-seeker': ['Steven', 'Jasmine', 'Riley', 'Volo', 'Wallace'],
  'vip-seeker': ['Cynthia', 'Lance', 'Palmer', 'Noland', 'Caitlin'],
};
