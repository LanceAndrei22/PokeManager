/**
 * 4-directional Human Trainer overworld spritesheet loader and frame slicer.
 *
 * Uses bundled Gen 3/4 style 64×128 RGBA sheets (`4 cols × 4 rows` of `16×32`
 * normalized during `scripts/fetch-world-assets.mjs`):
 * - Row 0 = facing South (`down`)
 * - Row 1 = facing North (`up`)
 * - Row 2 = facing West (`left`)
 * - Row 3 = facing East (`right`)
 */
import { ALL_HUMAN_NPCS } from '../data/npcs';

/** 4-way cardinal facing direction for Gen 3/4 Human Trainer overworld sheets. */
export type CardinalDirection = 'down' | 'up' | 'left' | 'right';

/** Drawable slice extracted from a loaded Human Trainer spritesheet. */
export interface HumanNpcFrame {
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  frameCol: number;
  row: number;
}

const DIRECTION_ROW: Record<CardinalDirection, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};

const WALK_SEQUENCE = [0, 1, 2, 3] as const;

const sheetCache = new Map<string, HTMLImageElement>();
const failedNpcIds = new Set<string>();

/**
 * Converts a 2D motion delta `(dx, dy)` into the dominant 4-way cardinal facing
 * direction (`down`, `up`, `left`, `right`).
 */
export function vectorToCardinalDirection(
  dx: number,
  dy: number,
  fallback: CardinalDirection = 'down',
  threshold = 0.2,
): CardinalDirection {
  if (Math.hypot(dx, dy) < threshold) {
    return fallback;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'down' : 'up';
}

/**
 * Computes `(col, row)` indices for a 4×4 Human Trainer spritesheet given
 * cardinal direction, walking state, and total walked distance in pixels.
 */
export function computeHumanNpcCell(
  direction: CardinalDirection,
  isWalking: boolean,
  walkDistancePx: number,
): { col: number; row: number } {
  const row = DIRECTION_ROW[direction] ?? 0;
  if (!isWalking) {
    return { col: 0, row };
  }
  const safeDist = Number.isFinite(walkDistancePx) ? Math.max(0, walkDistancePx) : 0;
  const step = Math.floor(safeDist / 12) % WALK_SEQUENCE.length;
  return { col: WALK_SEQUENCE[step], row };
}

/** Preloads a single Human Trainer spritesheet (`./assets/npcs/overworld/${npcId}.png`). */
export function preloadHumanNpcSheet(npcId: string): HTMLImageElement | null {
  if (!npcId || typeof Image === 'undefined' || failedNpcIds.has(npcId)) {
    return null;
  }
  let img = sheetCache.get(npcId);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onerror = () => {
      failedNpcIds.add(npcId);
    };
    img.src = `./assets/npcs/overworld/${npcId}.png`;
    sheetCache.set(npcId, img);
  }
  if (!img.complete || img.naturalWidth === 0) {
    return null;
  }
  return img;
}

/** Preloads all 16 bundled Human Trainer overworld spritesheets. */
export function preloadAllHumanNpcs(): void {
  for (const npc of ALL_HUMAN_NPCS) {
    preloadHumanNpcSheet(npc.id);
  }
}

/**
 * Returns the exact source frame rectangle for a Human Trainer NPC, or `null`
 * cleanly if the sheet is still loading or running in headless/jsdom mode.
 */
export function getHumanNpcFrame(
  npcId: string,
  direction: CardinalDirection,
  isWalking: boolean,
  walkDistancePx: number,
): HumanNpcFrame | null {
  const img = preloadHumanNpcSheet(npcId);
  if (!img) return null;

  const cols = 4;
  const rows = 4;
  const sw = Math.max(1, Math.floor(img.naturalWidth / cols));
  const sh = Math.max(1, Math.floor(img.naturalHeight / rows));
  const { col, row } = computeHumanNpcCell(direction, isWalking, walkDistancePx);

  return {
    image: img,
    sx: col * sw,
    sy: row * sh,
    sw,
    sh,
    frameCol: col,
    row,
  };
}
