/**
 * Procedural cozy pixel-art shop background: back wall with wainscot, window,
 * pendant lamps, PokéMart counter, door + welcome mat, staggered oak plank floor,
 * straw-bedded display pens with wooden fences, and the plush nap corner.
 * Drawn once per layout into an offscreen layer, then blitted every frame.
 */
import { PALETTE, drawBitmap, fillPixelRoundRect, type PixelBitmap } from './pixelArt';
import type { PenRect, Rect, ShopLayout } from './types';

const POKE_BALL: PixelBitmap = ['.rrrr.', 'rrrrrr', 'kkwwkk', 'wwwwww', '.wwww.'];
const BALL_COLORS = { r: '#e04848', k: PALETTE.woodDeep, w: PALETTE.white };

/** Thin seam/line thickness (half an art pixel, at least 1 backing px). */
function seam(unit: number): number {
  return Math.max(1, Math.round(unit / 2));
}

/** Deterministic integer hash so straw speckles/grain never shimmer between redraws. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Staggered oak planks: alternating row tones, offset joints, and light grain flecks. */
export function drawPlankFloor(ctx: CanvasRenderingContext2D, area: Rect, unit: number): void {
  const plankH = unit * 6;
  const plankLen = unit * 28;
  const line = seam(unit);
  for (let row = 0, y = area.y; y < area.y + area.h; row += 1, y += plankH) {
    ctx.fillStyle = row % 2 === 0 ? '#c9a77d' : '#c3a074';
    ctx.fillRect(area.x, y, area.w, plankH);
    ctx.fillStyle = '#a98558';
    ctx.fillRect(area.x, y + plankH - line, area.w, line);
    // Joint offset shifts by 11 art px per row → classic staggered plank pattern.
    const offset = (row * 11 * unit) % plankLen;
    for (let jx = area.x - offset; jx < area.x + area.w; jx += plankLen) {
      if (jx > area.x) ctx.fillRect(jx, y, line, plankH);
    }
    ctx.fillStyle = '#b8956a';
    for (let gx = area.x + (hash(row) % 9) * unit; gx < area.x + area.w; gx += unit * 9) {
      ctx.fillRect(gx, y + unit * (1 + (hash(gx + row) % 3)), unit * 2, line);
    }
  }
}

function drawWall(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const { wall, unit: u, width } = layout;
  ctx.fillStyle = '#f3e6cc';
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

  // Dotted cream wallpaper.
  ctx.fillStyle = PALETTE.creamDeep;
  for (let row = 0, y = u * 4; y < wall.h - u * 12; row += 1, y += u * 6) {
    for (let x = row % 2 === 0 ? 0 : u * 4; x < width; x += u * 8) ctx.fillRect(x, y, u, u);
  }

  // Matcha wainscot with vertical beadboard stripes.
  const wainTop = wall.h - u * 11;
  ctx.fillStyle = PALETTE.sageLight;
  ctx.fillRect(0, wainTop, width, wall.h - wainTop);
  ctx.fillStyle = '#a3c493';
  for (let x = u * 2; x < width; x += u * 5) ctx.fillRect(x, wainTop + u * 2, seam(u), wall.h - wainTop - u * 3);
  ctx.fillStyle = PALETTE.sage;
  ctx.fillRect(0, wainTop, width, u);

  // Crown trim and baseboard.
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 0, width, u * 2);
  ctx.fillRect(0, wall.h - u * 2, width, u * 2);
}

function drawWindow(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const r = layout.window;
  const u = layout.unit;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(r.x + u, r.y + u, r.w - u * 2, r.h - u * 2);
  // Window cross.
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(r.x + Math.round(r.w / 2) - Math.round(u / 2), r.y, u, r.h);
  ctx.fillRect(r.x, r.y + Math.round(r.h / 2) - Math.round(u / 2), r.w, u);
  // Glass shine.
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(r.x + u * 2, r.y + u * 2, u * 2, u);
  ctx.fillRect(r.x + u * 2, r.y + u * 3, u, u);
  // Sill with two potted sprouts.
  ctx.fillStyle = PALETTE.honeyDeep;
  ctx.fillRect(r.x - u, r.y + r.h, r.w + u * 2, u * 2);
  for (const px of [r.x + u * 2, r.x + r.w - u * 5]) {
    ctx.fillStyle = PALETTE.sage;
    ctx.fillRect(px, r.y + r.h - u * 3, u * 3, u * 3);
    ctx.fillStyle = PALETTE.berry;
    ctx.fillRect(px + u, r.y + r.h - u * 4, u, u);
  }
}

function drawLamps(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const u = layout.unit;
  for (const lamp of layout.lamps) {
    ctx.fillStyle = PALETTE.woodDeep;
    ctx.fillRect(lamp.x - Math.floor(seam(u) / 2), 0, seam(u), lamp.y - u * 3);
    // Stepped trapezoid shade (4 → 6 → 8 art px wide).
    ctx.fillStyle = PALETTE.honey;
    ctx.fillRect(lamp.x - u * 2, lamp.y - u * 3, u * 4, u);
    ctx.fillRect(lamp.x - u * 3, lamp.y - u * 2, u * 6, u);
    ctx.fillRect(lamp.x - u * 4, lamp.y - u, u * 8, u);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(lamp.x - u, lamp.y, u * 2, u);
  }
}

function drawCounter(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const c = layout.counter;
  const u = layout.unit;
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(c.x, c.y + u * 2, c.w, c.h - u * 2);
  ctx.fillStyle = '#8a6744';
  for (let x = c.x + u * 8; x < c.x + c.w; x += u * 8) ctx.fillRect(x, c.y + u * 2, seam(u), c.h - u * 2);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(c.x - u, c.y, c.w + u * 2, u * 2);

  // Classic blue PokéMart plate on the counter front.
  const fontPx = Math.max(8, Math.round(u * 4));
  ctx.font = `bold ${fontPx}px "Trebuchet MS", sans-serif`;
  const label = 'PokéMart';
  const plateW = Math.min(c.w - u * 4, Math.ceil(ctx.measureText(label).width) + u * 4);
  const plateX = c.x + Math.round((c.w - plateW) / 2);
  const plateY = c.y + u * 4;
  ctx.fillStyle = '#3d7599';
  ctx.fillRect(plateX, plateY, plateW, u * 6);
  ctx.fillStyle = PALETTE.white;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, plateX + plateW / 2, plateY + u * 3, plateW - u * 2);
  ctx.textAlign = 'start';

  // Register and a display Poké Ball resting on the counter top.
  ctx.fillStyle = '#5c6b73';
  ctx.fillRect(c.x + u * 3, c.y - u * 6, u * 10, u * 6);
  ctx.fillStyle = PALETTE.honey;
  ctx.fillRect(c.x + u * 5, c.y - u * 5, u * 6, u * 2);
  drawBitmap(ctx, POKE_BALL, c.x + c.w - u * 9, c.y - u * 5, u, BALL_COLORS);
}

function drawDoor(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const d = layout.door;
  const u = layout.unit;
  ctx.fillStyle = PALETTE.woodDeep;
  ctx.fillRect(d.x - u, d.y - u, d.w + u * 2, d.h + u);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(d.x + u * 2, d.y + u * 2, d.w - u * 4, Math.round(d.h * 0.32));
  ctx.fillStyle = '#8a6744';
  ctx.fillRect(d.x + u * 2, d.y + Math.round(d.h * 0.78), d.w - u * 4, seam(u));
  ctx.fillStyle = PALETTE.honey;
  ctx.fillRect(d.x + u * 2, d.y + Math.round(d.h * 0.62), u * 2, u * 2);
  // Welcome mat just inside the door, on the floor.
  ctx.fillStyle = PALETTE.berry;
  ctx.fillRect(d.x - u * 2, layout.wall.h + u, d.w + u * 4, u * 3);
  ctx.fillStyle = PALETTE.berryLight;
  ctx.fillRect(d.x, layout.wall.h + u * 2, d.w, seam(u));
}

function drawPen(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
  const { inner } = pen;
  // Fence frame, then straw bedding inside it.
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(pen.x, pen.y, pen.w, pen.h);
  ctx.fillStyle = '#f6e2a6';
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);

  const speckles = Math.floor((inner.w * inner.h) / (u * u * 40));
  for (let i = 0; i < speckles; i += 1) {
    const h = hash(i * 7 + pen.index * 1013);
    const sx = inner.x + (h % Math.max(1, inner.w - u * 2));
    const sy = inner.y + ((h >>> 11) % Math.max(1, inner.h - u));
    ctx.fillStyle = h % 3 === 0 ? '#d9b257' : '#e7c46b';
    ctx.fillRect(sx, sy, u * 2, seam(u));
  }
  // Soft shade under the back rail.
  ctx.fillStyle = 'rgba(186, 124, 24, 0.18)';
  ctx.fillRect(inner.x, inner.y, inner.w, u * 2);

  // Rail highlights and fence posts.
  ctx.fillStyle = '#b48d63';
  ctx.fillRect(pen.x, pen.y + u, pen.w, seam(u));
  ctx.fillRect(pen.x, pen.y + pen.h - u * 2, pen.w, seam(u));
  ctx.fillStyle = PALETTE.woodDark;
  const post = u * 3;
  const step = u * 14;
  for (let x = pen.x; x <= pen.x + pen.w - post; x += step) {
    ctx.fillRect(x, pen.y, post, post);
    ctx.fillRect(x, pen.y + pen.h - post, post, post);
  }
  for (let y = pen.y; y <= pen.y + pen.h - post; y += step) {
    ctx.fillRect(pen.x, y, post, post);
    ctx.fillRect(pen.x + pen.w - post, y, post, post);
  }
  ctx.fillRect(pen.x + pen.w - post, pen.y, post, post);
  ctx.fillRect(pen.x + pen.w - post, pen.y + pen.h - post, post, post);

  // Wooden name plate.
  const fontPx = Math.max(8, Math.round(u * 4));
  ctx.font = `bold ${fontPx}px "Trebuchet MS", sans-serif`;
  const label = `Pen ${pen.index + 1}`;
  const plateW = Math.ceil(ctx.measureText(label).width) + u * 4;
  const plateX = inner.x + u * 2;
  const plateY = inner.y + u * 2;
  ctx.fillStyle = PALETTE.woodDark;
  fillPixelRoundRect(ctx, plateX - seam(u), plateY - seam(u), plateW + seam(u) * 2, u * 6 + seam(u) * 2, u);
  ctx.fillStyle = PALETTE.cream;
  fillPixelRoundRect(ctx, plateX, plateY, plateW, u * 6, u);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, plateX + u * 2, plateY + u * 3);
}

function drawBed(ctx: CanvasRenderingContext2D, bed: Rect, u: number): void {
  ctx.fillStyle = PALETTE.berry;
  fillPixelRoundRect(ctx, bed.x, bed.y, bed.w, bed.h, u * 2);
  ctx.fillStyle = PALETTE.berryLight;
  fillPixelRoundRect(ctx, bed.x + u, bed.y + u, bed.w - u * 2, bed.h - u * 2, u * 2);
  ctx.fillStyle = PALETTE.cream;
  fillPixelRoundRect(ctx, bed.x + u * 3, bed.y + u * 2, bed.w - u * 6, Math.round(bed.h * 0.3), u);
  // Honey quilt band with stitch dots.
  const quiltY = bed.y + Math.round(bed.h * 0.64);
  ctx.fillStyle = '#f4d58a';
  ctx.fillRect(bed.x + u, quiltY, bed.w - u * 2, u * 2);
  ctx.fillStyle = '#e9a3ad';
  for (let x = bed.x + u * 3; x < bed.x + bed.w - u * 2; x += u * 4) ctx.fillRect(x, quiltY + u * 3, u, u);
}

function drawNapCorner(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const a = layout.napArea;
  const u = layout.unit;
  ctx.fillStyle = '#e8f1e2';
  fillPixelRoundRect(ctx, a.x, a.y, a.w, a.h, u * 2);
  // Stitched rug border.
  ctx.fillStyle = PALETTE.sageLight;
  for (let x = a.x + u * 2; x < a.x + a.w - u * 2; x += u * 4) {
    ctx.fillRect(x, a.y + u, u * 2, seam(u));
    ctx.fillRect(x, a.y + a.h - u - seam(u), u * 2, seam(u));
  }
  for (let y = a.y + u * 2; y < a.y + a.h - u * 2; y += u * 4) {
    ctx.fillRect(a.x + u, y, seam(u), u * 2);
    ctx.fillRect(a.x + a.w - u - seam(u), y, seam(u), u * 2);
  }
  const fontPx = Math.max(8, Math.round(u * 4.5));
  ctx.font = `bold ${fontPx}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = '#2f4f2e';
  ctx.textBaseline = 'middle';
  ctx.fillText('Nap Corner', a.x + u * 4, a.y + Math.round((layout.beds[0]?.y ?? a.y + u * 10) - a.y) / 2);
  for (const bed of layout.beds) drawBed(ctx, bed, u);
}

/** Paints the full static background for a layout. */
export function drawBackground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  ctx.imageSmoothingEnabled = false;
  drawPlankFloor(ctx, { x: 0, y: layout.wall.h, w: layout.width, h: layout.height - layout.wall.h }, layout.unit);
  drawWall(ctx, layout);
  drawWindow(ctx, layout);
  drawLamps(ctx, layout);
  drawCounter(ctx, layout);
  drawDoor(ctx, layout);
  for (const pen of layout.pens) drawPen(ctx, pen, layout.unit);
  drawNapCorner(ctx, layout);
}

/**
 * Renders the static background into an offscreen canvas once per layout, so each
 * animation frame is a single `drawImage` blit plus the moving entities.
 * Returns `null` when no 2D context is available (the renderer then draws inline).
 */
export function buildBackgroundLayer(layout: ShopLayout): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const layer = document.createElement('canvas');
  layer.width = layout.width;
  layer.height = layout.height;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  drawBackground(ctx, layout);
  return layer;
}
