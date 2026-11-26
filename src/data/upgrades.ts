/**
 * Shop upgrade tracks allowing cozy expansion of pens, incubators, nap beds,
 * cafe ambiance, and rare Mystery Egg shipments.
 */
import type { ShopUpgrade, ShopUpgradeId } from './types';

export const SHOP_UPGRADES: ShopUpgrade[] = [
  {
    id: 'extra-pen',
    name: 'Oak Display Pen',
    description: 'Adds +1 cozy display pen (base 3, up to 6 pens).',
    baseCost: 750,
    costStep: 550,
    maxLevel: 3,
  },
  {
    id: 'extra-incubator',
    name: 'Warm Egg Incubator',
    description: 'Adds +1 egg incubator slot & +15% hatch speed per level.',
    baseCost: 800,
    costStep: 650,
    maxLevel: 2,
  },
  {
    id: 'extra-nap-bed',
    name: 'Plush Nap Bed',
    description: 'Adds +1 stray healing bed & faster gentle nap recovery.',
    baseCost: 550,
    costStep: 450,
    maxLevel: 2,
  },
  {
    id: 'cafe-decor',
    name: 'Matcha Café Corner',
    description: 'Boosts shopper foot traffic, patience, and checkout tips (+₽35/level).',
    baseCost: 650,
    costStep: 500,
    maxLevel: 4,
  },
  {
    id: 'mystery-shipment',
    name: 'Lucky Egg Delivery',
    description: 'Increases Mystery Egg & Shiny hatching sparkle odds (+2%/level).',
    baseCost: 900,
    costStep: 700,
    maxLevel: 3,
  },
];

export const UPGRADES_BY_ID: Record<ShopUpgradeId, ShopUpgrade> = Object.fromEntries(
  SHOP_UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
) as Record<ShopUpgradeId, ShopUpgrade>;

/** Computes the ₽ cost to upgrade a specific shop facility to its next level. */
export function getUpgradeCost(upgradeId: ShopUpgradeId, currentLevel: number): number {
  const def = UPGRADES_BY_ID[upgradeId];
  return def.baseCost + currentLevel * def.costStep;
}
