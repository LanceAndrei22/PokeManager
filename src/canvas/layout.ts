/**
 * Pure indoor PokéMart shop floor geometry: converts CSS dimensions, pen count,
 * nap-bed count, and devicePixelRatio into backing-store rectangles for both
 * full-viewport desktop landscape and adaptive mobile portrait rooms, plus integer
 * PMD sprite scaling and walkway routes. No DOM access, so it is 100% unit-testable.
 */
import type { PenRect, Point, Rect, ShopLayout } from './types';

/** Layout constants in CSS pixels (converted to backing px via DPR). */
export const FLOOR_CSS = {
  padding: 10,
  wallHeight: 66,
  penHeight: 138,
  gap: 12,
  napHeight: 100,
  /** Below this CSS width pens switch from 3 columns to 2 columns. */
  mobileBreakpoint: 560,
  /** Below this CSS width the full-viewport indoor room switches to portrait stacking. */
  portraitBreakpoint: 768,
} as const;

/** Native edge length of fallback static sprites. */
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

/** Legacy CSS height helper kept for compatibility and embedded tests. */
export function computeShopCssHeight(cssWidth: number, penCount: number): number {
  const rows = getPenRows(cssWidth, penCount);
  const { padding, wallHeight, penHeight, gap, napHeight } = FLOOR_CSS;
  return padding + wallHeight + gap + rows * penHeight + (rows - 1) * gap + gap + napHeight + padding;
}

/**
 * Computes full-viewport indoor Gen 4 PokéMart geometry fitting cleanly between the
 * floating Top Pill HUD and Bottom DS Action Dock on both desktop (e.g. 1280×800)
 * and mobile portrait (e.g. 390×844) with zero page scroll.
 */
export function computeIndoorLayout(
  cssWidth: number,
  cssHeight: number,
  penCount: number,
  bedCount: number,
  rawDpr: number,
): ShopLayout {
  const dpr = clampDpr(rawDpr);
  const px = (css: number) => Math.round(css * dpr);
  const safeCssW = Math.max(320, cssWidth);
  const safeCssH = Math.max(460, cssHeight);
  const isPortrait = safeCssW < FLOOR_CSS.portraitBreakpoint;

  const width = px(safeCssW);
  const height = px(safeCssH);
  const unit = Math.max(2, Math.round((isPortrait ? 1.75 : 2) * dpr));
  const pad = px(isPortrait ? 10 : 18);
  const gap = px(isPortrait ? 8 : 12);

  // Reserve clean top & bottom safe bands so floating HUD pills and Bottom Dock never hide stations.
  const topBand = px(isPortrait ? 92 : 62);
  const bottomBand = px(isPortrait ? 78 : 78);

  const wallH = topBand + px(isPortrait ? 58 : 74);
  const wall: Rect = { x: 0, y: 0, w: width, h: wallH };

  const doorW = px(isPortrait ? 44 : 56);
  const doorH = px(isPortrait ? 46 : 56);
  const door: Rect = {
    x: width - pad - px(8) - doorW,
    y: wall.h - doorH,
    w: doorW,
    h: doorH,
  };

  const foyer: Rect = {
    x: door.x - px(10),
    y: wall.h,
    w: doorW + px(20),
    h: px(isPortrait ? 18 : 26),
  };

  const counterW = Math.min(px(isPortrait ? 148 : 204), Math.round(width * (isPortrait ? 0.44 : 0.28)));
  const counterH = px(isPortrait ? 24 : 30);
  const counter: Rect = {
    x: pad + px(4),
    y: wall.h - counterH,
    w: counterW,
    h: counterH,
  };

  const windowW = Math.min(px(isPortrait ? 84 : 150), Math.round(width * 0.2));
  const windowRect: Rect = {
    x: Math.round(width * (isPortrait ? 0.58 : 0.52) - windowW / 2),
    y: topBand + px(10),
    w: windowW,
    h: px(isPortrait ? 24 : 32),
  };

  // Up to 4 shoppers stand directly in front of Kecleon's counter along the top aisle.
  const queueY = wall.h + px(isPortrait ? 28 : 34);
  const queueStartX = counter.x + px(18);
  const queueStepX = Math.max(px(28), Math.round((counterW - px(20)) / 3.4));
  const counterQueueSpots: Point[] = Array.from({ length: 4 }, (_, i) => ({
    x: queueStartX + i * queueStepX,
    y: queueY + (i % 2) * unit * 2,
  }));

  const aisleY = wall.h + Math.round(px(isPortrait ? 14 : 20));
  const doorSpot: Point = {
    x: door.x + Math.round(door.w / 2),
    y: aisleY,
  };

  const floorBottom = height - bottomBand;

  if (isPortrait) {
    // Portrait vertical zoning: Counter Queue -> 2-col Pens -> Healing Corner -> 3 Bottom Stations
    const stationStripH = px(62);
    const stationY = floorBottom - stationStripH;
    const stationW = Math.floor((width - pad * 2 - gap * 2) / 3);
    const pcStation: Rect = { x: pad, y: stationY, w: stationW, h: stationStripH };
    const incubatorStation: Rect = {
      x: pad + stationW + gap,
      y: stationY,
      w: stationW,
      h: stationStripH,
    };
    const upgradesStation: Rect = {
      x: pad + (stationW + gap) * 2,
      y: stationY,
      w: stationW,
      h: stationStripH,
    };

    const napH = px(74);
    const napArea: Rect = {
      x: pad,
      y: stationY - gap - napH,
      w: width - pad * 2,
      h: napH,
    };

    const cols = 2;
    const rows = Math.max(1, Math.ceil(penCount / cols));
    const pensTop = queueY + px(14);
    const pensBottom = napArea.y - gap;
    const availPenH = Math.max(px(120), pensBottom - pensTop);
    const penH = Math.min(px(136), Math.floor((availPenH - gap * (rows - 1)) / rows));
    const penW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
    const fence = unit * 3;

    const pens: PenRect[] = Array.from({ length: penCount }, (_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = pad + col * (penW + gap);
      const y = pensTop + row * (penH + gap);
      return {
        index,
        x,
        y,
        w: penW,
        h: penH,
        inner: { x: x + fence, y: y + fence, w: penW - fence * 2, h: penH - fence * 2 },
      };
    });

    const innerH = Math.max(px(40), penH - fence * 2);
    const maxFit = Math.floor((innerH * 0.9) / SPRITE_SOURCE_SIZE);
    const preferred = Math.round((innerH * 0.66) / SPRITE_SOURCE_SIZE);
    const spriteScale = Math.max(1, Math.min(maxFit, preferred));

    const labelH = px(18);
    const slots = Math.max(1, bedCount);
    const bedW = Math.min(px(108), Math.floor((napArea.w - gap * (slots + 1)) / slots));
    const bedH = Math.max(px(28), napArea.h - labelH - px(6));
    const beds: Rect[] = Array.from({ length: bedCount }, (_, i) => ({
      x: napArea.x + gap + i * (bedW + gap),
      y: napArea.y + labelH,
      w: bedW,
      h: bedH,
    }));

    return {
      cssWidth: safeCssW,
      cssHeight: safeCssH,
      width,
      height,
      dpr,
      isPortrait: true,
      unit,
      spriteScale,
      spriteSize: SPRITE_SOURCE_SIZE * spriteScale,
      wall,
      door,
      foyer,
      doorSpot,
      counter,
      counterQueueSpots,
      window: windowRect,
      aisleY,
      pens,
      napArea,
      beds,
      incubatorStation,
      pcStation,
      upgradesStation,
      lamps: [
        { x: Math.round(width * 0.34), y: topBand + px(24) },
        { x: Math.round(width * 0.72), y: topBand + px(24) },
      ],
    };
  }

  // Landscape Desktop Indoor Room
  const wingH = Math.min(px(116), Math.max(px(88), Math.round((floorBottom - wall.h) * 0.23)));
  const wingY = floorBottom - wingH;
  const wingTotalW = width - pad * 2;
  const napW = Math.round(wingTotalW * 0.43);
  const sideStationW = Math.floor((wingTotalW - napW - gap * 3) / 3);

  const napArea: Rect = { x: pad, y: wingY, w: napW, h: wingH };
  const incubatorStation: Rect = {
    x: napArea.x + napArea.w + gap,
    y: wingY,
    w: sideStationW,
    h: wingH,
  };
  const pcStation: Rect = {
    x: incubatorStation.x + sideStationW + gap,
    y: wingY,
    w: sideStationW,
    h: wingH,
  };
  const upgradesStation: Rect = {
    x: pcStation.x + sideStationW + gap,
    y: wingY,
    w: sideStationW,
    h: wingH,
  };

  const cols = getPenColumns(safeCssW, penCount);
  const rows = Math.max(1, Math.ceil(penCount / cols));
  const pensTop = Math.max(wall.h + gap * 2, queueY + px(18));
  const pensBottom = wingY - gap;
  const availPenH = Math.max(px(130), pensBottom - pensTop);
  const penH = Math.min(px(176), Math.floor((availPenH - gap * (rows - 1)) / rows));
  const penW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const fence = unit * 3;

  // Vertically center the pen grid in the middle floor band
  const totalGridH = rows * penH + (rows - 1) * gap;
  const gridStartY = pensTop + Math.max(0, Math.floor((availPenH - totalGridH) / 2));

  const pens: PenRect[] = Array.from({ length: penCount }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = pad + col * (penW + gap);
    const y = gridStartY + row * (penH + gap);
    return {
      index,
      x,
      y,
      w: penW,
      h: penH,
      inner: { x: x + fence, y: y + fence, w: penW - fence * 2, h: penH - fence * 2 },
    };
  });

  const innerH = Math.max(px(50), penH - fence * 2);
  const maxFit = Math.floor((innerH * 0.92) / SPRITE_SOURCE_SIZE);
  const preferred = Math.round((innerH * 0.64) / SPRITE_SOURCE_SIZE);
  const spriteScale = Math.max(1, Math.min(maxFit, preferred));

  const labelH = px(20);
  const slots = Math.max(1, bedCount);
  const bedW = Math.min(px(132), Math.floor((napArea.w - gap * (slots + 1)) / slots));
  const bedH = Math.max(px(36), napArea.h - labelH - px(8));
  const beds: Rect[] = Array.from({ length: bedCount }, (_, i) => ({
    x: napArea.x + gap + i * (bedW + gap),
    y: napArea.y + labelH,
    w: bedW,
    h: bedH,
  }));

  return {
    cssWidth: safeCssW,
    cssHeight: safeCssH,
    width,
    height,
    dpr,
    isPortrait: false,
    unit,
    spriteScale,
    spriteSize: SPRITE_SOURCE_SIZE * spriteScale,
    wall,
    door,
    foyer,
    doorSpot,
    counter,
    counterQueueSpots,
    window: windowRect,
    aisleY,
    pens,
    napArea,
    beds,
    incubatorStation,
    pcStation,
    upgradesStation,
    lamps: [
      { x: Math.round(width * 0.29), y: topBand + px(28) },
      { x: Math.round(width * 0.72), y: topBand + px(28) },
    ],
  };
}

/**
 * Legacy boxed-floor geometry helper used by `animation-layout.test.ts` and `tiles.ts`.
 * Computes an indoor layout sized for `computeShopCssHeight(cssWidth, penCount)`.
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
  const unit = Math.max(2, Math.round(2 * dpr));
  const pad = px(FLOOR_CSS.padding);
  const gap = px(FLOOR_CSS.gap);

  const wall: Rect = { x: 0, y: 0, w: width, h: pad + px(FLOOR_CSS.wallHeight) };
  const doorW = px(34);
  const doorH = px(50);
  const door: Rect = { x: width - pad - px(10) - doorW, y: wall.h - doorH, w: doorW, h: doorH };
  const foyer: Rect = { x: door.x - px(4), y: wall.h, w: doorW + px(8), h: px(12) };

  const counterW = Math.min(px(130), Math.round(width * 0.28));
  const counter: Rect = { x: pad + px(6), y: wall.h - px(30), w: counterW, h: px(30) };

  const counterQueueSpots: Point[] = Array.from({ length: 4 }, (_, i) => ({
    x: counter.x + px(14) + i * px(26),
    y: wall.h + px(16),
  }));

  const windowW = Math.min(px(120), Math.round(width * 0.22));
  const windowRect: Rect = {
    x: Math.round(width / 2 - windowW / 2),
    y: pad + px(8),
    w: windowW,
    h: px(30),
  };

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

  const stationW = Math.min(px(90), Math.floor(napArea.w * 0.18));
  const upgradesStation: Rect = {
    x: napArea.x + napArea.w - stationW,
    y: napArea.y,
    w: stationW,
    h: napArea.h,
  };
  const pcStation: Rect = {
    x: upgradesStation.x - gap - stationW,
    y: napArea.y,
    w: stationW,
    h: napArea.h,
  };
  const incubatorStation: Rect = {
    x: pcStation.x - gap - stationW,
    y: napArea.y,
    w: stationW,
    h: napArea.h,
  };

  const aisleY = wall.h + Math.round(gap / 2);

  return {
    cssWidth,
    cssHeight,
    width,
    height,
    dpr,
    isPortrait: cssWidth < FLOOR_CSS.portraitBreakpoint,
    unit,
    spriteScale,
    spriteSize: SPRITE_SOURCE_SIZE * spriteScale,
    wall,
    door,
    foyer,
    doorSpot: { x: door.x + Math.round(door.w / 2), y: aisleY },
    counter,
    counterQueueSpots,
    window: windowRect,
    aisleY,
    pens,
    napArea,
    beds,
    incubatorStation,
    pcStation,
    upgradesStation,
    lamps: [
      { x: Math.round(width * 0.25), y: Math.round(wall.h * 0.4) },
      { x: Math.round(width * 0.75), y: Math.round(wall.h * 0.4) },
    ],
  };
}

/** Queue anchor point in front of Kecleon's register for the i-th queued shopper. */
export function getCounterQueueSpot(layout: ShopLayout, queueIndex: number): Point {
  const spots = layout.counterQueueSpots;
  if (spots.length === 0) {
    return {
      x: layout.counter.x + Math.round(layout.counter.w * 0.5),
      y: layout.counter.y + layout.counter.h + layout.unit * 8,
    };
  }
  return { ...spots[Math.min(Math.max(0, queueIndex), spots.length - 1)] };
}

/** Feet-position bounds a Pokémon may wander to inside a pen. */
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

/** Builds a walking route from the door along walkways to a browsing spot. */
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
