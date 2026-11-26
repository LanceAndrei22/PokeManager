/**
 * Stray Healing & Nap Station panel in PMD Navy & Gold.
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
    <div className="space-y-3 text-[#e2eeff]">
      <div>
        <h3 className="text-sm font-bold text-[#ffd84d]">
          Plush Nap Beds ({strays.length}/{napBedCapacity} occupied)
        </h3>
        <p className="text-xs text-[#a8c4f0]">
          Strays rest automatically while the shop is open, or wake up early with warm drinks &amp; berries.
        </p>
      </div>

      {strays.length === 0 ? (
        <div className="pmd-inset p-4 text-center text-xs text-[#a8c4f0]">
          All plush nap beds are empty and fluffed. Check Wholesale PC for discounted tired strays!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {strays.map((mon) => {
            const species = getSpecies(mon.speciesId);
            return (
              <article key={mon.uid} className="pmd-inset p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={56}
                    />
                    <div>
                      <h4 className="text-base font-semibold text-white">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </h4>
                      <div className="text-xs font-medium text-[#6ee7a0]">
                        {mon.trait} • Cute {mon.stats.cute} • Comfort {mon.stats.comfort}
                      </div>
                      <div className="pmd-num mt-1 text-sm text-[#ffd84d]">
                        Rested: {mon.healingProgress}%
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectPokemon(mon.uid)}
                    className="pmd-btn px-2.5 py-1 text-xs font-semibold"
                  >
                    Inspect
                  </button>
                </div>

                <progress
                  aria-label={`Nap recovery for ${species.name}`}
                  max={100}
                  value={mon.healingProgress}
                  className="mt-2 h-2 w-full accent-[#6ee7a0]"
                />

                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[#3b60a0] pt-2">
                  {availableCare.length === 0 ? (
                    <span className="text-xs text-[#b5d4ff]">
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
                          className="pmd-btn-emerald inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
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
