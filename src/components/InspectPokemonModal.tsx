/**
 * Inspect & Care Modal in PMD Navy & Gold:
 * Displays PMD portrait, stats, market appraisal breakdown, Set as Shop Mascot action,
 * location controls, Bag item usage (9 Stones, Care Berries/Drinks, Rare Candy), and
 * 2-click Emergency Liquidation (50% base value).
 */
import { useEffect, useState } from 'react';
import { ITEMS_CATALOG } from '../data/items';
import { getSpecies } from '../data/species';
import type { EvolutionStoneSlug, ItemSlug, MarketTrend, PokemonInstance } from '../data/types';
import {
  calculatePokemonValuation,
  getEffectiveMarkup,
  getLiquidationValue,
} from '../engine/economy';
import { canUseItemOnPokemon, getEvolutionTarget } from '../engine/items';
import { CozyDialog } from './CozyDialog';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface InspectPokemonModalProps {
  pokemon: PokemonInstance | null;
  isMascot: boolean;
  globalMarkup: number;
  penMarkups: Record<number, number | null>;
  trend: MarketTrend;
  recentSpeciesSales: Record<number, number>;
  inventory: Partial<Record<ItemSlug, number>>;
  onClose: () => void;
  onUseItem: (pokemonUid: string, itemSlug: ItemSlug) => void;
  onMovePokemon: (uid: string, dest: 'pen' | 'reserve' | 'healing') => void;
  onSetMascot: (uid: string) => void;
  onLiquidatePokemon: (uid: string) => void;
}

export function InspectPokemonModal({
  pokemon,
  isMascot,
  globalMarkup,
  penMarkups,
  trend,
  recentSpeciesSales,
  inventory,
  onClose,
  onUseItem,
  onMovePokemon,
  onSetMascot,
  onLiquidatePokemon,
}: InspectPokemonModalProps) {
  const [confirmLiquidate, setConfirmLiquidate] = useState(false);

  useEffect(() => {
    setConfirmLiquidate(false);
  }, [pokemon?.uid]);

  if (!pokemon) {
    return (
      <CozyDialog open={false} onClose={onClose} title="Inspect Companion">
        <div />
      </CozyDialog>
    );
  }

  const species = getSpecies(pokemon.speciesId);
  const markup = getEffectiveMarkup({ globalMarkup, penMarkups }, pokemon.penIndex);
  const recentSales = recentSpeciesSales[pokemon.speciesId] ?? 0;
  const collectorValuation = calculatePokemonValuation(
    pokemon,
    trend,
    'cozy-collector',
    recentSales,
    markup,
  );
  const baseValuation = calculatePokemonValuation(
    pokemon,
    trend,
    'bargain-browser',
    recentSales,
    markup,
  );
  const liquidationPayout = getLiquidationValue(pokemon);

  const usableItems = ITEMS_CATALOG.filter(
    (item) =>
      (item.category === 'stone' || item.category === 'care' || item.category === 'candy') &&
      (inventory[item.slug] ?? 0) > 0,
  );

  return (
    <CozyDialog
      open={Boolean(pokemon)}
      onClose={onClose}
      title={`${pokemon.isShiny ? '✨ Shiny ' : ''}${species.name} — Companion Care`}
    >
      <div className="space-y-4 text-[#e2eeff]">
        {/* Profile Header + Set Mascot */}
        <div className="pmd-inset flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center border-2 border-[#78a8f0] bg-[#0b1634]">
            <PokemonSprite
              speciesId={pokemon.speciesId}
              name={species.name}
              isShiny={pokemon.isShiny}
              size={80}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#6ee7a0] bg-[#14472c] px-2 py-0.5 text-[11px] font-bold text-[#9effc3]">
                  Trait: {pokemon.trait}
                </span>
                <span className="border border-[#78a8f0] bg-[#142958] px-2 py-0.5 text-[11px] font-bold uppercase text-[#ffd84d]">
                  {species.types.join(' / ')}
                </span>
                <span className="border border-[#4e78bd] bg-[#0c1b3e] px-2 py-0.5 text-[11px] font-bold text-[#cfe0ff]">
                  Egg: {species.eggGroups.join(' / ')}
                </span>
              </div>

              {isMascot ? (
                <span className="border border-[#ffd84d] bg-[#5c3e00] px-2 py-0.5 text-[11px] font-bold text-[#ffd84d]">
                  ★ Active Shop Mascot
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetMascot(pokemon.uid)}
                  className="pmd-btn-gold px-2.5 py-1 text-[11px] font-bold"
                >
                  Set as Shop Mascot
                </button>
              )}
            </div>

            <p className="text-xs italic text-[#a8c4f0]">{species.cozyNote}</p>
            <div className="grid grid-cols-3 gap-2 pt-0.5 text-xs font-bold">
              <div className="border border-[#3a61a3] bg-[#0a1430] px-2 py-1 text-[#ffd84d]">
                Cute: {pokemon.stats.cute}
              </div>
              <div className="border border-[#3a61a3] bg-[#0a1430] px-2 py-1 text-[#9effc3]">
                Comfort: {pokemon.stats.comfort}
              </div>
              <div className="border border-[#3a61a3] bg-[#0a1430] px-2 py-1 text-[#a8d0ff]">
                Rarity: {pokemon.stats.rarity}
              </div>
            </div>
          </div>
        </div>

        {/* Market Valuation Breakdown */}
        <div className="pmd-inset p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-[#ffd84d]">Adoption Appraisal Breakdown</h2>
            <span className="font-mono text-sm font-bold text-[#6ee7a0]">
              Base Tag: ₽{baseValuation.askingPrice.toLocaleString()} (Collector up to ₽
              {collectorValuation.askingPrice.toLocaleString()})
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-[#cfe0ff] sm:grid-cols-3">
            <div>Base Species: ₽{baseValuation.breakdown.basePrice}</div>
            <div>Stats Mult: {baseValuation.breakdown.statMultiplier}×</div>
            <div>Shiny Mult: {baseValuation.breakdown.shinyMultiplier}×</div>
            <div>
              Shift Trend:{' '}
              {baseValuation.breakdown.trendMatched
                ? `${baseValuation.breakdown.trendMultiplier}× Active`
                : '1.0×'}
            </div>
            <div>Supply Saturation: {baseValuation.breakdown.saturationMultiplier}×</div>
            <div>Markup Tag: {markup}%</div>
          </div>
        </div>

        {/* Location Controls & Emergency Liquidate */}
        <div className="pmd-inset flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="font-bold text-white">
            Location:{' '}
            {pokemon.location === 'pen'
              ? `Display Pen #${(pokemon.penIndex ?? 0) + 1}`
              : pokemon.location === 'healing'
                ? `Nap Bed (${pokemon.healingProgress}% rested)`
                : 'Reserve Kennel'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {pokemon.location !== 'pen' && !pokemon.needsRecovery && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'pen')}
                className="pmd-btn-emerald px-2.5 py-1 font-bold"
              >
                Move to Pen
              </button>
            )}
            {pokemon.location !== 'reserve' && !pokemon.needsRecovery && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'reserve')}
                className="pmd-btn px-2.5 py-1 font-bold"
              >
                Move to Reserve
              </button>
            )}
            {pokemon.location !== 'healing' && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'healing')}
                className="pmd-btn px-2.5 py-1 font-bold"
              >
                Nap Bed
              </button>
            )}
            {pokemon.location !== 'breeding' && !confirmLiquidate && (
              <button
                type="button"
                onClick={() => setConfirmLiquidate(true)}
                className="pmd-btn-danger px-2.5 py-1 font-bold"
              >
                Liquidate (+₽{liquidationPayout.toLocaleString()})
              </button>
            )}
            {confirmLiquidate && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onLiquidatePokemon(pokemon.uid);
                    onClose();
                  }}
                  className="pmd-btn-danger px-2.5 py-1 font-bold"
                >
                  Confirm Liquidate (+₽{liquidationPayout.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLiquidate(false)}
                  className="pmd-btn px-2 py-1 font-bold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Item Bag */}
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#ffd84d]">
            Use Item from Bag
          </h2>
          {usableItems.length === 0 ? (
            <p className="text-xs text-[#a8c4f0]">
              No stones, berries, or candies in your bag right now. Visit Wholesale PC → Supplies!
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {usableItems.map((item) => {
                const count = inventory[item.slug] ?? 0;
                const check = canUseItemOnPokemon(pokemon, item.slug);
                const evoTargetId =
                  item.category === 'stone'
                    ? getEvolutionTarget(pokemon.speciesId, item.slug as EvolutionStoneSlug)
                    : item.category === 'candy' && check.targetSpeciesId
                      ? check.targetSpeciesId
                      : null;
                const evoTargetName = evoTargetId ? getSpecies(evoTargetId).name : null;

                return (
                  <div
                    key={item.slug}
                    className="pmd-inset flex items-center justify-between gap-2 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <ItemIcon slug={item.slug} name={item.name} size={24} />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {item.name} (×{count})
                        </div>
                        <div className="text-[11px] text-[#a8c4f0]">
                          {evoTargetName
                            ? `Evolves → ${evoTargetName}`
                            : check.ok
                              ? item.description
                              : check.reason}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!check.ok}
                      onClick={() => onUseItem(pokemon.uid, item.slug)}
                      className="pmd-btn-emerald shrink-0 px-2.5 py-1 text-xs font-bold"
                    >
                      {evoTargetName ? 'Evolve' : 'Use'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CozyDialog>
  );
}
