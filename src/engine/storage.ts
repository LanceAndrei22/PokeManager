/**
 * Per-user v2 local storage profile manager and Base64 Save Export/Import serializer.
 *
 * Uses isolated v2 keys (`pokemart-low-cortisol:v2:index` & `pokemart-low-cortisol:v2:save:<profileId>`)
 * so v1 data stays untouched, stores Difficulty per profile, and validates exported saves
 * with an FNV-1a checksum.
 */
import { DEFAULT_CLERK_ID, getClerkById, resolveHumanNpcFallback } from '../data/npcs';
import type {
  DifficultyId,
  GameState,
  ProfileIndex,
  ProfileMeta,
  SaveEnvelope,
} from '../data/types';
import { createInitialGameState } from './simulation';

export const PROFILE_INDEX_KEY = 'pokemart-low-cortisol:v2:index';
export const PROFILE_SAVE_PREFIX = 'pokemart-low-cortisol:v2:save:';

/** Minimal Storage interface so unit tests can pass mock or real window.localStorage. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getDefaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  throw new Error('localStorage is unavailable in this environment.');
}

/** Computes a deterministic FNV-1a 32-bit hex checksum over a UTF-8 string. */
export function computeSaveChecksum(payload: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeUtf8Base64(encoded: string): string {
  const binary = atob(encoded.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function createProfileId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug || 'trainer'}-${Date.now().toString(36)}-${rand}`;
}

export function getProfileSaveKey(profileId: string): string {
  return `${PROFILE_SAVE_PREFIX}${profileId}`;
}

export function loadProfileIndex(storage: StorageLike = getDefaultStorage()): ProfileIndex | null {
  const raw = storage.getItem(PROFILE_INDEX_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProfileIndex;
    if (
      parsed &&
      parsed.version === 2 &&
      Array.isArray(parsed.profiles) &&
      parsed.profiles.length > 0
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveProfileIndex(
  index: ProfileIndex,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
}

export function loadProfileGameState(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): GameState | null {
  const raw = storage.getItem(getProfileSaveKey(profileId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed && parsed.version === 2 && typeof parsed.cash === 'number') {
      return migrateLegacyGameState(parsed);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Safely migrates pre-v2.1 saves: maps stale Pokémon NPC entries in `customers` /
 * `counterQueue` to Human Trainer profiles and populates default BGM/SFX preferences.
 */
export function migrateLegacyGameState(state: GameState): GameState {
  const customers = (state.customers ?? []).map((cust) => {
    const resolved = resolveHumanNpcFallback(cust.archetypeId, cust.npcId);
    if (cust.npcId === resolved.id && cust.npcPortraitUrl === resolved.portraitUrl) {
      return cust;
    }
    return {
      ...cust,
      npcId: resolved.id,
      npcPortraitUrl: resolved.portraitUrl,
      name: cust.npcId ? cust.name : resolved.name,
    };
  });

  const counterQueue = (state.counterQueue ?? []).map((offer) => {
    const resolved = resolveHumanNpcFallback(offer.archetypeId, offer.npcId);
    if (offer.npcId === resolved.id && offer.npcPortraitUrl === resolved.portraitUrl) {
      return offer;
    }
    return {
      ...offer,
      npcId: resolved.id,
      npcPortraitUrl: resolved.portraitUrl,
      customerName: offer.npcId ? offer.customerName : resolved.name,
    };
  });

  const shopkeepers =
    Array.isArray(state.shopkeepers) && state.shopkeepers.length > 0
      ? state.shopkeepers.map((id) => getClerkById(id).id)
      : [DEFAULT_CLERK_ID];

  return {
    ...state,
    bgmMuted: state.bgmMuted ?? false,
    sfxVolume: typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.65,
    bgmVolume: typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.35,
    shopkeepers,
    upgrades: {
      ...state.upgrades,
      'hire-clerk': state.upgrades?.['hire-clerk'] ?? 0,
    },
    customers,
    counterQueue,
  };
}

export function saveProfileGameState(
  state: GameState,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(getProfileSaveKey(state.profileId), JSON.stringify(state));

  const mascotMon =
    state.pokemon.find((mon) => mon.uid === state.mascotUid) ?? state.pokemon[0];

  const index = loadProfileIndex(storage);
  if (index) {
    const nextProfiles = index.profiles.map((meta) =>
      meta.id === state.profileId
        ? {
            ...meta,
            name: state.profileName,
            difficulty: state.difficulty,
            mascotSpeciesId: mascotMon?.speciesId ?? meta.mascotSpeciesId ?? 133,
            clerkNpcId: state.shopkeepers?.[0] ?? meta.clerkNpcId ?? DEFAULT_CLERK_ID,
            updatedAt: Date.now(),
          }
        : meta,
    );
    saveProfileIndex({ ...index, profiles: nextProfiles }, storage);
  }
}

/** Ensures at least one v2 Shift Manager profile exists in local storage. */
export function ensureInitialProfileStore(storage: StorageLike = getDefaultStorage()): {
  index: ProfileIndex;
  activeState: GameState;
} {
  const existing = loadProfileIndex(storage);
  if (existing) {
    const activeMeta =
      existing.profiles.find((p) => p.id === existing.activeProfileId) ?? existing.profiles[0];
    const loadedState = loadProfileGameState(activeMeta.id, storage);
    if (loadedState) {
      if (existing.activeProfileId !== activeMeta.id) {
        const fixedIndex = { ...existing, activeProfileId: activeMeta.id };
        saveProfileIndex(fixedIndex, storage);
        return { index: fixedIndex, activeState: loadedState };
      }
      return { index: existing, activeState: loadedState };
    }
  }

  const now = Date.now();
  const defaultId = 'cozy-host-1';
  const defaultName = 'Cozy Host';
  const initialState = createInitialGameState(defaultId, defaultName, 'standard');
  const initialMeta: ProfileMeta = {
    id: defaultId,
    name: defaultName,
    difficulty: 'standard',
    mascotSpeciesId: 133,
    createdAt: now,
    updatedAt: now,
  };
  const index: ProfileIndex = {
    version: 2,
    activeProfileId: defaultId,
    profiles: [initialMeta],
  };

  saveProfileGameState(initialState, storage);
  saveProfileIndex(index, storage);
  return { index, activeState: initialState };
}

/** Creates a brand-new isolated v2 Shift Manager profile with chosen Difficulty, Starter Mascot & Initial Shopkeeper. */
export function createProfile(
  rawName: string,
  difficulty: DifficultyId = 'standard',
  storage: StorageLike = getDefaultStorage(),
  starterSpeciesId = 133,
  initialClerkId: string = DEFAULT_CLERK_ID,
): { index: ProfileIndex; activeState: GameState } {
  const trimmed = rawName.trim().slice(0, 24) || 'Trainer';
  const current = ensureInitialProfileStore(storage).index;
  const now = Date.now();
  const newId = createProfileId(trimmed);
  const resolvedClerk = getClerkById(initialClerkId);
  const newState = createInitialGameState(
    newId,
    trimmed,
    difficulty,
    false,
    (now ^ (trimmed.length * 131)) >>> 0,
    starterSpeciesId,
    resolvedClerk.id,
  );
  const resolvedStarterId = newState.pokemon[0]?.speciesId ?? 133;

  const nextIndex: ProfileIndex = {
    version: 2,
    activeProfileId: newId,
    profiles: [
      ...current.profiles,
      {
        id: newId,
        name: trimmed,
        difficulty,
        mascotSpeciesId: resolvedStarterId,
        clerkNpcId: resolvedClerk.id,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  saveProfileGameState(newState, storage);
  saveProfileIndex(nextIndex, storage);
  return { index: nextIndex, activeState: newState };
}

/** Switches active profile and loads its isolated v2 GameState. */
export function switchActiveProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): { index: ProfileIndex; activeState: GameState } {
  const current = ensureInitialProfileStore(storage).index;
  const targetMeta = current.profiles.find((p) => p.id === profileId);
  if (!targetMeta) throw new Error(`Profile ${profileId} not found.`);

  const nextIndex: ProfileIndex = { ...current, activeProfileId: profileId };
  saveProfileIndex(nextIndex, storage);

  const loaded =
    loadProfileGameState(profileId, storage) ??
    createInitialGameState(targetMeta.id, targetMeta.name, targetMeta.difficulty ?? 'standard');
  saveProfileGameState(loaded, storage);
  return { index: nextIndex, activeState: loaded };
}

/** Resets a single profile back to Shift 1 on its difficulty (or an explicit new difficulty). */
export function resetProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
  difficultyOverride?: DifficultyId,
): GameState {
  const current = ensureInitialProfileStore(storage).index;
  const targetMeta = current.profiles.find((p) => p.id === profileId);
  if (!targetMeta) throw new Error(`Profile ${profileId} not found.`);

  const prevState = loadProfileGameState(profileId, storage);
  const diff = difficultyOverride ?? prevState?.difficulty ?? targetMeta.difficulty ?? 'standard';
  const starterId = targetMeta.mascotSpeciesId ?? 133;
  const clerkId = targetMeta.clerkNpcId ?? prevState?.shopkeepers?.[0] ?? DEFAULT_CLERK_ID;
  const freshState = createInitialGameState(
    targetMeta.id,
    targetMeta.name,
    diff,
    prevState?.muted ?? false,
    1042,
    starterId,
    clerkId,
  );
  saveProfileGameState(freshState, storage);
  return freshState;
}

/** Deletes a non-last profile and returns the updated ProfileIndex + active GameState. */
export function deleteProfile(
  profileId: string,
  storage: StorageLike = getDefaultStorage(),
): { index: ProfileIndex; activeState: GameState } {
  const current = ensureInitialProfileStore(storage).index;
  if (current.profiles.length <= 1) {
    throw new Error('Keep at least one Shift Manager profile.');
  }
  const nextProfiles = current.profiles.filter((p) => p.id !== profileId);
  storage.removeItem(getProfileSaveKey(profileId));

  const nextActiveId =
    current.activeProfileId === profileId ? nextProfiles[0].id : current.activeProfileId;
  const nextIndex: ProfileIndex = {
    version: 2,
    activeProfileId: nextActiveId,
    profiles: nextProfiles,
  };
  saveProfileIndex(nextIndex, storage);

  const activeMeta = nextProfiles.find((p) => p.id === nextActiveId) ?? nextProfiles[0];
  const activeState =
    loadProfileGameState(activeMeta.id, storage) ??
    createInitialGameState(activeMeta.id, activeMeta.name, activeMeta.difficulty ?? 'standard');
  return { index: nextIndex, activeState };
}

/** Encodes a v2 GameState into a checksum-verified UTF-8 Base64 save string. */
export function exportSaveCode(state: GameState): string {
  const stateJson = JSON.stringify(state);
  const envelope: SaveEnvelope = {
    format: 'pokemart-low-cortisol-save',
    version: 2,
    checksum: computeSaveChecksum(stateJson),
    exportedAt: new Date().toISOString(),
    state,
  };
  return encodeUtf8Base64(JSON.stringify(envelope));
}

/** Validates and decodes an exported v2 Base64 save code. */
export function importSaveCode(
  code: string,
  targetProfileId: string,
  targetProfileName?: string,
): GameState {
  if (!code || !code.trim()) {
    throw new Error('Paste a save code before importing.');
  }

  let envelope: SaveEnvelope;
  try {
    envelope = JSON.parse(decodeUtf8Base64(code)) as SaveEnvelope;
  } catch {
    throw new Error('Invalid save code format (could not decode Base64 JSON).');
  }

  if (
    !envelope ||
    envelope.format !== 'pokemart-low-cortisol-save' ||
    envelope.version !== 2 ||
    !envelope.state ||
    typeof envelope.checksum !== 'string'
  ) {
    throw new Error('Unrecognized or unsupported save file version (requires v2).');
  }

  const recomputed = computeSaveChecksum(JSON.stringify(envelope.state));
  if (recomputed !== envelope.checksum) {
    throw new Error('Save code checksum mismatch — code may be corrupted or truncated.');
  }

  const imported = envelope.state;
  if (
    typeof imported.cash !== 'number' ||
    !Array.isArray(imported.pokemon) ||
    !Array.isArray(imported.eggs) ||
    typeof imported.upgrades !== 'object'
  ) {
    throw new Error('Save payload is missing required shop data.');
  }

  return migrateLegacyGameState({
    ...imported,
    profileId: targetProfileId,
    profileName: targetProfileName ?? imported.profileName,
    shiftRunning: false,
    shiftPhase: imported.isBankrupt ? 'bankrupt' : imported.pendingSettlement ? 'settlement-debt' : 'prep',
    customers: [],
    updatedAt: Date.now(),
  });
}
