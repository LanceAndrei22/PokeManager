/**
 * Non-blocking Live-Clock Counter-Offer Panel anchored cleanly above the Bottom DS
 * Action Dock with no dimming backdrop. Pairs the Human Trainer shopper's pixel portrait
 * beside the PMD Pokémon portrait they wish to adopt while the shop ticks live.
 */
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { getItemDefinition } from '../data/items';
import { getHumanNpcById } from '../data/npcs';
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
  const npcProfile = getHumanNpcById(activeOffer.npcId);
  const portraitSrc =
    activeOffer.npcPortraitUrl || npcProfile?.portraitUrl || './assets/npcs/portraits/camper.png';

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
      <div className="pmd-panel space-y-2.5 p-3.5">
        {/* Header + Queue Switcher (1/N, 2/N...) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4e78bd] pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pmd-heading-display text-base text-[#ffe169]">
              PokéMart Counter
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
                    className={`pmd-num px-2.5 py-0.5 text-xs font-semibold ${
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
            className="pmd-btn px-2.5 py-0.5 text-sm font-semibold"
          >
            Hide
          </button>
        </div>

        {/* Human Trainer Portrait vs Desired Pokémon + Live Patience Bar */}
        <div className="grid gap-2.5 sm:grid-cols-[1.25fr_1fr]">
          <div className="pmd-inset flex items-center gap-3 p-2.5">
            <img
              src={portraitSrc}
              alt={activeOffer.customerName}
              width={60}
              height={60}
              className="pixel-art h-15 w-15 shrink-0 border border-[#4e78bd] bg-[#0a1430] object-contain"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-white">
                  {activeOffer.customerName}
                </span>
                {activeOffer.isVip && (
                  <span className="border border-[#ffe169] bg-[#5c3e00] px-1.5 py-0.5 text-xs font-semibold text-[#ffe169]">
                    VIP
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-[#b5d4ff]">{arch.badgeLabel}</div>
              {npcProfile && (
                <p className="mt-0.5 line-clamp-1 text-xs italic text-[#9ec4ff]">
                  &ldquo;{npcProfile.flavorLine}&rdquo;
                </p>
              )}

              {/* Live-Clock Patience Meter */}
              <div className="mt-1.5">
                <div className="pmd-num flex items-center justify-between text-xs font-semibold">
                  <span className={patiencePct < 35 ? 'text-[#ff9c94]' : 'text-[#dbe8ff]'}>
                    Patience: {activeOffer.patience}/{activeOffer.maxPatience}s
                  </span>
                  <span className="text-[#ffe169]">
                    Haggles {activeOffer.haggleAttempts}/{activeOffer.maxHaggleAttempts}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full border border-[#070d1f] bg-[#091229]">
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
          <div className="pmd-inset flex items-center justify-between gap-2 p-2.5">
            <div className="flex items-center gap-2.5">
              <PokemonSprite
                speciesId={activeOffer.speciesId}
                name={species.name}
                isShiny={activeOffer.isShiny}
                size={52}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {activeOffer.isShiny ? '✨ ' : ''}
                  {species.name}
                </div>
                <div className="pmd-num text-xs text-[#b5d4ff]">
                  Fair: ₽{activeOffer.fairValue.toLocaleString()}
                </div>
                <div className="pmd-num text-base font-semibold text-[#ffe169]">
                  Offer: ₽{activeOffer.currentOffer.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gift-Wrap Ball Ribbon & Haggle Feedback */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold text-[#b5d4ff]">Gift Ball:</span>
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
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold ${
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
            <span className="font-semibold text-[#ffe169]">{activeOffer.lastActionNote}</span>
          )}
        </div>

        {/* 4 Negotiation Controls */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onAccept(activeOffer.uid)}
            className="pmd-btn-emerald pmd-num px-3 py-1.5 text-sm font-semibold"
          >
            Accept (+₽{activeOffer.currentOffer.toLocaleString()})
          </button>
          <button
            type="button"
            disabled={maxHagglesReached}
            onClick={() => onHaggle(activeOffer.uid, 15)}
            className="pmd-btn-gold px-3 py-1.5 text-sm font-semibold"
          >
            Haggle +15%
          </button>
          <button
            type="button"
            disabled={maxHagglesReached}
            onClick={() => onHaggle(activeOffer.uid, 30)}
            className="pmd-btn-gold px-3 py-1.5 text-sm font-semibold"
          >
            Haggle +30%
          </button>
          <button
            type="button"
            onClick={() => onDecline(activeOffer.uid)}
            className="pmd-btn-danger px-3 py-1.5 text-sm font-semibold"
          >
            Decline
          </button>
        </div>
      </div>
    </aside>
  );
}
