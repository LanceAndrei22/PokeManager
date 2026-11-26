/**
 * Unit tests for per-user isolated local profiles and checksum-validated Base64 Save Export/Import.
 */
import { describe, expect, it } from 'vitest';
import {
  PROFILE_SAVE_PREFIX,
  createProfile,
  ensureInitialProfileStore,
  exportSaveCode,
  importSaveCode,
  loadProfileGameState,
  resetProfile,
  saveProfileGameState,
  switchActiveProfile,
  type StorageLike,
} from '../../src/engine/storage';
import { createInitialGameState } from '../../src/engine/simulation';

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

  it('migrates legacy Checkpoint 2 saves missing Human NPC fields and audio defaults', () => {
    const storage = createMemoryStorage();
    const base = createInitialGameState('legacy-1', 'Legacy Host', 'standard');
    const legacyPayload = {
      ...base,
      bgmMuted: undefined,
      sfxVolume: undefined,
      bgmVolume: undefined,
      customers: [
        {
          uid: 'cust-old',
          archetypeId: 'cozy-collector',
          npcSpeciesId: 40,
          npcPaddedId: '0040',
          name: 'Mina (Wigglytuff)',
          targetPenIndex: 0,
          statusText: 'Admiring Eevee...',
          ticksRemaining: 3,
        },
      ],
      counterQueue: [
        {
          uid: 'offer-old',
          customerUid: 'cust-old',
          archetypeId: 'bargain-browser',
          npcSpeciesId: 52,
          npcPaddedId: '0052',
          customerName: 'Nori (Meowth)',
          pokemonUid: 'mon-starter-eevee',
          speciesId: 133,
          isShiny: false,
          penIndex: 0,
          fairValue: 1000,
          initialOffer: 950,
          currentOffer: 950,
          haggleAttempts: 0,
          maxHaggleAttempts: 2,
          patience: 10,
          maxPatience: 10,
          trendMatched: false,
          archetypeMatched: false,
          isVip: false,
        },
      ],
    };

    storage.setItem(`${PROFILE_SAVE_PREFIX}legacy-1`, JSON.stringify(legacyPayload));
    const migrated = loadProfileGameState('legacy-1', storage);
    expect(migrated).not.toBeNull();
    expect(migrated!.bgmMuted).toBe(false);
    expect(migrated!.sfxVolume).toBe(0.65);
    expect(migrated!.bgmVolume).toBe(0.35);
    expect(migrated!.customers[0].npcId).toBe('picnicker');
    expect(migrated!.customers[0].npcPortraitUrl).toContain('./assets/npcs/portraits/');
    expect(migrated!.counterQueue[0].npcId).toBe('youngster');
    expect(migrated!.counterQueue[0].npcPortraitUrl).toContain('./assets/npcs/portraits/');
  });
});
