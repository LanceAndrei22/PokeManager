/**
 * Display Pens & Reserve Kennel management panel:
 * Controls global & per-pen markup sliders, active checkout gift-wrap Poké Ball,
 * detailed Platinum cards, and moving Pokémon between Reserve Kennel and Pens.
 */
import type { CSSProperties } from 'react';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type {
  GiftBallSlug,
  MarketTrend,
  PokemonInstance,
} from '../data/types';
import { calculatePokemonValuation, getEffectiveMarkup } from '../engine/economy';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface DisplayPensPanelProps {
  penCapacity: number;
  pokemon: PokemonInstance[];
  globalMarkup: number;
  penMarkups: Record<number, number | null>;
  activeGiftBall: GiftBallSlug;
  inventory: Partial<Record<string, number>>;
  trend: MarketTrend;
  recentSpeciesSales: Record<number, number>;
  onChangeGlobalMarkup: (markup: number) => void;
  onChangePenMarkup: (penIndex: number, markup: number | null) => void;
  onSelectGiftBall: (ball: GiftBallSlug) => void;
  onInspectPokemon: (uid: string) => void;
  onMovePokemon: (uid: string, dest: 'pen' | 'reserve' | 'healing', targetPenIndex?: number) => void;
}

const GIFT_BALL_OPTIONS: GiftBallSlug[] = [
  'poke-ball',
  'heal-ball',
  'friend-ball',
  'luxury-ball',
];

export function DisplayPensPanel({
  penCapacity,
  pokemon,
  globalMarkup,
  penMarkups,
  activeGiftBall,
  inventory,
  trend,
  recentSpeciesSales,
  onChangeGlobalMarkup,
  onChangePenMarkup,
  onSelectGiftBall,
  onInspectPokemon,
  onMovePokemon,
}: DisplayPensPanelProps) {
  const penMons = pokemon.filter((p) => p.location === 'pen');
  const reserveMons = pokemon.filter((p) => p.location === 'reserve');

  return (
    <div className="space-y-4">
      {/* Global Pricing & Checkout Ribbon Bar */}
      <div className="ds-inset grid gap-4 rounded-xl p-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-wood-900">
            <label htmlFor="global-markup-slider">Global Shop Markup</label>
            <span className="font-mono text-sm text-sage-800">{globalMarkup}%</span>
          </div>
          <input
            id="global-markup-slider"
            type="range"
            min={80}
            max={160}
            step={5}
            value={globalMarkup}
            aria-valuetext={`${globalMarkup} percent markup`}
            style={{ '--control-value': String(globalMarkup) } as CSSProperties}
            onChange={(e) => onChangeGlobalMarkup(Number(e.target.value))}
            className="cozy-slider mt-1"
          />
          <p className="text-[11px] text-wood-700">
            80%–105% delights Bargain Browsers; 125%+ suits Collectors &amp; Shiny Seekers.
          </p>
        </div>

        <div>
          <div className="text-xs font-bold text-wood-900">Checkout Gift-Wrap Ribbon</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {GIFT_BALL_OPTIONS.map((slug) => {
              const def = getItemDefinition(slug);
              const count = slug === 'poke-ball' ? '∞' : (inventory[slug] ?? 0);
              const disabled = slug !== 'poke-ball' && (inventory[slug] ?? 0) <= 0;
              const selected = activeGiftBall === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectGiftBall(slug)}
                  title={def.description}
                  className={`inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 text-[11px] font-bold transition ${
                    selected
                      ? 'border-sage-800 bg-sage-100 text-sage-800'
                      : 'border-wood-300 bg-cream-50 text-wood-900 hover:bg-cream-200'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <ItemIcon slug={slug} name={def.name} size={18} />
                  <span>{def.name.replace(' Wrap', '')}</span>
                  <span className="font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Display Pen Grid */}
      <div>
        <h3 className="mb-2 text-sm font-extrabold text-wood-900">
          Display Pens ({penMons.length}/{penCapacity})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: penCapacity }, (_, penIndex) => {
            const mon = penMons.find((p) => p.penIndex === penIndex);
            const penOverride = penMarkups[penIndex] ?? null;
            const effectiveMarkup = getEffectiveMarkup({ globalMarkup, penMarkups }, penIndex);

            if (!mon) {
              return (
                <div
                  key={penIndex}
                  className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-wood-300 bg-cream-100/50 p-3 text-center text-xs text-wood-500"
                >
                  <div className="font-bold">Display Pen #{penIndex + 1}</div>
                  <div className="mt-1">Empty — move a companion from Reserve or Wholesale!</div>
                </div>
              );
            }

            const species = getSpecies(mon.speciesId);
            const valuation = calculatePokemonValuation(
              mon,
              trend,
              'cozy-collector',
              recentSpeciesSales[mon.speciesId] ?? 0,
              effectiveMarkup,
            );
            const trendMatch = valuation.breakdown.trendMatched;

            return (
              <article
                key={mon.uid}
                className="ds-inset flex flex-col justify-between rounded-xl p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={64}
                    />
                    <div>
                      <div className="text-xs font-bold text-wood-500">Pen #{penIndex + 1}</div>
                      <h4 className="text-sm font-extrabold text-wood-900">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </h4>
                      <div className="text-[11px] font-semibold text-sage-800">{mon.trait}</div>
                      {trendMatch && (
                        <span className="mt-0.5 inline-block rounded bg-honey-100 px-1.5 py-0.5 text-[10px] font-bold text-wood-900">
                          Trend Boost!
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-extrabold text-sage-800">
                      ~₽{valuation.askingPrice.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-wood-500">{effectiveMarkup}% tag</div>
                  </div>
                </div>

                {/* Per-pen markup override mini control */}
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-wood-300/60 pt-2 text-[11px]">
                  <label className="flex items-center gap-1 font-semibold text-wood-700">
                    <span>Tag:</span>
                    <select
                      aria-label={`Pen ${penIndex + 1} markup`}
                      value={penOverride === null ? 'global' : String(penOverride)}
                      onChange={(e) =>
                        onChangePenMarkup(
                          penIndex,
                          e.target.value === 'global' ? null : Number(e.target.value),
                        )
                      }
                      className="rounded border border-wood-500 bg-cream-50 px-1.5 py-0.5 text-[11px] font-bold"
                    >
                      <option value="global">Global ({globalMarkup}%)</option>
                      <option value="90">90% Quick</option>
                      <option value="100">100% Fair</option>
                      <option value="115">115% Cozy</option>
                      <option value="135">135% Collector</option>
                    </select>
                  </label>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onMovePokemon(mon.uid, 'reserve')}
                      className="rounded border border-wood-500 bg-cream-50 px-2 py-0.5 font-bold text-wood-900 hover:bg-cream-200"
                    >
                      Rest
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectPokemon(mon.uid)}
                      className="rounded border border-sage-800 bg-sage-600 px-2.5 py-0.5 font-bold text-cream-50 hover:bg-sage-800"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Reserve Kennel */}
      <div>
        <h3 className="mb-2 text-sm font-extrabold text-wood-900">
          Reserve Kennel ({reserveMons.length})
        </h3>
        {reserveMons.length === 0 ? (
          <p className="rounded-lg border border-wood-300 bg-cream-100/40 px-3 py-2 text-xs text-wood-700">
            No Pokémon waiting in the back kennel. Extra hatches or rested strays wait here.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reserveMons.map((mon) => {
              const species = getSpecies(mon.speciesId);
              return (
                <div
                  key={mon.uid}
                  className="ds-inset flex items-center justify-between gap-2 rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={48}
                    />
                    <div>
                      <div className="text-xs font-extrabold text-wood-900">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </div>
                      <div className="text-[11px] text-wood-700">
                        {mon.trait} • Cute {mon.stats.cute}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onMovePokemon(mon.uid, 'pen')}
                      className="rounded border border-sage-800 bg-sage-600 px-2 py-1 text-[11px] font-bold text-cream-50 hover:bg-sage-800"
                    >
                      To Pen
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectPokemon(mon.uid)}
                      className="rounded border border-wood-500 bg-cream-50 px-2 py-1 text-[11px] font-bold text-wood-900"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
