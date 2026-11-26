/**
 * Shift Summary & Rent Settlement Modal in PMD Navy & Gold shown when a shift closes.
 * Displays Adoption revenue, Tips, Wholesale spend, Daily Rent + Upkeep breakdown,
 * ending balance, and Debt Grace invocation warnings.
 */
import type { ShiftSettlement } from '../data/types';
import { CozyDialog } from './CozyDialog';

export interface ShiftSummaryModalProps {
  summary: ShiftSettlement | null;
  onStartNextShift: () => void;
}

export function ShiftSummaryModal({ summary, onStartNextShift }: ShiftSummaryModalProps) {
  if (!summary) {
    return (
      <CozyDialog open={false} onClose={onStartNextShift} title="Shift Summary">
        <div />
      </CozyDialog>
    );
  }

  return (
    <CozyDialog
      open={Boolean(summary)}
      onClose={onStartNextShift}
      allowLightDismiss={false}
      title={`Shift #${summary.shiftNumber} Complete — Ledger Recap`}
    >
      <div className="space-y-4 text-xs text-[#e2eeff]">
        {summary.usedDebtGrace && (
          <div className="border-2 border-[#ffd84d] bg-[#523700] p-3 text-[#ffeaa3]">
            <strong>Debt Grace Invoked!</strong> Today&apos;s dues exceeded cash on hand, using 1
            Debt Grace shift (Remaining: {summary.debtGraceRemaining}). Finish your next shift at ≥ ₽0
            to avoid Store Foreclosure!
          </div>
        )}

        <p className="text-[#cfe0ff]">
          {summary.closedEarly
            ? 'Closed doors early for ledger tally and pen cleaning.'
            : 'Closing bell chimed! Kecleon tallied the counter register.'}{' '}
          Market Trend: <strong className="text-[#ffd84d]">{summary.trendTitle}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="pmd-inset p-2.5">
            <div className="text-[10px] text-[#a8c4f0]">Adoption Sales</div>
            <div className="font-mono text-base font-bold text-[#6ee7a0]">
              ₽{summary.revenue.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-2.5">
            <div className="text-[10px] text-[#a8c4f0]">Tips Earned</div>
            <div className="font-mono text-base font-bold text-[#ffd84d]">
              +₽{summary.tipsEarned.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-2.5">
            <div className="text-[10px] text-[#a8c4f0]">Wholesale Spend</div>
            <div className="font-mono text-base font-bold text-white">
              ₽{summary.expenses.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-2.5">
            <div className="text-[10px] text-[#a8c4f0]">Cash After Dues</div>
            <div
              className={`font-mono text-base font-bold ${
                summary.cashAfterDues >= 0 ? 'text-[#6ee7a0]' : 'text-[#ff8f85]'
              }`}
            >
              ₽{summary.cashAfterDues.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Daily Rent & Upkeep Breakdown */}
        <div className="pmd-inset grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Daily Rent</div>
            <div className="font-mono font-bold text-white">₽{summary.dailyRent.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Pen Upkeep</div>
            <div className="font-mono font-bold text-white">₽{summary.penUpkeep.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Nap Bed Upkeep</div>
            <div className="font-mono font-bold text-white">₽{summary.bedUpkeep.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Total Dues Paid</div>
            <div className="font-mono font-bold text-[#ffd84d]">
              ₽{summary.totalDues.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="pmd-inset flex flex-wrap gap-3 px-3 py-2 font-bold text-[#a8d0ff]">
          <span>Adoptions: {summary.adoptionsCount}</span>
          <span>•</span>
          <span>Walk-outs: {summary.walkoutsCount}</span>
          <span>•</span>
          <span>Hatched: {summary.eggsHatched}</span>
          <span>•</span>
          <span>Healed: {summary.straysHealed}</span>
          <span>•</span>
          <span className="text-[#ffd84d]">
            Shop XP: {summary.cozyXpEarned >= 0 ? '+' : ''}
            {summary.cozyXpEarned}
          </span>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onStartNextShift}
            className="pmd-btn-gold px-4 py-2 text-sm font-bold"
          >
            Start Next Shift (#{summary.shiftNumber + 1})
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
