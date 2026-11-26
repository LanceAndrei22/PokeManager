/**
 * Root application component for PokéMart: Low Cortisol Shift.
 * Connects pure simulation state, live-tick timer (1x / 2x), per-profile localStorage
 * auto-saves (on mutations + every 15s), Web Audio soft chiptune SFX, and cozy UI panels.
 */
import { useEffect, useState } from 'react';
import { getMarketTrend } from './data/trends';
import type {
  GameState,
  GiftBallSlug,
  ItemSlug,
  ProfileIndex,
  ShopUpgradeId,
} from './data/types';
import { playSfx } from './engine/audio';
import { getCozyRankInfo, getDexSummary } from './engine/dex';
import {
  getIncubatorCapacity,
  getNapBedCapacity,
  getPenCapacity,
} from './engine/healing';
import {
  advanceShiftTick,
  buySupplyItem,
  buyWholesaleOffer,
  claimHatchedEggAction,
  closeShiftEarly,
  movePokemonLocation,
  purchaseUpgradeAction,
  setActiveGiftBall,
  setGlobalMarkup,
  setPenMarkup,
  setShiftSpeed,
  startBreedingAction,
  startNextShift,
  toggleMuteAction,
  toggleShiftRunning,
  useItemAction,
  type ActionResult,
} from './engine/simulation';
import {
  createProfile,
  deleteProfile,
  ensureInitialProfileStore,
  importSaveCode,
  resetProfile,
  saveProfileGameState,
  switchActiveProfile,
} from './engine/storage';
import { ActivityLog } from './components/ActivityLog';
import { AdoptionDexModal } from './components/AdoptionDexModal';
import { BreedingIncubatorPanel } from './components/BreedingIncubatorPanel';
import { DisplayPensPanel } from './components/DisplayPensPanel';
import { HealingStationPanel } from './components/HealingStationPanel';
import { InspectPokemonModal } from './components/InspectPokemonModal';
import { ProfileBar } from './components/ProfileBar';
import { SaveTransferModal } from './components/SaveTransferModal';
import { ShiftHud } from './components/ShiftHud';
import { ShiftSummaryModal } from './components/ShiftSummaryModal';
import { ShopFloorPreview } from './components/ShopFloorPreview';
import { UpgradesPanel } from './components/UpgradesPanel';
import { WholesaleCatalogPanel } from './components/WholesaleCatalogPanel';

type WorkspaceTab = 'pens' | 'wholesale' | 'breeding' | 'healing' | 'upgrades';

export function App() {
  const [store, setStore] = useState<{ index: ProfileIndex; game: GameState }>(() => {
    const initial = ensureInitialProfileStore();
    return { index: initial.index, game: initial.activeState };
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('pens');
  const [inspectUid, setInspectUid] = useState<string | null>(null);
  const [dexOpen, setDexOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const game = store.game;
  const trend = getMarketTrend(game.activeTrendId);
  const rankInfo = getCozyRankInfo(game.cozyXp);
  const dexSummary = getDexSummary(game.dex);
  const penCapacity = getPenCapacity(game.upgrades);
  const incubatorCapacity = getIncubatorCapacity(game.upgrades);
  const napBedCapacity = getNapBedCapacity(game.upgrades);

  // Persist immediately whenever active profile GameState changes
  useEffect(() => {
    saveProfileGameState(game);
  }, [game]);

  // Periodic 15-second auto-save safeguard
  useEffect(() => {
    const interval = window.setInterval(() => {
      saveProfileGameState(game);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [game]);

  // Relaxed live-tick simulation loop (1000ms at 1x, 500ms at 2x) when shop doors are open
  useEffect(() => {
    if (!game.shiftRunning || game.lastShiftSummary) return;

    const tickMs = game.shiftSpeed === 2 ? 500 : 1000;
    const timer = window.setInterval(() => {
      setStore((prev) => {
        const result = advanceShiftTick(prev.game);
        for (const cue of result.sfxCues) {
          playSfx(cue, prev.game.muted);
        }
        return { ...prev, game: result.state };
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [game.shiftRunning, game.shiftSpeed, game.lastShiftSummary]);

  // Auto-dismiss transient feedback toast gently
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const applyAction = (runner: (state: GameState) => ActionResult) => {
    setStore((prev) => {
      const res = runner(prev.game);
      if (res.message) {
        setToast(res.message);
      }
      if (res.ok && res.sfx) {
        playSfx(res.sfx, prev.game.muted);
      }
      return { ...prev, game: res.state };
    });
  };

  const handleSwitchProfile = (profileId: string) => {
    const next = switchActiveProfile(profileId);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
    setToast(`Switched to ${next.activeState.profileName}'s PokéMart.`);
  };

  const handleCreateProfile = (name: string) => {
    const next = createProfile(name);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
    setToast(`Welcome, ${next.activeState.profileName}!`);
  };

  const handleResetProfile = (profileId: string) => {
    const fresh = resetProfile(profileId);
    setStore((prev) =>
      prev.game.profileId === profileId ? { ...prev, game: fresh } : prev,
    );
  };

  const handleDeleteProfile = (profileId: string) => {
    const next = deleteProfile(profileId);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
  };

  const handleImportSaveCode = (code: string): { ok: boolean; message: string } => {
    try {
      const imported = importSaveCode(code, game.profileId, game.profileName);
      saveProfileGameState(imported);
      setStore((prev) => ({ ...prev, game: imported }));
      return { ok: true, message: `Imported save into ${game.profileName}!` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Invalid save code.',
      };
    }
  };

  const inspectedPokemon = inspectUid
    ? game.pokemon.find((mon) => mon.uid === inspectUid) ?? null
    : null;

  return (
    <div className="min-h-screen bg-cream-50 pb-8 text-wood-900">
      <div className="mx-auto max-w-6xl space-y-4 px-3 pt-4 sm:px-6">
        <ProfileBar
          profileIndex={store.index}
          activeProfileName={game.profileName}
          muted={game.muted}
          discoveredCount={dexSummary.discoveredSpecies}
          totalSpeciesCount={dexSummary.totalSpecies}
          onSwitchProfile={handleSwitchProfile}
          onCreateProfile={handleCreateProfile}
          onToggleMute={() =>
            setStore((prev) => ({ ...prev, game: toggleMuteAction(prev.game) }))
          }
          onOpenDex={() => setDexOpen(true)}
          onOpenSaveModal={() => setSaveModalOpen(true)}
        />

        <ShiftHud
          cash={game.cash}
          shiftNumber={game.shiftNumber}
          shiftTick={game.shiftTick}
          shiftDurationTicks={game.shiftDurationTicks}
          shiftRunning={game.shiftRunning}
          shiftSpeed={game.shiftSpeed}
          rankInfo={rankInfo}
          trend={trend}
          hasPendingSummary={Boolean(game.lastShiftSummary)}
          onToggleRunning={() => applyAction(toggleShiftRunning)}
          onChangeSpeed={(speed) =>
            setStore((prev) => ({ ...prev, game: setShiftSpeed(prev.game, speed) }))
          }
          onCloseShiftEarly={() =>
            setStore((prev) => ({ ...prev, game: closeShiftEarly(prev.game) }))
          }
        />

        {toast && (
          <div
            role="status"
            className="rounded-lg border-2 border-sage-600 bg-sage-100 px-3 py-2 text-xs font-extrabold text-sage-800"
          >
            {toast}
          </div>
        )}

        <ShopFloorPreview
          penCapacity={penCapacity}
          napBedCapacity={napBedCapacity}
          pokemon={game.pokemon}
          customers={game.customers}
          shiftRunning={game.shiftRunning}
          cafeDecorLevel={game.upgrades['cafe-decor']}
          onInspectPokemon={(uid) => setInspectUid(uid)}
        />

        {/* Main Management Workspace Tabs */}
        <section aria-label="Shop Management Stations" className="ds-panel rounded-xl p-4">
          <div
            role="tablist"
            aria-label="Shop Station Tabs"
            className="flex gap-2 overflow-x-auto border-b-2 border-wood-300 pb-1"
          >
            {(
              [
                ['pens', `Display Pens (${game.pokemon.filter((p) => p.location === 'pen').length}/${penCapacity})`],
                ['wholesale', 'Wholesale & Supplies'],
                ['breeding', `Incubator (${game.eggs.length}/${incubatorCapacity})`],
                ['healing', `Nap Station (${game.pokemon.filter((p) => p.location === 'healing').length}/${napBedCapacity})`],
                ['upgrades', 'Upgrades'],
              ] as Array<[WorkspaceTab, string]>
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={activeTab === tabKey}
                onClick={() => setActiveTab(tabKey)}
                className="cozy-tab whitespace-nowrap rounded-t-md px-3 py-1.5 text-xs font-extrabold text-wood-900 hover:bg-cream-100"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pt-4">
            {activeTab === 'pens' && (
              <DisplayPensPanel
                penCapacity={penCapacity}
                pokemon={game.pokemon}
                globalMarkup={game.globalMarkup}
                penMarkups={game.penMarkups}
                activeGiftBall={game.activeGiftBall}
                inventory={game.inventory}
                trend={trend}
                recentSpeciesSales={game.recentSpeciesSales}
                onChangeGlobalMarkup={(markup) =>
                  setStore((prev) => ({ ...prev, game: setGlobalMarkup(prev.game, markup) }))
                }
                onChangePenMarkup={(penIndex, markup) =>
                  setStore((prev) => ({
                    ...prev,
                    game: setPenMarkup(prev.game, penIndex, markup),
                  }))
                }
                onSelectGiftBall={(ball: GiftBallSlug) =>
                  applyAction((state) => setActiveGiftBall(state, ball))
                }
                onInspectPokemon={(uid) => setInspectUid(uid)}
                onMovePokemon={(uid, dest, targetPenIndex) =>
                  applyAction((state) => movePokemonLocation(state, uid, dest, targetPenIndex))
                }
              />
            )}

            {activeTab === 'wholesale' && (
              <WholesaleCatalogPanel
                cash={game.cash}
                offers={game.wholesaleCatalog}
                inventory={game.inventory}
                onBuyOffer={(offerUid) =>
                  applyAction((state) => buyWholesaleOffer(state, offerUid))
                }
                onBuySupplyItem={(slug: ItemSlug) =>
                  applyAction((state) => buySupplyItem(state, slug, 1))
                }
              />
            )}

            {activeTab === 'breeding' && (
              <BreedingIncubatorPanel
                pokemon={game.pokemon}
                eggs={game.eggs}
                incubatorCapacity={incubatorCapacity}
                mysteryShipmentLevel={game.upgrades['mystery-shipment']}
                onStartBreeding={(parentA, parentB) =>
                  applyAction((state) => startBreedingAction(state, parentA, parentB))
                }
                onClaimEgg={(eggUid) =>
                  applyAction((state) => claimHatchedEggAction(state, eggUid))
                }
              />
            )}

            {activeTab === 'healing' && (
              <HealingStationPanel
                pokemon={game.pokemon}
                napBedCapacity={napBedCapacity}
                inventory={game.inventory}
                onUseCareItem={(uid, slug) => applyAction((state) => useItemAction(state, uid, slug))}
                onInspectPokemon={(uid) => setInspectUid(uid)}
              />
            )}

            {activeTab === 'upgrades' && (
              <UpgradesPanel
                cash={game.cash}
                upgrades={game.upgrades}
                onPurchaseUpgrade={(upgradeId: ShopUpgradeId) =>
                  applyAction((state) => purchaseUpgradeAction(state, upgradeId))
                }
              />
            )}
          </div>
        </section>

        <ActivityLog entries={game.activityLog} />

        <footer className="rounded-xl border border-wood-300 bg-cream-100/70 px-4 py-3 text-center text-[11px] text-wood-700">
          <strong>PokéMart: Low Cortisol Shift</strong> is a simple, completely free fan project made
          for entertainment purposes only. Pokémon names and Platinum sprites belong to Nintendo,
          Creatures Inc., and Game Freak (curated via PokeAPI/sprites).
        </footer>
      </div>

      {/* Accessible Modals */}
      <InspectPokemonModal
        pokemon={inspectedPokemon}
        globalMarkup={game.globalMarkup}
        penMarkups={game.penMarkups}
        trend={trend}
        recentSpeciesSales={game.recentSpeciesSales}
        inventory={game.inventory}
        onClose={() => setInspectUid(null)}
        onUseItem={(uid, slug) => applyAction((state) => useItemAction(state, uid, slug))}
        onMovePokemon={(uid, dest) =>
          applyAction((state) => movePokemonLocation(state, uid, dest))
        }
      />

      <ShiftSummaryModal
        summary={game.lastShiftSummary}
        onStartNextShift={() => {
          playSfx('bell', game.muted);
          setStore((prev) => ({ ...prev, game: startNextShift(prev.game) }));
        }}
      />

      <AdoptionDexModal open={dexOpen} dex={game.dex} onClose={() => setDexOpen(false)} />

      <SaveTransferModal
        open={saveModalOpen}
        profileIndex={store.index}
        activeState={game}
        onClose={() => setSaveModalOpen(false)}
        onCreateProfile={handleCreateProfile}
        onSwitchProfile={handleSwitchProfile}
        onResetProfile={handleResetProfile}
        onDeleteProfile={handleDeleteProfile}
        onImportSaveCode={handleImportSaveCode}
      />
    </div>
  );
}
