/**
 * Floating PMD Navy & Gold Top Pill HUD Bar.
 * Displays funds, upcoming shift Rent/Upkeep dues, shift timer & controls (Open/Pause,
 * 1x/2x speed, Close Shift), Shop Rank + XP, daily Market Trend, clickable Counter
 * Queue alert pill, and quick utilities (Journal, Volume, Guide, Main Menu).
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { CounterOffer, DifficultyConfig, MarketTrend } from '../data/types';
import type { ShopRankInfo } from '../engine/dex';
import { AudioControls } from './AudioControls';

export interface TopHudBarProps {
  profileName: string;
  difficulty: DifficultyConfig;
  cash: number;
  totalDues: number;
  debtGraceRemaining: number;
  shiftNumber: number;
  shiftTick: number;
  shiftDurationTicks: number;
  shiftRunning: boolean;
  shiftSpeed: 1 | 2;
  rankInfo: ShopRankInfo;
  trend: MarketTrend;
  counterQueue: CounterOffer[];
  hasPendingSettlement: boolean;
  muted: boolean;
  bgmMuted: boolean;
  sfxVolume: number;
  bgmVolume: number;
  onToggleRunning: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
  onCloseShiftEarly: () => void;
  onOpenCounterQueue: () => void;
  onOpenLog: () => void;
  onOpenGuide: () => void;
  onToggleBgmMute: () => void;
  onToggleMute: () => void;
  onChangeBgmVolume: (volume: number) => void;
  onChangeSfxVolume: (volume: number) => void;
  onReturnToMenu: () => void;
}

export function TopHudBar({
  profileName,
  difficulty,
  cash,
  totalDues,
  debtGraceRemaining,
  shiftNumber,
  shiftTick,
  shiftDurationTicks,
  shiftRunning,
  shiftSpeed,
  rankInfo,
  trend,
  counterQueue,
  hasPendingSettlement,
  muted,
  bgmMuted,
  sfxVolume,
  bgmVolume,
  onToggleRunning,
  onChangeSpeed,
  onCloseShiftEarly,
  onOpenCounterQueue,
  onOpenLog,
  onOpenGuide,
  onToggleBgmMute,
  onToggleMute,
  onChangeBgmVolume,
  onChangeSfxVolume,
  onReturnToMenu,
}: TopHudBarProps) {
  const rentAlert = cash < totalDues;
  const rankTipId = useId();
  const trendTipId = useId();
  const rankTipRef = useRef<HTMLDivElement>(null);
  const trendTipRef = useRef<HTMLDivElement>(null);
  const hideTimersRef = useRef<{ rank: number | null; trend: number | null }>({
    rank: null,
    trend: null,
  });
  const [rankTipOpen, setRankTipOpen] = useState(false);
  const [trendTipOpen, setTrendTipOpen] = useState(false);

  // Sync aria-expanded from native popover `toggle` events and upgrade `popover="hint"`
  // to `popover="auto"` in `beforetoggle` on browsers where `hint` defaults to `manual`.
  useEffect(() => {
    const syncToggle = (el: HTMLDivElement | null, setOpen: (v: boolean) => void) => {
      if (!el) return () => {};
      const onToggle = (ev: Event) => {
        const next = (ev as ToggleEvent).newState === 'open';
        setOpen(next);
      };
      const onBeforeToggle = (ev: Event) => {
        const toggleEv = ev as ToggleEvent;
        if (toggleEv.newState === 'open' && el.getAttribute('popover') === 'hint') {
          const probe = document.createElement('div');
          try {
            (probe as unknown as { popover: string }).popover = 'hint';
            if ((probe as unknown as { popover: string }).popover !== 'hint') {
              (el as unknown as { popover: string }).popover = 'auto';
            }
          } catch {
            // Older browser / jsdom without popover IDL property
          }
        }
      };
      el.addEventListener('toggle', onToggle);
      el.addEventListener('beforetoggle', onBeforeToggle);
      return () => {
        el.removeEventListener('toggle', onToggle);
        el.removeEventListener('beforetoggle', onBeforeToggle);
      };
    };

    const offRank = syncToggle(rankTipRef.current, setRankTipOpen);
    const offTrend = syncToggle(trendTipRef.current, setTrendTipOpen);
    return () => {
      offRank();
      offTrend();
      if (hideTimersRef.current.rank !== null) window.clearTimeout(hideTimersRef.current.rank);
      if (hideTimersRef.current.trend !== null) window.clearTimeout(hideTimersRef.current.trend);
    };
  }, []);

  const cancelHintHide = (key: 'rank' | 'trend') => {
    const timer = hideTimersRef.current[key];
    if (timer !== null) {
      window.clearTimeout(timer);
      hideTimersRef.current[key] = null;
    }
  };

  const showHintFallback = (key: 'rank' | 'trend', el: HTMLDivElement | null) => {
    cancelHintHide(key);
    if (!el || typeof window === 'undefined') return;
    if ('interestForElement' in HTMLButtonElement.prototype) return;
    if (typeof el.showPopover === 'function') {
      try {
        el.showPopover();
      } catch {
        // Already open or unsupported
      }
    }
  };

  const scheduleHintHide = (key: 'rank' | 'trend', el: HTMLDivElement | null) => {
    cancelHintHide(key);
    if (!el || typeof window === 'undefined') return;
    if ('interestForElement' in HTMLButtonElement.prototype) return;
    // Brief grace delay lets pointer move onto the tooltip itself (WCAG 1.4.13 Hoverable)
    hideTimersRef.current[key] = window.setTimeout(() => {
      hideTimersRef.current[key] = null;
      if (typeof el.hidePopover === 'function') {
        try {
          el.hidePopover();
        } catch {
          // Already closed or unsupported
        }
      }
    }, 180);
  };

  return (
    <header
      aria-label="Shop Top HUD"
      className="pointer-events-none fixed inset-x-0 top-0 z-20 px-3 pt-2"
    >
      <div className="mx-auto flex w-full max-w-[1840px] items-stretch justify-between gap-2">
        {/* Left: Funds + Rent Due + Shift Timer & Controls */}
        <div className="pointer-events-auto flex min-w-0 items-stretch gap-1.5">
          <div className="pmd-pill pmd-num flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold min-[1536px]:text-sm">
            <span className="text-[#ffd84d]" title={`${profileName} • ${difficulty.name}`}>
              ₽{cash.toLocaleString()}
            </span>
            <span className="text-[#4e78bd]">|</span>
            <span
              className={rentAlert ? 'text-[#ff8f85]' : 'text-[#b5d4ff]'}
              title={`Daily Rent & Pen/Bed Upkeep (${debtGraceRemaining} Debt Grace left)`}
            >
              Rent: ₽{totalDues.toLocaleString()}
            </span>
          </div>

          <div className="pmd-pill flex min-h-[40px] shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs">
            <span className="pmd-num whitespace-nowrap text-xs font-semibold text-[#ffd84d] min-[1536px]:text-sm">
              Shift #{shiftNumber}
            </span>
            <div className="flex items-center gap-1">
              <progress
                aria-label="Shift time progress"
                max={shiftDurationTicks}
                value={shiftTick}
                className="h-2 w-10 accent-[#ffd84d] min-[1536px]:w-14"
              />
              <span className="pmd-num whitespace-nowrap text-xs text-[#dbe8ff]">
                {shiftTick}/{shiftDurationTicks}s
              </span>
            </div>
            <button
              type="button"
              disabled={hasPendingSettlement}
              onClick={onToggleRunning}
              className={`whitespace-nowrap px-2 py-0.5 text-xs font-semibold ${
                shiftRunning ? 'pmd-btn-gold' : 'pmd-btn-emerald'
              }`}
            >
              {shiftRunning ? 'Pause Shift' : 'Open Shop'}
            </button>
            <div className="flex shrink-0 border border-[#78a8f0] bg-[#0b1634]" role="group" aria-label="Simulation speed">
              <button
                type="button"
                aria-pressed={shiftSpeed === 1}
                onClick={() => onChangeSpeed(1)}
                className={`pmd-num min-h-[24px] px-1.5 py-0.5 text-xs font-semibold leading-none ${
                  shiftSpeed === 1 ? 'bg-[#ffd84d] text-[#261600]' : 'text-[#dbe8ff]'
                }`}
              >
                1×
              </button>
              <button
                type="button"
                aria-pressed={shiftSpeed === 2}
                onClick={() => onChangeSpeed(2)}
                className={`pmd-num min-h-[24px] px-1.5 py-0.5 text-xs font-semibold leading-none ${
                  shiftSpeed === 2 ? 'bg-[#ffd84d] text-[#261600]' : 'text-[#dbe8ff]'
                }`}
              >
                2×
              </button>
            </div>
            <button
              type="button"
              disabled={hasPendingSettlement}
              onClick={onCloseShiftEarly}
              className="pmd-btn whitespace-nowrap px-2 py-0.5 text-xs font-semibold"
              title="Close Shop & Pay Shift Rent"
            >
              Close Shift
            </button>
          </div>
        </div>

        {/* Right: Counter Queue Alert + Rank/Trend + Utilities */}
        <div className="pointer-events-auto flex shrink-0 items-stretch gap-1.5">
          {counterQueue.length > 0 && (
            <button
              type="button"
              onClick={onOpenCounterQueue}
              className="pmd-btn-gold flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
            >
              <span>!</span>
              <span>Counter: {counterQueue.length} waiting</span>
            </button>
          )}

          <div className="pmd-pill hidden min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap px-2.5 py-1.5 text-xs min-[1440px]:flex">
            <button
              type="button"
              aria-expanded={rankTipOpen}
              aria-label={`Shop Rank ${rankInfo.rank} details`}
              popoverTarget={rankTipId}
              popoverTargetAction="show"
              onMouseEnter={() => showHintFallback('rank', rankTipRef.current)}
              onMouseLeave={() => scheduleHintHide('rank', rankTipRef.current)}
              onFocus={() => showHintFallback('rank', rankTipRef.current)}
              onBlur={() => scheduleHintHide('rank', rankTipRef.current)}
              className="inline-flex min-h-[24px] cursor-pointer items-center gap-1.5 rounded-none bg-transparent px-1 text-left focus-visible:outline-2 focus-visible:outline-[#ffd84d]"
              {...({ interestfor: rankTipId } as Record<string, string>)}
            >
              <span className="pmd-num font-semibold text-[#ffd84d]">
                Rank {rankInfo.rank}
              </span>
              <progress
                aria-label="Shop rank progress"
                max={100}
                value={rankInfo.progressPct}
                className="h-1.5 w-10 accent-[#6ee7a0]"
              />
            </button>
            <div
              ref={rankTipRef}
              id={rankTipId}
              role="tooltip"
              onMouseEnter={() => cancelHintHide('rank')}
              onMouseLeave={() => scheduleHintHide('rank', rankTipRef.current)}
              className="pmd-hint-popover"
              {...({ popover: 'hint' } as Record<string, string>)}
            >
              <div className="font-semibold text-[#ffd84d]">
                Rank {rankInfo.rank} — {rankInfo.title} ({rankInfo.xp} XP)
              </div>
              <p className="mt-1 text-[#cfe0ff]">
                Earn Shop XP from adoptions, healing strays, evolutions &amp; hatching to unlock
                rarer Gen 1–4 species and VIP Legendary Contracts.
              </p>
            </div>

            <span className="text-[#4e78bd]" aria-hidden="true">
              |
            </span>

            <button
              type="button"
              aria-expanded={trendTipOpen}
              aria-label={`Today's Market Trend: ${trend.badge}`}
              popoverTarget={trendTipId}
              popoverTargetAction="show"
              onMouseEnter={() => showHintFallback('trend', trendTipRef.current)}
              onMouseLeave={() => scheduleHintHide('trend', trendTipRef.current)}
              onFocus={() => showHintFallback('trend', trendTipRef.current)}
              onBlur={() => scheduleHintHide('trend', trendTipRef.current)}
              className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 bg-transparent px-1 text-left focus-visible:outline-2 focus-visible:outline-[#ffd84d]"
              {...({ interestfor: trendTipId } as Record<string, string>)}
            >
              <span className="font-semibold text-[#9ec4ff]">Trend:</span>
              <span className="font-semibold text-[#6ee7a0]">{trend.badge}</span>
            </button>
            <div
              ref={trendTipRef}
              id={trendTipId}
              role="tooltip"
              onMouseEnter={() => cancelHintHide('trend')}
              onMouseLeave={() => scheduleHintHide('trend', trendTipRef.current)}
              className="pmd-hint-popover"
              {...({ popover: 'hint' } as Record<string, string>)}
            >
              <div className="font-semibold text-[#6ee7a0]">
                Daily Trend: {trend.title}
              </div>
              <p className="mt-1 text-[#cfe0ff]">{trend.description}</p>
            </div>
          </div>

          <div className="pmd-pill flex min-h-[40px] shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs">
            <button
              type="button"
              onClick={onOpenLog}
              className="pmd-btn shrink-0 whitespace-nowrap px-2 py-0.5 font-semibold"
              title="Open Shift Journal"
            >
              Log
            </button>
            <AudioControls
              compact
              bgmMuted={bgmMuted}
              sfxMuted={muted}
              bgmVolume={bgmVolume}
              sfxVolume={sfxVolume}
              onToggleBgmMute={onToggleBgmMute}
              onToggleSfxMute={onToggleMute}
              onChangeBgmVolume={onChangeBgmVolume}
              onChangeSfxVolume={onChangeSfxVolume}
            />
            <button
              type="button"
              onClick={onOpenGuide}
              className="pmd-btn shrink-0 whitespace-nowrap px-2 py-0.5 font-semibold text-[#6ee7a0]"
              title="Open PokéMart Manager's Guide"
            >
              Guide
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="pmd-btn shrink-0 whitespace-nowrap px-2 py-0.5 font-semibold text-[#ffd84d]"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
