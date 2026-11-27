/**
 * Shared indoor Gen 4 PokéMart renderer constants, pixel bitmaps, color palettes,
 * and low-level drawing primitives (`seam`, `tileImageRect`).
 *
 * Leaf module imported by `indoorArchitecture.ts`, `indoorStations.ts`,
 * `indoorEntities.ts`, `indoorRenderer.ts`, and `tiles.ts` (zero upward dependencies).
 */
import type { CustomerArchetypeId } from '../data/types';
import {
  COIN,
  HEART,
  PALETTE,
  SPARKLE,
  STAR,
  type PixelBitmap,
} from './pixelArt';
import type { CanvasHitTarget, Rect } from './types';

/** Per-frame options passed from `ShopCanvas`. */
export interface IndoorRenderOptions {
  shiftRunning: boolean;
  shiftTick?: number;
  shiftDurationTicks?: number;
  shopkeepers?: string[];
  hoverTarget: CanvasHitTarget | null;
}

/** Fallback shirt colors per shopper archetype when sprite sheets are still loading. */
export const ARCHETYPE_SHIRTS: Record<CustomerArchetypeId, string> = {
  normal: '#5c8ed6',
  'cozy-collector': PALETTE.berry,
  'bargain-browser': PALETTE.sage,
  'trend-fan': PALETTE.honeyDeep,
  'shiny-seeker': PALETTE.lavender,
  'vip-seeker': '#7c3aed',
};

/** Overhead browsing thought-bubble icon per shopper archetype. */
export const BUBBLE_ICONS: Record<CustomerArchetypeId, PixelBitmap> = {
  normal: COIN,
  'cozy-collector': HEART,
  'bargain-browser': COIN,
  'trend-fan': STAR,
  'shiny-seeker': SPARKLE,
  'vip-seeker': SPARKLE,
};

/** Fallback hair color palette for procedural human sprites. */
export const HAIR_COLORS = ['#3c2918', '#7a4a2a', '#c27c3e', '#2f3a56', '#8e5b9a', '#d9a441'];

/** Miniature 6×5 Poké Ball pixel bitmap (display stand & loading placeholder). */
export const POKE_BALL: PixelBitmap = ['.rrrr.', 'rrrrrr', 'kkwwkk', 'wwwwww', '.wwww.'];

/** Left half of the frosted sliding-door Poké Ball decal. */
export const POKE_BALL_LEFT: PixelBitmap = ['.rr', 'rrr', 'kkw', 'www', '.ww'];

/** Right half of the frosted sliding-door Poké Ball decal. */
export const POKE_BALL_RIGHT: PixelBitmap = ['rr.', 'rrr', 'wkk', 'www', 'ww.'];

/** Canonical single source of truth for Poké Ball pixel bitmap colors across `src/canvas/`. */
export const BALL_COLORS = { r: '#e04848', k: '#1c2436', w: '#f7fafc' } as const;

/** Compact golden hover selection caret drawn above hovered Pokémon. */
export const HOVER_CARET: PixelBitmap = ['yyyyy', '.yyy.', '..y..'];

/** Crisp 12×20 transparent-background potted indoor ficus in a warm terracotta planter. */
export const POTTED_PLANT_BITMAP: PixelBitmap = [
  '....oooo....',
  '...ollllo...',
  '..ollggllo..',
  '.ollggggllo.',
  '.olggddgglo.',
  'oolggddggloo',
  'olggddddgglo',
  '.oggddddggo.',
  '..ooddddoo..',
  '...oogddo...',
  '....oddo....',
  '..oooooooo..',
  '.orrrrrrrro.',
  '.orpppppppo.',
  '..osssssso..',
  '..oppppbpo..',
  '..opppbbpo..',
  '...oppbbo...',
  '...opbbbo...',
  '....oooo....',
];

/** Color lookup map for `POTTED_PLANT_BITMAP`. */
export const POTTED_PLANT_COLORS: Record<string, string> = {
  o: '#1a2b1f',
  l: '#78d45c',
  g: '#3ea342',
  d: '#246b31',
  r: '#df9d6c',
  p: '#bd6d42',
  b: '#8e4b2a',
  s: '#4e301d',
};

/** Thin pixel seam/stroke thickness (half an art pixel, at least 1 backing px). */
export function seam(unit: number): number {
  return Math.max(1, Math.round(unit / 2));
}

/** Tiles a sprite cleanly within `rect`, clipping overflow pixels at boundaries. */
export function tileImageRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: Rect,
  tileW: number,
  tileH: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  for (let y = rect.y; y < rect.y + rect.h; y += tileH) {
    for (let x = rect.x; x < rect.x + rect.w; x += tileW) {
      ctx.drawImage(img, Math.round(x), Math.round(y), tileW, tileH);
    }
  }
  ctx.restore();
}
