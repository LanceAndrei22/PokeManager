/**
 * Stylized PokéMart Manager's Handbook (Game Guide Modal) in PMD DS Royal Navy & Gold.
 * Accessible from the top-right bar on both the Main Menu and the active Indoor Store HUD.
 * Organizes every core mechanic into scannable highlighted sections with bold callouts,
 * exact difficulty/archetype numbers, and quick strategy tips.
 */
import { useState } from 'react';
import { CUSTOMER_ARCHETYPES } from '../data/customers';
import { DIFFICULTY_LIST } from '../data/difficulties';
import { SHOP_UPGRADES } from '../data/upgrades';
import type { CustomerArchetypeId } from '../data/types';
import { CozyDialog } from './CozyDialog';

export interface GameGuideModalProps {
  open: boolean;
  onClose: () => void;
}

type GuideTabId = 'loop' | 'haggling' | 'staff' | 'care' | 'stakes';

const GUIDE_TABS: Array<{ id: GuideTabId; label: string }> = [
  { id: 'loop', label: 'Core Loop' },
  { id: 'haggling', label: 'Shoppers & Haggling' },
  { id: 'staff', label: 'Staff & Upgrades' },
  { id: 'care', label: 'Care, Breeding & Items' },
  { id: 'stakes', label: 'Rent, Stakes & Saves' },
];

const ARCHETYPE_ORDER: CustomerArchetypeId[] = [
  'normal',
  'bargain-browser',
  'cozy-collector',
  'trend-fan',
  'shiny-seeker',
  'vip-seeker',
];

const ARCHETYPE_BADGE_STYLES: Record<CustomerArchetypeId, string> = {
  normal: 'border-[#78a8f0] bg-[#142958] text-[#dbe8ff]',
  'bargain-browser': 'border-[#6ee7a0] bg-[#133b28] text-[#9effc3]',
  'cozy-collector': 'border-[#f48fb1] bg-[#451930] text-[#ffd1e3]',
  'trend-fan': 'border-[#ffd84d] bg-[#453208] text-[#ffe98f]',
  'shiny-seeker': 'border-[#c4a1ff] bg-[#2e1c54] text-[#e4d4ff]',
  'vip-seeker': 'border-[#ffd84d] bg-[#5c3e00] text-[#ffd84d]',
};

/** Interactive tabbed handbook explaining every mechanic of PokéMart: Low Cortisol Shift. */
export function GameGuideModal({ open, onClose }: GameGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTabId>('loop');

  return (
    <CozyDialog open={open} onClose={onClose} title="PokéMart Manager's Guide">
      <div className="space-y-4 text-sm leading-relaxed text-[#dbe8ff]">
        {/* Section Navigation Tabs */}
        <nav
          role="tablist"
          aria-label="Game Guide Sections"
          className="flex flex-wrap gap-1.5 border-b-2 border-[#3b60a0] pb-2"
        >
          {GUIDE_TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`pmd-tab px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-2 border-[#ffd84d] bg-[#214284] text-[#ffd84d]'
                    : 'border-2 border-[#3a61a3] bg-[#0e1e44] text-[#cfe0ff] hover:border-[#78a8f0] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: CORE LOOP & CONTROLS */}
        {activeTab === 'loop' && (
          <div className="space-y-3" role="tabpanel" aria-label="Core Loop">
            <section className="pmd-inset space-y-2.5 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#ffd84d]">
                  The 4-Step Shift Loop
                </h2>
                <span className="border border-[#ffd84d] bg-[#1a3160] px-2 py-0.5 text-xs font-semibold text-[#ffd84d]">
                  100s Per Shift • Zero Auto-Sales
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="border border-[#4e78bd] bg-[#0d1c40] p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#ffd84d]">
                    1. Prep &amp; Stock
                  </div>
                  <p className="mt-1 text-xs text-[#cfe0ff]">
                    While doors are <strong className="text-white">CLOSED</strong>, stock pens from
                    the <strong className="text-[#6ee7a0]">Wholesale PC</strong>, set{' '}
                    <strong className="text-[#ffd84d]">Price Tags (80%–160%)</strong>, heal strays,
                    and pair breeders.
                  </p>
                </div>
                <div className="border border-[#4e78bd] bg-[#0d1c40] p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#6ee7a0]">
                    2. Open Doors
                  </div>
                  <p className="mt-1 text-xs text-[#cfe0ff]">
                    Click <strong className="text-[#6ee7a0]">Open Shop</strong> (toggle{' '}
                    <strong className="text-[#ffd84d]">1× / 2×</strong> speed). Watch the{' '}
                    <strong className="text-white">Wall Clock</strong> above the counter count down
                    your shift—it freezes whenever you pause!
                  </p>
                </div>
                <div className="border border-[#4e78bd] bg-[#0d1c40] p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#78a8f0]">
                    3. Counter Deals
                  </div>
                  <p className="mt-1 text-xs text-[#cfe0ff]">
                    Trainers browse pens, then queue at the register with a{' '}
                    <strong className="text-[#ffd84d]">!</strong> badge. Click them before their{' '}
                    <strong className="text-[#ff9b91]">Patience Bar</strong> runs dry to{' '}
                    <strong className="text-white">Accept, Haggle, or Decline</strong>.
                  </p>
                </div>
                <div className="border border-[#4e78bd] bg-[#0d1c40] p-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#ff9b91]">
                    4. Pay Rent
                  </div>
                  <p className="mt-1 text-xs text-[#cfe0ff]">
                    When the clock hits <strong className="text-white">100s</strong> (or you click{' '}
                    <strong className="text-white">Close Shift</strong>), settle{' '}
                    <strong className="text-[#ffd84d]">Daily Rent + Pen &amp; Bed Upkeep</strong>,
                    then start tomorrow with a fresh Trend &amp; Catalog!
                  </p>
                </div>
              </div>
            </section>

            <section className="pmd-inset space-y-2 p-3.5">
              <h2 className="text-base font-semibold text-[#ffd84d]">
                Click-to-Manage Store Floor
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                  <strong className="text-[#ffd84d]">Display Pens &amp; Pokémon:</strong> Click any
                  Pokémon on the floor to <strong className="text-white">Inspect, Feed, Evolve,
                  Promote to Mascot, or Liquidate</strong>. Click an empty pen to stock it from your
                  Reserve Kennel.
                </div>
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                  <strong className="text-[#78a8f0]">Checkout Counter (!):</strong> Click any
                  waiting trainer (or the top gold <strong className="text-[#ffd84d]">Counter</strong>{' '}
                  alert) to open the non-blocking checkout panel while your shop stays live.
                </div>
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                  <strong className="text-[#6ee7a0]">Wholesale PC &amp; Upgrades Board:</strong>{' '}
                  Click the PC beside the counter for daily stock, strays, items &amp;{' '}
                  <strong className="text-[#ffd84d]">VIP Contracts</strong>. Click the oak wall
                  board to expand pens, beds, incubators, or hire clerks.
                </div>
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                  <strong className="text-[#f48fb1]">Resting Corner &amp; Incubator:</strong> Click
                  the bottom-left rug to tend napping rescues, or the glass{' '}
                  <strong className="text-[#6ee7a0]">Incubator</strong> pedestal to pair compatible
                  Pokémon and hatch Eggs.
                </div>
              </div>
            </section>

            <div className="border-2 border-[#6ee7a0] bg-[#103324] px-3.5 py-2.5 text-xs text-[#d6ffe6]">
              <strong className="text-[#6ee7a0]">Quick Tip:</strong> You can{' '}
              <strong className="text-white">Pause Shift</strong> anytime to safely reorganize pens,
              use evolution stones, or buy upgrades—the wall clock and shopper patience bars pause
              until you reopen!
            </div>
          </div>
        )}

        {/* TAB 2: SHOPPERS, VALUATION & HAGGLING */}
        {activeTab === 'haggling' && (
          <div className="space-y-3" role="tabpanel" aria-label="Shoppers and Haggling">
            <section className="pmd-inset space-y-2.5 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#ffd84d]">
                  6 Human Trainer Archetypes
                </h2>
                <span className="text-xs text-[#b5d4ff]">
                  Match traits, trends &amp; rarity for massive premiums
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ARCHETYPE_ORDER.map((id) => {
                  const arch = CUSTOMER_ARCHETYPES[id];
                  return (
                    <div key={id} className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`border px-2 py-0.5 font-semibold ${ARCHETYPE_BADGE_STYLES[id]}`}
                        >
                          {arch.name}
                        </span>
                        <span className="pmd-num text-[#ffd84d]">
                          Up to {arch.markupTolerance}%
                        </span>
                      </div>
                      <p className="mt-1.5 leading-snug text-[#cfe0ff]">{arch.description}</p>
                      <div className="pmd-num mt-1.5 flex items-center justify-between border-t border-[#264173] pt-1 text-[11px] text-[#9ec4ff]">
                        <span>Base Patience: {arch.basePatience}s</span>
                        <span>
                          Bonus:{' '}
                          <strong className="text-[#6ee7a0]">
                            {arch.bonusMultiplier > 1
                              ? `+${Math.round((arch.bonusMultiplier - 1) * 100)}%`
                              : 'Fair Base'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-[#b5d4ff]">
                <strong className="text-[#ffd84d]">Legendary Rule:</strong> Everyday{' '}
                <strong className="text-white">Normal Shoppers</strong> (~40% of visitors) gladly
                buy regular Pokémon without picky demands, but{' '}
                <strong className="text-[#ffd84d]">only VIP Collectors</strong> will make purchase
                offers on <strong className="text-white">Legendaries &amp; Mythicals</strong>.
              </p>
            </section>

            <section className="pmd-inset space-y-2.5 p-3.5">
              <h2 className="text-base font-semibold text-[#ffd84d]">
                Push-Your-Luck Counter Haggling (Max 2 Attempts)
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="border border-[#6ee7a0] bg-[#102e24] p-2.5 text-xs">
                  <div className="font-semibold text-[#6ee7a0]">Haggle +15% (Safer Push)</div>
                  <p className="mt-1 text-[#d6ffe6]">
                    <strong className="text-white">~68% base odds</strong> (higher if Trend or
                    Archetype matched). Costs <strong className="text-white">-1s</strong> patience
                    on success, or <strong className="text-[#ffd84d]">-35% max patience</strong> on
                    reject.
                  </p>
                </div>
                <div className="border border-[#ff9b91] bg-[#3b151a] p-2.5 text-xs">
                  <div className="font-semibold text-[#ff9b91]">Haggle +30% (Greedy Push)</div>
                  <p className="mt-1 text-[#ffd9d4]">
                    <strong className="text-white">~44% base odds</strong>. Huge payout jump, but
                    failure drops <strong className="text-white">60% max patience</strong> and has a{' '}
                    <strong className="text-[#ffd84d]">45% instant walk-out</strong> risk!
                  </p>
                </div>
                <div className="border border-[#78a8f0] bg-[#10224a] p-2.5 text-xs">
                  <div className="font-semibold text-[#ffd84d]">Gift-Wrap &amp; Decline</div>
                  <p className="mt-1 text-[#dbe8ff]">
                    Equip specialty <strong className="text-white">Poké Balls</strong> at checkout
                    for bonus <strong className="text-[#6ee7a0]">₽ Tips &amp; Shop XP</strong>.
                    Clicking <strong className="text-white">Decline</strong> dismisses a shopper
                    with <strong className="text-[#6ee7a0]">0 XP penalty</strong> (unlike walk-outs).
                  </p>
                </div>
              </div>
              <div className="border-t border-[#2d4a84] pt-2 text-xs text-[#cfe0ff]">
                <strong className="text-[#ffd84d]">Pricing &amp; Saturation Formula:</strong>{' '}
                Fair Value scales with <strong className="text-white">Stats</strong> (Cute, Comfort,
                Rarity), <strong className="text-[#ffd84d]">Shiny (3.0×!)</strong>,{' '}
                <strong className="text-[#6ee7a0]">Daily Trend</strong>, and{' '}
                <strong className="text-white">Archetype Match</strong>. Selling the exact same
                species <strong className="text-[#ff9b91]">3+ times recently</strong> trims{' '}
                <strong className="text-white">-8% per extra sale</strong> (capped at -30%), so
                rotate stock for peak profits!
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: STAFF, UPGRADES & RANK */}
        {activeTab === 'staff' && (
          <div className="space-y-3" role="tabpanel" aria-label="Staff and Upgrades">
            <section className="pmd-inset space-y-2 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#ffd84d]">
                  Shopkeepers &amp; Hiring Counter Clerks
                </h2>
                <span className="border border-[#6ee7a0] bg-[#123d28] px-2 py-0.5 text-xs font-semibold text-[#9effc3]">
                  Up to 3 Clerks Behind the Counter
                </span>
              </div>
              <p className="text-xs text-[#cfe0ff]">
                Choose your <strong className="text-white">Initial Shopkeeper</strong> (Leo, Clara,
                Liam, Penny, Hana, or Steven) when creating a Trainer Profile—they stand right
                beside the Cash Register. Buy{' '}
                <strong className="text-[#ffd84d]">Hire Counter Clerk</strong> on the Upgrades Board
                to recruit up to <strong className="text-white">2 random extra clerks</strong>:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border border-[#4e78bd] bg-[#0b1736] p-2.5 text-xs">
                  <strong className="text-[#6ee7a0]">Lv.1 (2 Shopkeepers Total):</strong> Every
                  queued shopper gets <strong className="text-white">+5s starting patience</strong>{' '}
                  and skips patience decay every 3rd tick (
                  <strong className="text-[#ffd84d]">~33% slower expiration</strong>).
                </div>
                <div className="border border-[#ffd84d] bg-[#1b3161] p-2.5 text-xs">
                  <strong className="text-[#ffd84d]">Lv.2 (3 Shopkeepers Total):</strong> Every
                  queued shopper gets <strong className="text-white">+10s starting patience</strong>{' '}
                  and skips patience decay every 2nd tick (
                  <strong className="text-[#6ee7a0]">50% slower expiration</strong>!).
                </div>
              </div>
            </section>

            <section className="pmd-inset space-y-2 p-3.5">
              <h2 className="text-base font-semibold text-[#ffd84d]">All 6 Shop Upgrades</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SHOP_UPGRADES.map((upg) => (
                  <div key={upg.id} className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-[#ffd84d]">{upg.name}</strong>
                      <span className="pmd-num text-[#9ec4ff]">Max Lv.{upg.maxLevel}</span>
                    </div>
                    <p className="mt-1 leading-snug text-[#cfe0ff]">{upg.description}</p>
                    <div className="pmd-num mt-1.5 text-[11px] text-[#6ee7a0]">
                      Starts at ₽{upg.baseCost.toLocaleString()} (+₽{upg.costStep}/lv)
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pmd-inset p-3 text-xs text-[#cfe0ff]">
              <strong className="text-[#ffd84d]">Shop Rank (Rk.1 → Rk.10) &amp; 493 Pokédex:</strong>{' '}
              Completing adoptions, healing strays, evolving, and hatching eggs earns{' '}
              <strong className="text-white">Shop XP</strong>. Higher ranks unlock rarer Gen 1–4
              species in Wholesale and trigger{' '}
              <strong className="text-[#ffd84d]">VIP Legendary Contracts</strong> (Rank 6+ on
              Relaxed/Standard; <strong className="text-[#6ee7a0]">Rank 4+ on High Stakes</strong>)!
            </section>
          </div>
        )}

        {/* TAB 4: CARE, BREEDING & ITEMS */}
        {activeTab === 'care' && (
          <div className="space-y-3" role="tabpanel" aria-label="Care, Breeding and Items">
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="pmd-inset space-y-1.5 p-3.5">
                <h2 className="text-base font-semibold text-[#6ee7a0]">
                  Stray Rescues &amp; Resting Corner
                </h2>
                <p className="text-xs text-[#cfe0ff]">
                  Discounted <strong className="text-white">Stray Rescues</strong> appear in the
                  Wholesale PC at a fraction of normal cost. They recover in your{' '}
                  <strong className="text-[#6ee7a0]">Plush Nap Beds</strong> at{' '}
                  <strong className="text-white">+5% per shift tick</strong> (faster with bed
                  upgrades) or instantly with care items like{' '}
                  <strong className="text-[#ffd84d]">Potion, Fresh Water, Oran Berry,</strong> or{' '}
                  <strong className="text-[#ffd84d]">Moomoo Milk</strong>.
                </p>
                <p className="text-xs text-[#9ec4ff]">
                  At <strong className="text-white">100% rested</strong>, strays automatically move
                  into an open Display Pen ready for top-dollar adoption!
                </p>
              </section>

              <section className="pmd-inset space-y-1.5 p-3.5">
                <h2 className="text-base font-semibold text-[#ffd84d]">
                  Evolution, Stat Care &amp; Mascot
                </h2>
                <p className="text-xs text-[#cfe0ff]">
                  Click any owned Pokémon to open <strong className="text-white">Inspect &amp; Care</strong>:
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-[#cfe0ff]">
                  <li>
                    <strong className="text-[#ffd84d]">9 Evolution Stones &amp; Rare Candy:</strong>{' '}
                    Evolve eligible species to dramatically raise resale value &amp; fill your{' '}
                    <strong className="text-white">493-species Dex</strong>.
                  </li>
                  <li>
                    <strong className="text-[#6ee7a0]">Stat Treats:</strong> Boost{' '}
                    <strong className="text-white">Cute</strong> &amp;{' '}
                    <strong className="text-white">Comfort</strong> to multiply appraisal value and
                    delight Cozy Collectors.
                  </li>
                  <li>
                    <strong className="text-[#78a8f0]">Set Store Mascot:</strong> Feature any
                    favorite companion on your Main Menu spotlight card.
                  </li>
                </ul>
              </section>
            </div>

            <section className="pmd-inset space-y-2 p-3.5">
              <h2 className="text-base font-semibold text-[#f48fb1]">
                Egg Breeding &amp; Shiny Sparkle Hunting
              </h2>
              <p className="text-xs text-[#cfe0ff]">
                Pair two rested Pokémon that share an{' '}
                <strong className="text-white">Egg Group</strong> (or pair any breedable species
                with <strong className="text-[#ffd84d]">Ditto</strong>!) in the{' '}
                <strong className="text-[#f48fb1]">Egg Incubator Bench</strong>. Even{' '}
                <strong className="text-[#78a8f0]">Manaphy</strong> hatches{' '}
                <strong className="text-white">Phione</strong>!
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-[#cfe0ff]">
                  <strong className="text-[#ffd84d]">Stat Inheritance:</strong> Hatched companions
                  blend parent stats and inherit traits—great for raising high-Cute or high-Rarity
                  lines without Wholesale costs.
                </div>
                <div className="border border-[#3a61a3] bg-[#0b1736] p-2.5 text-[#cfe0ff]">
                  <strong className="text-[#6ee7a0]">Shiny Odds:</strong> Upgrade{' '}
                  <strong className="text-white">Lucky Egg Delivery</strong> (+2%/lv) or play{' '}
                  <strong className="text-[#ffd84d]">High Stakes</strong> (+4% Shiny bonus) to
                  hatch <strong className="text-[#ffd84d]">3× value Shinies</strong>!
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: DIFFICULTIES, RENT, DEBT & SAVES */}
        {activeTab === 'stakes' && (
          <div className="space-y-3" role="tabpanel" aria-label="Rent, Stakes and Saves">
            <section className="pmd-inset space-y-2.5 p-3.5">
              <h2 className="text-base font-semibold text-[#ffd84d]">
                3 Difficulty Modes &amp; Daily Dues
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#4e78bd] text-[#ffd84d]">
                      <th className="py-1.5 pr-2">Mode</th>
                      <th className="py-1.5 pr-2">Start ₽</th>
                      <th className="py-1.5 pr-2">Daily Rent</th>
                      <th className="py-1.5 pr-2">Pen / Bed</th>
                      <th className="py-1.5 pr-2">Patience &amp; Haggle</th>
                      <th className="py-1.5">Debt Grace &amp; Perks</th>
                    </tr>
                  </thead>
                  <tbody className="pmd-num divide-y divide-[#253f75] text-[#dbe8ff]">
                    {DIFFICULTY_LIST.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-2 font-semibold text-white">{d.name}</td>
                        <td className="py-2 pr-2 text-[#6ee7a0]">
                          ₽{d.startingCash.toLocaleString()}
                        </td>
                        <td className="py-2 pr-2">
                          ₽{d.baseRent} (+₽{d.rentPerShift}/d)
                        </td>
                        <td className="py-2 pr-2">
                          ₽{d.upkeepPerPen} / ₽{d.upkeepPerBed}
                        </td>
                        <td className="py-2 pr-2">
                          {Math.round(d.patienceMultiplier * 100)}% •{' '}
                          {d.haggleSuccessModifier >= 0
                            ? `+${Math.round(d.haggleSuccessModifier * 100)}%`
                            : `${Math.round(d.haggleSuccessModifier * 100)}%`}
                        </td>
                        <td className="py-2">
                          <strong
                            className={
                              d.debtGraceShifts > 0 ? 'text-[#6ee7a0]' : 'text-[#ff9b91]'
                            }
                          >
                            {d.debtGraceShifts} Grace
                          </strong>
                          {d.id === 'high-stakes'
                            ? ' • +4% Shiny, VIP Rk.4+ (1.35×)'
                            : d.walkoutXpPenalty === 0
                              ? ' • 0 Walkout XP loss'
                              : ` • -${d.walkoutXpPenalty} XP walkout`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <section className="pmd-inset space-y-1.5 p-3.5 text-xs">
                <h2 className="text-sm font-semibold text-[#ff9b91]">
                  Emergency Liquidation &amp; Bankruptcy
                </h2>
                <p className="text-[#cfe0ff]">
                  If your cash cannot cover end-of-shift{' '}
                  <strong className="text-white">Rent + Upkeep</strong>, the{' '}
                  <strong className="text-[#ffd84d]">Debt Settlement</strong> screen lets you{' '}
                  <strong className="text-white">Emergency Liquidate</strong> non-breeding Pokémon
                  for <strong className="text-[#6ee7a0]">50% base wholesale value</strong>.
                </p>
                <p className="text-[#ffd9d4]">
                  Still short? You burn <strong className="text-white">1 Debt Grace shift</strong>.
                  Falling below <strong className="text-white">₽0</strong> with{' '}
                  <strong className="text-[#ff9b91]">0 Debt Grace</strong> left forecloses the store
                  (Bankruptcy).
                </p>
              </section>

              <section className="pmd-inset space-y-1.5 p-3.5 text-xs">
                <h2 className="text-sm font-semibold text-[#78a8f0]">
                  Local Profiles &amp; Save Export
                </h2>
                <p className="text-[#cfe0ff]">
                  Every Shift Manager profile lives in its own isolated browser{' '}
                  <strong className="text-white">localStorage</strong> slot and auto-saves on every
                  action plus every <strong className="text-white">15 seconds</strong>.
                </p>
                <p className="text-[#9ec4ff]">
                  Open <strong className="text-[#ffd84d]">Save / Profiles</strong> on the Main Menu
                  anytime to create profiles, reset runs, or back up your checksum-verified{' '}
                  <strong className="text-white">Base64 Save Code</strong>.
                </p>
              </section>
            </div>
          </div>
        )}
      </div>
    </CozyDialog>
  );
}
