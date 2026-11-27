/**
 * Central release version & changelog registry for PokéMart: Low Cortisol Shift.
 *
 * Single source of truth for `APP_VERSION` (synced with `package.json`), the
 * structured `RELEASE_NOTES` history, and safe `localStorage` gating so every
 * future release only requires bumping `APP_VERSION` and prepending a new entry.
 */

/** Current semantic playtest release version (synced with `package.json`). */
export const APP_VERSION = '0.1.0-playtest';

/** Human-friendly banner label for the active release. */
export const RELEASE_LABEL = 'Initial Playtest Release';

/** Dedicated `localStorage` key tracking the last version the user dismissed (separate from save slots). */
export const SEEN_RELEASE_VERSION_KEY = 'pokemart_seen_release_version';

/** Single versioned changelog entry rendered inside `ReleaseNotesModal`. */
export interface ReleaseNoteEntry {
  readonly version: string;
  readonly label: string;
  readonly date: string;
  readonly summary: string;
  readonly highlights: readonly string[];
}

/** Ordered changelog entries (newest release first). */
export const RELEASE_NOTES: readonly ReleaseNoteEntry[] = [
  {
    version: APP_VERSION,
    label: RELEASE_LABEL,
    date: '2026-11-27',
    summary:
      'Welcome to the very first public desktop playtest of PokéMart: Low Cortisol Shift! Open your doors, manage your pens, negotiate live at the counter, and explore all 493 Gen 1–4 companions.',
    highlights: [
      '493 Gen 1–4 PMD Species (#001 Bulbasaur → #493 Arceus) with grounded multi-frame pixel animations, shiny variants, and zero-404 sprite loading.',
      'Live-Clock Counter & Haggling: Serve 6 Human Trainer archetypes with zero auto-sales—accept, haggle (+15% / +30%), gift-wrap in specialty Poké Balls, or hire extra counter clerks to extend patience.',
      'Display Pens, Reserve Kennel & Resting Corner: Manage display pricing, nurse rescued strays back to health on plush nap beds, and pair compatible Egg Groups in the Breeding Incubator.',
      'Upgrades, Supplies & 493-Species Adoption Dex: Unlock extra pens, beds, incubators, and clerks; stock 9 Evolution Stones, Rare Candies, and care treats; and track Normal/Shiny discoveries.',
      'Interactive Manager’s Guide, Consolidated Volume & Adaptive BGM: Learn every mechanic in-app and enjoy zero-KB Web Audio Menu, Shop, and bittersweet Bankruptcy soundtracks.',
      'Isolated Local Save Profiles: Create multiple Relaxed, Standard, or High Stakes profiles with auto-save and checksum-verified Base64 Save Export/Import.',
    ],
  },
];

function resolveStorage(
  override?: Pick<Storage, 'getItem' | 'setItem'> | null,
): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the last seen release version from `localStorage`, returning `null` if unset or restricted. */
export function getSeenReleaseVersion(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): string | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    return store.getItem(SEEN_RELEASE_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns `true` when the player has not yet dismissed `currentVersion` (first launch
 * or after upgrading to a newer release version).
 */
export function shouldShowReleaseNotes(
  currentVersion: string = APP_VERSION,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): boolean {
  return getSeenReleaseVersion(storage) !== currentVersion;
}

/** Persists `version` in `localStorage` so the popup does not reopen until the next release bump. */
export function markReleaseNotesSeen(
  version: string = APP_VERSION,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(SEEN_RELEASE_VERSION_KEY, version);
  } catch {
    // Gracefully ignore QuotaExceededError / private-browsing storage restrictions
  }
}
