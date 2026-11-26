/**
 * Stray Healing & Nap Station panel:
 * Displays plush nap beds for recovering strays, progress bars, and 1-click
 * Care Berries/Drinks quick-recovery buttons from the Item Bag.
 */
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type { ItemSlug, PokemonInstance } from '../data/types';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface HealingStationPanelProps {
  pokemon: PokemonInstance[];
  napBedCapacity: number;
  inventory: Partial<Record<ItemSlug, number>>;
  onUseCareItem: (pokemonUid: string, itemSlug: ItemSlug) => void;
  onInspectPokemon: (uid: string) => void;
}

const QUICK_CARE_ITEMS: ItemSlug[] = [
  'oran-berry',
  'fresh-water',
  'potion',
  'sitrus-berry',
  'moomoo-milk',
];

export function HealingStationPanel({
  pokemon,
  napBedCapacity,
  inventory,
  onUseCareItem,
  onInspectPokemon,
}: HealingStationPanelProps) {
  const strays = pokemon.filter((p) => p.location === 'healing');
  const availableCare = QUICK_CARE_ITEMS.filter((slug) => (inventory[slug] ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-wood-900">
            Plush Nap Beds ({strays.length}/{napBedCapacity} occupied)
          </h3>
          <p className="text-xs text-wood-700">
            Strays rest automatically while the shop is open, or wake up early with warm drinks &amp; berries.
          </p>
        </div>
      </div>

      {strays.length === 0 ? (
        <div className="ds-inset rounded-xl p-4 text-center text-xs text-wood-700">
          All plush nap beds are empty and fluffed. Check Wholesale &amp; Rescues for discounted tired strays!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {strays.map((mon) => {
            const species = getSpecies(mon.speciesId);
            return (
              <article key={mon.uid} className="ds-inset rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={60}
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-wood-900">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </h4>
                      <div className="text-[11px] font-semibold text-sage-800">
                        {mon.trait} • Cute {mon.stats.cute} • Comfort {mon.stats.comfort}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-wood-900">
                        <span>Rested: {mon.healingProgress}%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectPokemon(mon.uid)}
                    className="rounded border border-wood-500 bg-cream-50 px-2 py-0.5 text-[11px] font-bold text-wood-900"
                  >
                    Inspect
                  </button>
                </div>

                <progress
                  aria-label={`Nap recovery for ${species.name}`}
                  max={100}
                  value={mon.healingProgress}
                  className="mt-2 h-2 w-full"
                />

                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-wood-300/60 pt-2">
                  {availableCare.length === 0 ? (
                    <span className="text-[11px] text-wood-500">
                      Buy Berries or Moomoo Milk in Supplies to speed recovery.
                    </span>
                  ) : (
                    availableCare.map((slug) => {
                      const def = getItemDefinition(slug);
                      const count = inventory[slug] ?? 0;
                      return (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => onUseCareItem(mon.uid, slug)}
                          className="inline-flex items-center gap-1 rounded border border-sage-800 bg-sage-100 px-2 py-0.5 text-[11px] font-bold text-sage-800 hover:bg-sage-300/60"
                        >
                          <ItemIcon slug={slug} name={def.name} size={16} />
                          <span>
                            {def.name} ({count})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
