/**
 * PMD Pokémon NPC cast for PokéMart: Low Cortisol Shift (v2).
 * Store Clerk Kecleon stands behind the register counter, while animated PMD
 * Pokémon shoppers browse pens and queue at the counter with archetype personalities.
 */
import type { CustomerArchetypeId } from './types';
import { pickRandom, type RngFn } from '../engine/rng';

export interface PmdNpcProfile {
  speciesId: number;
  paddedId: string;
  name: string;
  role: string;
}

/** Store Clerk standing behind the PokéMart register counter. */
export const CLERK_NPC: PmdNpcProfile = {
  speciesId: 352,
  paddedId: '0352',
  name: 'Kecleon',
  role: 'Shopkeeper',
};

/** Archetype-matched PMD Pokémon shoppers bundled locally for instant offline boot. */
export const SHOPPER_NPCS_BY_ARCHETYPE: Record<CustomerArchetypeId, PmdNpcProfile[]> = {
  'bargain-browser': [
    { speciesId: 52, paddedId: '0052', name: 'Meowth', role: 'Bargain Browser' },
    { speciesId: 399, paddedId: '0399', name: 'Bidoof', role: 'Bargain Browser' },
    { speciesId: 263, paddedId: '0263', name: 'Zigzagoon', role: 'Bargain Browser' },
  ],
  'cozy-collector': [
    { speciesId: 40, paddedId: '0040', name: 'Wigglytuff', role: 'Cozy Collector' },
    { speciesId: 113, paddedId: '0113', name: 'Chansey', role: 'Cozy Collector' },
    { speciesId: 143, paddedId: '0143', name: 'Snorlax', role: 'Cozy Collector' },
  ],
  'trend-fan': [
    { speciesId: 279, paddedId: '0279', name: 'Pelipper', role: 'Trend Fan' },
    { speciesId: 272, paddedId: '0272', name: 'Ludicolo', role: 'Trend Fan' },
    { speciesId: 417, paddedId: '0417', name: 'Pachirisu', role: 'Trend Fan' },
  ],
  'shiny-seeker': [
    { speciesId: 53, paddedId: '0053', name: 'Persian', role: 'Shiny Seeker' },
    { speciesId: 430, paddedId: '0430', name: 'Honchkrow', role: 'Shiny Seeker' },
    { speciesId: 448, paddedId: '0448', name: 'Lucario', role: 'Shiny Seeker' },
  ],
  'vip-seeker': [
    { speciesId: 53, paddedId: '0053', name: 'Persian', role: 'VIP Legendary Seeker' },
    { speciesId: 430, paddedId: '0430', name: 'Honchkrow', role: 'VIP Legendary Seeker' },
    { speciesId: 448, paddedId: '0448', name: 'Lucario', role: 'VIP Legendary Seeker' },
  ],
};

/** Selects a matching PMD shopper NPC species for the given customer archetype. */
export function pickShopperNpc(archetypeId: CustomerArchetypeId, rng: RngFn): PmdNpcProfile {
  return pickRandom(SHOPPER_NPCS_BY_ARCHETYPE[archetypeId], rng);
}
