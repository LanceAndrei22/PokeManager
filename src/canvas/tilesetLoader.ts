/**
 * Preloader and image cache for bundled PokéMart outdoor & indoor GBA tilesets
 * and cohesive Pet Shop furniture props under `public/assets/tiles/`.
 */

export const OUTDOOR_TILE_NAMES = [
  'grass',
  'grass-tuft',
  'flowers',
  'path',
  'water',
  'fence',
  'signpost',
  'tree',
  'pokemart-building',
] as const;

export const INDOOR_TILE_NAMES = [
  'floor-tile',
  'wall-tile',
  'clock-wall',
  'counter-left',
  'counter-mid',
  'counter-right',
  'shelf-blue',
  'plant-pot',
  'mat',
  'door-closed',
  'door-open',
  'pc-terminal',
  'pen-grass',
  'pen-fence',
  'healing-rug',
  'healing-bed',
  'incubator-pod',
  'upgrades-board',
] as const;

export type TileCategory = 'outdoor' | 'indoor';
export type OutdoorTileName = (typeof OUTDOOR_TILE_NAMES)[number];
export type IndoorTileName = (typeof INDOOR_TILE_NAMES)[number];

const tileCache = new Map<string, HTMLImageElement>();
const failedTiles = new Set<string>();
const updateListeners = new Set<() => void>();
let preloadPromise: Promise<void> | null = null;

function tileKey(category: TileCategory, name: string): string {
  return `${category}/${name}`;
}

function notifyListeners(): void {
  for (const cb of updateListeners) {
    cb();
  }
}

function loadTileImage(category: TileCategory, name: string): Promise<void> {
  const key = tileKey(category, name);
  if (typeof Image === 'undefined' || failedTiles.has(key)) {
    return Promise.resolve();
  }
  const existing = tileCache.get(key);
  if (existing) {
    return existing.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => resolve(), { once: true });
        });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      notifyListeners();
      resolve();
    };
    img.onerror = () => {
      failedTiles.add(key);
      resolve();
    };
    img.src = `./assets/tiles/${category}/${name}.png`;
    tileCache.set(key, img);
  });
}

/**
 * Registers a callback notified when newly decoded tile PNGs become ready so
 * offscreen background canvases can rebuild immediately.
 */
export function onTilesetUpdate(cb: () => void): () => void {
  updateListeners.add(cb);
  return () => {
    updateListeners.delete(cb);
  };
}

/** Preloads all outdoor and indoor tile images once and caches them in memory. */
export function preloadTilesets(): Promise<void> {
  if (typeof Image === 'undefined') {
    return Promise.resolve();
  }
  if (!preloadPromise) {
    const jobs: Promise<void>[] = [
      ...OUTDOOR_TILE_NAMES.map((name) => loadTileImage('outdoor', name)),
      ...INDOOR_TILE_NAMES.map((name) => loadTileImage('indoor', name)),
    ];
    preloadPromise = Promise.all(jobs).then(() => undefined);
  }
  return preloadPromise;
}

/** Returns a decoded tile `HTMLImageElement`, or `null` while loading / in jsdom. */
export function getTileImage(category: TileCategory, name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const key = tileKey(category, name);
  if (failedTiles.has(key)) return null;

  let img = tileCache.get(key);
  if (!img) {
    void loadTileImage(category, name);
    img = tileCache.get(key);
  }
  if (!img || !img.complete || img.naturalWidth === 0) {
    return null;
  }
  return img;
}

/** Returns true once at least the core indoor floor & outdoor grass tiles have decoded. */
export function areTilesReady(): boolean {
  return Boolean(getTileImage('indoor', 'floor-tile') && getTileImage('outdoor', 'grass'));
}
