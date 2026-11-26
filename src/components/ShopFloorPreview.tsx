/**
 * Cozy static 2D PokéMart shop floor preview for Phase 4.
 * Renders warm tiled display pens with static Platinum sprites, plush nap beds,
 * and active browsing customers with visible archetype badges.
 * (Animated HTML5 Canvas floor rendering arrives in Phase 5 after handoff.)
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getSpecies } from '../data/species';
import type { PokemonInstance, ShopCustomer } from '../data/types';
import { PokemonSprite } from './PokemonSprite';

export interface ShopFloorPreviewProps {
  penCapacity: number;
  napBedCapacity: number;
  pokemon: PokemonInstance[];
  customers: ShopCustomer[];
  shiftRunning: boolean;
  cafeDecorLevel: number;
  onInspectPokemon: (uid: string) => void;
}

export function ShopFloorPreview({
  penCapacity,
  napBedCapacity,
  pokemon,
  customers,
  shiftRunning,
  cafeDecorLevel,
  onInspectPokemon,
}: ShopFloorPreviewProps) {
  const healingPokemon = pokemon.filter((p) => p.location === 'healing');

  return (
    <section aria-label="Cozy Shop Floor Preview" className="ds-panel rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-wood-900">Cozy Shop Floor</h2>
          <p className="text-xs text-wood-700">
            {shiftRunning
              ? 'Warm acoustic bells chime softly as customers stroll between pens.'
              : 'Shop is quiet. Click Open Shop when you want customers to visit.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-wood-700">
          {cafeDecorLevel > 0 && (
            <span className="rounded-full border border-sage-600 bg-sage-100 px-2.5 py-0.5 text-sage-800">
              Matcha Café Lv.{cafeDecorLevel}
            </span>
          )}
          <span className="rounded-full border border-wood-500 bg-cream-100 px-2.5 py-0.5">
            {customers.length} Visitor{customers.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Warm wood tiled shop floor container */}
      <div className="rounded-xl border-2 border-wood-700 bg-cream-200/70 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: penCapacity }, (_, penIndex) => {
            const occupant = pokemon.find(
              (mon) => mon.location === 'pen' && mon.penIndex === penIndex,
            );
            const species = occupant ? getSpecies(occupant.speciesId) : null;
            const penVisitors = customers.filter((c) => c.targetPenIndex === penIndex);

            return (
              <div
                key={penIndex}
                className="flex flex-col justify-between rounded-lg border-2 border-wood-500 bg-cream-50 p-2.5"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-wood-700">
                  <span>Pen #{penIndex + 1}</span>
                  {occupant?.isShiny && (
                    <span className="rounded bg-honey-100 px-1.5 py-0.5 text-[10px] text-wood-900">
                      ✨ Shiny
                    </span>
                  )}
                </div>

                {occupant && species ? (
                  <button
                    type="button"
                    onClick={() => onInspectPokemon(occupant.uid)}
                    className="my-1.5 flex items-center gap-2 rounded-md p-1 text-left hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-sage-600"
                  >
                    <PokemonSprite
                      speciesId={occupant.speciesId}
                      name={species.name}
                      isShiny={occupant.isShiny}
                      size={64}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-wood-900">
                        {species.name}
                      </div>
                      <div className="text-[11px] font-semibold text-sage-800">
                        {occupant.trait}
                      </div>
                      <div className="text-[10px] text-wood-500">Click to inspect</div>
                    </div>
                  </button>
                ) : (
                  <div className="my-4 text-center text-xs font-medium text-wood-500">
                    Empty straw pen
                  </div>
                )}

                {/* Visiting shoppers admiring this pen */}
                <div className="min-h-[28px] space-y-1 border-t border-cream-200 pt-1.5">
                  {penVisitors.length > 0 ? (
                    penVisitors.map((visitor) => {
                      const arch = CUSTOMER_ARCHETYPES[visitor.archetypeId];
                      return (
                        <div
                          key={visitor.uid}
                          className="flex items-center justify-between gap-1 text-[11px]"
                        >
                          <span
                            className={`rounded border px-1.5 py-0.5 font-bold ${arch.accentClass}`}
                          >
                            {visitor.name} • {arch.badgeLabel}
                          </span>
                          <span className="truncate text-wood-700">{visitor.statusText}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-wood-500">No shopper at pen yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Plush Nap Corner Summary Strip */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border-2 border-sage-300 bg-sage-100/70 px-3 py-2">
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
                  <PokemonSprite
                    speciesId={mon.speciesId}
                    name={sp.name}
                    isShiny={mon.isShiny}
                    size={28}
                  />
                  <span>
                    {sp.name} ({mon.healingProgress}%)
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
