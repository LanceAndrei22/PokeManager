/**
 * Save & Profile Transfer Modal:
 * Manages isolated local Shift Manager profiles (create, switch, reset, delete)
 * and checksum-validated Base64 Save Export/Import.
 */
import { useEffect, useState, type FormEvent } from 'react';
import type { GameState, ProfileIndex } from '../data/types';
import { exportSaveCode } from '../engine/storage';
import { CozyDialog } from './CozyDialog';

export interface SaveTransferModalProps {
  open: boolean;
  profileIndex: ProfileIndex;
  activeState: GameState;
  onClose: () => void;
  onCreateProfile: (name: string) => void;
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
    onCreateProfile(newProfileName.trim());
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
    <CozyDialog open={open} onClose={onClose} title="Local Profiles & Save Transfer">
      <div className="space-y-4 text-xs">
        {statusMessage && (
          <div
            role="status"
            className={`rounded-lg border-2 px-3 py-2 font-bold ${
              statusError
                ? 'border-berry-500 bg-berry-100 text-wood-900'
                : 'border-sage-600 bg-sage-100 text-sage-800'
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* Profile List */}
        <section className="ds-inset space-y-2 rounded-xl p-3">
          <h2 className="text-sm font-extrabold text-wood-900">Shift Manager Profiles</h2>
          <p className="text-wood-700">
            Every profile is stored locally in its own isolated browser save slot.
          </p>

          <div className="space-y-1.5">
            {profileIndex.profiles.map((meta) => {
              const isActive = meta.id === profileIndex.activeProfileId;
              return (
                <div
                  key={meta.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-wood-300 bg-cream-50 px-2.5 py-1.5"
                >
                  <div>
                    <span className="font-extrabold text-wood-900">{meta.name}</span>
                    {isActive && (
                      <span className="ml-2 rounded bg-sage-100 px-1.5 py-0.5 text-[10px] font-bold text-sage-800">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSwitchProfile(meta.id)}
                        className="rounded border border-sage-800 bg-sage-600 px-2 py-0.5 font-bold text-cream-50"
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
                      className="rounded border border-wood-500 bg-cream-100 px-2 py-0.5 font-bold text-wood-900"
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
                        className="rounded border border-berry-500 bg-berry-100 px-2 py-0.5 font-bold text-wood-900"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="flex flex-wrap gap-2 pt-1">
            <input
              type="text"
              aria-label="Create new Shift Manager profile"
              placeholder="New Shift Manager name..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              maxLength={24}
              className="flex-1 rounded-md border-2 border-wood-500 bg-cream-50 px-2.5 py-1 text-xs text-wood-900"
            />
            <button
              type="submit"
              className="rounded-md border-2 border-sage-800 bg-sage-600 px-3 py-1 font-bold text-cream-50"
            >
              Create Profile
            </button>
          </form>
        </section>

        {/* Export / Import */}
        <section className="ds-inset space-y-2 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-wood-900">
              Export Save Code ({activeState.profileName})
            </h2>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-wood-700 bg-honey-100 px-2.5 py-1 font-bold text-wood-900"
            >
              Copy Code
            </button>
          </div>
          <textarea
            aria-label="Export Save Code"
            readOnly
            rows={3}
            value={exportCode}
            className="w-full rounded-md border border-wood-500 bg-cream-50 p-2 font-mono text-[11px] text-wood-900"
          />

          <label className="block pt-1 font-bold text-wood-900">
            <span>Import Save Code (replaces current active profile data)</span>
            <textarea
              aria-label="Import Save Code"
              rows={3}
              placeholder="Paste Base64 save code here..."
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-wood-500 bg-cream-50 p-2 font-mono text-[11px] text-wood-900"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              className="rounded-md border-2 border-wood-700 bg-sky-100 px-3 py-1 font-bold text-wood-900 hover:bg-sky-100/80"
            >
              Import Save into {activeState.profileName}
            </button>
          </div>
        </section>
      </div>
    </CozyDialog>
  );
}
