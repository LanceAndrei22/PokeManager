/**
 * Floating PMD Navy & Gold Top Pill HUD Bar.
 * Displays funds, upcoming shift Rent/Upkeep dues, shift timer & controls (Open/Pause,
 * 1x/2x speed, Close Shift), Shop Rank + XP, daily Market Trend, clickable Counter
 * Queue alert pill, and quick utilities (Journal, Motion Toggle, SFX, Main Menu).
 */
import type { CounterOffer, DifficultyConfig, MarketTrend } from '../data/types';
import type { ShopRankInfo } from '../engine/dex';

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
  motionPaused: boolean;
  onToggleRunning: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
  onCloseShiftEarly: () => void;
  onOpenCounterQueue: () => void;
  onOpenLog: () => void;
  onToggleMotionPaused: () => void;
  onToggleMute: () => void;
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
  motionPaused,
  onToggleRunning,
  onChangeSpeed,
  onCloseShiftEarly,
  onOpenCounterQueue,
  onOpenLog,
  onToggleMotionPaused,
  onToggleMute,
  onReturnToMenu,
}: TopHudBarProps) {
  const shiftPct = Math.min(100, Math.round((shiftTick / shiftDurationTicks) * 100));
  const rentAlert = cash < totalDues;

  return (
    <header
      aria-label="Shop Top HUD"
      className="safe-top-bar pointer-events-none fixed inset-x-0 top-0 z-20"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-1.5">
        {/* Left: Funds + Rent Due + Shift Timer & Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <div className="pmd-pill flex items-center gap-2 px-2.5 py-1 text-xs font-bold">
            <span className="text-[#ffd84d]" title={`${profileName} • ${difficulty.name}`}>
              ₽{cash.toLocaleString()}
            </span>
            <span className="text-[#4e78bd]">|</span>
            <span
              className={rentAlert ? 'text-[#ff8f85]' : 'text-[#a8d0ff]'}
              title={`Daily Rent & Pen/Bed Upkeep (${debtGraceRemaining} Debt Grace left)`}
            >
              Rent: ₽{totalDues.toLocaleString()}
            </span>
          </div>

          <div className="pmd-pill flex flex-wrap items-center gap-1.5 px-2.5 py-1 text-xs">
            <span className="font-bold text-[#ffd84d]">Shift #{shiftNumber}</span>
            <div className="hidden items-center gap-1.5 sm:flex">
              <progress
                aria-label="Shift time progress"
                max={shiftDurationTicks}
                value={shiftTick}
                className="h-2 w-16 accent-[#ffd84d]"
              />
              <span className="font-mono text-[10px] text-[#cfe0ff]">
                {shiftTick}/{shiftDurationTicks}s
              </span>
            </div>
            <button
              type="button"
              disabled={hasPendingSettlement}
              onClick={onToggleRunning}
              className={`px-2 py-0.5 text-[11px] font-bold ${
                shiftRunning ? 'pmd-btn-gold' : 'pmd-btn-emerald'
              }`}
            >
              {shiftRunning ? 'Pause Shift' : 'Open Shop'}
            </button>
            <div className="flex border border-[#78a8f0] bg-[#0b1634]" role="group" aria-label="Simulation speed">
              <button
                type="button"
                aria-pressed={shiftSpeed === 1}
                onClick={() => onChangeSpeed(1)}
                className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  shiftSpeed === 1 ? 'bg-[#ffd84d] text-[#261600]' : 'text-[#cfe0ff]'
                }`}
              >
                1×
              </button>
              <button
                type="button"
                aria-pressed={shiftSpeed === 2}
                onClick={() => onChangeSpeed(2)}
                className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  shiftSpeed === 2 ? 'bg-[#ffd84d] text-[#261600]' : 'text-[#cfe0ff]'
                }`}
              >
                2×
              </button>
            </div>
            <button
              type="button"
              disabled={hasPendingSettlement}
              onClick={onCloseShiftEarly}
              className="pmd-btn px-2 py-0.5 text-[11px] font-bold"
              title="Close Shop & Pay Shift Rent"
            >
              Close Shift
            </button>
          </div>
        </div>

        {/* Right: Counter Queue Alert + Rank/Trend + Utilities */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          {counterQueue.length > 0 && (
            <button
              type="button"
              onClick={onOpenCounterQueue}
              className="pmd-btn-gold flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold"
            >
              <span>!</span>
              <span>Counter: {counterQueue.length} waiting</span>
            </button>
          )}

          <div
            className="pmd-pill hidden items-center gap-2 px-2.5 py-1 text-[11px] lg:flex"
            title={`${rankInfo.title} (${rankInfo.xp} XP)`}
          >
            <span className="font-bold text-[#ffd84d]">Rk.{rankInfo.rank}</span>
            <progress
              aria-label="Shop rank progress"
              max={100}
              value={rankInfo.progressPct}
              className="h-1.5 w-12 accent-[#6ee7a0]"
            />
            <span className="text-[#a8d0ff]">{trend.badge}</span>
          </div>

          <div className="pmd-pill flex items-center gap-1 px-1.5 py-0.5 text-[11px]">
            <button
              type="button"
              onClick={onOpenLog}
              className="pmd-btn px-2 py-0.5 font-bold"
              title="Open Shift Journal"
            >
              Log
            </button>
            <button
              type="button"
              onClick={onToggleMotionPaused}
              aria-label={motionPaused ? 'Play animation' : 'Pause animation'}
              className="pmd-btn hidden px-2 py-0.5 font-bold sm:inline-flex"
            >
              {motionPaused ? 'Play Anim' : 'Pause Anim'}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="pmd-btn px-2 py-0.5 font-bold"
            >
              {muted ? 'Muted' : 'SFX On'}
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="pmd-btn px-2 py-0.5 font-bold text-[#ffd84d]"
            >
              Menu
            </button>
          </div>
        </div>
      </div>

      {/* Ultra-slim live shift readout bar on narrow mobile widths */}
      <div className="mt-1 flex items-center justify-center sm:hidden">
        <span className="pmd-pill pointer-events-auto px-2 py-0.5 font-mono text-[10px] text-[#cfe0ff]">
          {shiftPct}% • {trend.badge} • Rk.{rankInfo.rank}
        </span>
      </div>
    </header>
  );
}
