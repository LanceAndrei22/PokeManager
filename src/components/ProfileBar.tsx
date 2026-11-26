/**
 * Top profile switcher bar: handles Shift Manager profile switching, inline new
 * profile creation, SFX mute toggling, Adoption Dex modal, and Save Export/Import.
 */
import { useState, type FormEvent } from 'react';
import type { ProfileIndex } from '../data/types';
import { ItemIcon } from './PokemonSprite';

export interface ProfileBarProps {
  profileIndex: ProfileIndex;
  activeProfileName: string;
  muted: boolean;
  discoveredCount: number;
  totalSpeciesCount: number;
  onSwitchProfile: (profileId: string) => void;
  onCreateProfile: (name: string) => void;
  onToggleMute: () => void;
  onOpenDex: () => void;
  onOpenSaveModal: () => void;
}

export function ProfileBar({
  profileIndex,
  activeProfileName,
  muted,
  discoveredCount,
  totalSpeciesCount,
  onSwitchProfile,
  onCreateProfile,
  onToggleMute,
  onOpenDex,
  onOpenSaveModal,
}: ProfileBarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    onCreateProfile(newName.trim());
    setNewName('');
    setCreating(false);
  };

  return (
    <header className="ds-panel rounded-xl px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-wood-700 bg-honey-100">
            <ItemIcon slug="poke-ball" name="PokéMart Icon" size={28} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-wood-900 sm:text-xl">
              PokéMart: Low Cortisol Shift
            </h1>
            <p className="text-xs text-wood-700">
              Cozy Gen 4 pet shop, stray nap center &amp; incubator • Zero stress
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-wood-700">
            <span>Manager:</span>
            <select
              aria-label="Shift Manager Profile"
              value={profileIndex.activeProfileId}
              onChange={(e) => onSwitchProfile(e.target.value)}
              className="rounded-md border-2 border-wood-500 bg-cream-100 px-2 py-1 text-xs font-bold text-wood-900 focus-visible:outline-2 focus-visible:outline-sage-600"
            >
              {profileIndex.profiles.map((meta) => (
                <option key={meta.id} value={meta.id}>
                  {meta.name}
                </option>
              ))}
            </select>
          </label>

          {creating ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="New profile name"
                placeholder="Trainer name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={24}
                autoFocus
                className="w-32 rounded-md border-2 border-wood-500 bg-cream-50 px-2 py-1 text-xs text-wood-900"
              />
              <button
                type="submit"
                className="rounded-md border-2 border-sage-800 bg-sage-600 px-2.5 py-1 text-xs font-bold text-cream-50 hover:bg-sage-800"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md border-2 border-wood-500 bg-cream-100 px-2 py-1 text-xs font-bold text-wood-900"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md border-2 border-wood-500 bg-cream-100 px-2.5 py-1 text-xs font-bold text-wood-900 hover:bg-cream-200"
            >
              + New Profile
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDex}
            className="rounded-md border-2 border-wood-700 bg-honey-100 px-2.5 py-1 text-xs font-bold text-wood-900 hover:bg-honey-400/50"
          >
            Dex ({discoveredCount}/{totalSpeciesCount})
          </button>

          <button
            type="button"
            onClick={onOpenSaveModal}
            className="rounded-md border-2 border-wood-700 bg-sky-100 px-2.5 py-1 text-xs font-bold text-wood-900 hover:bg-sky-100/80"
          >
            Save / Profiles
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={muted}
            title={`Sound settings for ${activeProfileName}`}
            className="rounded-md border-2 border-wood-500 bg-cream-100 px-2.5 py-1 text-xs font-bold text-wood-900 hover:bg-cream-200"
          >
            {muted ? 'SFX: Muted' : 'SFX: On'}
          </button>
        </div>
      </div>
    </header>
  );
}
