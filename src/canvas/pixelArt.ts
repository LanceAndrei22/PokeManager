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

export const SWEAT_DROP: PixelBitmap = ['..b..', '.bbb.', '.bwb.', 'bbwbb', '.bbb.'];

export const EXCLAMATION_MARK: PixelBitmap = ['kk', 'kk', 'kk', '..', 'kk'];

export const EGG_ICON: PixelBitmap = [
  '..cccc..',
  '.ccyycc.',
  'ccyccycc',
  'ccccsscc',
  'ccsscccc',
  '.cccccc.',
  '..cccc..',
];

export const PC_ICON: PixelBitmap = [
  'bbbbbbbb',
  'bccccccb',
  'bcwwwwcb',
  'bccccccb',
  'bbbbbbbb',
  '..bbbb..',
  '.bbbbbb.',
];

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
  b: '#3b82f6',
  k: '#1b1200',
  c: '#78e0ff',
  s: '#6ee7a0',
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

/**
 * Crisp grounded pixel-oval contact shadow tucked tightly underneath a sprite's feet.
 * Uses a dark translucent charcoal-olive tint (`#0b1610`) with a soft outer rim and
 * denser inner core so characters look physically planted on both grass and floor tiles.
 */
export function drawPixelShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  unit: number,
  alpha = 0.34,
): void {
  const u = Math.max(1, Math.round(unit));
  const w = Math.max(u * 5, Math.round(width / u) * u);
  const x = Math.round(cx - w / 2);
  // Anchor the oval centered directly at feetY (`cy`) with zero vertical float gap
  const y = Math.round(cy - u);

  // Soft outer pixel oval (4 art-pixel rows tall)
  ctx.fillStyle = `rgba(10, 18, 14, ${(alpha * 0.62).toFixed(3)})`;
  ctx.fillRect(x + u * 2, y - u, Math.max(u, w - u * 4), u);
  ctx.fillRect(x + u, y, Math.max(u, w - u * 2), u);
  ctx.fillRect(x, y + u, w, u);
  ctx.fillRect(x + u * 2, y + u * 2, Math.max(u, w - u * 4), u);

  // Denser inner contact core directly beneath the feet
  ctx.fillStyle = `rgba(8, 14, 10, ${(alpha * 0.58).toFixed(3)})`;
  ctx.fillRect(x + u * 2, y, Math.max(u, w - u * 4), u * 2);
}
