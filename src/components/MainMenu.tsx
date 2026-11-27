/**
 * Dedicated PMD DS / PokéSurvivor-inspired Main Menu & Title Screen.
 * Renders over the full-viewport animated PMD meadow canvas with chunky gold logo,
 * tilted splash tagline, left Royal Navy hub (PLAY, Profile Switcher, New Trainer
 * Creator with 6 bundled starters & 3-tier Difficulty Box, quick utilities),
 * right floating "Your Mascot" spotlight card, and bottom-left fan credits.
 */
import { useState, type FormEvent } from 'react';
import { MenuBackdropCanvas } from '../canvas/MenuBackdropCanvas';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../data/difficulties';
import { CLERK_ROSTER, DEFAULT_CLERK_ID } from '../data/npcs';
import { APP_VERSION } from '../data/releaseNotes';
import { getSpecies } from '../data/species';
import {
  STARTER_MASCOT_IDS,
  type DifficultyId,
  type GameState,
  type ProfileIndex,
} from '../data/types';
import { getDexSummary, getShopRankInfo } from '../engine/dex';
import { AudioControls } from './AudioControls';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface MainMenuProps {
  profileIndex: ProfileIndex;
  activeState: GameState;
  onPlay: () => void;
  onSwitchProfile: (profileId: string) => void;
  onCreateProfile: (
    name: string,
    difficulty: DifficultyId,
    starterSpeciesId: number,
    clerkNpcId?: string,
  ) => void;
  onToggleBgmMute: () => void;
  onToggleMute: () => void;
  onChangeBgmVolume: (volume: number) => void;
  onChangeSfxVolume: (volume: number) => void;
  onOpenSaveModal: () => void;
  onOpenGuide: () => void;
  onOpenCredits: () => void;
  onOpenReleaseNotes?: () => void;
}

const SPLASH_LINES = [
  'Fresh Berries & Live Counter Haggling!',
  '493 Gen 1–4 Species Ready for Adoption!',
  'Watch Clerk Leo Tally Every Pokédollar!',
];

export function MainMenu({
  profileIndex,
  activeState,
  onPlay,
  onSwitchProfile,
  onCreateProfile,
  onToggleBgmMute,
  onToggleMute,
  onChangeBgmVolume,
  onChangeSfxVolume,
  onOpenSaveModal,
  onOpenGuide,
  onOpenCredits,
  onOpenReleaseNotes,
}: MainMenuProps) {
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [trainerName, setTrainerName] = useState('');
  const [selectedDiff, setSelectedDiff] = useState<DifficultyId>(activeState.difficulty);
  const [selectedStarter, setSelectedStarter] = useState<number>(133);
  const [selectedClerk, setSelectedClerk] = useState<string>(DEFAULT_CLERK_ID);

  const mascotMon =
    activeState.pokemon.find((mon) => mon.uid === activeState.mascotUid) ?? activeState.pokemon[0];
  const mascotSpecies = getSpecies(mascotMon?.speciesId ?? 133);
  const activeDiff = DIFFICULTIES[activeState.difficulty ?? 'standard'];
  const rankInfo = getShopRankInfo(activeState.cozyXp);
  const dexSummary = getDexSummary(activeState.dex);
  const splashIndex = (activeState.shiftNumber + activeState.profileName.length) % SPLASH_LINES.length;

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = trainerName.trim();
    if (!cleaned) return;
    onCreateProfile(cleaned, selectedDiff, selectedStarter, selectedClerk);
    setTrainerName('');
    setCreatorOpen(false);
  };

  return (
    <div className="pmd-scroll-themed relative h-dvh w-screen overflow-y-auto overflow-x-hidden">
      <MenuBackdropCanvas />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1440px] flex-col justify-between px-8 py-6">
        {/* Top Title Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="relative">
            <h1 className="pmd-title">PokéMart: Low Cortisol Shift</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <span className="pmd-text-shadow text-sm font-semibold tracking-wider text-[#dbe8ff] uppercase">
                GEN 4 PET SHOP &amp; COUNTER TYCOON
              </span>
              <span className="pmd-splash inline-block -rotate-2 text-base font-semibold">
                {SPLASH_LINES[splashIndex]}
              </span>
            </div>
          </div>

          {/* Quick Fan Badges Bar (Top Right) */}
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="pmd-pill pmd-num flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-sm font-semibold">
              <span className="text-[#ffd84d]">₽</span>
              <span>{activeState.cash.toLocaleString()}</span>
            </div>
            <AudioControls
              bgmMuted={Boolean(activeState.bgmMuted)}
              sfxMuted={Boolean(activeState.muted)}
              bgmVolume={activeState.bgmVolume ?? 0.35}
              sfxVolume={activeState.sfxVolume ?? 0.65}
              onToggleBgmMute={onToggleBgmMute}
              onToggleSfxMute={onToggleMute}
              onChangeBgmVolume={onChangeBgmVolume}
              onChangeSfxVolume={onChangeSfxVolume}
            />
            <button
              type="button"
              onClick={onOpenSaveModal}
              className="pmd-btn shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
            >
              Save / Profiles
            </button>
            <button
              type="button"
              onClick={onOpenGuide}
              className="pmd-btn shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold text-[#ffd84d]"
            >
              Guide
            </button>
            <button
              type="button"
              onClick={onOpenCredits}
              className="pmd-btn shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold"
            >
              Credits
            </button>
          </div>
        </header>

        {/* Main Hub + Floating "Your Mascot" Spotlight */}
        <main className="my-auto grid grid-cols-[1.35fr_0.9fr] items-center gap-8 py-4">
          {/* Left Royal-Blue PMD Command Hub */}
          <section aria-label="Store Menu Hub" className="pmd-panel space-y-3.5 p-5">
            <div className="grid grid-cols-[1fr_1.35fr] gap-3.5">
              {/* Prominent Play Tile Button */}
              <button
                type="button"
                onClick={onPlay}
                className="pmd-btn-gold flex flex-col items-center justify-center gap-2 px-4 py-5 text-center"
              >
                <ItemIcon slug="poke-ball" name="Open Store" size={44} />
                <span className="pmd-heading-display text-2xl tracking-wider">
                  PLAY
                </span>
                <span className="text-sm font-semibold text-[#3b2200]">
                  {activeState.isBankrupt
                    ? 'Inspect Bankrupt Shop'
                    : `Open ${activeState.profileName}'s Store`}
                </span>
              </button>

              {/* Profile Selector + Difficulty Info Box */}
              <div className="pmd-inset flex flex-col justify-between gap-2.5 p-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="menu-profile-select"
                      className="text-sm font-semibold text-[#ffd84d]"
                    >
                      Shift Manager Profile
                    </label>
                    <button
                      type="button"
                      aria-expanded={creatorOpen}
                      onClick={() => setCreatorOpen((prev) => !prev)}
                      className="pmd-btn px-2.5 py-0.5 text-xs font-semibold text-[#ffd84d]"
                    >
                      {creatorOpen ? 'Cancel' : '+ New Trainer'}
                    </button>
                  </div>
                  <select
                    id="menu-profile-select"
                    aria-label="Shift Manager Profile"
                    value={profileIndex.activeProfileId}
                    onChange={(e) => onSwitchProfile(e.target.value)}
                    className="mt-1.5 w-full border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-sm font-medium text-white"
                  >
                    {profileIndex.profiles.map((meta) => (
                      <option key={meta.id} value={meta.id}>
                        {meta.name} ({DIFFICULTIES[meta.difficulty ?? 'standard'].name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-[#2e4d88] pt-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#b5d4ff]">Active Mode:</span>
                    <span className="font-semibold text-[#ffd84d]">{activeDiff.name}</span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-[#d4e3ff]">
                    {activeDiff.tagline}
                  </p>
                </div>
              </div>
            </div>

            {/* Expandable New Trainer Creator (Name + 6 Starter Mascots + 3-Tier Difficulty Box) */}
            {creatorOpen && (
              <form
                onSubmit={handleCreateSubmit}
                aria-label="New Trainer Creator"
                className="pmd-inset space-y-3 border-2 border-[#ffd84d] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#ffd84d]">New Trainer Profile</h2>
                  <span className="text-xs text-[#b5d4ff]">
                    Local isolated save • Pick partner &amp; stakes
                  </span>
                </div>

                <div>
                  <label htmlFor="new-trainer-name" className="block text-sm font-semibold text-[#dbe8ff]">
                    Trainer Name
                  </label>
                  <input
                    id="new-trainer-name"
                    type="text"
                    required
                    maxLength={24}
                    placeholder="e.g. Dawn, Lucas, Cynthia..."
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    className="mt-1 w-full border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-sm text-white placeholder:text-[#6f8ec2]"
                  />
                </div>

                {/* 6 Bundled Iconic Starter Mascots */}
                <div>
                  <div className="mb-1.5 text-sm font-semibold text-[#dbe8ff]">
                    Pick Starter Mascot (Starts in Pen #1)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {STARTER_MASCOT_IDS.map((speciesId) => {
                      const sp = getSpecies(speciesId);
                      const chosen = selectedStarter === speciesId;
                      return (
                        <button
                          key={speciesId}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => setSelectedStarter(speciesId)}
                          className={`flex flex-col items-center gap-1 border-2 p-1.5 text-center transition ${
                            chosen
                              ? 'border-[#ffd84d] bg-[#24458a]'
                              : 'border-[#3a61a3] bg-[#0d1c40] hover:border-[#78a8f0]'
                          }`}
                        >
                          <PokemonSprite speciesId={speciesId} name={sp.name} size={40} />
                          <span className="text-xs font-semibold text-white">{sp.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6 Bundled Starting Shopkeepers */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#dbe8ff]">
                      Pick Initial Shopkeeper
                    </span>
                    <span className="text-xs text-[#9ec4ff]">
                      Hire extra random clerks later via Upgrades
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {CLERK_ROSTER.map((clerk) => {
                      const chosen = selectedClerk === clerk.id;
                      const shortName = clerk.name.replace(/^Clerk\s+/, '');
                      return (
                        <button
                          key={clerk.id}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => setSelectedClerk(clerk.id)}
                          title={`${clerk.name} — ${clerk.role}`}
                          className={`flex flex-col items-center gap-1 border-2 p-1.5 text-center transition ${
                            chosen
                              ? 'border-[#ffd84d] bg-[#24458a]'
                              : 'border-[#3a61a3] bg-[#0d1c40] hover:border-[#78a8f0]'
                          }`}
                        >
                          <img
                            src={clerk.portraitUrl}
                            alt={clerk.name}
                            width={36}
                            height={36}
                            className="pixel-art h-9 w-9 object-contain"
                          />
                          <span className="text-xs font-semibold text-white">{shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3-Tier Difficulty Box styled after PokéSurvivor */}
                <div>
                  <div className="mb-1.5 text-sm font-semibold text-[#dbe8ff]">Difficulty Mode</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DIFFICULTY_LIST.map((diff) => {
                      const active = selectedDiff === diff.id;
                      return (
                        <button
                          key={diff.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedDiff(diff.id)}
                          className={`flex flex-col items-start gap-1 border-2 p-2.5 text-left ${
                            active
                              ? 'border-[#ffd84d] bg-[#214284]'
                              : 'border-[#3a61a3] bg-[#0d1c40] hover:border-[#78a8f0]'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-1">
                            <span className="text-sm font-semibold text-[#ffd84d]">{diff.name}</span>
                            <span className="pmd-num text-xs text-[#b5d4ff]">
                              ₽{diff.startingCash.toLocaleString()}
                            </span>
                          </div>
                          <div className="pmd-num text-xs leading-snug text-[#d2e2ff]">
                            Rent ₽{diff.baseRent}+/d • {diff.debtGraceShifts} Grace •{' '}
                            {diff.id === 'high-stakes'
                              ? 'VIP Rk4+'
                              : 'Gentle pacing'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="submit" className="pmd-btn-gold px-4 py-2 text-sm font-semibold">
                    Create Trainer &amp; Save
                  </button>
                </div>
              </form>
            )}

            {/* 3-Tier Difficulty Quick Preview Strip */}
            {!creatorOpen && (
              <div className="pmd-inset grid gap-2 p-2.5 text-xs sm:grid-cols-3">
                {DIFFICULTY_LIST.map((diff) => {
                  const isCurrent = diff.id === activeState.difficulty;
                  return (
                    <div
                      key={diff.id}
                      className={`border px-2.5 py-2 ${
                        isCurrent
                          ? 'border-[#ffd84d] bg-[#1a3772]'
                          : 'border-[#2e4d88] bg-[#0b1634]/80 opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className={isCurrent ? 'text-[#ffd84d]' : 'text-[#dbe8ff]'}>
                          {diff.name}
                        </span>
                        <span className="pmd-num text-xs text-[#9ec4ff]">
                          Rent ₽{diff.baseRent}
                        </span>
                      </div>
                      <div className="pmd-num mt-0.5 text-xs text-[#b5d4ff]">
                        {diff.debtGraceShifts} Debt Grace • Bankrupt at &lt;₽0
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Floating "Your Mascot" Spotlight Card */}
          <aside
            aria-label="Your Mascot Spotlight"
            className="pmd-panel mx-auto w-full max-w-sm space-y-3 p-4"
          >
            <div className="flex items-center justify-between border-b-2 border-[#4e78bd] pb-2">
              <h2 className="text-base font-semibold text-[#ffd84d]">Your Mascot</h2>
              <span className="border border-[#ffd84d] bg-[#142958] px-2.5 py-0.5 text-xs font-semibold text-[#ffd84d]">
                {activeDiff.name}
              </span>
            </div>

            <div className="pmd-inset flex flex-col items-center justify-center py-4">
              <div className="relative flex h-28 w-28 items-center justify-center border-2 border-[#78a8f0] bg-[radial-gradient(circle,#264b96_0%,#0c1733_75%)]">
                <PokemonSprite
                  speciesId={mascotSpecies.id}
                  name={mascotSpecies.name}
                  isShiny={mascotMon?.isShiny}
                  size={88}
                  className="pmd-float-bob"
                />
              </div>
              <div className="mt-2.5 text-base font-semibold text-white">
                {mascotMon?.isShiny ? '✨ Shiny ' : ''}
                {mascotSpecies.name}
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {mascotSpecies.types.map((t) => (
                  <span
                    key={t}
                    className="border border-[#78a8f0] bg-[#152d63] px-2.5 py-0.5 text-xs font-semibold uppercase text-[#ffd84d]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pmd-inset space-y-1.5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="pmd-num font-semibold text-[#b5d4ff]">Rank {rankInfo.rank}</span>
                <span className="text-xs font-semibold text-[#ffd84d]">{rankInfo.title}</span>
              </div>
              <progress
                aria-label="Shop Rank XP progress"
                max={100}
                value={rankInfo.progressPct}
                className="h-2 w-full accent-[#ffd84d]"
              />
              <div className="pmd-num flex items-center justify-between text-xs text-[#cfe0ff]">
                <span>Shift #{activeState.shiftNumber}</span>
                <span>
                  Pokédex: {dexSummary.discoveredSpecies}/{dexSummary.totalSpecies}
                </span>
              </div>
            </div>
          </aside>
        </main>

        {/* Quiet Bottom Fan Credits + Subtle Version / Patch Notes Pill */}
        <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 text-left text-xs text-[#dbe8ff]/90">
          <div className="inline-block border border-[#3a61a3]/70 bg-[#0c1733]/80 px-2.5 py-1">
            <strong>PokéMart: Low Cortisol Shift</strong> — Simple, completely free fan project made
            for entertainment only • Sprites: PMDCollab/SpriteCollab (CC BY-NC 4.0) • Pokémon ©
            Nintendo, Creatures Inc., GAME FREAK.
          </div>
          {onOpenReleaseNotes && (
            <button
              type="button"
              onClick={onOpenReleaseNotes}
              className="pmd-btn pmd-num shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold text-[#ffd84d]"
            >
              v{APP_VERSION} · Patch Notes
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
