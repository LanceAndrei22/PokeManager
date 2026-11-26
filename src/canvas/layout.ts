/**
 * Pure PC desktop indoor PokéMart shop floor geometry: converts desktop CSS dimensions
 * (`1280×720` minimum, optimized for `1920×1080` and `2560×1440+`), pen count, nap-bed
 * count, and devicePixelRatio into backing-store rectangles with crisp integer pixel
 * scaling, integrated wall/floor station placement, and modular Resting Pen geometry.
 * No DOM access, so it is 100% unit-testable.
 */
import type { PenRect, Point, Rect, ShopLayout } from './types';

/** Desktop layout constants in CSS pixels (converted to backing px via DPR and `resScale`). */
export const FLOOR_CSS = {
  padding: 10,
  wallHeight: 66,
  penHeight: 138,
  gap: 12,
  napHeight: 100,
  /** Minimum supported desktop canvas width in CSS px. */
  minDesktopWidth: 960,
  /** Reference desktop width used to derive proportional high-res scaling. */
  baseDesktopWidth: 1280,
  /** Reference desktop height used to derive proportional high-res scaling. */
  baseDesktopHeight: 760,
} as const;

/** Native edge length of fallback static sprites. */
export const SPRITE_SOURCE_SIZE = 80;

/** Clamps DPR to [1, 3] so huge zoom levels never allocate giant canvases. */
export function clampDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(3, Math.max(1, dpr));
}

/**
 * Computes a proportional widescreen desktop scale factor:
 * `1.0` at `1280×760`, `~1.42` at `1920×1080`, `~1.89` at `2560×1440` (capped at `2.2`).
 */
export function computeDesktopResScale(cssWidth: number, cssHeight: number): number {
  const safeW = Math.max(FLOOR_CSS.minDesktopWidth, cssWidth);
  const safeH = Math.max(600, cssHeight);
  return Math.min(
    2.2,
    Math.max(
      1,
      Math.min(safeW / FLOOR_CSS.baseDesktopWidth, safeH / FLOOR_CSS.baseDesktopHeight),
    ),
  );
}

/** Number of pen columns on desktop (up to 3 columns across the main floor). */
export function getPenColumns(_cssWidth: number, penCount: number): number {
  return Math.max(1, Math.min(3, penCount));
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
 * Modular layout helper for the Resting / Nap Corner care alcove.
 * Isolated cleanly so future Resting Pen mechanics (additional beds, care stations,
 * comfort zones) can expand this region without disturbing the rest of the store plan.
 */
export function computeRestingPensLayout(
  areaX: number,
  areaY: number,
  areaW: number,
  areaH: number,
  bedCount: number,
  gap: number,
  spx: (cssAt1280: number) => number,
): { napArea: Rect; beds: Rect[] } {
  const napArea: Rect = { x: areaX, y: areaY, w: areaW, h: areaH };
  const labelH = spx(22);
  const padX = Math.max(gap, spx(16));
  const slots = Math.max(1, bedCount);
  const bedW = Math.min(spx(148), Math.floor((areaW - padX * 2 - gap * (slots - 1)) / slots));
  const bedH = Math.max(spx(46), areaH - labelH - spx(12));
  const beds: Rect[] = Array.from({ length: bedCount }, (_, i) => ({
    x: areaX + padX + i * (bedW + gap),
    y: areaY + labelH,
    w: bedW,
    h: bedH,
  }));
  return { napArea, beds };
}

/**
 * Computes full-viewport PC desktop indoor Gen 4 PokéMart geometry fitting cleanly between
 * the floating Top Pill HUD and Bottom DS Action Dock across `1280×800`, `1920×1080`, and
 * `2560×1440+`:
 * - Substantial, deeper Checkout Counter on the upper-left with room behind it for Clerk Leo
 *   and a stitched Checkout Mat directly in front for queuing shoppers.
 * - Standing Wholesale PC Kiosk flush against the back wall beside the counter.
 * - Wall-mounted wooden Upgrades Notice Board on the upper-right wall.
 * - Organic Habitat Display Pens centered across the middle floor.
 * - Modular Resting Corner rug alcove & physical Egg Incubator care pedestal on the lower floor.
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
  const safeCssW = Math.max(FLOOR_CSS.minDesktopWidth, cssWidth);
  const safeCssH = Math.max(600, cssHeight);
  const resScale = computeDesktopResScale(safeCssW, safeCssH);
  const spx = (cssAt1280: number) => Math.round(cssAt1280 * resScale * dpr);

  const width = px(safeCssW);
  const height = px(safeCssH);

  // Crisp integer backing-store art-pixel size:
  // 2px @ 1280×800 (1× DPR), 3px @ 1920×1080 (1× DPR), 4px @ 2560×1440 (1× DPR).
  const unit = Math.max(2, Math.round(2 * resScale * dpr));
  const pad = spx(22);
  const gap = spx(14);

  // Clear the fixed desktop Top HUD bar and Bottom Action Dock cleanly across resolutions.
  const topBand = px(Math.round(70 + (resScale - 1) * 18));
  const bottomBand = px(Math.round(76 + (resScale - 1) * 20));

  const wallH = topBand + spx(86);
  const wall: Rect = { x: 0, y: 0, w: width, h: wallH };

  const doorW = spx(74);
  const doorH = spx(74);
  const door: Rect = {
    x: width - pad - spx(26) - doorW,
    y: wall.h - doorH,
    w: doorW,
    h: doorH,
  };

  const foyer: Rect = {
    x: door.x - spx(4),
    y: wall.h,
    w: doorW + spx(8),
    h: spx(26),
  };

  // Larger, deeper Gen 4 Checkout Counter projecting organically onto the floor so hired
  // shopkeepers stand visibly behind the desk top while shoppers queue right up against it.
  const counterW = Math.min(spx(308), Math.round(width * 0.29));
  const counterH = spx(50);
  const counter: Rect = {
    x: pad + spx(24),
    y: wall.h - spx(14),
    w: counterW,
    h: counterH,
  };
  const counterBottom = counter.y + counter.h;

  // Standing Gen 4 Wholesale PC Kiosk placed flush against the back wall beside the counter.
  const pcW = spx(62);
  const pcH = spx(74);
  const pcStation: Rect = {
    x: counter.x + counter.w + spx(22),
    y: wall.h - spx(46),
    w: pcW,
    h: pcH,
  };

  // Unified vertical window band datum shared across ALL sunlit back-wall windows
  const windowY = topBand + spx(4);
  const windowH = spx(34);

  // Physical oak Upgrades Notice Board mounted directly on the upper-right back wall
  const upgradesW = spx(122);
  const upgradesH = spx(48);
  const upgradesX = Math.round(
    pcStation.x + pcStation.w + (door.x - (pcStation.x + pcStation.w)) * 0.56 - upgradesW / 2,
  );
  const upgradesStation: Rect = {
    x: Math.min(door.x - upgradesW - spx(28), Math.max(pcStation.x + pcStation.w + spx(110), upgradesX)),
    y: windowY,
    w: upgradesW,
    h: upgradesH,
  };

  // Primary sunlit window centered cleanly between the Wholesale PC and the Upgrades Board
  const midGapStart = pcStation.x + pcStation.w + spx(18);
  const midGapEnd = upgradesStation.x - spx(18);
  const midGapW = Math.max(spx(72), midGapEnd - midGapStart);
  const windowW = Math.min(spx(164), midGapW);
  const windowRect: Rect = {
    x: Math.round(midGapStart + (midGapW - windowW) / 2),
    y: windowY,
    w: windowW,
    h: windowH,
  };

  // Additional aligned sunlit windows sharing exact `windowY` and `windowH`:
  // 1) Right-side sunlit window between Upgrades Board and Sliding Glass Exit
  // 2) Twin accent windows flanking the enlarged centered Wall Clock above the Counter
  const extraWindows: Rect[] = [];

  const rightGapStart = upgradesStation.x + upgradesStation.w + spx(18);
  const rightGapEnd = door.x - spx(18);
  const rightGapW = rightGapEnd - rightGapStart;
  if (rightGapW >= spx(72)) {
    const rightWinW = Math.min(spx(156), rightGapW);
    extraWindows.push({
      x: Math.round(rightGapStart + (rightGapW - rightWinW) / 2),
      y: windowY,
      w: rightWinW,
      h: windowH,
    });
  }

  const clockClearHalf = spx(29);
  const counterCenterX = Math.round(counter.x + counter.w / 2);
  const leftClockWinStart = counter.x + spx(8);
  const leftClockWinEnd = counterCenterX - clockClearHalf;
  if (leftClockWinEnd - leftClockWinStart >= spx(54)) {
    extraWindows.push({
      x: leftClockWinStart,
      y: windowY,
      w: leftClockWinEnd - leftClockWinStart,
      h: windowH,
    });
  }
  const rightClockWinStart = counterCenterX + clockClearHalf;
  const rightClockWinEnd = counter.x + counter.w - spx(8);
  if (rightClockWinEnd - rightClockWinStart >= spx(54)) {
    extraWindows.push({
      x: rightClockWinStart,
      y: windowY,
      w: rightClockWinEnd - rightClockWinStart,
      h: windowH,
    });
  }

  // Up to 4 shoppers stand grounded on the Checkout Mat right up against the counter front.
  const queueY = counterBottom + unit * 18;
  const queueStartX = counter.x + unit * 16;
  const queueStepX = Math.max(unit * 18, Math.round((counterW - unit * 32) / 3));
  const counterQueueSpots: Point[] = Array.from({ length: 4 }, (_, i) => ({
    x: queueStartX + i * queueStepX,
    y: queueY + (i % 2) * unit * 2,
  }));

  const aisleY = counterBottom + Math.round(unit * 11);
  const doorSpot: Point = {
    x: door.x + Math.round(door.w / 2),
    y: wall.h + spx(18),
  };

  // Lower Care Wing: modular Resting Corner rug alcove (left) + physical Incubator pedestal (right)
  const floorBottom = height - bottomBand;
  const wingH = Math.min(
    spx(136),
    Math.max(spx(102), Math.round((floorBottom - counterBottom) * 0.24)),
  );
  const wingY = floorBottom - wingH;
  const wingTotalW = width - pad * 2;
  const napW = Math.round(wingTotalW * 0.52);

  const { napArea, beds } = computeRestingPensLayout(
    pad,
    wingY,
    napW,
    wingH,
    bedCount,
    gap,
    spx,
  );

  // Physical Egg Incubator care table sitting naturally on the open lower-right floor tiles
  const incW = Math.min(spx(210), Math.max(spx(150), Math.round(wingTotalW * 0.22)));
  const incH = Math.min(wingH, spx(122));
  const incubatorStation: Rect = {
    x: napArea.x + napArea.w + Math.round((wingTotalW - napW - incW) * 0.45),
    y: wingY + Math.round((wingH - incH) / 2),
    w: incW,
    h: incH,
  };

  // Organic Habitat Display Pens centered cleanly in the middle floor band
  const cols = getPenColumns(safeCssW, penCount);
  const rows = Math.max(1, Math.ceil(penCount / cols));
  const pensTop = Math.max(counterBottom + gap * 2, queueY + spx(18));
  const pensBottom = wingY - spx(22);
  const availPenH = Math.max(spx(136), pensBottom - pensTop);
  const maxPenH = spx(rows === 1 ? 210 : 168);
  const penH = Math.min(maxPenH, Math.floor((availPenH - gap * (rows - 1)) / rows));
  const penW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const fence = unit * 4;

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

  const innerH = Math.max(spx(54), penH - fence * 2);
  const maxFit = Math.floor((innerH * 0.92) / SPRITE_SOURCE_SIZE);
  const preferred = Math.round((innerH * 0.64) / SPRITE_SOURCE_SIZE);
  const spriteScale = Math.max(1, Math.min(maxFit, preferred));

  return {
    cssWidth: safeCssW,
    cssHeight: safeCssH,
    width,
    height,
    dpr,
    resScale,
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
    extraWindows,
    aisleY,
    pens,
    napArea,
    beds,
    incubatorStation,
    pcStation,
    upgradesStation,
    lamps: [
      { x: Math.round(pcStation.x + pcStation.w / 2), y: topBand + spx(18) },
      { x: Math.round(upgradesStation.x + upgradesStation.w / 2), y: topBand - spx(4) },
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
    resScale: 1,
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
    extraWindows: [],
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

/** Queue anchor point in front of Clerk Leo's register for the i-th queued shopper. */
export function getCounterQueueSpot(layout: ShopLayout, queueIndex: number): Point {
  const spots = layout.counterQueueSpots;
  if (spots.length === 0) {
    return {
      x: layout.counter.x + Math.round(layout.counter.w * 0.5),
      y: layout.counter.y + layout.counter.h + layout.unit * 18,
    };
  }
  return { ...spots[Math.min(Math.max(0, queueIndex), spots.length - 1)] };
}

/** Feet-position bounds a Pokémon may wander to inside a pen (generous headroom for Legendaries). */
export function getPenWanderBounds(layout: ShopLayout, penIndex: number): Rect | null {
  const pen = layout.pens[penIndex];
  if (!pen) return null;
  const u = layout.unit;
  const { inner } = pen;
  const marginX = Math.max(u * 22, inner.w * 0.14);
  let minX = inner.x + marginX;
  let maxX = inner.x + inner.w - marginX;
  if (minX > maxX) minX = maxX = inner.x + inner.w / 2;
  const maxY = inner.y + inner.h - u * 4;
  // Leave upper pen headroom so tall Legendaries (Lugia, Rayquaza, Dialga, Arceus) never clip top rail
  let minY = inner.y + Math.min(inner.h * 0.72, Math.max(u * 38, inner.h * 0.54));
  if (minY > maxY) minY = maxY;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Feet anchor for a sleeping Pokémon resting on a nap-bed cushion. */
export function getBedAnchor(layout: ShopLayout, bedIndex: number): Point | null {
  const bed = layout.beds[bedIndex];
  if (!bed) return null;
  return { x: bed.x + Math.round(bed.w / 2), y: bed.y + Math.round(bed.h * 0.74) };
}

/**
 * Where the n-th browsing shopper stands: grounded on the PokéMart tile floor right outside
 * the pen's front-right fence rail so Y-sorting places the fence between shopper & Pokémon.
 */
export function getCustomerSpot(layout: ShopLayout, penIndex: number, visitorIndex: number): Point {
  const pen = layout.pens[penIndex] ?? layout.pens[0];
  if (!pen) return { ...layout.doorSpot };
  const u = layout.unit;
  const x = Math.max(pen.x + u * 8, pen.x + pen.w - u * 10 - visitorIndex * u * 12);
  return { x, y: pen.y + pen.h + u * 8 };
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

/** Walks cleanly from a pen browsing spot along side walkways up to a counter queue spot. */
export function buildCounterRoute(
  layout: ShopLayout,
  penIndex: number,
  from: Point,
  to: Point,
): Point[] {
  const pen = layout.pens[penIndex];
  const sideX = pen
    ? Math.min(layout.width - layout.unit, pen.x + pen.w + Math.round(layout.unit * 3))
    : from.x;
  const route: Point[] =
    pen && from.y > pen.y
      ? [{ ...from }, { x: sideX, y: from.y }, { x: sideX, y: to.y }, { ...to }]
      : [{ ...from }, { x: from.x, y: to.y }, { ...to }];
  return dedupePath(route);
}

/** Walks cleanly from any floor/counter position via the top walkway back out the glass doors. */
export function buildExitFromPointRoute(layout: ShopLayout, from: Point): Point[] {
  return dedupePath([
    { ...from },
    { x: from.x, y: layout.aisleY },
    { ...layout.doorSpot },
  ]);
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
