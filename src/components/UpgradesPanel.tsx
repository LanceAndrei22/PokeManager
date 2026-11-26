/**
 * Shop Upgrades panel in PMD Navy & Gold.
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
    <div className="grid gap-3 text-[#e2eeff] sm:grid-cols-2 lg:grid-cols-3">
      {SHOP_UPGRADES.map((upgrade) => {
        const level = upgrades[upgrade.id] ?? 0;
        const isMax = level >= upgrade.maxLevel;
        const cost = getUpgradeCost(upgrade.id, level);
        const canAfford = cash >= cost;

        return (
          <article key={upgrade.id} className="pmd-inset flex flex-col justify-between p-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[#ffd84d]">{upgrade.name}</h3>
                <span className="pmd-num border border-[#78a8f0] bg-[#0a1430] px-2 py-0.5 text-xs font-semibold text-white">
                  Lv.{level}/{upgrade.maxLevel}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#b5d4ff]">
                {upgrade.description}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#3b60a0] pt-2">
              <span className="pmd-num text-base text-[#ffd84d]">
                {isMax ? 'Maxed Out' : `₽${cost.toLocaleString()}`}
              </span>
              <button
                type="button"
                disabled={isMax || !canAfford}
                onClick={() => onPurchaseUpgrade(upgrade.id)}
                className="pmd-btn-emerald px-3 py-1 text-sm font-semibold"
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
