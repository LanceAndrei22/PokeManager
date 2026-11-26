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

/** Maps grounded entity animation state to preferred PMD sheet lookup order (no Hop). */
export const STATE_ANIM_PRIORITY: Record<PokemonAnimState, PmdAnimKey[]> = {
  sleep: ['Sleep', 'Idle', 'Walk'],
  idle: ['Idle', 'Walk'],
  walk: ['Walk', 'Idle'],
};

/** Cached opaque-pixel bounds for a PMD animation sheet frame so feet plant cleanly on shadows. */
export interface SpriteGroundMetrics {
  bottomPadPx: number;
  visibleWidthPx: number;
  visibleHeightPx: number;
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Inspects frame `(0, 0)` of a decoded PMD spritesheet once to find its exact lowest opaque
 * pixel (`bottomPadPx`) and visible body bounds. Falls back cleanly in jsdom/headless contexts.
 */
function measureSheetGroundMetrics(
  img: HTMLImageElement,
  sw: number,
  sh: number,
): SpriteGroundMetrics {
  const fallback: SpriteGroundMetrics = {
    bottomPadPx: Math.round(sh * 0.28),
    visibleWidthPx: Math.max(12, Math.round(sw * 0.56)),
    visibleHeightPx: Math.max(14, Math.round(sh * 0.56)),
  };
  if (typeof document === 'undefined' || sw <= 0 || sh <= 0) return fallback;

  try {
    if (!measureCanvas) {
      measureCanvas = document.createElement('canvas');
      measureCtx = measureCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!measureCanvas || !measureCtx) return fallback;
    if (measureCanvas.width < sw || measureCanvas.height < sh) {
      measureCanvas.width = Math.max(measureCanvas.width, sw);
      measureCanvas.height = Math.max(measureCanvas.height, sh);
    }
    measureCtx.clearRect(0, 0, sw, sh);
    measureCtx.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh);
    const data = measureCtx.getImageData(0, 0, sw, sh).data;

    let minX = sw;
    let maxX = -1;
    let minY = sh;
    let maxY = -1;
    for (let y = 0; y < sh; y += 1) {
      const rowOff = y * sw * 4;
      for (let x = 0; x < sw; x += 1) {
        if (data[rowOff + x * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return fallback;

    // Cap bottomPad at 44% of frame height so standing Pokémon plant feet squarely on their
    // shadow while naturally high-floating sprites (e.g. Gastly) keep subtle native levitation.
    const rawBottomPad = sh - 1 - maxY;
    return {
      bottomPadPx: Math.min(rawBottomPad, Math.floor(sh * 0.44)),
      visibleWidthPx: Math.max(10, maxX - minX + 1),
      visibleHeightPx: Math.max(12, maxY - minY + 1),
    };
  } catch {
    return fallback;
  }
}

/**
 * Selects the best available grounded PMD sheet (`Walk` | `Idle` | `Sleep`) and
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
  const metricsCache = new Map<string, SpriteGroundMetrics>();
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

      const metricsKey = `${sheetUrl}:${slice.sw}x${slice.sh}`;
      let metrics = metricsCache.get(metricsKey);
      if (!metrics) {
        metrics = measureSheetGroundMetrics(img, slice.sw, slice.sh);
        metricsCache.set(metricsKey, metrics);
      }

      return {
        image: img,
        sx: slice.sx,
        sy: slice.sy,
        sw: slice.sw,
        sh: slice.sh,
        bottomPadPx: metrics.bottomPadPx,
        visibleWidthPx: metrics.visibleWidthPx,
        visibleHeightPx: metrics.visibleHeightPx,
        usesDirectionRow: true,
        facesLeft: true,
      };
    },
  };
}
