/**
 * Shop Upgrades panel in PMD Navy & Gold.
 */
import { DEFAULT_CLERK_ID, getClerkById } from '../data/npcs';
import { SHOP_UPGRADES, getUpgradeCost } from '../data/upgrades';
import type { ShopUpgradeId } from '../data/types';

export interface UpgradesPanelProps {
  cash: number;
  upgrades: Record<ShopUpgradeId, number>;
  shopkeepers?: string[];
  onPurchaseUpgrade: (upgradeId: ShopUpgradeId) => void;
}

export function UpgradesPanel({
  cash,
  upgrades,
  shopkeepers = [DEFAULT_CLERK_ID],
  onPurchaseUpgrade,
}: UpgradesPanelProps) {
  const activeClerks = (shopkeepers.length > 0 ? shopkeepers : [DEFAULT_CLERK_ID]).map((id) =>
    getClerkById(id),
  );

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

              {upgrade.id === 'hire-clerk' && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#2d4a84] pt-2">
                  <span className="text-xs font-semibold text-[#9ec4ff]">Staff:</span>
                  {activeClerks.map((clerk, idx) => (
                    <span
                      key={`${clerk.id}-${idx}`}
                      className="inline-flex items-center gap-1 border border-[#4e78bd] bg-[#0d1c40] px-1.5 py-0.5 text-xs font-medium text-white"
                    >
                      <img
                        src={clerk.portraitUrl}
                        alt={clerk.name}
                        width={18}
                        height={18}
                        className="pixel-art h-4 w-4 object-contain"
                      />
                      <span>{clerk.name.replace(/^Clerk\s+/, '')}</span>
                    </span>
                  ))}
                </div>
              )}
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
                {isMax ? 'Complete' : upgrade.id === 'hire-clerk' ? 'Hire Random' : 'Upgrade'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
