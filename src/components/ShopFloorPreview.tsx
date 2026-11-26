/**
 * Cozy PokéMart shop floor panel.
 * Hosts the animated HTML5 Canvas floor (Platinum sprites wandering pens, napping
 * strays, strolling shoppers, particles) plus an accessible DOM mirror: pen occupant
 * buttons, visitor archetype badges, and the nap corner strip for keyboard and
 * screen-reader users. Includes a visible Pause/Play animation control (WCAG 2.2.2).
 */
import { useState } from 'react';
import { ShopFloorCanvas } from '../canvas/ShopFloorCanvas';
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getSpecies } from '../data/species';
import type { PokemonInstance, ShopCustomer } from '../data/types';
import { PokemonSprite } from './PokemonSprite';

export interface ShopFloorPreviewProps {
  profileId: string;
  cash: number;
  shiftSpeed: 1 | 2;
  penCapacity: number;
  napBedCapacity: number;
  pokemon: PokemonInstance[];
  customers: ShopCustomer[];
  shiftRunning: boolean;
  cafeDecorLevel: number;
  onInspectPokemon: (uid: string) => void;
}

export function ShopFloorPreview({
  profileId,
  cash,
  shiftSpeed,
  penCapacity,
  napBedCapacity,
  pokemon,
  customers,
  shiftRunning,
  cafeDecorLevel,
  onInspectPokemon,
}: ShopFloorPreviewProps) {
  const [motionPaused, setMotionPaused] = useState(false);
  const healingPokemon = pokemon.filter((p) => p.location === 'healing');
  const penPokemon = pokemon
    .filter((p) => p.location === 'pen' && p.penIndex !== null)
    .sort((a, b) => (a.penIndex ?? 0) - (b.penIndex ?? 0));

  return (
    <section aria-label="Cozy Shop Floor" className="ds-panel rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-wood-900">Cozy Shop Floor</h2>
          <p className="text-xs text-wood-700">
            {shiftRunning
              ? 'Shoppers stroll between pens while companions hop, nap, and sparkle.'
              : 'Shop is quiet. Click Open Shop when you want customers to visit.'}{' '}
            Click a Pokémon to inspect it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-wood-700">
          {cafeDecorLevel > 0 && (
            <span className="rounded-full border border-sage-600 bg-sage-100 px-2.5 py-0.5 text-sage-800">
              Matcha Café Lv.{cafeDecorLevel}
            </span>
          )}
          <span className="rounded-full border border-wood-500 bg-cream-100 px-2.5 py-0.5">
            {customers.length} Visitor{customers.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setMotionPaused((v) => !v)}
            className="rounded-md border-2 border-wood-500 bg-cream-100 px-2 py-0.5 text-[11px] font-bold text-wood-900 hover:bg-cream-200"
          >
            {motionPaused ? 'Play animation' : 'Pause animation'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border-2 border-wood-700 bg-cream-200/70 p-1.5 sm:p-2">
        <ShopFloorCanvas
          profileId={profileId}
          cash={cash}
          shiftSpeed={shiftSpeed}
          shiftRunning={shiftRunning}
          pokemon={pokemon}
          customers={customers}
          penCapacity={penCapacity}
          napBedCapacity={napBedCapacity}
          motionPaused={motionPaused}
          onInspectPokemon={onInspectPokemon}
        />
      </div>

      {/* Accessible DOM mirror of the canvas for keyboard & screen-reader users */}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-extrabold text-wood-900">On display:</span>
          {penPokemon.length === 0 ? (
            <span className="text-xs text-wood-500">All pens empty</span>
          ) : (
            penPokemon.map((mon) => {
              const sp = getSpecies(mon.speciesId);
              return (
                <button
                  key={mon.uid}
                  type="button"
                  onClick={() => onInspectPokemon(mon.uid)}
                  className="inline-flex items-center gap-1 rounded-md border border-wood-500 bg-cream-50 px-1.5 py-0.5 text-[11px] font-bold text-wood-900 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-sage-600"
                >
                  <PokemonSprite speciesId={mon.speciesId} name={sp.name} isShiny={mon.isShiny} size={24} />
                  <span>
                    Pen {(mon.penIndex ?? 0) + 1}: {mon.isShiny ? '✨ ' : ''}
                    {sp.name}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-extrabold text-wood-900">Shoppers:</span>
          {customers.length === 0 ? (
            <span className="text-xs text-wood-500">No shoppers browsing yet</span>
          ) : (
            customers.map((visitor) => {
              const arch = CUSTOMER_ARCHETYPES[visitor.archetypeId];
              return (
                <span
                  key={visitor.uid}
                  title={`${arch.shortTag} — ${visitor.statusText}`}
                  className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${arch.accentClass}`}
                >
                  {visitor.name} • {arch.badgeLabel} (Pen {visitor.targetPenIndex + 1})
                </span>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-sage-300 bg-sage-100/70 px-3 py-2">
        <span className="text-xs font-extrabold text-sage-800">
          Nap Corner ({healingPokemon.length}/{napBedCapacity} beds):
        </span>
        {healingPokemon.length === 0 ? (
          <span className="text-xs text-sage-800/80">All plush cushions crisp and ready.</span>
        ) : (
          healingPokemon.map((mon) => {
            const sp = getSpecies(mon.speciesId);
            return (
              <button
                key={mon.uid}
                type="button"
                onClick={() => onInspectPokemon(mon.uid)}
                className="inline-flex items-center gap-1.5 rounded-md border border-sage-600 bg-cream-50 px-2 py-0.5 text-xs font-bold text-wood-900 hover:bg-cream-100"
              >
                <PokemonSprite speciesId={mon.speciesId} name={sp.name} isShiny={mon.isShiny} size={28} />
                <span>
                  {sp.name} ({mon.healingProgress}%)
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
