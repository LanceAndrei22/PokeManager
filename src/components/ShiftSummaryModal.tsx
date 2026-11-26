/**
 * Cozy Shift Summary Modal shown when a shift finishes or is closed early.
 */
import type { ShiftSummary } from '../data/types';
import { CozyDialog } from './CozyDialog';

export interface ShiftSummaryModalProps {
  summary: ShiftSummary | null;
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

  const netProfit = summary.revenue + summary.tipsEarned - summary.expenses;

  return (
    <CozyDialog
      open={Boolean(summary)}
      onClose={onStartNextShift}
      allowLightDismiss={false}
      title={`Shift #${summary.shiftNumber} Complete — Cozy Recap`}
    >
      <div className="space-y-4">
        <p className="text-xs text-wood-700">
          {summary.closedEarly
            ? 'You flipped the sign to Resting Early and brewed some warm tea.'
            : 'Closing bell chimed! All browsers headed home with warm smiles.'}{' '}
          Active trend: <strong className="text-wood-900">{summary.trendTitle}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="ds-inset rounded-lg p-2.5">
            <div className="text-[11px] font-bold text-wood-500">Adoption Sales</div>
            <div className="font-mono text-base font-extrabold text-sage-800">
              ₽{summary.revenue.toLocaleString()}
            </div>
          </div>
          <div className="ds-inset rounded-lg p-2.5">
            <div className="text-[11px] font-bold text-wood-500">Tips Earned</div>
            <div className="font-mono text-base font-extrabold text-honey-600">
              +₽{summary.tipsEarned.toLocaleString()}
            </div>
          </div>
          <div className="ds-inset rounded-lg p-2.5">
            <div className="text-[11px] font-bold text-wood-500">Wholesale Spend</div>
            <div className="font-mono text-base font-extrabold text-wood-900">
              ₽{summary.expenses.toLocaleString()}
            </div>
          </div>
          <div className="ds-inset rounded-lg p-2.5">
            <div className="text-[11px] font-bold text-wood-500">Shift Net</div>
            <div className="font-mono text-base font-extrabold text-wood-900">
              {netProfit >= 0 ? '+' : ''}₽{netProfit.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 rounded-lg border border-sage-300 bg-sage-100/70 px-3 py-2 text-xs font-bold text-sage-800">
          <span>Adoptions: {summary.adoptionsCount}</span>
          <span>•</span>
          <span>Eggs Hatched: {summary.eggsHatched}</span>
          <span>•</span>
          <span>Strays Rested: {summary.straysHealed}</span>
          <span>•</span>
          <span>Cozy XP: +{summary.cozyXpEarned}</span>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onStartNextShift}
            className="rounded-lg border-2 border-sage-800 bg-sage-600 px-4 py-2 text-sm font-extrabold text-cream-50 hover:bg-sage-800"
          >
            Start Next Shift (#{summary.shiftNumber + 1})
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
