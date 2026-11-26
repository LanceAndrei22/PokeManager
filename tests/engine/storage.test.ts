/**
 * Unit tests for per-user isolated local profiles and checksum-validated Base64 Save Export/Import.
 */
import { describe, expect, it } from 'vitest';
import {
  createProfile,
  ensureInitialProfileStore,
  exportSaveCode,
  importSaveCode,
  resetProfile,
  saveProfileGameState,
  switchActiveProfile,
  type StorageLike,
} from '../../src/engine/storage';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('Per-Profile Local Storage & Base64 Save Transfer', () => {
  it('isolates Profile A and Profile B completely across mutations and switches', () => {
    const storage = createMemoryStorage();
    ensureInitialProfileStore(storage);

    const profileA = createProfile('Red', 'high-stakes', storage);
    const profileB = createProfile('Blue', 'relaxed', storage);

    expect(profileA.activeState.profileId).not.toBe(profileB.activeState.profileId);
    expect(profileA.activeState.cash).toBe(1200);
    expect(profileB.activeState.cash).toBe(3500);

    // Switch to Red and mutate cash and cozyXp
    const loadedRed = switchActiveProfile(profileA.activeState.profileId, storage);
    const mutatedRed = {
      ...loadedRed.activeState,
      cash: 9999,
      cozyXp: 450,
    };
    saveProfileGameState(mutatedRed, storage);

    // Switch to Blue and confirm Blue is completely untouched
    const loadedBlue = switchActiveProfile(profileB.activeState.profileId, storage);
    expect(loadedBlue.activeState.cash).toBe(3500);
    expect(loadedBlue.activeState.cozyXp).toBe(0);

    // Switch back to Red and verify persistence
    const reloadedRed = switchActiveProfile(profileA.activeState.profileId, storage);
    expect(reloadedRed.activeState.cash).toBe(9999);
    expect(reloadedRed.activeState.cozyXp).toBe(450);

    // Resetting Red resets back to High Stakes starting cash without altering Blue
    const resetRed = resetProfile(profileA.activeState.profileId, storage);
    expect(resetRed.cash).toBe(1200);
    expect(switchActiveProfile(profileB.activeState.profileId, storage).activeState.cash).toBe(3500);
  });

  it('round-trips Unicode Base64 Save Export/Import and rejects corrupted codes', () => {
    const storage = createMemoryStorage();
    const { activeState } = createProfile('PokéHost Lance', 'standard', storage);
    const modified = {
      ...activeState,
      cash: 4321,
      cozyXp: 210,
    };

    const code = exportSaveCode(modified);
    const restored = importSaveCode(code, 'target-id', 'Target Manager');

    expect(restored.cash).toBe(4321);
    expect(restored.cozyXp).toBe(210);
    expect(restored.profileId).toBe('target-id');
    expect(restored.profileName).toBe('Target Manager');

    // Tampered code must fail checksum validation
    const tampered = `${code.slice(0, -4)}AAAA`;
    expect(() => importSaveCode(tampered, 'target-id')).toThrow(/checksum|format|Invalid/i);
    expect(() => importSaveCode('not-valid-base64!!!', 'target-id')).toThrow();
    expect(() => importSaveCode('', 'target-id')).toThrow();
  });
});
