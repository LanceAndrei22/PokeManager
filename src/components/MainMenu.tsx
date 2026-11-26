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
import { getSpecies } from '../data/species';
import {
  STARTER_MASCOT_IDS,
  type DifficultyId,
  type GameState,
  type ProfileIndex,
} from '../data/types';
import { getDexSummary, getShopRankInfo } from '../engine/dex';
import { ItemIcon, PokemonSprite } from './PokemonSprite';

export interface MainMenuProps {
  profileIndex: ProfileIndex;
  activeState: GameState;
  onPlay: () => void;
  onSwitchProfile: (profileId: string) => void;
  onCreateProfile: (name: string, difficulty: DifficultyId, starterSpeciesId: number) => void;
  onToggleMute: () => void;
  onOpenSaveModal: () => void;
  onOpenCredits: () => void;
}

const SPLASH_LINES = [
  'Fresh Berries & Live Counter Haggling!',
  '493 Gen 1–4 Species Ready for Adoption!',
  'Watch Kecleon Count Every Pokédollar!',
];

export function MainMenu({
  profileIndex,
  activeState,
  onPlay,
  onSwitchProfile,
  onCreateProfile,
  onToggleMute,
  onOpenSaveModal,
  onOpenCredits,
}: MainMenuProps) {
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [trainerName, setTrainerName] = useState('');
  const [selectedDiff, setSelectedDiff] = useState<DifficultyId>(activeState.difficulty);
  const [selectedStarter, setSelectedStarter] = useState<number>(133);

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
    onCreateProfile(cleaned, selectedDiff, selectedStarter);
    setTrainerName('');
    setCreatorOpen(false);
  };

  return (
    <div className="relative h-dvh w-screen overflow-y-auto overflow-x-hidden">
      <MenuBackdropCanvas />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col justify-between px-3 py-4 sm:px-6 sm:py-5">
        {/* Top Title Header */}
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <h1 className="pmd-title">PokéMart: Low Cortisol Shift</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <span className="font-[family-name:var(--font-display)] text-[11px] tracking-[0.18em] text-[#dbe8ff] uppercase">
                GEN 4 PET SHOP &amp; COUNTER TYCOON
              </span>
              <span className="pmd-splash inline-block -rotate-2 text-xs font-bold sm:text-sm">
                {SPLASH_LINES[splashIndex]}
              </span>
            </div>
          </div>

          {/* Quick Fan Badges Bar (Top Right) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="pmd-pill flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold">
              <span className="text-[#ffd84d]">₽</span>
              <span className="font-mono">{activeState.cash.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className="pmd-btn px-2.5 py-1 text-xs font-bold"
            >
              SFX: {activeState.muted ? 'Muted' : 'On'}
            </button>
            <button
              type="button"
              onClick={onOpenSaveModal}
              className="pmd-btn px-2.5 py-1 text-xs font-bold"
            >
              Save / Profiles
            </button>
            <button
              type="button"
              onClick={onOpenCredits}
              className="pmd-btn px-2.5 py-1 text-xs font-bold"
            >
              Credits
            </button>
          </div>
        </header>

        {/* Main Hub + Floating "Your Mascot" Spotlight */}
        <main className="my-auto grid items-center gap-5 py-4 lg:grid-cols-[1.35fr_0.9fr]">
          {/* Left Royal-Blue PMD Command Hub */}
          <section aria-label="Store Menu Hub" className="pmd-panel space-y-3 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]">
              {/* Prominent Play Tile Button */}
              <button
                type="button"
                onClick={onPlay}
                className="pmd-btn-gold flex flex-col items-center justify-center gap-2 px-4 py-5 text-center"
              >
                <ItemIcon slug="poke-ball" name="Open Store" size={44} />
                <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-wide">
                  PLAY
                </span>
                <span className="text-xs font-bold text-[#3b2200]">
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
                      className="text-xs font-bold text-[#ffd84d]"
                    >
                      Shift Manager Profile
                    </label>
                    <button
                      type="button"
                      aria-expanded={creatorOpen}
                      onClick={() => setCreatorOpen((prev) => !prev)}
                      className="pmd-btn px-2 py-0.5 text-[11px] font-bold text-[#ffd84d]"
                    >
                      {creatorOpen ? 'Cancel' : '+ New Trainer'}
                    </button>
                  </div>
                  <select
                    id="menu-profile-select"
                    aria-label="Shift Manager Profile"
                    value={profileIndex.activeProfileId}
                    onChange={(e) => onSwitchProfile(e.target.value)}
                    className="mt-1.5 w-full border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-xs font-bold text-white"
                  >
                    {profileIndex.profiles.map((meta) => (
                      <option key={meta.id} value={meta.id}>
                        {meta.name} ({DIFFICULTIES[meta.difficulty ?? 'standard'].name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-[#2e4d88] pt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#a8c4f0]">Active Mode:</span>
                    <span className="font-bold text-[#ffd84d]">{activeDiff.name}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-[#d4e3ff]">
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
                  <h2 className="text-sm font-bold text-[#ffd84d]">New Trainer Profile</h2>
                  <span className="text-[11px] text-[#a8c4f0]">
                    Local isolated save • Pick partner &amp; stakes
                  </span>
                </div>

                <div>
                  <label htmlFor="new-trainer-name" className="block text-xs font-bold text-[#dbe8ff]">
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
                    className="mt-1 w-full border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1.5 text-xs text-white placeholder:text-[#6f8ec2]"
                  />
                </div>

                {/* 6 Bundled Iconic Starter Mascots */}
                <div>
                  <div className="mb-1.5 text-xs font-bold text-[#dbe8ff]">
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
                          <span className="text-[11px] font-bold text-white">{sp.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3-Tier Difficulty Box styled after PokéSurvivor */}
                <div>
                  <div className="mb-1.5 text-xs font-bold text-[#dbe8ff]">Difficulty Mode</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DIFFICULTY_LIST.map((diff) => {
                      const active = selectedDiff === diff.id;
                      return (
                        <button
                          key={diff.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedDiff(diff.id)}
                          className={`flex flex-col items-start gap-1 border-2 p-2 text-left ${
                            active
                              ? 'border-[#ffd84d] bg-[#214284]'
                              : 'border-[#3a61a3] bg-[#0d1c40] hover:border-[#78a8f0]'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[#ffd84d]">{diff.name}</span>
                            <span className="font-mono text-[10px] text-[#a8d0ff]">
                              ₽{diff.startingCash.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] leading-tight text-[#d2e2ff]">
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
                  <button type="submit" className="pmd-btn-gold px-4 py-1.5 text-xs font-bold">
                    Create Trainer &amp; Save
                  </button>
                </div>
              </form>
            )}

            {/* 3-Tier Difficulty Quick Preview Strip */}
            {!creatorOpen && (
              <div className="pmd-inset grid gap-2 p-2.5 text-[11px] sm:grid-cols-3">
                {DIFFICULTY_LIST.map((diff) => {
                  const isCurrent = diff.id === activeState.difficulty;
                  return (
                    <div
                      key={diff.id}
                      className={`border px-2 py-1.5 ${
                        isCurrent
                          ? 'border-[#ffd84d] bg-[#1a3772]'
                          : 'border-[#2e4d88] bg-[#0b1634]/80 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className={isCurrent ? 'text-[#ffd84d]' : 'text-[#dbe8ff]'}>
                          {diff.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#9ec4ff]">
                          Rent ₽{diff.baseRent}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#a8c4f0]">
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
              <h2 className="text-sm font-bold text-[#ffd84d]">Your Mascot</h2>
              <span className="border border-[#ffd84d] bg-[#142958] px-2 py-0.5 text-[10px] font-bold text-[#ffd84d]">
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
              <div className="mt-2.5 text-base font-bold text-white">
                {mascotMon?.isShiny ? '✨ Shiny ' : ''}
                {mascotSpecies.name}
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {mascotSpecies.types.map((t) => (
                  <span
                    key={t}
                    className="border border-[#78a8f0] bg-[#152d63] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ffd84d]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pmd-inset space-y-1.5 p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#a8c4f0]">Rank {rankInfo.rank}</span>
                <span className="text-[11px] font-bold text-[#ffd84d]">{rankInfo.title}</span>
              </div>
              <progress
                aria-label="Shop Rank XP progress"
                max={100}
                value={rankInfo.progressPct}
                className="h-2 w-full accent-[#ffd84d]"
              />
              <div className="flex items-center justify-between text-[11px] text-[#cfe0ff]">
                <span>Shift #{activeState.shiftNumber}</span>
                <span>
                  Pokédex: {dexSummary.discoveredSpecies}/{dexSummary.totalSpecies}
                </span>
              </div>
            </div>
          </aside>
        </main>

        {/* Quiet Bottom-Left Fan Credits */}
        <footer className="pt-2 text-left text-[11px] text-[#dbe8ff]/85">
          <div className="inline-block border border-[#3a61a3]/70 bg-[#0c1733]/80 px-2.5 py-1">
            <strong>PokéMart: Low Cortisol Shift</strong> — Simple, completely free fan project made
            for entertainment only • Sprites: PMDCollab/SpriteCollab (CC BY-NC 4.0) • Pokémon ©
            Nintendo, Creatures Inc., GAME FREAK.
          </div>
        </footer>
      </div>
    </div>
  );
}
