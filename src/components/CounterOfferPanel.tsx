/**
 * Non-blocking Live-Clock Counter-Offer Panel anchored cleanly above the Bottom DS
 * Action Dock with no dimming backdrop so the indoor store canvas and shift timer keep
 * ticking live while the player negotiates (`Accept`, `Haggle +15%`, `Haggle +30%`,
 * `Decline`) or switches between up to 4 queued shoppers at Kecleon's counter.
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getItemDefinition } from '../data/items';
import { getSpecies } from '../data/species';
import type { CounterOffer, GiftBallSlug } from '../data/types';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface CounterOfferPanelProps {
  queue: CounterOffer[];
  activeOffer: CounterOffer | null;
  activeGiftBall: GiftBallSlug;
  inventory: Partial<Record<string, number>>;
  onSelectOffer: (offerUid: string) => void;
  onSelectGiftBall: (ball: GiftBallSlug) => void;
  onAccept: (offerUid: string) => void;
  onHaggle: (offerUid: string, boostPct: 15 | 30) => void;
  onDecline: (offerUid: string) => void;
  onMinimize: () => void;
}

const GIFT_BALL_OPTIONS: GiftBallSlug[] = [
  'poke-ball',
  'heal-ball',
  'friend-ball',
  'luxury-ball',
  'cherish-ball',
];

export function CounterOfferPanel({
  queue,
  activeOffer,
  activeGiftBall,
  inventory,
  onSelectOffer,
  onSelectGiftBall,
  onAccept,
  onHaggle,
  onDecline,
  onMinimize,
}: CounterOfferPanelProps) {
  if (!activeOffer || queue.length === 0) return null;

  const species = getSpecies(activeOffer.speciesId);
  const arch = CUSTOMER_ARCHETYPES[activeOffer.archetypeId];
  const patiencePct =
    activeOffer.maxPatience > 0
      ? Math.min(100, Math.max(0, Math.round((activeOffer.patience / activeOffer.maxPatience) * 100)))
      : 100;
  const maxHagglesReached = activeOffer.haggleAttempts >= activeOffer.maxHaggleAttempts;

  return (
    <aside
      aria-label="Live Counter Negotiation"
      className="pointer-events-auto fixed inset-x-2 bottom-[4.75rem] z-30 mx-auto max-w-2xl"
    >
      <div className="pmd-panel space-y-2.5 p-3">
        {/* Header + Queue Switcher (1/N, 2/N...) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4e78bd] pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-[family-name:var(--font-display)] text-xs font-bold text-[#ffd84d]">
              Kecleon Counter
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Queued shoppers">
              {queue.map((q, idx) => {
                const selected = q.uid === activeOffer.uid;
                const low = q.maxPatience > 0 && q.patience / q.maxPatience < 0.35;
                return (
                  <button
                    key={q.uid}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectOffer(q.uid)}
                    className={`px-2 py-0.5 font-mono text-[10px] font-bold ${
                      selected
                        ? 'pmd-btn-gold'
                        : low
                          ? 'pmd-btn-danger'
                          : 'pmd-btn'
                    }`}
                  >
                    {idx + 1}/{queue.length}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onMinimize}
            className="pmd-btn px-2 py-0.5 text-[11px] font-bold"
          >
            Hide
          </button>
        </div>

        {/* Shopper vs Target Pokémon + Live Patience Bar */}
        <div className="grid gap-2.5 sm:grid-cols-[1.2fr_1fr]">
          <div className="pmd-inset flex items-center gap-2.5 p-2">
            <PokemonSprite
              speciesId={activeOffer.npcSpeciesId}
              name={activeOffer.customerName}
              size={52}
            />
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <span className="truncate font-bold text-white">{activeOffer.customerName}</span>
                {activeOffer.isVip && (
                  <span className="border border-[#ffd84d] bg-[#5c3e00] px-1 text-[10px] font-bold text-[#ffd84d]">
                    VIP
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#a8d0ff]">{arch.badgeLabel}</div>

              {/* Live-Clock Patience Meter */}
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className={patiencePct < 35 ? 'text-[#ff8f85]' : 'text-[#cfe0ff]'}>
                    Patience: {activeOffer.patience}/{activeOffer.maxPatience}s
                  </span>
                  <span className="text-[#ffd84d]">
                    Haggles {activeOffer.haggleAttempts}/{activeOffer.maxHaggleAttempts}
                  </span>
                </div>
                <div className="mt-0.5 h-2 w-full border border-[#070d1f] bg-[#091229]">
                  <div
                    className={`h-full transition-all ${
                      patiencePct > 60
                        ? 'bg-[#2ecc71]'
                        : patiencePct > 35
                          ? 'bg-[#ffd84d]'
                          : 'bg-[#e74c3c]'
                    }`}
                    style={{ width: `${patiencePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Requested Pokémon & Current Offer */}
          <div className="pmd-inset flex items-center justify-between gap-2 p-2">
            <div className="flex items-center gap-2">
              <PokemonSprite
                speciesId={activeOffer.speciesId}
                name={species.name}
                isShiny={activeOffer.isShiny}
                size={48}
              />
              <div className="min-w-0 text-xs">
                <div className="truncate font-bold text-white">
                  {activeOffer.isShiny ? '✨ ' : ''}
                  {species.name}
                </div>
                <div className="text-[10px] text-[#a8d0ff]">
                  Fair: ₽{activeOffer.fairValue.toLocaleString()}
                </div>
                <div className="font-mono text-sm font-bold text-[#ffd84d]">
                  Offer: ₽{activeOffer.currentOffer.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Haggle feedback message + Quick Gift-Wrap Ball Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-bold text-[#a8d0ff]">Gift Ball:</span>
            {GIFT_BALL_OPTIONS.map((slug) => {
              const def = getItemDefinition(slug);
              const disabled = slug !== 'poke-ball' && (inventory[slug] ?? 0) <= 0;
              const selected = activeGiftBall === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectGiftBall(slug)}
                  title={`${def.name}: ${def.description}`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold ${
                    selected ? 'pmd-btn-gold' : 'pmd-btn'
                  }`}
                >
                  <ItemIcon slug={slug} name={def.name} size={14} />
                  <span>{def.name.replace(' Wrap', '').replace(' Ball', '')}</span>
                </button>
              );
            })}
          </div>
          {activeOffer.lastActionNote && (
            <span className="font-bold text-[#ffd84d]">{activeOffer.lastActionNote}</span>
          )}
        </div>

        {/* 4 Negotiation Controls */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onAccept(activeOffer.uid)}
            className="pmd-btn-emerald px-2.5 py-1.5 text-xs font-bold"
          >
            Accept (+₽{activeOffer.currentOffer.toLocaleString()})
          </button>
          <button
            type="button"
            disabled={maxHagglesReached}
            onClick={() => onHaggle(activeOffer.uid, 15)}
            className="pmd-btn-gold px-2.5 py-1.5 text-xs font-bold"
          >
            Haggle +15%
          </button>
          <button
            type="button"
            disabled={maxHagglesReached}
            onClick={() => onHaggle(activeOffer.uid, 30)}
            className="pmd-btn-gold px-2.5 py-1.5 text-xs font-bold"
          >
            Haggle +30%
          </button>
          <button
            type="button"
            onClick={() => onDecline(activeOffer.uid)}
            className="pmd-btn-danger px-2.5 py-1.5 text-xs font-bold"
          >
            Decline
          </button>
        </div>
      </div>
    </aside>
  );
}
