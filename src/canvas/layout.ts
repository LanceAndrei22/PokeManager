/**
 * Pure shop floor geometry: converts a CSS width, pen count, nap-bed count, and
 * devicePixelRatio into backing-store rectangles for the wall, pens, nap corner,
 * customer routes, and integer sprite scaling. No DOM access, so it is unit-testable.
 */
import type { PenRect, Point, Rect, ShopLayout } from './types';

/** Layout constants in CSS pixels (converted to backing px via DPR). */
export const FLOOR_CSS = {
  padding: 10,
  wallHeight: 66,
  penHeight: 138,
  gap: 12,
  napHeight: 100,
  /** Below this CSS width the floor uses 2 pen columns instead of 3. */
  mobileBreakpoint: 560,
} as const;

/** Native edge length of Pokémon Platinum front sprites. */
export const SPRITE_SOURCE_SIZE = 80;

/** Clamps DPR to [1, 3] so huge zoom levels never allocate giant canvases. */
export function clampDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(3, Math.max(1, dpr));
}

/** Number of pen columns for a given CSS width (2 on phones, 3 on wider screens). */
export function getPenColumns(cssWidth: number, penCount: number): number {
  const maxCols = cssWidth < FLOOR_CSS.mobileBreakpoint ? 2 : 3;
  return Math.max(1, Math.min(maxCols, penCount));
}

/** Number of pen rows needed to fit `penCount` pens. */
export function getPenRows(cssWidth: number, penCount: number): number {
  return Math.max(1, Math.ceil(penCount / getPenColumns(cssWidth, penCount)));
}

/** Total CSS height of the floor canvas: wall + pen rows + nap corner + paddings. */
export function computeShopCssHeight(cssWidth: number, penCount: number): number {
  const rows = getPenRows(cssWidth, penCount);
  const { padding, wallHeight, penHeight, gap, napHeight } = FLOOR_CSS;
  return padding + wallHeight + gap + rows * penHeight + (rows - 1) * gap + gap + napHeight + padding;
}

/**
 * Computes the full floor layout in backing-store pixels.
 * Sprite scaling is snapped to an integer multiple of 80 px so each Platinum source
 * pixel becomes an exact k×k block — no blur and no uneven pixel columns.
 */
export function computeShopLayout(
  cssWidth: number,
  penCount: number,
  bedCount: number,
  rawDpr: number,
): ShopLayout {
  const dpr = clampDpr(rawDpr);
  const px = (css: number) => Math.round(css * dpr);
  const cols = getPenColumns(cssWidth, penCount);
  const rows = getPenRows(cssWidth, penCount);
  const cssHeight = computeShopCssHeight(cssWidth, penCount);

  const width = px(cssWidth);
  const height = px(cssHeight);
  // One procedural art pixel ≈ 2 CSS px, snapped to whole backing pixels.
  const unit = Math.max(2, Math.round(2 * dpr));
  const pad = px(FLOOR_CSS.padding);
  const gap = px(FLOOR_CSS.gap);

  const wall: Rect = { x: 0, y: 0, w: width, h: pad + px(FLOOR_CSS.wallHeight) };

  const doorW = px(34);
  const doorH = px(50);
  const door: Rect = { x: width - pad - px(10) - doorW, y: wall.h - doorH, w: doorW, h: doorH };

  const counterW = Math.min(px(130), Math.round(width * 0.28));
  const counter: Rect = { x: pad + px(6), y: wall.h - px(30), w: counterW, h: px(30) };

  const windowW = Math.min(px(120), Math.round(width * 0.22));
  const windowRect: Rect = {
    x: Math.round(width / 2 - windowW / 2),
    y: pad + px(8),
    w: windowW,
    h: px(30),
  };

  // Pens: equal-width columns separated by walkable gaps.
  const fence = unit * 3;
  const penTop = wall.h + gap;
  const penW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const penH = px(FLOOR_CSS.penHeight);
  const pens: PenRect[] = Array.from({ length: penCount }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = pad + col * (penW + gap);
    const y = penTop + row * (penH + gap);
    return {
      index,
      x,
      y,
      w: penW,
      h: penH,
      inner: { x: x + fence, y: y + fence, w: penW - fence * 2, h: penH - fence * 2 },
    };
  });

  // Integer sprite multiplier targeting ~64% of the pen interior height, never overflowing 92%.
  const innerH = penH - fence * 2;
  const maxFit = Math.floor((innerH * 0.92) / SPRITE_SOURCE_SIZE);
  const preferred = Math.round((innerH * 0.64) / SPRITE_SOURCE_SIZE);
  const spriteScale = Math.max(1, Math.min(maxFit, preferred));

  const napTop = penTop + rows * penH + (rows - 1) * gap + gap;
  const napArea: Rect = { x: pad, y: napTop, w: width - pad * 2, h: px(FLOOR_CSS.napHeight) };
  const labelH = px(20);
  const slots = Math.max(1, bedCount);
  const bedW = Math.min(px(132), Math.floor((napArea.w - gap * (slots + 1)) / slots));
  const bedH = napArea.h - labelH - px(8);
  const beds: Rect[] = Array.from({ length: bedCount }, (_, i) => ({
    x: napArea.x + gap + i * (bedW + gap),
    y: napArea.y + labelH,
    w: bedW,
    h: bedH,
  }));

  const aisleY = wall.h + Math.round(gap / 2);

  return {
    cssWidth,
    cssHeight,
    width,
    height,
    dpr,
    unit,
    spriteScale,
    spriteSize: SPRITE_SOURCE_SIZE * spriteScale,
    wall,
    door,
    doorSpot: { x: door.x + Math.round(door.w / 2), y: aisleY },
    counter,
    window: windowRect,
    aisleY,
    pens,
    napArea,
    beds,
    lamps: [
      { x: Math.round(width * 0.25), y: Math.round(wall.h * 0.4) },
      { x: Math.round(width * 0.75), y: Math.round(wall.h * 0.4) },
    ],
  };
}

/**
 * Feet-position bounds a Pokémon may wander to inside a pen. Horizontal margins keep
 * the visible part of the sprite (≈64% of its box) inside the fence; the top margin
 * keeps its head below the back rail. Collapses to a line/point in tiny pens.
 */
export function getPenWanderBounds(layout: ShopLayout, penIndex: number): Rect | null {
  const pen = layout.pens[penIndex];
  if (!pen) return null;
  const s = layout.spriteSize;
  const { inner } = pen;
  let minX = inner.x + s * 0.32;
  let maxX = inner.x + inner.w - s * 0.32;
  if (minX > maxX) minX = maxX = inner.x + inner.w / 2;
  const maxY = inner.y + inner.h - layout.unit;
  let minY = inner.y + s * 0.78;
  if (minY > maxY) minY = maxY;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Feet anchor for a sleeping Pokémon resting on a nap-bed pillow. */
export function getBedAnchor(layout: ShopLayout, bedIndex: number): Point | null {
  const bed = layout.beds[bedIndex];
  if (!bed) return null;
  return { x: bed.x + Math.round(bed.w / 2), y: bed.y + Math.round(bed.h * 0.86) };
}

/** Where the n-th browsing shopper stands: at the pen's front-right corner, side by side. */
export function getCustomerSpot(layout: ShopLayout, penIndex: number, visitorIndex: number): Point {
  const pen = layout.pens[penIndex] ?? layout.pens[0];
  if (!pen) return { ...layout.doorSpot };
  const u = layout.unit;
  const x = Math.max(pen.x + u * 6, pen.x + pen.w - u * 8 - visitorIndex * u * 10);
  return { x, y: pen.y + pen.h - Math.round(u * 1.5) };
}

/**
 * Builds a cozy walking route from the door to a pen spot: along the aisle under the
 * wall, down the walkway gap to the right of the target pen, then into the spot.
 * Walking the gaps keeps shoppers from striding straight through other pens.
 */
export function buildEntryRoute(layout: ShopLayout, penIndex: number, spot: Point): Point[] {
  const pen = layout.pens[penIndex] ?? layout.pens[0];
  const gapX = pen ? Math.min(layout.width - layout.unit, pen.x + pen.w + Math.round(layout.unit * 3)) : spot.x;
  const route: Point[] = [
    { ...layout.doorSpot },
    { x: gapX, y: layout.aisleY },
    { x: gapX, y: spot.y },
    { ...spot },
  ];
  return dedupePath(route);
}

/** Removes consecutive duplicate points so zero-length segments never divide by zero. */
export function dedupePath(path: Point[]): Point[] {
  return path.filter((p, i) => i === 0 || p.x !== path[i - 1].x || p.y !== path[i - 1].y);
}

/** Total polyline length of a path. */
export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

/** Point at normalized distance `t ∈ [0, 1]` along a polyline (constant walking speed). */
export function pointAlongPath(path: Point[], totalLength: number, t: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1 || totalLength <= 0) return { ...path[path.length - 1] };
  let remaining = Math.min(1, Math.max(0, t)) * totalLength;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const k = seg === 0 ? 1 : remaining / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remaining -= seg;
  }
  return { ...path[path.length - 1] };
}
