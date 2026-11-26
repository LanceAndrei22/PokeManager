/**
 * Display Pens & Reserve Kennel management panel in PMD Navy & Gold:
 * Controls global & per-pen markup sliders, active checkout gift-wrap Poké Ball,
 * Pokémon cards, and moving Pokémon between Reserve Kennel and Pens.
 */
import type { CSSProperties } from 'react';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type { GiftBallSlug, MarketTrend, PokemonInstance } from '../data/types';
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
  'cherish-ball',
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
    <div className="space-y-4 text-[#e2eeff]">
      {/* Global Pricing & Checkout Ribbon Bar */}
      <div className="pmd-inset grid gap-4 p-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <label htmlFor="global-markup-slider" className="text-[#ffd84d]">
              Global Shop Markup
            </label>
            <span className="pmd-num text-base text-[#6ee7a0]">{globalMarkup}%</span>
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
            className="pmd-slider mt-1"
          />
          <p className="text-xs text-[#b5d4ff]">
            80%–105% delights Bargain Browsers; 125%+ suits Collectors &amp; Shiny Seekers.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold text-[#ffd84d]">Checkout Gift-Wrap Ribbon</div>
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
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold ${
                    selected ? 'pmd-btn-gold' : 'pmd-btn'
                  }`}
                >
                  <ItemIcon slug={slug} name={def.name} size={18} />
                  <span>{def.name.replace(' Wrap', '')}</span>
                  <span className="pmd-num text-xs">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Display Pen Grid */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-[#ffd84d]">
          Display Pens ({penMons.length}/{penCapacity})
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: penCapacity }, (_, penIndex) => {
            const mon = penMons.find((p) => p.penIndex === penIndex);
            const penOverride = penMarkups[penIndex] ?? null;
            const effectiveMarkup = getEffectiveMarkup({ globalMarkup, penMarkups }, penIndex);

            if (!mon) {
              return (
                <div
                  key={penIndex}
                  className="pmd-inset flex min-h-[156px] flex-col items-center justify-center border-dashed border-[#4e78bd] p-3.5 text-center text-sm text-[#b5d4ff]"
                >
                  <div className="font-semibold text-white">Display Pen #{penIndex + 1}</div>
                  <div className="mt-1 text-xs">Empty — move a companion from Reserve or Wholesale!</div>
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
              <article key={mon.uid} className="pmd-inset flex min-w-0 flex-col justify-between p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={56}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="pmd-num text-xs font-semibold text-[#b5d4ff]">Pen #{penIndex + 1}</div>
                      <h4 className="truncate text-base font-semibold text-white">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </h4>
                      <div className="text-xs font-semibold text-[#6ee7a0]">{mon.trait}</div>
                      {trendMatch && (
                        <span className="mt-0.5 inline-block border border-[#ffd84d] bg-[#5c3e00] px-1.5 py-0.5 text-xs font-semibold text-[#ffd84d]">
                          Trend Boost!
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="pmd-num text-base text-[#ffd84d]">
                      ~₽{valuation.askingPrice.toLocaleString()}
                    </div>
                    <div className="pmd-num text-xs text-[#b5d4ff]">{effectiveMarkup}% tag</div>
                  </div>
                </div>

                {/* Stacked Tag Selector + Crisp 2-Column Action Row (Zero Right-Edge Overflow) */}
                <div className="mt-3 flex flex-col gap-2 border-t border-[#3b60a0] pt-2.5 text-xs">
                  <label className="flex min-w-0 items-center justify-between gap-2 font-semibold text-[#b5d4ff]">
                    <span className="shrink-0">Tag:</span>
                    <select
                      aria-label={`Pen ${penIndex + 1} markup`}
                      value={penOverride === null ? 'global' : String(penOverride)}
                      onChange={(e) =>
                        onChangePenMarkup(
                          penIndex,
                          e.target.value === 'global' ? null : Number(e.target.value),
                        )
                      }
                      className="min-w-0 flex-1 border border-[#78a8f0] bg-[#0a1430] px-2 py-1 text-xs font-semibold text-white"
                    >
                      <option value="global">Global ({globalMarkup}%)</option>
                      <option value="90">90% Quick</option>
                      <option value="100">100% Fair</option>
                      <option value="115">115% Cozy</option>
                      <option value="135">135% Collector</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onMovePokemon(mon.uid, 'reserve')}
                      className="pmd-btn whitespace-nowrap px-2.5 py-1 text-center font-semibold"
                    >
                      Rest
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectPokemon(mon.uid)}
                      className="pmd-btn-emerald whitespace-nowrap px-2.5 py-1 text-center font-semibold"
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
        <h3 className="mb-2 text-base font-semibold text-[#ffd84d]">
          Reserve Kennel ({reserveMons.length})
        </h3>
        {reserveMons.length === 0 ? (
          <p className="pmd-inset px-3 py-2.5 text-sm text-[#b5d4ff]">
            No Pokémon waiting in the back kennel. Extra hatches or rested strays wait here.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {reserveMons.map((mon) => {
              const species = getSpecies(mon.speciesId);
              return (
                <div
                  key={mon.uid}
                  className="pmd-inset flex min-w-0 items-center justify-between gap-2 p-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <PokemonSprite
                      speciesId={mon.speciesId}
                      name={species.name}
                      isShiny={mon.isShiny}
                      size={44}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {mon.isShiny ? '✨ ' : ''}
                        {species.name}
                      </div>
                      <div className="text-xs text-[#b5d4ff]">
                        {mon.trait} • Cute {mon.stats.cute}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onMovePokemon(mon.uid, 'pen')}
                      className="pmd-btn-emerald whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
                    >
                      To Pen
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectPokemon(mon.uid)}
                      className="pmd-btn whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
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
