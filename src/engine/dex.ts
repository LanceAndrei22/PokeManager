/**
 * Adoption Dex discovery tracking and 10-tier Shop Rank progression across 493 species.
 */
import { SPECIES_CATALOG } from '../data/species';
import type { AdoptionDexEntry } from '../data/types';

export interface ShopRankTier {
  rank: number;
  title: string;
  minXp: number;
}

export const SHOP_RANK_TIERS: ShopRankTier[] = [
  { rank: 1, title: 'Tea Kettle Trainee', minXp: 0 },
  { rank: 2, title: 'Matcha Mart Clerk', minXp: 90 },
  { rank: 3, title: 'Kecleon Apprentice', minXp: 220 },
  { rank: 4, title: 'Sinnoh Nap Warden', minXp: 400 },
  { rank: 5, title: 'Counter Negotiator', minXp: 640 },
  { rank: 6, title: 'VIP Contract Broker', minXp: 950 },
  { rank: 7, title: 'Guild Provisioner', minXp: 1350 },
  { rank: 8, title: 'Pseudo-Legend Curator', minXp: 1850 },
  { rank: 9, title: 'Legendary Liaison', minXp: 2500 },
  { rank: 10, title: 'Grand Kecleon Guildmaster', minXp: 3400 },
];

export interface ShopRankInfo {
  rank: number;
  title: string;
  xp: number;
  currentTierXp: number;
  nextRankXp: number | null;
  progressPct: number;
  unlockedSpeciesCount: number;
}

/** Computes current Shop Rank (1–10), title, progress %, and unlocked species count. */
export function getCozyRankInfo(cozyXp: number): ShopRankInfo {
  const safeXp = Math.max(0, cozyXp);
  let current = SHOP_RANK_TIERS[0];
  for (const tier of SHOP_RANK_TIERS) {
    if (safeXp >= tier.minXp) {
      current = tier;
    }
  }
  const nextTier = SHOP_RANK_TIERS.find((tier) => tier.rank === current.rank + 1) ?? null;
  const progressPct = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(((safeXp - current.minXp) / (nextTier.minXp - current.minXp)) * 100),
        ),
      )
    : 100;

  const unlockedSpeciesCount = SPECIES_CATALOG.filter(
    (species) => species.unlockRank <= current.rank,
  ).length;

  return {
    rank: current.rank,
    title: current.title,
    xp: safeXp,
    currentTierXp: current.minXp,
    nextRankXp: nextTier ? nextTier.minXp : null,
    progressPct,
    unlockedSpeciesCount,
  };
}

/** Alias matching v2 Shop Rank terminology. */
export const getShopRankInfo = getCozyRankInfo;

/** Records a Normal/Shiny sighting and adoption/hatch/evolution counts in the Dex. */
export function recordDexDiscovery(
  dex: Record<number, AdoptionDexEntry>,
  speciesId: number,
  options: {
    isShiny: boolean;
    event: 'seen' | 'adopted' | 'hatched' | 'evolved';
  },
): Record<number, AdoptionDexEntry> {
  const prev = dex[speciesId] ?? {
    speciesId,
    seenNormal: false,
    seenShiny: false,
    adoptedCount: 0,
    hatchedCount: 0,
    evolvedCount: 0,
  };

  const next: AdoptionDexEntry = {
    ...prev,
    seenNormal: prev.seenNormal || !options.isShiny,
    seenShiny: prev.seenShiny || options.isShiny,
    adoptedCount: prev.adoptedCount + (options.event === 'adopted' ? 1 : 0),
    hatchedCount: prev.hatchedCount + (options.event === 'hatched' ? 1 : 0),
    evolvedCount: prev.evolvedCount + (options.event === 'evolved' ? 1 : 0),
  };

  return {
    ...dex,
    [speciesId]: next,
  };
}

export interface DexSummary {
  totalSpecies: number;
  discoveredSpecies: number;
  shinySpecies: number;
  totalAdoptions: number;
  totalHatched: number;
  totalEvolved: number;
}

/** Aggregates summary counters across all 493 Gen 1–4 species. */
export function getDexSummary(dex: Record<number, AdoptionDexEntry>): DexSummary {
  const entries = Object.values(dex);
  return {
    totalSpecies: SPECIES_CATALOG.length,
    discoveredSpecies: entries.filter((entry) => entry.seenNormal || entry.seenShiny).length,
    shinySpecies: entries.filter((entry) => entry.seenShiny).length,
    totalAdoptions: entries.reduce((sum, entry) => sum + entry.adoptedCount, 0),
    totalHatched: entries.reduce((sum, entry) => sum + entry.hatchedCount, 0),
    totalEvolved: entries.reduce((sum, entry) => sum + entry.evolvedCount, 0),
  };
}
