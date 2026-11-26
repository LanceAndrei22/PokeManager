/**
 * Tiny procedural pixel-art bitmaps (hearts, stars, coins, sparkles, Z, shoppers)
 * plus crisp drawing helpers that paint them as `unit`-sized squares — no image
 * assets and no anti-aliasing.
 */

/** Row strings; `.` is transparent, other characters index a palette. */
export type PixelBitmap = readonly string[];

export const HEART: PixelBitmap = [
  '.rr.rr.',
  'rrrrrrr',
  'rrrwrrr',
  '.rrrrr.',
  '..rrr..',
  '...r...',
];

export const STAR: PixelBitmap = [
  '...y...',
  '..yyy..',
  'yyyyyyy',
  '.yyyyy.',
  '.yy.yy.',
  'y.....y',
];

export const COIN: PixelBitmap = [
  '..ooo..',
  '.oyyyo.',
  'oyyoyyo',
  'oyyoyyo',
  '.oyyyo.',
  '..ooo..',
];

export const SPARKLE: PixelBitmap = [
  '...y...',
  '..yyy..',
  'yyywyyy',
  '..yyy..',
  '...y...',
];

export const LETTER_Z: PixelBitmap = ['zzzz', '...z', '..z.', '.z..', 'zzzz'];

/**
 * Left-facing shopper, 8×15 art pixels, two walk frames (only the legs differ).
 * h = hair, s = skin, e = eye, c = shirt (archetype colour), p = pants, b = shoes.
 */
const SHOPPER_TOP: PixelBitmap = [
  '..hhhh..',
  '.hhhhhh.',
  '.hhhhhhh',
  '.seshhhh',
  '.sssshh.',
  '..ssss..',
  '.cccccc.',
  'cccccccc',
  'sccccccs',
  'sccccccs',
  '.cccccc.',
  '.pppppp.',
];

export const SHOPPER_FRAMES: readonly PixelBitmap[] = [
  [...SHOPPER_TOP, '.pp..pp.', '.pp..pp.', '.bb..bb.'],
  [...SHOPPER_TOP, '.pp..pp.', 'pp....pp', 'bb....bb'],
];

/** Shared Gen 4 cozy palette used by bitmaps and the renderer. */
export const PALETTE = {
  cream: '#fdf9f0',
  creamDeep: '#eedec1',
  wood: '#9d7952',
  woodDark: '#6b4e31',
  woodDeep: '#3c2918',
  sage: '#527c4f',
  sageLight: '#b7d2aa',
  honey: '#efc15a',
  honeyDeep: '#ba7c18',
  berry: '#d16878',
  berryLight: '#fce7ea',
  lavender: '#6a5ca5',
  sky: '#cfe5f2',
  white: '#ffffff',
  skin: '#f2c9a0',
} as const;

/** Default colour mapping for the icon bitmaps above. */
export const ICON_COLORS: Record<string, string> = {
  r: PALETTE.berry,
  w: PALETTE.white,
  y: PALETTE.honey,
  o: PALETTE.honeyDeep,
  z: PALETTE.lavender,
};

/** Bitmap dimensions in art pixels. */
export function bitmapSize(bitmap: PixelBitmap): { w: number; h: number } {
  return { w: bitmap.reduce((m, row) => Math.max(m, row.length), 0), h: bitmap.length };
}

/**
 * Paints a bitmap with its top-left at (x, y); each art pixel is a `unit`×`unit` square.
 * Coordinates are rounded to whole backing pixels to stay crisp.
 */
export function drawBitmap(
  ctx: CanvasRenderingContext2D,
  bitmap: PixelBitmap,
  x: number,
  y: number,
  unit: number,
  colors: Record<string, string>,
): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  for (let row = 0; row < bitmap.length; row += 1) {
    const line = bitmap[row];
    for (let col = 0; col < line.length; col += 1) {
      const color = colors[line[col]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + col * unit, oy + row * unit, unit, unit);
    }
  }
}

/** Pixel-style rounded rectangle: a plus-shape with `unit`-sized corners trimmed. */
export function fillPixelRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  unit: number,
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  ctx.fillRect(rx + unit, ry, rw - unit * 2, rh);
  ctx.fillRect(rx, ry + unit, rw, rh - unit * 2);
}

/** Flat pixel shadow ellipse approximated with three stacked bars. */
export function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  unit: number,
  alpha = 0.22,
): void {
  const w = Math.max(unit * 2, Math.round(width / unit) * unit);
  ctx.fillStyle = `rgba(60, 41, 24, ${alpha})`;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - unit);
  ctx.fillRect(x + unit, y - unit, w - unit * 2, unit);
  ctx.fillRect(x, y, w, unit);
  ctx.fillRect(x + unit, y + unit, w - unit * 2, unit);
}
