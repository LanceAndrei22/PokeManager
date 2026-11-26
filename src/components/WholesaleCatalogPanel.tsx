/**
 * Wholesale PC Terminal, VIP Legendary Contracts & Supply Shelf in PMD Navy & Gold.
 */
import { useEffect, useState } from 'react';
import { ITEMS_CATALOG } from '../data/items';
import { getSpecies } from '../data/species';
import type { ItemSlug, WholesaleOffer } from '../data/types';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface WholesaleCatalogPanelProps {
  cash: number;
  offers: WholesaleOffer[];
  inventory: Partial<Record<ItemSlug, number>>;
  initialTab?: 'pokemon' | 'supplies';
  onBuyOffer: (offerUid: string) => void;
  onBuySupplyItem: (slug: ItemSlug) => void;
}

export function WholesaleCatalogPanel({
  cash,
  offers,
  inventory,
  initialTab = 'pokemon',
  onBuyOffer,
  onBuySupplyItem,
}: WholesaleCatalogPanelProps) {
  const [subTab, setSubTab] = useState<'pokemon' | 'supplies'>(initialTab);

  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);

  const purchasableItems = ITEMS_CATALOG.filter((item) => item.cost > 0);

  return (
    <div className="space-y-3 text-[#e2eeff]">
      <div
        className="flex flex-wrap items-center gap-2 border-b-2 border-[#4e78bd] pb-1"
        role="tablist"
        aria-label="Wholesale Shelf Sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pokemon'}
          onClick={() => setSubTab('pokemon')}
          className="pmd-tab px-3 py-1.5 text-xs font-bold text-[#ffd84d]"
        >
          Daily Wholesale &amp; Rescues ({offers.filter((o) => !o.purchased).length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'supplies'}
          onClick={() => setSubTab('supplies')}
          className="pmd-tab px-3 py-1.5 text-xs font-bold text-[#ffd84d]"
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
            const isVip = offer.kind === 'vip-contract';

            return (
              <article
                key={offer.uid}
                className={`pmd-inset flex flex-col justify-between p-3 ${
                  isVip ? 'border-[#ffd84d] bg-[#2a2208]/75' : ''
                } ${offer.purchased ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  {isEgg ? (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#78a8f0] bg-[#0a1430]">
                      <ItemIcon slug="egg" name="Mystery Egg" size={40} />
                    </div>
                  ) : (
                    <PokemonSprite
                      speciesId={offer.speciesId}
                      name={species.name}
                      isShiny={offer.isShiny}
                      size={56}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <span
                      className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold ${
                        isVip
                          ? 'border-[#ffd84d] bg-[#5c3e00] text-[#ffd84d]'
                          : isEgg
                            ? 'border-[#a78bfa] bg-[#2b1f52] text-[#ddd6fe]'
                            : isStray
                              ? 'border-[#f472b6] bg-[#4c1d3d] text-[#fbcfe8]'
                              : 'border-[#2ecc71] bg-[#14472c] text-[#9effc3]'
                      }`}
                    >
                      {isVip
                        ? '👑 VIP Legendary Contract'
                        : isEgg
                          ? 'Mystery Egg'
                          : isStray
                            ? `Tired Stray (${offer.initialHealingProgress}% rested)`
                            : 'Healthy Adoptable'}
                    </span>

                    <h4 className="mt-1 truncate text-sm font-bold text-white">
                      {isEgg ? 'Warm Mystery Egg' : `${offer.isShiny ? '✨ ' : ''}${species.name}`}
                    </h4>
                    <div className="text-[11px] text-[#a8c4f0]">
                      {isEgg
                        ? 'Hatches a surprise baby companion'
                        : `${offer.trait} • Cute ${offer.stats.cute} • Comfort ${offer.stats.comfort}`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#3b60a0] pt-2">
                  <span className="font-mono text-sm font-bold text-[#ffd84d]">
                    ₽{offer.cost.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={offer.purchased || !canAfford}
                    onClick={() => onBuyOffer(offer.uid)}
                    className={`px-3 py-1 text-xs font-bold ${
                      isVip ? 'pmd-btn-gold' : 'pmd-btn-emerald'
                    }`}
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
              <article key={item.slug} className="pmd-inset flex flex-col justify-between p-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#78a8f0] bg-[#0a1430]">
                    <ItemIcon slug={item.slug} name={item.name} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-white">{item.name}</h4>
                      <span className="font-mono text-[11px] font-bold text-[#6ee7a0]">
                        Bag: {owned}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#a8c4f0]">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[#3b60a0] pt-2">
                  <span className="font-mono text-xs font-bold text-[#ffd84d]">
                    ₽{item.cost.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuySupplyItem(item.slug)}
                    className="pmd-btn-gold px-3 py-1 text-xs font-bold"
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
