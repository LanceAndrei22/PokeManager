/**
 * Inspect Pokémon Modal: shows Platinum sprite, Cute/Comfort/Rarity stats,
 * transparent market valuation breakdown, location controls, and active Item Bag usage
 * (Evolution Stones, Care Berries/Drinks, and Rare Candy).
 */
import { ITEMS_CATALOG } from '../data/items';
import { getSpecies } from '../data/species';
import type { EvolutionStoneSlug, ItemSlug, MarketTrend, PokemonInstance } from '../data/types';
import { calculatePokemonValuation, getEffectiveMarkup } from '../engine/economy';
import { canUseItemOnPokemon, getEvolutionTarget } from '../engine/items';
import { CozyDialog } from './CozyDialog';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface InspectPokemonModalProps {
  pokemon: PokemonInstance | null;
  globalMarkup: number;
  penMarkups: Record<number, number | null>;
  trend: MarketTrend;
  recentSpeciesSales: Record<number, number>;
  inventory: Partial<Record<ItemSlug, number>>;
  onClose: () => void;
  onUseItem: (pokemonUid: string, itemSlug: ItemSlug) => void;
  onMovePokemon: (uid: string, dest: 'pen' | 'reserve' | 'healing') => void;
}

export function InspectPokemonModal({
  pokemon,
  globalMarkup,
  penMarkups,
  trend,
  recentSpeciesSales,
  inventory,
  onClose,
  onUseItem,
  onMovePokemon,
}: InspectPokemonModalProps) {
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
      <div className="space-y-4">
        {/* Profile Header */}
        <div className="ds-inset flex flex-col gap-4 rounded-xl p-3 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-wood-500 bg-cream-50">
            <PokemonSprite
              speciesId={pokemon.speciesId}
              name={species.name}
              isShiny={pokemon.isShiny}
              size={80}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-sage-600 bg-sage-100 px-2 py-0.5 text-xs font-bold text-sage-800">
                Trait: {pokemon.trait}
              </span>
              <span className="rounded border border-wood-500 bg-cream-50 px-2 py-0.5 text-xs font-bold text-wood-800">
                Types: {species.types.join(' / ')}
              </span>
              <span className="rounded border border-wood-500 bg-cream-50 px-2 py-0.5 text-xs font-bold text-wood-800">
                Egg: {species.eggGroups.join(' / ')}
              </span>
            </div>
            <p className="text-xs italic text-wood-700">{species.cozyNote}</p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-bold">
              <div className="rounded bg-cream-50 px-2 py-1">Cute: {pokemon.stats.cute}</div>
              <div className="rounded bg-cream-50 px-2 py-1">Comfort: {pokemon.stats.comfort}</div>
              <div className="rounded bg-cream-50 px-2 py-1">Rarity: {pokemon.stats.rarity}</div>
            </div>
          </div>
        </div>

        {/* Market Valuation Breakdown */}
        <div className="ds-inset rounded-xl p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold text-wood-900">Adoption Appraisal Breakdown</h2>
            <span className="font-mono text-sm font-extrabold text-sage-800">
              Base Tag: ₽{baseValuation.askingPrice.toLocaleString()} (Collector up to ₽
              {collectorValuation.askingPrice.toLocaleString()})
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-wood-800 sm:grid-cols-3">
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

        {/* Move Location Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-wood-300 bg-cream-100/60 px-3 py-2 text-xs">
          <span className="font-bold text-wood-900">
            Location:{' '}
            {pokemon.location === 'pen'
              ? `Display Pen #${(pokemon.penIndex ?? 0) + 1}`
              : pokemon.location === 'healing'
                ? `Nap Bed (${pokemon.healingProgress}% rested)`
                : 'Reserve Kennel'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pokemon.location !== 'pen' && !pokemon.needsRecovery && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'pen')}
                className="rounded border border-sage-800 bg-sage-600 px-2.5 py-1 font-bold text-cream-50 hover:bg-sage-800"
              >
                Move to Pen
              </button>
            )}
            {pokemon.location !== 'reserve' && !pokemon.needsRecovery && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'reserve')}
                className="rounded border border-wood-500 bg-cream-50 px-2.5 py-1 font-bold text-wood-900"
              >
                Move to Reserve
              </button>
            )}
            {pokemon.location !== 'healing' && (
              <button
                type="button"
                onClick={() => onMovePokemon(pokemon.uid, 'healing')}
                className="rounded border border-wood-500 bg-cream-50 px-2.5 py-1 font-bold text-wood-900"
              >
                Nap Bed
              </button>
            )}
          </div>
        </div>

        {/* Active Item Bag */}
        <div>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-wood-700">
            Use Item from Bag
          </h2>
          {usableItems.length === 0 ? (
            <p className="text-xs text-wood-700">
              No stones, berries, or candies in your bag right now. Stock up in Wholesale &amp; Supplies!
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {usableItems.map((item) => {
                const count = inventory[item.slug] ?? 0;
                const check = canUseItemOnPokemon(pokemon, item.slug);
                const evoTargetId =
                  item.category === 'stone'
                    ? getEvolutionTarget(pokemon.speciesId, item.slug as EvolutionStoneSlug)
                    : null;
                const evoTargetName = evoTargetId ? getSpecies(evoTargetId).name : null;

                return (
                  <div
                    key={item.slug}
                    className="ds-inset flex items-center justify-between gap-2 rounded-lg p-2"
                  >
                    <div className="flex items-center gap-2">
                      <ItemIcon slug={item.slug} name={item.name} size={24} />
                      <div>
                        <div className="text-xs font-extrabold text-wood-900">
                          {item.name} (×{count})
                        </div>
                        <div className="text-[11px] text-wood-700">
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
                      className="shrink-0 rounded border-2 border-sage-800 bg-sage-600 px-2.5 py-1 text-xs font-bold text-cream-50 hover:bg-sage-800 disabled:cursor-not-allowed disabled:border-wood-300 disabled:bg-cream-200 disabled:text-wood-500"
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
