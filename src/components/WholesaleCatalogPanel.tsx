/**
 * Daily Wholesale & Rescue Catalog plus Supply Shelf for purchasing Evolution Stones,
 * Care Drinks/Berries, Rare Candy, and Gift-Wrap Poké Balls.
 */
import { useState } from 'react';
import { ITEMS_CATALOG } from '../data/items';
import { getSpecies } from '../data/species';
import type { ItemSlug, WholesaleOffer } from '../data/types';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface WholesaleCatalogPanelProps {
  cash: number;
  offers: WholesaleOffer[];
  inventory: Partial<Record<ItemSlug, number>>;
  onBuyOffer: (offerUid: string) => void;
  onBuySupplyItem: (slug: ItemSlug) => void;
}

export function WholesaleCatalogPanel({
  cash,
  offers,
  inventory,
  onBuyOffer,
  onBuySupplyItem,
}: WholesaleCatalogPanelProps) {
  const [subTab, setSubTab] = useState<'pokemon' | 'supplies'>('pokemon');
  const purchasableItems = ITEMS_CATALOG.filter((item) => item.cost > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b-2 border-wood-300 pb-1" role="tablist" aria-label="Wholesale Shelf Sections">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pokemon'}
          onClick={() => setSubTab('pokemon')}
          className="cozy-tab rounded-t-md px-3 py-1.5 text-xs font-extrabold text-wood-900"
        >
          Daily Wholesale &amp; Rescues ({offers.filter((o) => !o.purchased).length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'supplies'}
          onClick={() => setSubTab('supplies')}
          className="cozy-tab rounded-t-md px-3 py-1.5 text-xs font-extrabold text-wood-900"
        >
          Shop Supplies &amp; Stones
        </button>
      </div>

      {subTab === 'pokemon' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const species = getSpecies(offer.speciesId);
            const canAfford = cash >= offer.cost;
            const isEgg = offer.kind === 'egg';
            const isStray = offer.kind === 'stray';

            return (
              <article
                key={offer.uid}
                className={`ds-inset flex flex-col justify-between rounded-xl p-3 ${
                  offer.purchased ? 'opacity-55' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isEgg ? (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-wood-300 bg-cream-50">
                      <ItemIcon slug="egg" name="Mystery Egg" size={44} />
                    </div>
                  ) : (
                    <PokemonSprite
                      speciesId={offer.speciesId}
                      name={species.name}
                      isShiny={offer.isShiny}
                      size={64}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isEgg
                          ? 'bg-lavender-100 text-lavender-600'
                          : isStray
                            ? 'bg-berry-100 text-wood-900'
                            : 'bg-sage-100 text-sage-800'
                      }`}
                    >
                      {isEgg
                        ? 'Mystery Egg'
                        : isStray
                          ? `Tired Stray (${offer.initialHealingProgress}% rested)`
                          : 'Healthy Adoptable'}
                    </span>

                    <h4 className="mt-1 truncate text-sm font-extrabold text-wood-900">
                      {isEgg ? 'Warm Mystery Egg' : `${offer.isShiny ? '✨ ' : ''}${species.name}`}
                    </h4>
                    <div className="text-[11px] text-wood-700">
                      {isEgg
                        ? 'Hatches a surprise baby companion'
                        : `${offer.trait} • Cute ${offer.stats.cute} • Comfort ${offer.stats.comfort}`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-wood-300/60 pt-2">
                  <span className="font-mono text-sm font-extrabold text-wood-900">
                    ₽{offer.cost.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={offer.purchased || !canAfford}
                    onClick={() => onBuyOffer(offer.uid)}
                    className="rounded-md border-2 border-sage-800 bg-sage-600 px-3 py-1 text-xs font-bold text-cream-50 hover:bg-sage-800 disabled:cursor-not-allowed disabled:border-wood-300 disabled:bg-cream-200 disabled:text-wood-500"
                  >
                    {offer.purchased ? 'Adopted' : isEgg ? 'Incubate' : isStray ? 'Rescue' : 'Welcome'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {purchasableItems.map((item) => {
            const owned = inventory[item.slug] ?? 0;
            const canAfford = cash >= item.cost;
            return (
              <article
                key={item.slug}
                className="ds-inset flex flex-col justify-between rounded-xl p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-wood-300 bg-cream-50">
                    <ItemIcon slug={item.slug} name={item.name} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-extrabold text-wood-900">{item.name}</h4>
                      <span className="font-mono text-[11px] font-bold text-sage-800">
                        Bag: {owned}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-wood-700">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-wood-300/60 pt-2">
                  <span className="font-mono text-xs font-extrabold text-wood-900">
                    ₽{item.cost.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuySupplyItem(item.slug)}
                    className="rounded-md border-2 border-wood-700 bg-honey-100 px-3 py-1 text-xs font-bold text-wood-900 hover:bg-honey-400/50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Buy 1
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
