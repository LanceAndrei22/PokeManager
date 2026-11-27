/**
 * 493-Species Gen 1–4 Adoption Dex Modal in PMD Navy & Gold.
 * Supports instant search (name or #ID), Legendaries & Mythicals filter,
 * Normal/Shiny discovery tabs, rarity filtering, and 48-entry pagination so
 * all 493 species browse snappily with zero request storms.
 */
import { useMemo, useState } from 'react';
import { SPECIES_CATALOG } from '../data/species';
import type { AdoptionDexEntry, RarityTier } from '../data/types';
import { getDexSummary } from '../engine/dex';
import { CozyDialog } from './CozyDialog';
import { PokemonSprite } from './PokemonSprite';

export interface AdoptionDexModalProps {
  open: boolean;
  dex: Record<number, AdoptionDexEntry>;
  onClose: () => void;
}

type DexTabFilter = 'all' | 'discovered' | 'shiny' | 'legendary';
const PAGE_SIZE = 48;

export function AdoptionDexModal({ open, dex, onClose }: AdoptionDexModalProps) {
  const [filter, setFilter] = useState<DexTabFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | RarityTier>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const summary = getDexSummary(dex);

  const legendaryCount = useMemo(
    () => SPECIES_CATALOG.filter((sp) => sp.isLegendary || sp.isMythical).length,
    [],
  );

  const filteredSpecies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return SPECIES_CATALOG.filter((species) => {
      const entry = dex[species.id];
      const discovered = Boolean(entry && (entry.seenNormal || entry.seenShiny));
      if (filter === 'discovered' && !discovered) return false;
      if (filter === 'shiny' && !entry?.seenShiny) return false;
      if (filter === 'legendary' && !species.isLegendary && !species.isMythical) return false;
      if (rarityFilter !== 'all' && species.rarityTier !== rarityFilter) return false;
      if (query) {
        const matchesName = species.name.toLowerCase().includes(query);
        const matchesId =
          String(species.id) === query ||
          species.paddedId.includes(query) ||
          `#${species.id}` === query;
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [dex, filter, rarityFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSpecies.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredSpecies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <CozyDialog
      open={open}
      onClose={onClose}
      scrollBody={false}
      title={`Adoption Dex (${summary.discoveredSpecies}/${summary.totalSpecies} Species)`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden text-xs text-[#e2eeff]">
        {/* Pinned Top Controls: Summary Stats, Search/Rarity, Category Tabs */}
        <div className="shrink-0 space-y-3">
          {/* Summary Stats */}
          <div className="pmd-inset flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-bold">
            <span>Normal/Seen: {summary.discoveredSpecies}</span>
            <span className="text-[#ffd84d]">✨ Shiny: {summary.shinySpecies}</span>
            <span>Adopted: {summary.totalAdoptions}</span>
            <span>Hatched: {summary.totalHatched}</span>
            <span>Evolved: {summary.totalEvolved}</span>
          </div>

          {/* Search + Rarity Select */}
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              aria-label="Search Pokédex"
              placeholder="Search name or #ID (e.g. Arceus, 493)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="min-w-[200px] flex-1 border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-xs text-white placeholder:text-[#6f8ec2]"
            />
            <select
              aria-label="Filter by Rarity Tier"
              value={rarityFilter}
              onChange={(e) => {
                setRarityFilter(e.target.value as 'all' | RarityTier);
                setPage(1);
              }}
              className="border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-xs font-bold text-[#ffd84d]"
            >
              <option value="all">All Rarities</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="pseudo">Pseudo-Legendary</option>
              <option value="legendary">Legendary</option>
              <option value="mythical">Mythical</option>
            </select>
          </div>

          {/* Category Filter Tabs */}
          <div
            className="flex flex-wrap gap-2 border-b-2 border-[#4e78bd] pb-1"
            role="tablist"
            aria-label="Adoption Dex Filter"
          >
            {(
              [
                ['all', `All (${SPECIES_CATALOG.length})`],
                ['discovered', `Discovered (${summary.discoveredSpecies})`],
                ['shiny', `Shiny (${summary.shinySpecies})`],
                ['legendary', `Legendaries & Mythicals (${legendaryCount})`],
              ] as Array<[DexTabFilter, string]>
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={filter === tabKey}
                onClick={() => {
                  setFilter(tabKey);
                  setPage(1);
                }}
                className="pmd-tab px-3 py-1 text-xs font-bold text-[#ffd84d]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Single Scrollable Paginated Species Grid */}
        <div tabIndex={0} className="pmd-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {pageItems.length === 0 ? (
            <div className="pmd-inset p-6 text-center text-[#a8c4f0]">
              No Gen 1–4 Pokémon match your current search or filter.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {pageItems.map((species) => {
                const entry = dex[species.id];
                const discovered = Boolean(entry && (entry.seenNormal || entry.seenShiny));
                const showShiny = Boolean(entry?.seenShiny);
                const isMythicOrLeg = species.isLegendary || species.isMythical;

                return (
                  <div
                    key={species.id}
                    className={`pmd-inset flex items-center gap-2.5 p-2 ${
                      isMythicOrLeg ? 'border-[#ffd84d]' : ''
                    } ${discovered ? '' : 'opacity-70'}`}
                  >
                    <PokemonSprite
                      speciesId={species.id}
                      name={species.name}
                      isShiny={showShiny}
                      size={48}
                      className={discovered ? '' : 'brightness-50 grayscale'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="pmd-num flex items-center justify-between gap-1 text-xs text-[#b5d4ff]">
                        <span>#{species.paddedId}</span>
                        <span className="uppercase text-[#ffd84d]">{species.rarityTier}</span>
                      </div>
                      <div className="truncate text-sm font-semibold text-white">
                        {showShiny ? '✨ ' : ''}
                        {species.name}
                      </div>
                      <div className="text-xs text-[#b5d4ff]">
                        {discovered
                          ? `Adopted ${entry?.adoptedCount ?? 0} • Hatched ${entry?.hatchedCount ?? 0}`
                          : `Unlocks Rank ${species.unlockRank}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinned Bottom Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-[#4e78bd] pt-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="pmd-btn px-3 py-1 text-sm font-semibold"
            >
              Prev
            </button>
            <span className="pmd-num text-sm text-[#ffd84d]">
              Page {safePage} / {totalPages} ({filteredSpecies.length} species)
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="pmd-btn px-3 py-1 text-sm font-semibold"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </CozyDialog>
  );
}
