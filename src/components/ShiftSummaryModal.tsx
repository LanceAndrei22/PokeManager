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
      <div className="space-y-4 text-sm text-[#e2eeff]">
        {summary.usedDebtGrace && (
          <div className="border-2 border-[#ffd84d] bg-[#523700] p-3 text-[#ffeaa3]">
            <strong>Debt Grace Invoked!</strong> Today&apos;s dues exceeded cash on hand, using 1
            Debt Grace shift (Remaining: {summary.debtGraceRemaining}). Finish your next shift at ≥ ₽0
            to avoid Store Foreclosure!
          </div>
        )}

        <p className="text-sm leading-relaxed text-[#dbe8ff]">
          {summary.closedEarly
            ? 'Closed doors early for ledger tally and pen cleaning.'
            : 'Closing bell chimed! Clerk Leo tallied the counter register.'}{' '}
          Market Trend: <strong className="font-semibold text-[#ffd84d]">{summary.trendTitle}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Adoption Sales</div>
            <div className="pmd-num pmd-text-shadow mt-0.5 text-lg text-[#6ee7a0]">
              ₽{summary.revenue.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Tips Earned</div>
            <div className="pmd-num pmd-text-shadow mt-0.5 text-lg text-[#ffd84d]">
              +₽{summary.tipsEarned.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Wholesale Spend</div>
            <div className="pmd-num pmd-text-shadow mt-0.5 text-lg text-white">
              ₽{summary.expenses.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Cash After Dues</div>
            <div
              className={`pmd-num pmd-text-shadow mt-0.5 text-lg ${
                summary.cashAfterDues >= 0 ? 'text-[#6ee7a0]' : 'text-[#ff8f85]'
              }`}
            >
              ₽{summary.cashAfterDues.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Daily Rent & Upkeep Breakdown */}
        <div className="pmd-inset grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-[#b5d4ff]">Daily Rent</div>
            <div className="pmd-num mt-0.5 text-base text-white">
              ₽{summary.dailyRent.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#b5d4ff]">Pen Upkeep</div>
            <div className="pmd-num mt-0.5 text-base text-white">
              ₽{summary.penUpkeep.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#b5d4ff]">Nap Bed Upkeep</div>
            <div className="pmd-num mt-0.5 text-base text-white">
              ₽{summary.bedUpkeep.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#b5d4ff]">Total Dues Paid</div>
            <div className="pmd-num mt-0.5 text-base text-[#ffd84d]">
              ₽{summary.totalDues.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="pmd-inset pmd-num flex flex-wrap gap-3 px-3.5 py-2.5 text-sm text-[#c4deff]">
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
            className="pmd-btn-gold px-5 py-2 text-base font-semibold"
          >
            Start Next Shift (#{summary.shiftNumber + 1})
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
