/**
 * Hybrid PMDCollab / SpriteCollab loader with zero-404 availability gating.
 *
 * Asset lookup priority:
 * 1. Bundled local core assets (`./assets/pmd/{paddedId}/...`) listed in `pmdCoreManifest.json`
 *    for instant offline boot (Kecleon clerk + 12 PMD shoppers + starter mascots).
 * 2. Browser Cache API (`pokemart-pmd-v2`) for cached remote GitHub Raw responses.
 * 3. On-demand GitHub Raw fetches (`crossOrigin = "anonymous"`) for all 493 Gen 1–4
 *    species + shiny `0000/0001/` variants, gated by `species.pmdAnims` from `tracker.json`
 *    so missing sheets are never requested.
 */
import rawCoreManifest from '../data/pmdCoreManifest.json';
import { getSpecies } from '../data/species';
import type { PmdAnimKey } from '../data/types';
import {
  computePmdFrameRect,
  parseAnimDataXml,
  type ParsedAnimData,
  type PmdAnimDefinition,
} from './pmdAnimator';
import type { PmdDirection, PokemonAnimState, SpriteEntityAdapter, SpriteFrame } from './types';

export const SPRITECOLLAB_RAW_BASE =
  'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const PMD_CACHE_NAME = 'pokemart-pmd-v2';

interface CoreManifestEntry {
  anims: string[];
  portrait: boolean;
}

const CORE_MANIFEST = rawCoreManifest as Record<string, CoreManifestEntry>;

/** Maps entity animation state to preferred PMD sheet lookup order. */
export const STATE_ANIM_PRIORITY: Record<PokemonAnimState, PmdAnimKey[]> = {
  hop: ['Hop', 'Idle', 'Walk'],
  sleep: ['Sleep', 'Idle', 'Walk'],
  idle: ['Idle', 'Walk'],
  walk: ['Walk', 'Idle'],
};

/**
 * Selects the best available PMD sheet (`Walk` | `Idle` | `Sleep` | `Hop`) and
 * whether to pull from the shiny subfolder (`0000/0001/`) based on `tracker.json`
 * availability metadata, guaranteeing zero 404 requests.
 */
export function resolvePmdSheetSpec(
  speciesId: number,
  isShiny: boolean,
  state: PokemonAnimState,
): { animKey: PmdAnimKey; useShinyFolder: boolean } {
  const species = getSpecies(speciesId);
  const candidates = STATE_ANIM_PRIORITY[state] ?? ['Idle', 'Walk'];

  if (isShiny && species.pmdAnims.shiny.length > 0) {
    for (const animKey of candidates) {
      if (species.pmdAnims.shiny.includes(animKey)) {
        return { animKey, useShinyFolder: true };
      }
    }
  }

  for (const animKey of candidates) {
    if (species.pmdAnims.normal.includes(animKey)) {
      return { animKey, useShinyFolder: false };
    }
  }

  return { animKey: 'Walk', useShinyFolder: false };
}

/**
 * Resolves the portrait URL for a species (local core asset first when normal &
 * bundled, else remote PMD SpriteCollab portrait respecting shiny availability).
 */
export function getPmdPortraitUrl(speciesId: number, isShiny = false): string {
  const species = getSpecies(speciesId);
  const padded = species.paddedId;
  const local = CORE_MANIFEST[padded];

  if (!isShiny && local?.portrait) {
    return `./assets/pmd/${padded}/Normal.png`;
  }
  if (isShiny && species.pmdAnims.shinyPortrait) {
    return `${SPRITECOLLAB_RAW_BASE}/portrait/${padded}/0000/0001/Normal.png`;
  }
  return `${SPRITECOLLAB_RAW_BASE}/portrait/${padded}/Normal.png`;
}

/** Resolves the URL for a species' `AnimData.xml` (bundled local or remote). */
export function getPmdAnimXmlUrl(speciesId: number): string {
  const padded = getSpecies(speciesId).paddedId;
  if (CORE_MANIFEST[padded]) {
    return `./assets/pmd/${padded}/AnimData.xml`;
  }
  return `${SPRITECOLLAB_RAW_BASE}/sprite/${padded}/AnimData.xml`;
}

/** Resolves the URL for an animation sheet PNG (bundled local or remote). */
export function getPmdSheetUrl(
  speciesId: number,
  animName: string,
  useShinyFolder: boolean,
): string {
  const padded = getSpecies(speciesId).paddedId;
  const local = CORE_MANIFEST[padded];
  if (!useShinyFolder && local?.anims.includes(animName)) {
    return `./assets/pmd/${padded}/${animName}-Anim.png`;
  }
  const folder = useShinyFolder ? `${padded}/0000/0001` : padded;
  return `${SPRITECOLLAB_RAW_BASE}/sprite/${folder}/${animName}-Anim.png`;
}

async function fetchWithCache(url: string): Promise<Response> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(PMD_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) return cached;
      const fresh = await fetch(url, { mode: 'cors' });
      if (fresh.ok) {
        await cache.put(url, fresh.clone());
      }
      return fresh;
    } catch {
      // Cache API may be restricted in non-HTTPS or sandboxed frames; fall through to fetch
    }
  }
  return fetch(url, { mode: 'cors' });
}

const FALLBACK_IDLE_ANIM: PmdAnimDefinition = {
  name: 'Idle',
  sourceAnim: 'Idle',
  frameWidth: 32,
  frameHeight: 32,
  durations: [10],
  totalTicks: 10,
};

/**
 * Creates a cached, non-blocking PMD `SpriteEntityAdapter` for the HTML5 Canvas.
 * Requests `AnimData.xml` + spritesheets once per URL, caches parsed XML and decoded
 * `HTMLImageElement` objects in memory + Cache API, and returns `null` while loading
 * so the renderer never blocks or throws.
 */
export function createPmdSpriteAdapter(): SpriteEntityAdapter {
  const animDataCache = new Map<number, ParsedAnimData>();
  const animLoading = new Set<number>();
  const sheetCache = new Map<string, HTMLImageElement>();
  const failedUrls = new Set<string>();

  const ensureAnimData = (speciesId: number) => {
    if (animDataCache.has(speciesId) || animLoading.has(speciesId)) return;
    if (typeof fetch === 'undefined') return;
    animLoading.add(speciesId);

    const url = getPmdAnimXmlUrl(speciesId);
    fetchWithCache(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((xml) => {
        animDataCache.set(speciesId, parseAnimDataXml(xml));
      })
      .catch(() => {
        // Fallback so we don't retry failing XML fetches in a tight loop
        animDataCache.set(speciesId, { shadowSize: 1, anims: {} });
      })
      .finally(() => {
        animLoading.delete(speciesId);
      });
  };

  const ensureSheetImage = (url: string): HTMLImageElement | null => {
    if (typeof Image === 'undefined' || failedUrls.has(url)) return null;
    let img = sheetCache.get(url);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onerror = () => {
        failedUrls.add(url);
      };
      img.src = url;
      sheetCache.set(url, img);
    }
    if (!img.complete || img.naturalWidth === 0) return null;
    return img;
  };

  return {
    getFrame(
      speciesId: number,
      isShiny: boolean,
      state: PokemonAnimState,
      timeSec: number,
      direction: PmdDirection = 0,
    ): SpriteFrame | null {
      ensureAnimData(speciesId);
      const parsed = animDataCache.get(speciesId);
      if (!parsed) return null;

      const { animKey, useShinyFolder } = resolvePmdSheetSpec(speciesId, isShiny, state);
      const animDef =
        parsed.anims[animKey] ??
        parsed.anims.Idle ??
        parsed.anims.Walk ??
        FALLBACK_IDLE_ANIM;

      const sheetUrl = getPmdSheetUrl(speciesId, animDef.sourceAnim, useShinyFolder);
      const img = ensureSheetImage(sheetUrl);
      if (!img) return null;

      const slice = computePmdFrameRect(
        animDef,
        img.naturalWidth,
        img.naturalHeight,
        direction,
        timeSec,
      );

      return {
        image: img,
        sx: slice.sx,
        sy: slice.sy,
        sw: slice.sw,
        sh: slice.sh,
        usesDirectionRow: true,
        facesLeft: true,
      };
    },
  };
}
