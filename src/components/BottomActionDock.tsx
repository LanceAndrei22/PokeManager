/**
 * Floating PMD DS Action Dock anchored at the bottom center of the viewport.
 * Provides 1-click access to Display Pens, Wholesale PC (with glowing gold VIP
 * contract badge), Breeding Incubator, Healing Corner, Item Bag, Upgrades, and
 * the 493-species Pokédex without leaving the full-screen store floor.
 */

export type ShopModalTab =
  | 'pens'
  | 'wholesale'
  | 'breeding'
  | 'healing'
  | 'bag'
  | 'upgrades'
  | 'dex';

export interface BottomActionDockProps {
  activeModal: ShopModalTab | null;
  penOccupied: number;
  penCapacity: number;
  healingOccupied: number;
  napBedCapacity: number;
  eggCount: number;
  readyEggCount: number;
  incubatorCapacity: number;
  hasVipContract: boolean;
  totalItemsCount: number;
  discoveredCount: number;
  totalSpeciesCount: number;
  onSelectModal: (tab: ShopModalTab) => void;
}

export function BottomActionDock({
  activeModal,
  penOccupied,
  penCapacity,
  healingOccupied,
  napBedCapacity,
  eggCount,
  readyEggCount,
  incubatorCapacity,
  hasVipContract,
  totalItemsCount,
  discoveredCount,
  totalSpeciesCount,
  onSelectModal,
}: BottomActionDockProps) {
  const buttons: Array<{
    id: ShopModalTab;
    label: string;
    sub: string;
    highlightGold?: boolean;
  }> = [
    { id: 'pens', label: 'Pens', sub: `${penOccupied}/${penCapacity}` },
    {
      id: 'wholesale',
      label: hasVipContract ? 'Wholesale ★VIP' : 'Wholesale PC',
      sub: hasVipContract ? 'VIP Contract' : 'Stock',
      highlightGold: hasVipContract,
    },
    {
      id: 'breeding',
      label: readyEggCount > 0 ? 'Eggs ★Ready' : 'Breeding',
      sub: `${eggCount}/${incubatorCapacity}`,
      highlightGold: readyEggCount > 0,
    },
    { id: 'healing', label: 'Healing', sub: `${healingOccupied}/${napBedCapacity}` },
    { id: 'bag', label: 'Item Bag', sub: `${totalItemsCount}` },
    { id: 'upgrades', label: 'Upgrades', sub: 'Expand' },
    { id: 'dex', label: 'Pokédex', sub: `${discoveredCount}/${totalSpeciesCount}` },
  ];

  return (
    <nav
      aria-label="Shop Action Dock"
      className="safe-bottom-dock pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center"
    >
      <div className="pmd-panel pmd-scroll-strip pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto px-2 py-1.5">
        {buttons.map((btn) => {
          const isOpen = activeModal === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              aria-pressed={isOpen}
              onClick={() => onSelectModal(btn.id)}
              className={`flex shrink-0 flex-col items-center justify-center px-2.5 py-1 text-center ${
                btn.highlightGold
                  ? 'pmd-btn-gold'
                  : isOpen
                    ? 'pmd-btn border-[#ffd84d] ring-1 ring-[#ffd84d]'
                    : 'pmd-btn'
              }`}
            >
              <span className="whitespace-nowrap text-xs font-semibold leading-tight sm:text-sm">
                {btn.label}
              </span>
              <span
                className={`pmd-num text-xs leading-tight ${
                  btn.highlightGold ? 'text-[#3b2200]' : 'text-[#b5d4ff]'
                }`}
              >
                {btn.sub}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
