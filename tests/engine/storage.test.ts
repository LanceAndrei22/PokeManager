/**
 * Unit tests for per-user isolated local profiles and checksum-validated Base64 Save Export/Import.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_CODE_LENGTH,
  PROFILE_SAVE_PREFIX,
  computeSaveChecksum,
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

  describe('Save Import Security & Sanitization Hardening', () => {
    function encodeRawEnvelope(envelopeJson: string): string {
      const bytes = new TextEncoder().encode(envelopeJson);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }

    function encodeSignedState(stateObj: Record<string, unknown>): string {
      const stateJson = JSON.stringify(stateObj);
      const envelope = {
        format: 'pokemart-low-cortisol-save',
        version: 2,
        checksum: computeSaveChecksum(stateJson),
        exportedAt: new Date().toISOString(),
        state: stateObj,
      };
      return encodeRawEnvelope(JSON.stringify(envelope));
    }

    it('rejects oversized import strings before decoding or parsing', () => {
      const oversized = 'A'.repeat(MAX_IMPORT_CODE_LENGTH + 1);
      expect(() => importSaveCode(oversized, 'target-id')).toThrow(/too large|256 KB/i);
    });

    it('rejects malformed Base64, invalid UTF-8 byte sequences, malformed JSON, and bad checksums', () => {
      // Malformed Base64 characters
      expect(() => importSaveCode('@@@not-base64@@@', 'target-id')).toThrow(/Invalid save code/i);

      // Valid Base64 encoding an invalid UTF-8 byte sequence (0xFF 0xFE 0xFD)
      const invalidUtf8Base64 = btoa(String.fromCharCode(0xff, 0xfe, 0xfd, 0x80));
      expect(() => importSaveCode(invalidUtf8Base64, 'target-id')).toThrow(/Invalid save code/i);

      // Valid UTF-8 Base64 but broken JSON
      expect(() => importSaveCode(encodeRawEnvelope('{"format": broken'), 'target-id')).toThrow(
        /Invalid save code/i,
      );

      // Valid JSON envelope but mismatched checksum
      const base = createInitialGameState('p1', 'Host', 'standard');
      const badChecksumEnvelope = JSON.stringify({
        format: 'pokemart-low-cortisol-save',
        version: 2,
        checksum: 'deadbeef',
        exportedAt: new Date().toISOString(),
        state: base,
      });
      expect(() => importSaveCode(encodeRawEnvelope(badChecksumEnvelope), 'target-id')).toThrow(
        /checksum mismatch/i,
      );
    });

    it('rejects prototype pollution payloads (__proto__, constructor, prototype) cleanly', () => {
      const base = createInitialGameState('p1', 'Host', 'standard');
      const rawStateWithProto = `{"__proto__":{"polluted":true},"cash":${base.cash},"pokemon":[],"eggs":[],"upgrades":{}}`;
      const envelopeJson = `{"format":"pokemart-low-cortisol-save","version":2,"checksum":"${computeSaveChecksum(rawStateWithProto)}","exportedAt":"2026-01-01T00:00:00.000Z","state":${rawStateWithProto}}`;

      expect(() => importSaveCode(encodeRawEnvelope(envelopeJson), 'target-id')).toThrow(
        /disallowed object keys/i,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();

      const rawStateWithConstructor = `{"constructor":{"prototype":{"polluted":true}},"cash":500,"pokemon":[],"eggs":[],"upgrades":{}}`;
      const envConstructor = `{"format":"pokemart-low-cortisol-save","version":2,"checksum":"${computeSaveChecksum(rawStateWithConstructor)}","exportedAt":"2026-01-01T00:00:00.000Z","state":${rawStateWithConstructor}}`;
      expect(() => importSaveCode(encodeRawEnvelope(envConstructor), 'target-id')).toThrow(
        /disallowed object keys/i,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('rejects payloads with wrong required field types (e.g. null upgrades, string cash)', () => {
      const base = createInitialGameState('p1', 'Host', 'standard');

      expect(() =>
        importSaveCode(
          encodeSignedState({ ...(base as unknown as Record<string, unknown>), cash: '9999' }),
          'target-id',
        ),
      ).toThrow(/missing required shop data|invalid field types/i);

      expect(() =>
        importSaveCode(
          encodeSignedState({ ...(base as unknown as Record<string, unknown>), upgrades: null }),
          'target-id',
        ),
      ).toThrow(/missing required shop data|invalid field types/i);

      expect(() =>
        importSaveCode(
          encodeSignedState({ ...(base as unknown as Record<string, unknown>), pokemon: 'invalid' }),
          'target-id',
        ),
      ).toThrow(/missing required shop data|invalid field types/i);

      expect(() =>
        importSaveCode(
          encodeSignedState({ ...(base as unknown as Record<string, unknown>), profileName: 12345 }),
          'target-id',
        ),
      ).toThrow(/missing required shop data|invalid field types/i);
    });

    it('clamps extreme/negative numeric values, strips invalid species, and caps oversized arrays', () => {
      const base = createInitialGameState('p1', 'Host', 'standard');
      const hugePokemonList = Array.from({ length: 85 }, (_, idx) => ({
        uid: `mon-${idx}`,
        speciesId: idx === 0 ? 9999 : 133, // index 0 is invalid speciesId -> stripped
        isShiny: false,
        trait: 'BogusTrait',
        stats: { cute: 9999, comfort: -50, rarity: 500 },
        location: 'pen',
        penIndex: 99,
        healingProgress: 999,
        needsRecovery: false,
        acquiredAtShift: -10,
        origin: 'hacked-origin',
      }));

      const tamperedState: Record<string, unknown> = {
        ...(base as unknown as Record<string, unknown>),
        profileName: 'A'.repeat(120),
        difficulty: 'impossible-mode',
        cash: 9_999_999_999_999,
        shiftNumber: -42,
        shiftTick: 99999,
        shiftDurationTicks: 5,
        cozyXp: -500,
        debtGraceDaysRemaining: 99,
        globalMarkup: 9999,
        sfxVolume: 42,
        bgmVolume: -5,
        activeTrendId: 'non-existent-trend',
        activeGiftBall: 'master-ball-hack',
        upgrades: {
          'extra-pen': 999,
          'extra-incubator': -5,
          'unknown-upgrade': 50,
        },
        inventory: {
          'oran-berry': 50_000,
          'fake-item': 99,
        },
        pokemon: hugePokemonList,
        dex: {
          133: {
            speciesId: 133,
            seenNormal: true,
            seenShiny: false,
            adoptedCount: -10,
            hatchedCount: 5_000_000,
            evolvedCount: 3,
          },
          9999: {
            speciesId: 9999,
            seenNormal: true,
            seenShiny: true,
            adoptedCount: 1,
            hatchedCount: 0,
            evolvedCount: 0,
          },
        },
      };

      const sanitized = importSaveCode(encodeSignedState(tamperedState), 'target-id');

      expect(sanitized.profileName.length).toBe(24);
      expect(sanitized.difficulty).toBe('standard');
      expect(sanitized.cash).toBe(999_999_999);
      expect(sanitized.shiftNumber).toBe(1);
      expect(sanitized.shiftDurationTicks).toBe(20);
      expect(sanitized.shiftTick).toBe(20);
      expect(sanitized.cozyXp).toBe(0);
      expect(sanitized.debtGraceDaysRemaining).toBe(10);
      expect(sanitized.globalMarkup).toBe(160);
      expect(sanitized.sfxVolume).toBe(1);
      expect(sanitized.bgmVolume).toBe(0);
      expect(sanitized.activeGiftBall).toBe('poke-ball');
      expect(sanitized.upgrades['extra-pen']).toBe(3);
      expect(sanitized.upgrades['extra-incubator']).toBe(0);
      expect('unknown-upgrade' in sanitized.upgrades).toBe(false);
      expect(sanitized.inventory['oran-berry']).toBe(999);
      expect('fake-item' in sanitized.inventory).toBe(false);

      // Invalid species stripped & list capped at 60 entries
      expect(sanitized.pokemon.length).toBe(60);
      expect(sanitized.pokemon.every((mon) => mon.speciesId === 133)).toBe(true);
      expect(sanitized.pokemon[0].stats).toEqual({ cute: 100, comfort: 1, rarity: 100 });
      expect(sanitized.pokemon[0].penIndex).toBe(5);
      expect(sanitized.pokemon[0].healingProgress).toBe(100);
      expect(sanitized.pokemon[0].trait).toBe('Docile');

      // Invalid Dex entry stripped & counts clamped
      expect(sanitized.dex[9999]).toBeUndefined();
      expect(sanitized.dex[133]?.adoptedCount).toBe(0);
      expect(sanitized.dex[133]?.hatchedCount).toBe(99_999);
    });
  });
});
