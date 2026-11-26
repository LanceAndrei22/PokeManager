/**
 * Floating PMD Navy & Gold Top Pill HUD Bar.
 * Displays funds, upcoming shift Rent/Upkeep dues, shift timer & controls (Open/Pause,
 * 1x/2x speed, Close Shift), Shop Rank + XP, daily Market Trend, clickable Counter
 * Queue alert pill, and quick utilities (Journal, Motion Toggle, SFX, Main Menu).
 */
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
  motionPaused: boolean;
  onToggleRunning: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
  onCloseShiftEarly: () => void;
  onOpenCounterQueue: () => void;
  onOpenLog: () => void;
  onToggleMotionPaused: () => void;
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
  motionPaused,
  onToggleRunning,
  onChangeSpeed,
  onCloseShiftEarly,
  onOpenCounterQueue,
  onOpenLog,
  onToggleMotionPaused,
  onToggleBgmMute,
  onToggleMute,
  onChangeBgmVolume,
  onChangeSfxVolume,
  onReturnToMenu,
}: TopHudBarProps) {
  const rentAlert = cash < totalDues;

  return (
    <header
      aria-label="Shop Top HUD"
      className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4 pt-2.5"
    >
      <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-2">
        {/* Left: Funds + Rent Due + Shift Timer & Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="pmd-pill pmd-num flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-sm font-semibold">
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

          <div className="pmd-pill flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <span className="pmd-num whitespace-nowrap text-sm font-semibold text-[#ffd84d]">
              Shift #{shiftNumber}
            </span>
            <div className="flex items-center gap-1">
              <progress
                aria-label="Shift time progress"
                max={shiftDurationTicks}
                value={shiftTick}
                className="h-2 w-12 accent-[#ffd84d]"
              />
              <span className="pmd-num whitespace-nowrap text-xs text-[#dbe8ff]">
                {shiftTick}/{shiftDurationTicks}s
              </span>
            </div>
            <button
              type="button"
              disabled={hasPendingSettlement}
              onClick={onToggleRunning}
              className={`whitespace-nowrap px-2.5 py-0.5 text-xs font-semibold ${
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
                className={`pmd-num px-1.5 py-0.5 text-xs font-semibold ${
                  shiftSpeed === 1 ? 'bg-[#ffd84d] text-[#261600]' : 'text-[#dbe8ff]'
                }`}
              >
                1×
              </button>
              <button
                type="button"
                aria-pressed={shiftSpeed === 2}
                onClick={() => onChangeSpeed(2)}
                className={`pmd-num px-1.5 py-0.5 text-xs font-semibold ${
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

        {/* Right: Counter Queue Alert + Rank/Trend + Audio & Utilities */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {counterQueue.length > 0 && (
            <button
              type="button"
              onClick={onOpenCounterQueue}
              className="pmd-btn-gold flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
            >
              <span>!</span>
              <span>Counter: {counterQueue.length} waiting</span>
            </button>
          )}

          <div
            className="pmd-pill hidden items-center gap-2 whitespace-nowrap px-2.5 py-1 text-xs min-[1400px]:flex"
            title={`${rankInfo.title} (${rankInfo.xp} XP)`}
          >
            <span className="pmd-num font-semibold text-[#ffd84d]">Rk.{rankInfo.rank}</span>
            <progress
              aria-label="Shop rank progress"
              max={100}
              value={rankInfo.progressPct}
              className="h-1.5 w-10 accent-[#6ee7a0]"
            />
            <span className="text-[#b5d4ff]">{trend.badge}</span>
          </div>

          <div className="pmd-pill flex items-center gap-1 px-1.5 py-0.5 text-xs">
            <button
              type="button"
              onClick={onOpenLog}
              className="pmd-btn whitespace-nowrap px-2 py-0.5 font-semibold"
              title="Open Shift Journal"
            >
              Log
            </button>
            <button
              type="button"
              onClick={onToggleMotionPaused}
              aria-label={motionPaused ? 'Play animation' : 'Pause animation'}
              className="pmd-btn inline-flex whitespace-nowrap px-2 py-0.5 font-semibold"
            >
              {motionPaused ? 'Play' : 'Anim'}
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
              onClick={onReturnToMenu}
              className="pmd-btn whitespace-nowrap px-2 py-0.5 font-semibold text-[#ffd84d]"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
