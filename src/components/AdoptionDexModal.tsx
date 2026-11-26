/**
 * Adoption Dex Modal displaying all 45 curated Gen 1–4 Pokémon Platinum species,
 * Normal & Shiny discoveries, and per-species adopted/hatched/evolved counters.
 */
import { useState } from 'react';
import { SPECIES_CATALOG } from '../data/species';
import type { AdoptionDexEntry } from '../data/types';
import { getDexSummary } from '../engine/dex';
import { CozyDialog } from './CozyDialog';
import { PokemonSprite } from './PokemonSprite';

export interface AdoptionDexModalProps {
  open: boolean;
  dex: Record<number, AdoptionDexEntry>;
  onClose: () => void;
}

export function AdoptionDexModal({ open, dex, onClose }: AdoptionDexModalProps) {
  const [filter, setFilter] = useState<'all' | 'discovered' | 'shiny'>('all');
  const summary = getDexSummary(dex);

  const visibleSpecies = SPECIES_CATALOG.filter((species) => {
    const entry = dex[species.id];
    const discovered = Boolean(entry && (entry.seenNormal || entry.seenShiny));
    if (filter === 'discovered') return discovered;
    if (filter === 'shiny') return Boolean(entry?.seenShiny);
    return true;
  });

  return (
    <CozyDialog
      open={open}
      onClose={onClose}
      title={`Adoption Dex (${summary.discoveredSpecies}/${summary.totalSpecies} Species)`}
    >
      <div className="space-y-3">
        <div className="ds-inset flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold text-wood-900">
          <span>Normal/Seen: {summary.discoveredSpecies}</span>
          <span>✨ Shiny Seen: {summary.shinySpecies}</span>
          <span>Adopted: {summary.totalAdoptions}</span>
          <span>Hatched: {summary.totalHatched}</span>
          <span>Evolved: {summary.totalEvolved}</span>
        </div>

        <div className="flex gap-2 border-b-2 border-wood-300 pb-1" role="tablist" aria-label="Adoption Dex Filter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className="cozy-tab px-3 py-1 text-xs font-extrabold text-wood-900"
          >
            All ({SPECIES_CATALOG.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'discovered'}
            onClick={() => setFilter('discovered')}
            className="cozy-tab px-3 py-1 text-xs font-extrabold text-wood-900"
          >
            Discovered ({summary.discoveredSpecies})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'shiny'}
            onClick={() => setFilter('shiny')}
            className="cozy-tab px-3 py-1 text-xs font-extrabold text-wood-900"
          >
            Shiny ({summary.shinySpecies})
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {visibleSpecies.map((species) => {
            const entry = dex[species.id];
            const discovered = Boolean(entry && (entry.seenNormal || entry.seenShiny));
            const showShiny = Boolean(entry?.seenShiny);

            return (
              <div
                key={species.id}
                className={`ds-inset flex items-center gap-2.5 rounded-lg p-2 ${
                  discovered ? '' : 'opacity-65'
                }`}
              >
                <PokemonSprite
                  speciesId={species.id}
                  name={species.name}
                  isShiny={showShiny}
                  size={52}
                  className={discovered ? '' : 'brightness-50 grayscale'}
                />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-mono text-[10px] text-wood-500">#{species.id}</div>
                  <div className="truncate font-extrabold text-wood-900">
                    {showShiny ? '✨ ' : ''}
                    {species.name}
                  </div>
                  <div className="text-[11px] text-wood-700">
                    {discovered
                      ? `Adopted ${entry?.adoptedCount ?? 0} • Hatched ${entry?.hatchedCount ?? 0}`
                      : `Unlocks Rank ${species.minCozyRank}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CozyDialog>
  );
}
