/**
 * Debt Warning & Emergency Liquidation Modal shown automatically when shift-end
 * rent/upkeep dues exceed available cash (`shiftPhase === 'settlement-debt'`).
 * Lets players sell Reserve/Display Pokémon at 50% base market value before confirming.
 */
import { getSpecies } from '../data/species';
import type { PokemonInstance, ShiftSettlement } from '../data/types';
import { getLiquidationValue } from '../engine/economy';
import { CozyDialog } from './CozyDialog';
import { PokemonSprite } from './PokemonSprite';

export interface DebtLiquidationModalProps {
  open: boolean;
  cash: number;
  settlement: ShiftSettlement | null;
  debtGraceRemaining: number;
  pokemon: PokemonInstance[];
  onLiquidatePokemon: (pokemonUid: string) => void;
  onFinalizeSettlement: () => void;
}

export function DebtLiquidationModal({
  open,
  cash,
  settlement,
  debtGraceRemaining,
  pokemon,
  onLiquidatePokemon,
  onFinalizeSettlement,
}: DebtLiquidationModalProps) {
  if (!open || !settlement) {
    return (
      <CozyDialog open={false} onClose={() => {}} title="Rent Settlement">
        <div />
      </CozyDialog>
    );
  }

  const cashAfterDues = cash - settlement.totalDues;
  const shortfall = Math.max(0, -cashAfterDues);
  const liquidatable = pokemon.filter((p) => p.location !== 'breeding');

  const confirmLabel =
    shortfall === 0
      ? 'Pay Rent & Continue'
      : debtGraceRemaining > 0
        ? `Use Debt Grace (${debtGraceRemaining} left)`
        : 'Declare Bankruptcy';

  return (
    <CozyDialog
      open={open}
      onClose={() => {}}
      allowLightDismiss={false}
      title={`Shift #${settlement.shiftNumber} — Rent Due & Emergency Liquidation`}
    >
      <div className="space-y-4 text-xs text-[#e2eeff]">
        <div
          className={`border-2 p-3 ${
            shortfall === 0
              ? 'border-[#2ecc71] bg-[#123d28]'
              : 'border-[#e74c3c] bg-[#4a161b]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-white">
              {shortfall === 0
                ? 'Rent Covered! Ready to settle shift dues.'
                : `Cash Shortfall: ₽${shortfall.toLocaleString()}`}
            </strong>
            <span className="font-mono font-bold text-[#ffd84d]">
              Grace Shifts Left: {debtGraceRemaining}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#f2d6d6]">
            {shortfall === 0
              ? 'Your emergency liquidation covered today’s rent and pen/bed upkeep.'
              : debtGraceRemaining > 0
                ? 'Liquidate companions below to pay today’s dues, or invoke 1 Debt Grace shift.'
                : 'No Debt Grace shifts remain! Cover the shortfall below or your store will be foreclosed.'}
          </p>
        </div>

        {/* Itemized Dues */}
        <div className="pmd-inset grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Daily Rent</div>
            <div className="font-mono text-sm font-bold text-white">
              ₽{settlement.dailyRent.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Pen Upkeep</div>
            <div className="font-mono text-sm font-bold text-white">
              ₽{settlement.penUpkeep.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Nap Bed Upkeep</div>
            <div className="font-mono text-sm font-bold text-white">
              ₽{settlement.bedUpkeep.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#a8c4f0]">Total Dues / Cash</div>
            <div className="font-mono text-sm font-bold text-[#ffd84d]">
              ₽{settlement.totalDues.toLocaleString()} / ₽{cash.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Emergency Liquidation Roster (50% base value) */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#ffd84d]">
            Emergency Liquidation (Wholesale 50% Base Value)
          </h2>
          {liquidatable.length === 0 ? (
            <p className="pmd-inset p-3 text-[#a8c4f0]">
              No eligible Pokémon left to liquidate.
            </p>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {liquidatable.map((mon) => {
                const sp = getSpecies(mon.speciesId);
                const payout = getLiquidationValue(mon);
                return (
                  <div
                    key={mon.uid}
                    className="pmd-inset flex items-center justify-between gap-2 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <PokemonSprite
                        speciesId={mon.speciesId}
                        name={sp.name}
                        isShiny={mon.isShiny}
                        size={40}
                      />
                      <div>
                        <div className="font-bold text-white">
                          {mon.isShiny ? '✨ ' : ''}
                          {sp.name}
                        </div>
                        <div className="text-[10px] text-[#a8c4f0]">
                          {mon.location === 'pen'
                            ? `Pen #${(mon.penIndex ?? 0) + 1}`
                            : mon.location === 'healing'
                              ? 'Nap Bed'
                              : 'Reserve'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLiquidatePokemon(mon.uid)}
                      className="pmd-btn-danger shrink-0 px-2.5 py-1 text-[11px] font-bold"
                    >
                      Liquidate (+₽{payout.toLocaleString()})
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[#4e78bd] pt-3">
          <button
            type="button"
            onClick={onFinalizeSettlement}
            className={`px-4 py-2 text-xs font-bold ${
              shortfall === 0
                ? 'pmd-btn-emerald'
                : debtGraceRemaining > 0
                  ? 'pmd-btn-gold'
                  : 'pmd-btn-danger'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
