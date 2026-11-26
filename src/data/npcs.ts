/**
 * Human Trainer NPC cast for PokéMart: Low Cortisol Shift (v2.1).
 * Store Clerk Leo manages the PokéMart counter while 15 authentic Gen 3/4 Human
 * Trainer shoppers browse pens and negotiate offers with pixel trainer portraits.
 */
import { pickRandom, type RngFn } from '../engine/rng';
import type { CustomerArchetypeId } from './types';

/** Complete visual and narrative profile for a Human Trainer NPC. */
export interface HumanNpcProfile {
  id: string;
  name: string;
  role: string;
  archetypeId: CustomerArchetypeId | 'clerk';
  overworldUrl: string;
  portraitUrl: string;
  flavorLine: string;
}

/** Default initial Shopkeeper NPC ID when creating a profile without explicit selection. */
export const DEFAULT_CLERK_ID = 'mart_employee';

/** PokéMart Store Clerk standing behind the checkout counter. */
export const CLERK_NPC: HumanNpcProfile = {
  id: 'mart_employee',
  name: 'Clerk Leo',
  role: 'PokéMart Clerk',
  archetypeId: 'clerk',
  overworldUrl: './assets/npcs/overworld/mart_employee.png',
  portraitUrl: './assets/npcs/portraits/clerk.png',
  flavorLine: 'Welcome to PokéMart! Every companion here is happy and well-rested.',
};

/**
 * Playable & hireable Counter Shopkeeper roster (6 bundled local Human Trainer sprites).
 * Players choose their initial shopkeeper when creating a profile; hiring additional
 * counter clerks via the Upgrades board draws randomly from remaining unhired clerks.
 */
export const CLERK_ROSTER: HumanNpcProfile[] = [
  CLERK_NPC,
  {
    id: 'woman_2',
    name: 'Clerk Clara',
    role: 'Care Clerk',
    archetypeId: 'clerk',
    overworldUrl: './assets/npcs/overworld/woman_2.png',
    portraitUrl: './assets/npcs/portraits/pokemonbreederf-gen4.png',
    flavorLine: 'Happy companions and calm checkouts keep every customer smiling!',
  },
  {
    id: 'camper',
    name: 'Clerk Liam',
    role: 'Trail Clerk',
    archetypeId: 'clerk',
    overworldUrl: './assets/npcs/overworld/camper.png',
    portraitUrl: './assets/npcs/portraits/camper.png',
    flavorLine: 'Quick on the register and always ready with a friendly trail tip!',
  },
  {
    id: 'lass',
    name: 'Clerk Penny',
    role: 'Front Clerk',
    archetypeId: 'clerk',
    overworldUrl: './assets/npcs/overworld/lass.png',
    portraitUrl: './assets/npcs/portraits/lass-gen4.png',
    flavorLine: 'I’ll greet every shopper at the door so nobody feels rushed!',
  },
  {
    id: 'woman_1',
    name: 'Clerk Hana',
    role: 'Boutique Clerk',
    archetypeId: 'clerk',
    overworldUrl: './assets/npcs/overworld/woman_1.png',
    portraitUrl: './assets/npcs/portraits/lady-gen4.png',
    flavorLine: 'Gracious hospitality makes every PokéMart visit unforgettable.',
  },
  {
    id: 'steven',
    name: 'Clerk Steven',
    role: 'Concierge Clerk',
    archetypeId: 'clerk',
    overworldUrl: './assets/npcs/overworld/steven.png',
    portraitUrl: './assets/npcs/portraits/steven.png',
    flavorLine: 'A steady hand at the counter puts even VIP collectors at ease.',
  },
];

const CLERK_BY_ID: Record<string, HumanNpcProfile> = Object.fromEntries(
  CLERK_ROSTER.map((clerk) => [clerk.id, clerk]),
);

/** Resolves a valid Shopkeeper profile by ID, defaulting safely to Clerk Leo. */
export function getClerkById(clerkId?: string): HumanNpcProfile {
  if (clerkId && CLERK_BY_ID[clerkId]) return CLERK_BY_ID[clerkId];
  return CLERK_NPC;
}

/** Picks a random unhired Shopkeeper from `CLERK_ROSTER` for the Hire Counter Clerk upgrade. */
export function pickRandomAdditionalClerk(
  existingClerkIds: readonly string[],
  rng: RngFn,
): HumanNpcProfile {
  const hired = new Set(existingClerkIds);
  const available = CLERK_ROSTER.filter((clerk) => !hired.has(clerk.id));
  if (available.length === 0) {
    return pickRandom(CLERK_ROSTER, rng);
  }
  return pickRandom(available, rng);
}

/** Archetype-matched Human Trainer shoppers bundled locally under `public/assets/npcs/`. */
export const HUMAN_SHOPPER_NPCS_BY_ARCHETYPE: Record<CustomerArchetypeId, HumanNpcProfile[]> = {
  normal: [
    {
      id: 'camper',
      name: 'Camper Liam',
      role: 'Normal Shopper',
      archetypeId: 'normal',
      overworldUrl: './assets/npcs/overworld/camper.png',
      portraitUrl: './assets/npcs/portraits/camper.png',
      flavorLine: 'Looking for a cheerful partner to join my weekend hikes!',
    },
    {
      id: 'hiker',
      name: 'Hiker Greg',
      role: 'Normal Shopper',
      archetypeId: 'normal',
      overworldUrl: './assets/npcs/overworld/hiker.png',
      portraitUrl: './assets/npcs/portraits/hiker-gen4.png',
      flavorLine: 'Haha! Any sturdy, friendly Pokémon catches my eye today!',
    },
    {
      id: 'woman_2',
      name: 'Breeder Clara',
      role: 'Normal Shopper',
      archetypeId: 'normal',
      overworldUrl: './assets/npcs/overworld/woman_2.png',
      portraitUrl: './assets/npcs/portraits/pokemonbreederf-gen4.png',
      flavorLine: 'You keep your shop habitats so clean — let’s make a fair deal.',
    },
    {
      id: 'man_3',
      name: 'Traveler Ben',
      role: 'Normal Shopper',
      archetypeId: 'normal',
      overworldUrl: './assets/npcs/overworld/man_3.png',
      portraitUrl: './assets/npcs/portraits/pokemonbreeder-gen4.png',
      flavorLine: 'Just stopping by PokéMart for a kind new companion!',
    },
  ],
  'bargain-browser': [
    {
      id: 'youngster',
      name: 'Youngster Joey',
      role: 'Bargain Browser',
      archetypeId: 'bargain-browser',
      overworldUrl: './assets/npcs/overworld/youngster.png',
      portraitUrl: './assets/npcs/portraits/youngster-gen4.png',
      flavorLine: 'My allowance goes far if the price tag is fair — deal?',
    },
    {
      id: 'lass',
      name: 'Lass Penny',
      role: 'Bargain Browser',
      archetypeId: 'bargain-browser',
      overworldUrl: './assets/npcs/overworld/lass.png',
      portraitUrl: './assets/npcs/portraits/lass-gen4.png',
      flavorLine: 'Ooh, cute! Just don’t push the markup too steep on me!',
    },
    {
      id: 'school_kid_m',
      name: 'School Kid Sam',
      role: 'Bargain Browser',
      archetypeId: 'bargain-browser',
      overworldUrl: './assets/npcs/overworld/school_kid_m.png',
      portraitUrl: './assets/npcs/portraits/schoolkid-gen4.png',
      flavorLine: 'I studied PokéMart pricing charts in class today!',
    },
  ],
  'cozy-collector': [
    {
      id: 'picnicker',
      name: 'Picnicker Lana',
      role: 'Cozy Collector',
      archetypeId: 'cozy-collector',
      overworldUrl: './assets/npcs/overworld/picnicker.png',
      portraitUrl: './assets/npcs/portraits/picnicker.png',
      flavorLine: 'Sleepy, cozy companions make the best picnic buddies!',
    },
    {
      id: 'woman_1',
      name: 'Lady Hana',
      role: 'Cozy Collector',
      archetypeId: 'cozy-collector',
      overworldUrl: './assets/npcs/overworld/woman_1.png',
      portraitUrl: './assets/npcs/portraits/lady-gen4.png',
      flavorLine: 'Oh my, look at that gentle temperament — worth every Pokédollar.',
    },
    {
      id: 'pokefan_f',
      name: 'Poké Fan Mina',
      role: 'Cozy Collector',
      archetypeId: 'cozy-collector',
      overworldUrl: './assets/npcs/overworld/pokefan_f.png',
      portraitUrl: './assets/npcs/portraits/pokefanf-gen4.png',
      flavorLine: 'High Cute stats steal my heart every single visit!',
    },
  ],
  'trend-fan': [
    {
      id: 'beauty',
      name: 'Beauty Aria',
      role: 'Trend Fan',
      archetypeId: 'trend-fan',
      overworldUrl: './assets/npcs/overworld/beauty.png',
      portraitUrl: './assets/npcs/portraits/beauty-gen4dp.png',
      flavorLine: 'Everyone in Jubilife wants today’s trending type!',
    },
    {
      id: 'artist',
      name: 'Artist Marco',
      role: 'Trend Fan',
      archetypeId: 'trend-fan',
      overworldUrl: './assets/npcs/overworld/artist.png',
      portraitUrl: './assets/npcs/portraits/artist-gen4.png',
      flavorLine: 'Magnifique! A trending companion inspires my next canvas.',
    },
  ],
  'shiny-seeker': [
    {
      id: 'gentleman',
      name: 'Gentleman Arthur',
      role: 'Shiny Seeker',
      archetypeId: 'shiny-seeker',
      overworldUrl: './assets/npcs/overworld/gentleman.png',
      portraitUrl: './assets/npcs/portraits/gentleman-gen4.png',
      flavorLine: 'Rarity and shimmering coats command top Pokédollars.',
    },
    {
      id: 'rich_boy',
      name: 'Rich Boy Victor',
      role: 'Shiny Seeker',
      archetypeId: 'shiny-seeker',
      overworldUrl: './assets/npcs/overworld/rich_boy.png',
      portraitUrl: './assets/npcs/portraits/richboy-gen4.png',
      flavorLine: 'Only shimmering or ultra-rare companions for my estate!',
    },
  ],
  'vip-seeker': [
    {
      id: 'steven',
      name: 'Champion Steven',
      role: 'VIP Collector',
      archetypeId: 'vip-seeker',
      overworldUrl: './assets/npcs/overworld/steven.png',
      portraitUrl: './assets/npcs/portraits/steven.png',
      flavorLine: 'A legendary partner here? Name your terms at the counter.',
    },
    {
      id: 'gentleman',
      name: 'Gentleman Arthur',
      role: 'VIP Collector',
      archetypeId: 'vip-seeker',
      overworldUrl: './assets/npcs/overworld/gentleman.png',
      portraitUrl: './assets/npcs/portraits/gentleman-gen4.png',
      flavorLine: 'I have traveled far across Sinnoh for a VIP-tier companion.',
    },
    {
      id: 'rich_boy',
      name: 'Rich Boy Victor',
      role: 'VIP Collector',
      archetypeId: 'vip-seeker',
      overworldUrl: './assets/npcs/overworld/rich_boy.png',
      portraitUrl: './assets/npcs/portraits/richboy-gen4.png',
      flavorLine: 'Money is no object for a Legend or Pseudo-Legend!',
    },
  ],
};

/** @deprecated Legacy v2.0 save migration only */
export const SHOPPER_NPCS_BY_ARCHETYPE = HUMAN_SHOPPER_NPCS_BY_ARCHETYPE;

/** Flat lookup map across Clerk + all unique Human Trainer NPCs by `id`. */
export const HUMAN_NPCS_BY_ID: Record<string, HumanNpcProfile> = (() => {
  const map: Record<string, HumanNpcProfile> = {
    [CLERK_NPC.id]: CLERK_NPC,
  };
  for (const list of Object.values(HUMAN_SHOPPER_NPCS_BY_ARCHETYPE)) {
    for (const npc of list) {
      if (!map[npc.id]) {
        map[npc.id] = npc;
      }
    }
  }
  return map;
})();

/** Ordered list of all distinct Human Trainer NPCs (Clerk + 15 shoppers). */
export const ALL_HUMAN_NPCS: HumanNpcProfile[] = Object.values(HUMAN_NPCS_BY_ID);

/** Selects a matching Human Trainer shopper profile for the given customer archetype. */
export function pickShopperNpc(archetypeId: CustomerArchetypeId, rng: RngFn): HumanNpcProfile {
  const list =
    HUMAN_SHOPPER_NPCS_BY_ARCHETYPE[archetypeId] ?? HUMAN_SHOPPER_NPCS_BY_ARCHETYPE.normal;
  return pickRandom(list, rng);
}

/** Resolves a Human NPC profile by ID (returns null if not found). */
export function getHumanNpcById(npcId: string): HumanNpcProfile | null {
  return HUMAN_NPCS_BY_ID[npcId] ?? null;
}

/**
 * Safely resolves an NPC profile for legacy v2.0 saves missing `npcId` / `npcPortraitUrl`,
 * returning the deterministic first Human Trainer in the requested archetype.
 */
export function resolveHumanNpcFallback(
  archetypeId: CustomerArchetypeId,
  npcId?: string,
): HumanNpcProfile {
  if (npcId && HUMAN_NPCS_BY_ID[npcId]) {
    return HUMAN_NPCS_BY_ID[npcId];
  }
  const pool =
    HUMAN_SHOPPER_NPCS_BY_ARCHETYPE[archetypeId] ?? HUMAN_SHOPPER_NPCS_BY_ARCHETYPE.normal;
  return pool[0];
}
