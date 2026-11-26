/**
 * Heads-Up Display showing shop funds, live-tick shift controls (Open/Pause, 1x/2x,
 * Close Shift & Rest), Cozy Rank progress, and the active Shift Market Trend.
 */
import type { MarketTrend } from '../data/types';
import type { ShopRankInfo } from '../engine/dex';

export interface ShiftHudProps {
  cash: number;
  shiftNumber: number;
  shiftTick: number;
  shiftDurationTicks: number;
  shiftRunning: boolean;
  shiftSpeed: 1 | 2;
  rankInfo: ShopRankInfo;
  trend: MarketTrend;
  hasPendingSummary: boolean;
  onToggleRunning: () => void;
  onChangeSpeed: (speed: 1 | 2) => void;
  onCloseShiftEarly: () => void;
}

export function ShiftHud({
  cash,
  shiftNumber,
  shiftTick,
  shiftDurationTicks,
  shiftRunning,
  shiftSpeed,
  rankInfo,
  trend,
  hasPendingSummary,
  onToggleRunning,
  onChangeSpeed,
  onCloseShiftEarly,
}: ShiftHudProps) {
  const shiftProgressPct = Math.min(100, Math.round((shiftTick / shiftDurationTicks) * 100));

  return (
    <section aria-label="Shift Controls and Market Trend" className="ds-panel rounded-xl p-4">
      <div className="grid gap-3 md:grid-cols-12 md:items-center">
        {/* Funds & Shift Clock */}
        <div className="flex flex-wrap items-center gap-4 md:col-span-5">
          <div className="ds-inset rounded-lg px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-wood-500">
              Shop Funds
            </div>
            <div className="font-mono text-xl font-extrabold text-sage-800">
              ₽{cash.toLocaleString()}
            </div>
          </div>

          <div className="min-w-[150px] flex-1">
            <div className="flex items-center justify-between text-xs font-bold text-wood-900">
              <span>Shift #{shiftNumber}</span>
              <span className="font-mono text-wood-700">
                {shiftTick}/{shiftDurationTicks}s
              </span>
            </div>
            <progress
              aria-label="Shift timer progress"
              max={shiftDurationTicks}
              value={shiftTick}
              className="mt-1 h-2.5 w-full overflow-hidden rounded-full"
            />
            <div className="mt-0.5 text-[11px] text-wood-700">
              {shiftRunning
                ? `Doors open (${shiftSpeed}× gentle pace)`
                : hasPendingSummary
                  ? 'Shift complete — review summary'
                  : `Paused (${shiftProgressPct}%)`}
            </div>
          </div>
        </div>

        {/* Relaxed Pace Controls */}
        <div className="flex flex-wrap items-center gap-2 md:col-span-4">
          <button
            type="button"
            onClick={onToggleRunning}
            className={`rounded-lg border-2 px-3.5 py-2 text-xs font-extrabold transition ${
              shiftRunning
                ? 'border-honey-600 bg-honey-100 text-wood-900 hover:bg-honey-400/60'
                : 'border-sage-800 bg-sage-600 text-cream-50 hover:bg-sage-800'
            }`}
          >
            {shiftRunning ? 'Pause Shift' : 'Open Shop'}
          </button>

          <div className="inline-flex rounded-lg border-2 border-wood-500 bg-cream-100 p-0.5">
            <button
              type="button"
              onClick={() => onChangeSpeed(1)}
              aria-pressed={shiftSpeed === 1}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                shiftSpeed === 1 ? 'bg-wood-700 text-cream-50' : 'text-wood-900 hover:bg-cream-200'
              }`}
            >
              1×
            </button>
            <button
              type="button"
              onClick={() => onChangeSpeed(2)}
              aria-pressed={shiftSpeed === 2}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                shiftSpeed === 2 ? 'bg-wood-700 text-cream-50' : 'text-wood-900 hover:bg-cream-200'
              }`}
            >
              2×
            </button>
          </div>

          <button
            type="button"
            onClick={onCloseShiftEarly}
            className="rounded-lg border-2 border-wood-500 bg-cream-100 px-3 py-2 text-xs font-bold text-wood-900 hover:bg-cream-200"
          >
            Close Shift &amp; Rest
          </button>
        </div>

        {/* Cozy Rank Badge */}
        <div className="ds-inset rounded-lg px-3 py-2 md:col-span-3">
          <div className="flex items-center justify-between text-xs font-bold text-wood-900">
            <span>Cozy Rank {rankInfo.rank}</span>
            <span className="text-[11px] text-sage-800">{rankInfo.xp} XP</span>
          </div>
          <div className="text-xs font-semibold text-wood-700">{rankInfo.title}</div>
          <progress
            aria-label="Cozy rank progress"
            max={100}
            value={rankInfo.progressPct}
            className="mt-1 h-2 w-full"
          />
          <div className="mt-0.5 text-[11px] text-wood-500">
            {rankInfo.unlockedSpeciesCount} species unlocked in Wholesale
          </div>
        </div>
      </div>

      {/* Market Trend Ticker */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-honey-600/60 bg-honey-100/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-wood-900 px-2 py-0.5 text-[11px] font-bold text-honey-100">
            Market Trend
          </span>
          <span className="font-extrabold text-wood-900">{trend.title}:</span>
          <span className="text-wood-800">{trend.description}</span>
        </div>
        <span className="rounded-full border border-honey-600 bg-cream-50 px-2.5 py-0.5 text-[11px] font-bold text-wood-900">
          {trend.badge}
        </span>
      </div>
    </section>
  );
}
