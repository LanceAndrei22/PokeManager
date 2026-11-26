/**
 * Shop Upgrades panel for expanding pens, incubators, nap beds, cafe ambiance,
 * and Lucky Egg shiny/mystery shipments.
 */
import { SHOP_UPGRADES, getUpgradeCost } from '../data/upgrades';
import type { ShopUpgradeId } from '../data/types';

export interface UpgradesPanelProps {
  cash: number;
  upgrades: Record<ShopUpgradeId, number>;
  onPurchaseUpgrade: (upgradeId: ShopUpgradeId) => void;
}

export function UpgradesPanel({ cash, upgrades, onPurchaseUpgrade }: UpgradesPanelProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SHOP_UPGRADES.map((upgrade) => {
        const level = upgrades[upgrade.id] ?? 0;
        const isMax = level >= upgrade.maxLevel;
        const cost = getUpgradeCost(upgrade.id, level);
        const canAfford = cash >= cost;

        return (
          <article key={upgrade.id} className="ds-inset flex flex-col justify-between rounded-xl p-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-wood-900">{upgrade.name}</h3>
                <span className="rounded-full border border-wood-500 bg-cream-50 px-2 py-0.5 font-mono text-[11px] font-bold text-wood-900">
                  Lv.{level}/{upgrade.maxLevel}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-wood-700">
                {upgrade.description}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-wood-300/60 pt-2">
              <span className="font-mono text-xs font-extrabold text-wood-900">
                {isMax ? 'Maxed Out' : `₽${cost.toLocaleString()}`}
              </span>
              <button
                type="button"
                disabled={isMax || !canAfford}
                onClick={() => onPurchaseUpgrade(upgrade.id)}
                className="rounded-md border-2 border-sage-800 bg-sage-600 px-3 py-1 text-xs font-bold text-cream-50 hover:bg-sage-800 disabled:cursor-not-allowed disabled:border-wood-300 disabled:bg-cream-200 disabled:text-wood-500"
              >
                {isMax ? 'Complete' : 'Upgrade'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
