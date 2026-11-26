/**
 * Breeding & Genetics Incubator panel:
 * Lets the player select two compatible rested Pokémon (sharing an Egg Group or
 * species), incubate an inherited Egg, track live-tick progress, and hatch it.
 */
import { useMemo, useState } from 'react';
import { getSpecies } from '../data/species';
import type { EggInstance, PokemonInstance } from '../data/types';
import { areCompatibleParents } from '../engine/breeding';
import { ItemIcon } from './PokemonSprite';

export interface BreedingIncubatorPanelProps {
  pokemon: PokemonInstance[];
  eggs: EggInstance[];
  incubatorCapacity: number;
  mysteryShipmentLevel: number;
  onStartBreeding: (parentAUid: string, parentBUid: string) => void;
  onClaimEgg: (eggUid: string) => void;
}

export function BreedingIncubatorPanel({
  pokemon,
  eggs,
  incubatorCapacity,
  mysteryShipmentLevel,
  onStartBreeding,
  onClaimEgg,
}: BreedingIncubatorPanelProps) {
  const eligible = useMemo(
    () => pokemon.filter((p) => !p.needsRecovery && p.location !== 'breeding'),
    [pokemon],
  );

  const [parentAUid, setParentAUid] = useState<string>('');
  const [parentBUid, setParentBUid] = useState<string>('');

  const resolvedA = eligible.find((p) => p.uid === parentAUid) ?? eligible[0] ?? null;
  const compatiblePartners = useMemo(() => {
    if (!resolvedA) return [];
    return eligible.filter((candidate) => areCompatibleParents(resolvedA, candidate));
  }, [eligible, resolvedA]);

  const resolvedB =
    compatiblePartners.find((p) => p.uid === parentBUid) ?? compatiblePartners[0] ?? null;

  const canBreed =
    Boolean(resolvedA && resolvedB) &&
    eggs.length < incubatorCapacity &&
    areCompatibleParents(resolvedA!, resolvedB!);

  const baseShinyPct = 5 + mysteryShipmentLevel * 2 + (resolvedA?.isShiny || resolvedB?.isShiny ? 5 : 0);

  return (
    <div className="space-y-4">
      <div className="ds-inset rounded-xl p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-wood-900">Pair Compatible Companions</h3>
            <p className="text-xs text-wood-700">
              Share a species or Egg Group (e.g., Field, Water, Monster, Fairy) to inherit stats &amp; traits.
            </p>
          </div>
          <span className="rounded-full border border-honey-600 bg-honey-100 px-2.5 py-0.5 text-[11px] font-bold text-wood-900">
            Shiny Odds: ~{Math.min(25, baseShinyPct)}%
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-wood-900">
            <span>Parent A</span>
            <select
              aria-label="Breeding Parent A"
              value={resolvedA?.uid ?? ''}
              onChange={(e) => setParentAUid(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-wood-500 bg-cream-50 px-2.5 py-1.5 text-xs font-semibold text-wood-900"
            >
              {eligible.length === 0 ? (
                <option value="">No rested companions available</option>
              ) : (
                eligible.map((mon) => {
                  const sp = getSpecies(mon.speciesId);
                  return (
                    <option key={mon.uid} value={mon.uid}>
                      {mon.isShiny ? '✨ ' : ''}
                      {sp.name} [{sp.eggGroups.join('/')}] • {mon.trait}
                    </option>
                  );
                })
              )}
            </select>
          </label>

          <label className="block text-xs font-bold text-wood-900">
            <span>Parent B (Compatible Partners)</span>
            <select
              aria-label="Breeding Parent B"
              value={resolvedB?.uid ?? ''}
              onChange={(e) => setParentBUid(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-wood-500 bg-cream-50 px-2.5 py-1.5 text-xs font-semibold text-wood-900"
            >
              {compatiblePartners.length === 0 ? (
                <option value="">No matching Egg Group partner yet</option>
              ) : (
                compatiblePartners.map((mon) => {
                  const sp = getSpecies(mon.speciesId);
                  return (
                    <option key={mon.uid} value={mon.uid}>
                      {mon.isShiny ? '✨ ' : ''}
                      {sp.name} [{sp.eggGroups.join('/')}] • {mon.trait}
                    </option>
                  );
                })
              )}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-wood-700">
            {compatiblePartners.length > 0 && resolvedA && resolvedB
              ? `Match ready! Baby inherits Cute/Comfort/Rarity from ${getSpecies(resolvedA.speciesId).name} & ${getSpecies(resolvedB.speciesId).name}.`
              : 'Welcome or rescue another companion sharing an Egg Group to pair!'}
          </div>
          <button
            type="button"
            disabled={!canBreed}
            onClick={() => resolvedA && resolvedB && onStartBreeding(resolvedA.uid, resolvedB.uid)}
            className="rounded-lg border-2 border-sage-800 bg-sage-600 px-3.5 py-1.5 text-xs font-extrabold text-cream-50 hover:bg-sage-800 disabled:cursor-not-allowed disabled:border-wood-300 disabled:bg-cream-200 disabled:text-wood-500"
          >
            Start Incubation ({eggs.length}/{incubatorCapacity})
          </button>
        </div>
      </div>

      {/* Incubator Slots */}
      <div>
        <h3 className="mb-2 text-sm font-extrabold text-wood-900">
          Warm Incubators ({eggs.length}/{incubatorCapacity} active)
        </h3>
        {eggs.length === 0 ? (
          <p className="rounded-lg border border-wood-300 bg-cream-100/40 px-3 py-2.5 text-xs text-wood-700">
            No eggs incubating yet. Pair compatible Pokémon above or adopt a Mystery Egg from Wholesale.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {eggs.map((egg) => {
              const babySpecies = getSpecies(egg.speciesId);
              return (
                <article key={egg.uid} className="ds-inset rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-wood-300 bg-cream-50">
                      <ItemIcon slug="egg" name="Incubating Egg" size={34} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-extrabold text-wood-900">
                          {egg.readyToHatch ? `Ready: ${babySpecies.name} Egg!` : 'Warming Egg'}
                        </h4>
                        <span className="font-mono text-xs font-bold text-sage-800">
                          {Math.round(egg.progress)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-wood-700">
                        Parents: {egg.parentNames[0]} &amp; {egg.parentNames[1]} • {egg.trait}
                      </div>
                      <progress
                        aria-label={`Egg incubation progress for ${babySpecies.name}`}
                        max={100}
                        value={egg.progress}
                        className="mt-1.5 h-2 w-full"
                      />
                    </div>
                  </div>

                  {egg.readyToHatch && (
                    <div className="mt-2.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onClaimEgg(egg.uid)}
                        className="rounded-lg border-2 border-honey-600 bg-honey-100 px-3 py-1 text-xs font-extrabold text-wood-900 hover:bg-honey-400/60"
                      >
                        Hatch Egg!
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
