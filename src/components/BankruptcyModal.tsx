/**
 * Store Foreclosed / Bankruptcy Modal displaying the final tycoon scorecard and
 * offering a clean Shift #1 Reset or Return to Main Menu.
 */
import { DIFFICULTIES } from '../data/difficulties';
import type { BankruptcySummary } from '../data/types';
import { CozyDialog } from './CozyDialog';

export interface BankruptcyModalProps {
  open: boolean;
  summary: BankruptcySummary | null;
  profileName: string;
  onResetRun: () => void;
  onReturnToMenu: () => void;
}

export function BankruptcyModal({
  open,
  summary,
  profileName,
  onResetRun,
  onReturnToMenu,
}: BankruptcyModalProps) {
  if (!open || !summary) {
    return (
      <CozyDialog open={false} onClose={onReturnToMenu} title="Store Foreclosed">
        <div />
      </CozyDialog>
    );
  }

  const diff = DIFFICULTIES[summary.difficulty];

  return (
    <CozyDialog
      open={open}
      onClose={onReturnToMenu}
      allowLightDismiss={false}
      title="Store Foreclosed — Bankruptcy"
    >
      <div className="space-y-4 text-sm text-[#e2eeff]">
        <div className="border-2 border-[#e74c3c] bg-[#4a161b] p-3">
          <h2 className="pmd-heading-display text-[#ffd84d]">
            {profileName}&apos;s PokéMart Foreclosed on Shift #{summary.shiftNumber}
          </h2>
          <p className="mt-1 text-sm text-[#ffd4d0]">
            Daily rent and upkeep exceeded remaining funds with zero Debt Grace remaining. Review
            your tycoon scorecard below and start fresh anytime.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Difficulty</div>
            <div className="mt-0.5 text-base font-semibold text-[#ffd84d]">{diff.name}</div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Shifts Survived</div>
            <div className="pmd-num mt-0.5 text-base text-white">{summary.shiftNumber}</div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Total Adoptions</div>
            <div className="pmd-num mt-0.5 text-base text-white">{summary.totalAdoptions}</div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Lifetime Revenue</div>
            <div className="pmd-num mt-0.5 text-base text-[#6ee7a0]">
              ₽{summary.totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Highest Sale</div>
            <div className="pmd-num mt-0.5 text-base text-[#ffd84d]">
              ₽{summary.highestSale.toLocaleString()}
            </div>
          </div>
          <div className="pmd-inset p-3">
            <div className="text-xs font-medium text-[#b5d4ff]">Pokédex Seen</div>
            <div className="pmd-num mt-0.5 text-base text-white">
              {summary.dexDiscovered} / 493
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#4e78bd] pt-3">
          <button
            type="button"
            onClick={onReturnToMenu}
            className="pmd-btn px-4 py-2 text-sm font-semibold"
          >
            Return to Main Menu
          </button>
          <button
            type="button"
            onClick={onResetRun}
            className="pmd-btn-gold px-4 py-2 text-sm font-semibold"
          >
            Start Fresh Shift #1
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
