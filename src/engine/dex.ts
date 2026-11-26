/**
 * Adoption Dex discovery tracking and Cozy Rank progression logic.
 */
import { SPECIES_CATALOG } from '../data/species';
import type { AdoptionDexEntry } from '../data/types';

export interface CozyRankTier {
  rank: number;
  title: string;
  minXp: number;
}

export const COZY_RANK_TIERS: CozyRankTier[] = [
  { rank: 1, title: 'Tea Kettle Trainee', minXp: 0 },
  { rank: 2, title: 'Matcha Mart Host', minXp: 120 },
  { rank: 3, title: 'Sinnoh Nap Warden', minXp: 320 },
  { rank: 4, title: 'Platinum Cozy Curator', minXp: 620 },
  { rank: 5, title: 'Grand Low-Cortisol Master', minXp: 1050 },
];

export interface CozyRankInfo {
  rank: number;
  title: string;
  xp: number;
  currentTierXp: number;
  nextRankXp: number | null;
  progressPct: number;
  unlockedSpeciesCount: number;
}

/** Computes current Cozy Rank, title, progress bar %, and unlocked catalog count. */
export function getCozyRankInfo(cozyXp: number): CozyRankInfo {
  let current = COZY_RANK_TIERS[0];
  for (const tier of COZY_RANK_TIERS) {
    if (cozyXp >= tier.minXp) {
      current = tier;
    }
  }
  const nextTier = COZY_RANK_TIERS.find((tier) => tier.rank === current.rank + 1) ?? null;
  const progressPct = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(((cozyXp - current.minXp) / (nextTier.minXp - current.minXp)) * 100),
        ),
      )
    : 100;

  const unlockedSpeciesCount = SPECIES_CATALOG.filter(
    (species) => species.minCozyRank <= current.rank,
  ).length;

  return {
    rank: current.rank,
    title: current.title,
    xp: cozyXp,
    currentTierXp: current.minXp,
    nextRankXp: nextTier ? nextTier.minXp : null,
    progressPct,
    unlockedSpeciesCount,
  };
}

/**
 * Records a Normal/Shiny sighting and increments adopted/hatched/evolved counters
 * inside the player's Adoption Dex.
 */
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

/** Aggregates summary counters displayed at the top of the Adoption Dex modal. */
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
