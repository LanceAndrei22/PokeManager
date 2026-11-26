/**
 * Save & Profile Transfer Modal in PMD Navy & Gold:
 * Manages isolated local Shift Manager profiles (create with Difficulty/Starter,
 * switch, reset, delete) and checksum-validated Base64 Save Export/Import.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../data/difficulties';
import { getSpecies } from '../data/species';
import {
  STARTER_MASCOT_IDS,
  type DifficultyId,
  type GameState,
  type ProfileIndex,
} from '../data/types';
import { exportSaveCode } from '../engine/storage';
import { CozyDialog } from './CozyDialog';
import { PokemonSprite } from './PokemonSprite';

export interface SaveTransferModalProps {
  open: boolean;
  profileIndex: ProfileIndex;
  activeState: GameState;
  onClose: () => void;
  onCreateProfile: (name: string, difficulty: DifficultyId, starterSpeciesId: number) => void;
  onSwitchProfile: (profileId: string) => void;
  onResetProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onImportSaveCode: (code: string) => { ok: boolean; message: string };
}

export function SaveTransferModal({
  open,
  profileIndex,
  activeState,
  onClose,
  onCreateProfile,
  onSwitchProfile,
  onResetProfile,
  onDeleteProfile,
  onImportSaveCode,
}: SaveTransferModalProps) {
  const [newProfileName, setNewProfileName] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<DifficultyId>('standard');
  const [newStarterId, setNewStarterId] = useState<number>(133);
  const [importInput, setImportInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);

  const exportCode = open ? exportSaveCode(activeState) : '';

  useEffect(() => {
    if (!open) {
      setStatusMessage(null);
      setStatusError(false);
    }
  }, [open]);

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim(), newDifficulty, newStarterId);
    setStatusMessage(`Created & switched to profile "${newProfileName.trim()}".`);
    setStatusError(false);
    setNewProfileName('');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setStatusMessage('Copied Base64 save code to clipboard!');
      setStatusError(false);
    } catch {
      setStatusMessage('Copy manually from the Export Save Code box.');
      setStatusError(false);
    }
  };

  const handleImport = () => {
    const result = onImportSaveCode(importInput);
    setStatusMessage(result.message);
    setStatusError(!result.ok);
    if (result.ok) {
      setImportInput('');
    }
  };

  return (
    <CozyDialog open={open} onClose={onClose} title="Local Profiles &amp; Save Transfer">
      <div className="space-y-4 text-xs text-[#e2eeff]">
        {statusMessage && (
          <div
            role="status"
            className={`border-2 px-3 py-2 font-bold ${
              statusError
                ? 'border-[#e74c3c] bg-[#4a161b] text-[#ffd4d0]'
                : 'border-[#2ecc71] bg-[#123d28] text-[#cfffe3]'
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* Profile List */}
        <section className="pmd-inset space-y-2.5 p-3">
          <h2 className="text-sm font-bold text-[#ffd84d]">Shift Manager Profiles</h2>
          <p className="text-[#a8c4f0]">
            Every profile is stored locally in its own isolated v2 browser save slot.
          </p>

          <div className="space-y-1.5">
            {profileIndex.profiles.map((meta) => {
              const isActive = meta.id === profileIndex.activeProfileId;
              const diff = DIFFICULTIES[meta.difficulty ?? 'standard'];
              const mascotId = meta.mascotSpeciesId ?? 133;
              const mascotSpecies = getSpecies(mascotId);

              return (
                <div
                  key={meta.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border-2 px-2.5 py-2 ${
                    isActive
                      ? 'border-[#ffd84d] bg-[#1b366d]'
                      : 'border-[#3a61a3] bg-[#0e1e44]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PokemonSprite
                      speciesId={mascotId}
                      name={mascotSpecies.name}
                      size={32}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-white">{meta.name}</span>
                        <span className="border border-[#78a8f0] bg-[#13295c] px-1.5 py-0.5 text-[10px] font-bold text-[#a8d0ff]">
                          {diff.name}
                        </span>
                        {isActive && (
                          <span className="border border-[#2ecc71] bg-[#14472c] px-1.5 py-0.5 text-[10px] font-bold text-[#9effc3]">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSwitchProfile(meta.id)}
                        className="pmd-btn-emerald px-2.5 py-1 font-bold"
                      >
                        Load
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onResetProfile(meta.id);
                        setStatusMessage(`Reset "${meta.name}" to a fresh Shift #1.`);
                        setStatusError(false);
                      }}
                      className="pmd-btn px-2.5 py-1 font-bold"
                    >
                      Reset
                    </button>
                    {profileIndex.profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteProfile(meta.id);
                          setStatusMessage(`Deleted profile "${meta.name}".`);
                          setStatusError(false);
                        }}
                        className="pmd-btn-danger px-2.5 py-1 font-bold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="space-y-2 border-t border-[#3b60a0] pt-2.5">
            <div className="text-[11px] font-bold text-[#ffd84d]">Create New Trainer Profile</div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Create new Shift Manager profile"
                placeholder="New Shift Manager name..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                maxLength={24}
                className="min-w-[180px] flex-1 border-2 border-[#78a8f0] bg-[#0a1430] px-2.5 py-1 text-xs text-white placeholder:text-[#6f8ec2]"
              />
              <select
                aria-label="New profile difficulty"
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value as DifficultyId)}
                className="border-2 border-[#78a8f0] bg-[#0a1430] px-2 py-1 text-xs font-bold text-[#ffd84d]"
              >
                {DIFFICULTY_LIST.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="New profile starter mascot"
                value={newStarterId}
                onChange={(e) => setNewStarterId(Number(e.target.value))}
                className="border-2 border-[#78a8f0] bg-[#0a1430] px-2 py-1 text-xs font-bold text-white"
              >
                {STARTER_MASCOT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {getSpecies(id).name}
                  </option>
                ))}
              </select>
              <button type="submit" className="pmd-btn-gold px-3 py-1 font-bold">
                Create Profile
              </button>
            </div>
          </form>
        </section>

        {/* Export / Import */}
        <section className="pmd-inset space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#ffd84d]">
              Export Save Code ({activeState.profileName})
            </h2>
            <button
              type="button"
              onClick={handleCopy}
              className="pmd-btn-gold px-2.5 py-1 font-bold"
            >
              Copy Code
            </button>
          </div>
          <textarea
            aria-label="Export Save Code"
            readOnly
            rows={3}
            value={exportCode}
            className="w-full border-2 border-[#4e78bd] bg-[#091229] p-2 font-mono text-[11px] text-[#cfe0ff]"
          />

          <label className="block pt-1 font-bold text-[#e2eeff]">
            <span>Import Save Code (replaces current active profile data)</span>
            <textarea
              aria-label="Import Save Code"
              rows={3}
              placeholder="Paste Base64 save code here..."
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              className="mt-1 w-full border-2 border-[#4e78bd] bg-[#091229] p-2 font-mono text-[11px] text-white placeholder:text-[#6f8ec2]"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              className="pmd-btn px-3 py-1 font-bold"
            >
              Import Save into {activeState.profileName}
            </button>
          </div>
        </section>
      </div>
    </CozyDialog>
  );
}
