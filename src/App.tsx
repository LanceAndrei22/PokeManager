/**
 * Root application shell for PokéMart: Low Cortisol Shift (v2).
 * Coordinates the live PMD Main Menu & Title Screen, full-viewport click-to-manage
 * Indoor PokéMart Canvas, floating Top HUD Pill Bar, Bottom DS Action Dock,
 * non-blocking Live-Clock Counter-Offer Panel, Debt Liquidation & Bankruptcy modals,
 * per-profile isolated localStorage auto-saves, and Web Audio cozy SFX.
 */
import { useEffect, useState } from 'react';
import { ShopCanvas } from './canvas/ShopCanvas';
import type { CanvasHitTarget } from './canvas/types';
import { getDifficultyConfig } from './data/difficulties';
import { getMarketTrend } from './data/trends';
import type {
  DifficultyId,
  GameState,
  GiftBallSlug,
  ItemSlug,
  ProfileIndex,
  ShopUpgradeId,
} from './data/types';
import { initAudioUnlockListeners, playSfx, setSfxMuted, setSfxVolume } from './engine/audio';
import { setBgmMuted, setBgmTrack, setBgmVolume } from './engine/bgm';
import { getDexSummary, getShopRankInfo } from './engine/dex';
import { calculateShiftDues } from './engine/economy';
import {
  getIncubatorCapacity,
  getNapBedCapacity,
  getPenCapacity,
} from './engine/healing';
import {
  acceptCounterOfferAction,
  advanceShiftTick,
  buySupplyItem,
  buyWholesaleOffer,
  claimHatchedEggAction,
  closeShiftEarly,
  declineCounterOfferAction,
  finalizeDebtSettlement,
  haggleCounterOfferAction,
  liquidatePokemonAction,
  movePokemonLocation,
  purchaseUpgradeAction,
  setActiveGiftBall,
  setBgmVolumeAction,
  setGlobalMarkup,
  setPenMarkup,
  setSfxVolumeAction,
  setShiftSpeed,
  setShopMascotAction,
  startBreedingAction,
  startNextShift,
  toggleBgmMuteAction,
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
import { BankruptcyModal } from './components/BankruptcyModal';
import { BottomActionDock, type ShopModalTab } from './components/BottomActionDock';
import { BreedingIncubatorPanel } from './components/BreedingIncubatorPanel';
import { CounterOfferPanel } from './components/CounterOfferPanel';
import { CozyDialog } from './components/CozyDialog';
import { CreditsModal } from './components/CreditsModal';
import { DebtLiquidationModal } from './components/DebtLiquidationModal';
import { DisplayPensPanel } from './components/DisplayPensPanel';
import { GameGuideModal } from './components/GameGuideModal';
import { HealingStationPanel } from './components/HealingStationPanel';
import { InspectPokemonModal } from './components/InspectPokemonModal';
import { MainMenu } from './components/MainMenu';
import { SaveTransferModal } from './components/SaveTransferModal';
import { ShiftSummaryModal } from './components/ShiftSummaryModal';
import { TopHudBar } from './components/TopHudBar';
import { UpgradesPanel } from './components/UpgradesPanel';
import { WholesaleCatalogPanel } from './components/WholesaleCatalogPanel';

type ActiveDialogKind = ShopModalTab | 'log' | null;

export function App() {
  const [store, setStore] = useState<{ index: ProfileIndex; game: GameState }>(() => {
    const initial = ensureInitialProfileStore();
    return { index: initial.index, game: initial.activeState };
  });

  const [screen, setScreen] = useState<'menu' | 'shop'>('menu');
  const [activeDialog, setActiveDialog] = useState<ActiveDialogKind>(null);
  const [activeOfferUid, setActiveOfferUid] = useState<string | null>(null);
  const [inspectUid, setInspectUid] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const game = store.game;
  const difficulty = getDifficultyConfig(game.difficulty);
  const trend = getMarketTrend(game.activeTrendId);
  const rankInfo = getShopRankInfo(game.cozyXp);
  const dexSummary = getDexSummary(game.dex);
  const penCapacity = getPenCapacity(game.upgrades);
  const incubatorCapacity = getIncubatorCapacity(game.upgrades);
  const napBedCapacity = getNapBedCapacity(game.upgrades);
  const shiftDues = calculateShiftDues(game);

  // Unlock cross-browser Web Audio cleanly on first pointer/key gesture
  useEffect(() => initAudioUnlockListeners(), []);

  // Keep SFX and BGM engines synchronized with active profile audio preferences
  useEffect(() => {
    setSfxMuted(Boolean(game.muted));
    setSfxVolume(game.sfxVolume ?? 0.65);
    setBgmMuted(Boolean(game.bgmMuted));
    setBgmVolume(game.bgmVolume ?? 0.35);
  }, [game.muted, game.sfxVolume, game.bgmMuted, game.bgmVolume]);

  // Crossfade BGM between relaxed Menu theme, cozy PokéMart groove, and Bankruptcy silence
  useEffect(() => {
    if (game.isBankrupt) {
      setBgmTrack('quiet');
    } else if (screen === 'menu') {
      setBgmTrack('menu');
    } else {
      setBgmTrack('shop');
    }
  }, [screen, game.isBankrupt]);

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

  // Live-tick simulation loop (1000ms at 1x, 500ms at 2x) when shop doors are open
  useEffect(() => {
    if (
      !game.shiftRunning ||
      game.isBankrupt ||
      game.shiftPhase !== 'open' ||
      game.lastShiftSummary ||
      game.pendingSettlement
    ) {
      return;
    }

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
  }, [
    game.shiftRunning,
    game.shiftSpeed,
    game.shiftPhase,
    game.isBankrupt,
    game.lastShiftSummary,
    game.pendingSettlement,
  ]);

  // Keep activeOfferUid aligned when queue updates (advance smoothly or clear on empty)
  useEffect(() => {
    if (activeOfferUid === null) return;
    const stillPresent = game.counterQueue.some((q) => q.uid === activeOfferUid);
    if (!stillPresent) {
      setActiveOfferUid(game.counterQueue[0]?.uid ?? null);
    }
  }, [game.counterQueue, activeOfferUid]);

  // Auto-dismiss transient toast banner cleanly
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
      if (res.sfx) {
        playSfx(res.sfx, prev.game.muted);
      }
      return { ...prev, game: res.state };
    });
  };

  const handleSwitchProfile = (profileId: string) => {
    const next = switchActiveProfile(profileId);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
    setActiveOfferUid(null);
    setActiveDialog(null);
    setToast(`Switched to ${next.activeState.profileName}'s PokéMart.`);
  };

  const handleCreateProfile = (
    name: string,
    selectedDiff: DifficultyId = 'standard',
    starterSpeciesId = 133,
    clerkNpcId?: string,
  ) => {
    const next = createProfile(name, selectedDiff, undefined, starterSpeciesId, clerkNpcId);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
    setActiveOfferUid(null);
    setActiveDialog(null);
    setToast(`Welcome, ${next.activeState.profileName}!`);
  };

  const handleResetProfile = (profileId: string) => {
    const fresh = resetProfile(profileId);
    setStore((prev) =>
      prev.game.profileId === profileId ? { ...prev, game: fresh } : prev,
    );
    setActiveOfferUid(null);
    setInspectUid(null);
  };

  const handleDeleteProfile = (profileId: string) => {
    const next = deleteProfile(profileId);
    setStore({ index: next.index, game: next.activeState });
    setInspectUid(null);
    setActiveOfferUid(null);
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

  const handleReturnToMenu = () => {
    setStore((prev) => ({
      ...prev,
      game: {
        ...prev.game,
        shiftRunning: false,
        shiftPhase: prev.game.shiftPhase === 'open' ? 'prep' : prev.game.shiftPhase,
      },
    }));
    setActiveDialog(null);
    setActiveOfferUid(null);
    setInspectUid(null);
    setScreen('menu');
  };

  const handleCanvasTarget = (target: CanvasHitTarget) => {
    if (target.kind === 'pokemon') {
      setInspectUid(target.uid);
    } else if (target.kind === 'counter-offer') {
      setActiveOfferUid(target.offerUid);
    } else if (target.kind === 'empty-pen') {
      setActiveDialog('pens');
    } else if (target.kind === 'station') {
      setActiveDialog(target.station);
    }
  };

  const inspectedPokemon = inspectUid
    ? game.pokemon.find((mon) => mon.uid === inspectUid) ?? null
    : null;

  const activeOffer = activeOfferUid
    ? game.counterQueue.find((q) => q.uid === activeOfferUid) ?? null
    : null;

  const totalItemsCount = Object.entries(game.inventory)
    .filter(([slug]) => slug !== 'poke-ball')
    .reduce((sum, [, qty]) => sum + (qty ?? 0), 0);

  const penOccupied = game.pokemon.filter((p) => p.location === 'pen').length;
  const healingOccupied = game.pokemon.filter((p) => p.location === 'healing').length;
  const readyEggCount = game.eggs.filter((e) => e.readyToHatch).length;
  const hasVipContract = game.wholesaleCatalog.some(
    (o) => !o.purchased && o.kind === 'vip-contract',
  );

  const stationDialogTitle: Record<Exclude<ActiveDialogKind, null | 'dex'>, string> = {
    pens: `Display Pens & Reserve Kennel (${penOccupied}/${penCapacity})`,
    wholesale: 'Wholesale PC & VIP Contracts',
    breeding: `Egg Incubator Bench (${game.eggs.length}/${incubatorCapacity})`,
    healing: `Healing Corner & Nap Beds (${healingOccupied}/${napBedCapacity})`,
    bag: 'Shop Supplies, Stones & Item Bag',
    upgrades: 'Shop Upgrades Board',
    log: 'Shift Journal & Ledger',
  };

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0c1733] text-[#eef5ff]">
      {screen === 'menu' ? (
        <MainMenu
          profileIndex={store.index}
          activeState={game}
          onPlay={() => {
            playSfx('bell', game.muted);
            setScreen('shop');
          }}
          onSwitchProfile={handleSwitchProfile}
          onCreateProfile={handleCreateProfile}
          onToggleBgmMute={() =>
            setStore((prev) => ({ ...prev, game: toggleBgmMuteAction(prev.game) }))
          }
          onToggleMute={() =>
            setStore((prev) => ({ ...prev, game: toggleMuteAction(prev.game) }))
          }
          onChangeBgmVolume={(volume) =>
            setStore((prev) => ({ ...prev, game: setBgmVolumeAction(prev.game, volume) }))
          }
          onChangeSfxVolume={(volume) =>
            setStore((prev) => ({ ...prev, game: setSfxVolumeAction(prev.game, volume) }))
          }
          onOpenSaveModal={() => setSaveModalOpen(true)}
          onOpenGuide={() => setGuideModalOpen(true)}
          onOpenCredits={() => setCreditsModalOpen(true)}
        />
      ) : (
        <>
          {/* Full-Viewport Click-to-Manage Gen 4 Indoor PokéMart */}
          <ShopCanvas
            profileId={game.profileId}
            cash={game.cash}
            shiftSpeed={game.shiftSpeed}
            shiftRunning={game.shiftRunning}
            shiftTick={game.shiftTick}
            shiftDurationTicks={game.shiftDurationTicks}
            shopkeepers={game.shopkeepers}
            pokemon={game.pokemon}
            customers={game.customers}
            counterQueue={game.counterQueue}
            eggs={game.eggs}
            wholesaleCatalog={game.wholesaleCatalog}
            penCapacity={penCapacity}
            napBedCapacity={napBedCapacity}
            motionPaused={motionPaused}
            onSelectTarget={handleCanvasTarget}
          />

          {/* Floating Top Pill HUD Bar */}
          <TopHudBar
            profileName={game.profileName}
            difficulty={difficulty}
            cash={game.cash}
            totalDues={shiftDues.totalDues}
            debtGraceRemaining={game.debtGraceDaysRemaining}
            shiftNumber={game.shiftNumber}
            shiftTick={game.shiftTick}
            shiftDurationTicks={game.shiftDurationTicks}
            shiftRunning={game.shiftRunning}
            shiftSpeed={game.shiftSpeed}
            rankInfo={rankInfo}
            trend={trend}
            counterQueue={game.counterQueue}
            hasPendingSettlement={
              Boolean(game.lastShiftSummary) || Boolean(game.pendingSettlement) || game.isBankrupt
            }
            muted={game.muted}
            bgmMuted={Boolean(game.bgmMuted)}
            sfxVolume={game.sfxVolume ?? 0.65}
            bgmVolume={game.bgmVolume ?? 0.35}
            motionPaused={motionPaused}
            onToggleRunning={() => applyAction(toggleShiftRunning)}
            onChangeSpeed={(speed) =>
              setStore((prev) => ({ ...prev, game: setShiftSpeed(prev.game, speed) }))
            }
            onCloseShiftEarly={() =>
              setStore((prev) => ({ ...prev, game: closeShiftEarly(prev.game) }))
            }
            onOpenCounterQueue={() => {
              if (game.counterQueue[0]) {
                setActiveOfferUid(game.counterQueue[0].uid);
              }
            }}
            onOpenLog={() =>
              setActiveDialog((prev) => (prev === 'log' ? null : 'log'))
            }
            onOpenGuide={() => setGuideModalOpen(true)}
            onToggleMotionPaused={() => setMotionPaused((prev) => !prev)}
            onToggleBgmMute={() =>
              setStore((prev) => ({ ...prev, game: toggleBgmMuteAction(prev.game) }))
            }
            onToggleMute={() =>
              setStore((prev) => ({ ...prev, game: toggleMuteAction(prev.game) }))
            }
            onChangeBgmVolume={(volume) =>
              setStore((prev) => ({ ...prev, game: setBgmVolumeAction(prev.game, volume) }))
            }
            onChangeSfxVolume={(volume) =>
              setStore((prev) => ({ ...prev, game: setSfxVolumeAction(prev.game, volume) }))
            }
            onReturnToMenu={handleReturnToMenu}
          />

          {/* Transient Feedback Toast docked cleanly above Bottom Dock (never overlaps Top HUD) */}
          {toast && !activeOffer && (
            <div
              role="status"
              className="pmd-pill pointer-events-none fixed bottom-20 left-1/2 z-30 max-w-lg -translate-x-1/2 px-3.5 py-1.5 text-center text-sm font-semibold text-[#6ee7a0]"
            >
              {toast}
            </div>
          )}

          {/* Non-Blocking Live-Clock Counter-Offer Panel */}
          <CounterOfferPanel
            queue={game.counterQueue}
            activeOffer={activeOffer}
            activeGiftBall={game.activeGiftBall}
            inventory={game.inventory}
            onSelectOffer={(offerUid) => setActiveOfferUid(offerUid)}
            onSelectGiftBall={(ball: GiftBallSlug) =>
              applyAction((state) => setActiveGiftBall(state, ball))
            }
            onAccept={(offerUid) =>
              applyAction((state) => acceptCounterOfferAction(state, offerUid))
            }
            onHaggle={(offerUid, boostPct) =>
              applyAction((state) => haggleCounterOfferAction(state, offerUid, boostPct))
            }
            onDecline={(offerUid) =>
              applyAction((state) => declineCounterOfferAction(state, offerUid))
            }
            onMinimize={() => setActiveOfferUid(null)}
          />

          {/* Floating Bottom DS Action Dock */}
          <BottomActionDock
            activeModal={activeDialog === 'log' ? null : activeDialog}
            penOccupied={penOccupied}
            penCapacity={penCapacity}
            healingOccupied={healingOccupied}
            napBedCapacity={napBedCapacity}
            eggCount={game.eggs.length}
            readyEggCount={readyEggCount}
            incubatorCapacity={incubatorCapacity}
            hasVipContract={hasVipContract}
            totalItemsCount={totalItemsCount}
            discoveredCount={dexSummary.discoveredSpecies}
            totalSpeciesCount={dexSummary.totalSpecies}
            onSelectModal={(tab) =>
              setActiveDialog((prev) => (prev === tab ? null : tab))
            }
          />

          {/* Station & Dock Modals */}
          <CozyDialog
            open={Boolean(activeDialog && activeDialog !== 'dex')}
            onClose={() => setActiveDialog(null)}
            title={
              activeDialog && activeDialog !== 'dex' ? stationDialogTitle[activeDialog] : ''
            }
          >
            {activeDialog === 'pens' && (
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
                onInspectPokemon={(uid) => {
                  setActiveDialog(null);
                  setInspectUid(uid);
                }}
                onMovePokemon={(uid, dest, targetPenIndex) =>
                  applyAction((state) => movePokemonLocation(state, uid, dest, targetPenIndex))
                }
              />
            )}

            {(activeDialog === 'wholesale' || activeDialog === 'bag') && (
              <WholesaleCatalogPanel
                cash={game.cash}
                offers={game.wholesaleCatalog}
                inventory={game.inventory}
                initialTab={activeDialog === 'bag' ? 'supplies' : 'pokemon'}
                onBuyOffer={(offerUid) =>
                  applyAction((state) => buyWholesaleOffer(state, offerUid))
                }
                onBuySupplyItem={(slug: ItemSlug) =>
                  applyAction((state) => buySupplyItem(state, slug, 1))
                }
              />
            )}

            {activeDialog === 'breeding' && (
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

            {activeDialog === 'healing' && (
              <HealingStationPanel
                pokemon={game.pokemon}
                napBedCapacity={napBedCapacity}
                inventory={game.inventory}
                onUseCareItem={(uid, slug) => applyAction((state) => useItemAction(state, uid, slug))}
                onInspectPokemon={(uid) => {
                  setActiveDialog(null);
                  setInspectUid(uid);
                }}
              />
            )}

            {activeDialog === 'upgrades' && (
              <UpgradesPanel
                cash={game.cash}
                upgrades={game.upgrades}
                shopkeepers={game.shopkeepers}
                onPurchaseUpgrade={(upgradeId: ShopUpgradeId) =>
                  applyAction((state) => purchaseUpgradeAction(state, upgradeId))
                }
              />
            )}

            {activeDialog === 'log' && <ActivityLog entries={game.activityLog} />}
          </CozyDialog>

          {/* 493-Species Adoption Dex Modal */}
          <AdoptionDexModal
            open={activeDialog === 'dex'}
            dex={game.dex}
            onClose={() => setActiveDialog(null)}
          />

          {/* Companion Care & Inspect Modal */}
          <InspectPokemonModal
            pokemon={inspectedPokemon}
            isMascot={Boolean(
              inspectedPokemon &&
                (game.mascotUid
                  ? game.mascotUid === inspectedPokemon.uid
                  : game.pokemon[0]?.uid === inspectedPokemon.uid),
            )}
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
            onSetMascot={(uid) => applyAction((state) => setShopMascotAction(state, uid))}
            onLiquidatePokemon={(uid) => applyAction((state) => liquidatePokemonAction(state, uid))}
          />

          {/* Debt Warning & Emergency Liquidation Modal */}
          <DebtLiquidationModal
            open={
              game.shiftPhase === 'settlement-debt' &&
              !game.isBankrupt &&
              Boolean(game.pendingSettlement)
            }
            cash={game.cash}
            settlement={game.pendingSettlement}
            debtGraceRemaining={game.debtGraceDaysRemaining}
            pokemon={game.pokemon}
            onLiquidatePokemon={(uid) =>
              applyAction((state) => liquidatePokemonAction(state, uid))
            }
            onFinalizeSettlement={() => {
              playSfx('bell', game.muted);
              setStore((prev) => ({ ...prev, game: finalizeDebtSettlement(prev.game) }));
            }}
          />

          {/* Shift Summary & Rent Recap Modal */}
          <ShiftSummaryModal
            summary={game.lastShiftSummary}
            onStartNextShift={() => {
              playSfx('bell', game.muted);
              setStore((prev) => ({
                ...prev,
                game: startNextShift(prev.game),
              }));
            }}
          />

          {/* Bankruptcy / Store Foreclosed Modal */}
          <BankruptcyModal
            open={game.isBankrupt}
            summary={game.bankruptcySummary}
            profileName={game.profileName}
            onResetRun={() => handleResetProfile(game.profileId)}
            onReturnToMenu={handleReturnToMenu}
          />
        </>
      )}

      {/* Root-level Profile/Save Transfer & Credits Modals accessible from Menu or Shop */}
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

      <GameGuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} />

      <CreditsModal open={creditsModalOpen} onClose={() => setCreditsModalOpen(false)} />

      {/* Lightweight Desktop-Only Notice when browser viewport is narrower than 960px */}
      <div
        role="region"
        aria-label="Desktop browser required"
        className="fixed inset-0 z-50 hidden items-center justify-center bg-[#0c1733]/98 p-6 max-[959px]:flex"
      >
        <div className="pmd-panel max-w-md space-y-3 p-6 text-center">
          <h2 className="pmd-heading-display text-[#ffd84d]">Desktop Browser Only</h2>
          <p className="text-sm leading-relaxed text-[#dbe8ff]">
            <strong>PokéMart: Low Cortisol Shift</strong> is built for PC desktop web browsers
            with mouse &amp; keyboard (minimum <strong>1280×720</strong>, optimized for{' '}
            <strong>1920×1080</strong> and <strong>2560×1440+</strong>).
          </p>
          <p className="text-xs text-[#b5d4ff]">
            Widen this browser window to at least 960px or open the game on a PC monitor.
          </p>
        </div>
      </div>
    </div>
  );
}
