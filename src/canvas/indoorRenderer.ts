/**
 * Full-screen Indoor Gen 4 PokéMart pixel renderer:
 * - Caches cohesive Gen 4 PokéMart architecture (`floor-tile`, `wall-tile`, `clock-wall`,
 *   `plant-pot`, `mat`, Checkout Welcome Mat, wall-mounted oak Upgrades Board, Organic
 *   Habitat Display Pens with floor drop shadows, and modular braided-rug Resting Corner).
 * - Layers live dynamic elements with true 2.5D Y-depth:
 *   1. Sliding glass entrance doors (`OPEN`/`CLOSED`),
 *   2. Clerk Leo standing physically *behind* the deep Gen 4 Checkout Counter (legs occluded
 *      naturally by the counter desk top, cash register, and Poké Ball display case),
 *   3. Standing Wholesale PC Kiosk flush against the back wall with subtle monitor glow,
 *   4. Physical Egg Incubator oak-and-glass pedestal with wobbling eggs,
 *   5. Depth-sorted grounded PMD Pokémon (with opaque-foot contact shadows), Pen front fence
 *      rails, and grounded Human Trainer shoppers with tightly anchored head indicators.
 */
import type { CustomerArchetypeId } from '../data/types';
import {
  STATIC_POSE,
  STATIC_SLEEP_POSE,
  breathingPose,
  sleepPose,
  walkFrame,
  type Pose,
} from './animation';
import { getHumanNpcFrame, type CardinalDirection } from './humanNpcAnimator';
import { drawOrganicPenHabitat } from './organicTerrain';
import { particleAlpha, type Particle } from './particles';
import {
  COIN,
  EGG_ICON,
  EXCLAMATION_MARK,
  HEART,
  ICON_COLORS,
  LETTER_Z,
  PALETTE,
  SHOPPER_FRAMES,
  SPARKLE,
  STAR,
  SWEAT_DROP,
  bitmapSize,
  drawBitmap,
  drawPixelShadow,
  fillPixelRoundRect,
  type PixelBitmap,
} from './pixelArt';
import { drawPlankFloor } from './tiles';
import { getTileImage } from './tilesetLoader';
import type {
  CanvasHitTarget,
  PenRect,
  Rect,
  ShopLayout,
  SpriteEntityAdapter,
  SpriteFrame,
} from './types';
import type { CustomerWalker, PokemonEntity, QueuedShopperEntity, ShopWorld } from './world';

/** Per-frame options passed from `ShopCanvas`. */
export interface IndoorRenderOptions {
  shiftRunning: boolean;
  shiftTick?: number;
  shiftDurationTicks?: number;
  shopkeepers?: string[];
  hoverTarget: CanvasHitTarget | null;
}

const ARCHETYPE_SHIRTS: Record<CustomerArchetypeId, string> = {
  normal: '#5c8ed6',
  'cozy-collector': PALETTE.berry,
  'bargain-browser': PALETTE.sage,
  'trend-fan': PALETTE.honeyDeep,
  'shiny-seeker': PALETTE.lavender,
  'vip-seeker': '#7c3aed',
};

const BUBBLE_ICONS: Record<CustomerArchetypeId, PixelBitmap> = {
  normal: COIN,
  'cozy-collector': HEART,
  'bargain-browser': COIN,
  'trend-fan': STAR,
  'shiny-seeker': SPARKLE,
  'vip-seeker': SPARKLE,
};

const HAIR_COLORS = ['#3c2918', '#7a4a2a', '#c27c3e', '#2f3a56', '#8e5b9a', '#d9a441'];
const POKE_BALL: PixelBitmap = ['.rrrr.', 'rrrrrr', 'kkwwkk', 'wwwwww', '.wwww.'];
const POKE_BALL_LEFT: PixelBitmap = ['.rr', 'rrr', 'kkw', 'www', '.ww'];
const POKE_BALL_RIGHT: PixelBitmap = ['rr.', 'rrr', 'wkk', 'www', 'ww.'];
const BALL_COLORS = { r: '#e04848', k: '#1c2436', w: '#f7fafc' };
const HOVER_CARET: PixelBitmap = ['yyyyy', '.yyy.', '..y..'];

/** Crisp 12×20 transparent-background potted indoor ficus in a warm terracotta planter. */
const POTTED_PLANT_BITMAP: PixelBitmap = [
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
const POTTED_PLANT_COLORS: Record<string, string> = {
  o: '#1a2b1f',
  l: '#78d45c',
  g: '#3ea342',
  d: '#246b31',
  r: '#df9d6c',
  p: '#bd6d42',
  b: '#8e4b2a',
  s: '#4e301d',
};

function seam(unit: number): number {
  return Math.max(1, Math.round(unit / 2));
}

/**
 * Scales every PMD Pokémon at the room's uniform integer pixel density (`layout.unit`) so
 * all 493 species share identical crisp pixel thickness and authentic relative PMD body
 * proportions (e.g. Dialga/Lugia/Arceus naturally taller than Mewtwo/Eevee). Only steps
 * down an integer multiplier if the Pokémon's *visible* opaque silhouette (not empty PMD
 * attack-frame cell padding) would overflow the pen interior.
 */
function computeFrameDrawSize(
  frame: SpriteFrame,
  layout: ShopLayout,
): { drawW: number; drawH: number; scale: number } {
  if (!frame.usesDirectionRow) {
    return { drawW: layout.spriteSize, drawH: layout.spriteSize, scale: layout.spriteScale };
  }
  const visW = frame.visibleWidthPx ?? Math.round(frame.sw * 0.56);
  const visH = frame.visibleHeightPx ?? Math.round(frame.sh * 0.56);
  const penInnerH = layout.pens[0]?.inner.h ?? layout.spriteSize * 1.8;
  const penInnerW = layout.pens[0]?.inner.w ?? layout.spriteSize * 3.0;
  const maxVisH = penInnerH * 0.88;
  const maxVisW = penInnerW * 0.82;

  let scale = layout.unit;
  if (visH * scale > maxVisH || visW * scale > maxVisW) {
    scale = Math.max(
      1,
      Math.floor(Math.min(maxVisH / Math.max(1, visH), maxVisW / Math.max(1, visW))),
    );
  }
  return { drawW: frame.sw * scale, drawH: frame.sh * scale, scale };
}

function getPokemonPose(world: ShopWorld, ent: PokemonEntity): Pose {
  const still = world.reducedMotion || world.motionPaused;
  if (ent.state === 'sleep') return still ? STATIC_SLEEP_POSE : sleepPose(world.time, ent.phase);
  // Keep walking Pokémon strictly un-distorted (native PMD Walk-Anim frames planted at feetY)
  if (ent.state === 'walk' || still) return STATIC_POSE;
  return breathingPose(world.time, ent.phase);
}

/** Tiles a sprite cleanly within `rect` clipping overflow pixels at boundaries. */
function tileImageRect(
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

function drawMartFloor(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const floorRect: Rect = {
    x: 0,
    y: layout.wall.h,
    w: layout.width,
    h: layout.height - layout.wall.h,
  };
  const floorTile = getTileImage('indoor', 'floor-tile');
  if (floorTile) {
    const step = layout.unit * 16;
    tileImageRect(ctx, floorTile, floorRect, step, step);
    // Subtle ground ambient shadow right along the base of the back wall
    ctx.fillStyle = 'rgba(12, 24, 42, 0.14)';
    ctx.fillRect(0, layout.wall.h, layout.width, layout.unit * 2);
    return;
  }
  drawPlankFloor(ctx, floorRect, layout.unit);
}

/** Renders the physical oak-framed Upgrades Notice Board mounted directly on the back wall. */
function drawWallUpgradesBoard(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const b = layout.upgradesStation;
  const u = layout.unit;

  // Soft cast shadow onto the PokéMart wall beneath the oak frame
  ctx.fillStyle = 'rgba(10, 20, 38, 0.28)';
  ctx.fillRect(b.x + u * 2, b.y + u * 2, b.w, b.h + u);

  // Dark pixel outline + warm mitered oak wood border
  ctx.fillStyle = '#2d1c0f';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#8b5e36';
  ctx.fillRect(b.x + u, b.y + u, b.w - u * 2, b.h - u * 2);
  ctx.fillStyle = '#a87849';
  ctx.fillRect(b.x + u, b.y + u, b.w - u * 2, u);

  // Warm woven corkboard backing
  const innerX = b.x + u * 3;
  const innerY = b.y + u * 3;
  const innerW = Math.max(u * 6, b.w - u * 6);
  const innerH = Math.max(u * 6, b.h - u * 7);
  ctx.fillStyle = '#c49a6c';
  ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.fillStyle = '#b18659';
  for (let py = innerY + u; py < innerY + innerH - u; py += u * 3) {
    for (let px = innerX + u; px < innerX + innerW - u; px += u * 4) {
      ctx.fillRect(px, py, u, seam(u));
    }
  }

  // Pinned store blueprint & notice sheets with tiny red/gold pushpins
  const sheet1W = Math.max(u * 6, Math.round(innerW * 0.34));
  const sheet1H = Math.max(u * 5, Math.round(innerH * 0.68));
  const s1x = innerX + u * 2;
  const s1y = innerY + u * 2;
  ctx.fillStyle = 'rgba(20, 14, 8, 0.22)';
  ctx.fillRect(s1x + seam(u), s1y + seam(u), sheet1W, sheet1H);
  ctx.fillStyle = '#fdf4d3';
  ctx.fillRect(s1x, s1y, sheet1W, sheet1H);
  ctx.fillStyle = '#8f7d5e';
  ctx.fillRect(s1x + u, s1y + u * 3, sheet1W - u * 2, seam(u));
  ctx.fillRect(s1x + u, s1y + u * 5, sheet1W - u * 3, seam(u));
  ctx.fillStyle = '#d94638';
  ctx.fillRect(s1x + Math.round(sheet1W / 2) - seam(u), s1y + seam(u), u, u);

  const sheet2W = Math.max(u * 7, Math.round(innerW * 0.42));
  const sheet2H = Math.max(u * 6, Math.round(innerH * 0.72));
  const s2x = innerX + innerW - sheet2W - u * 2;
  const s2y = innerY + u * 1.5;
  ctx.fillStyle = 'rgba(20, 14, 8, 0.22)';
  ctx.fillRect(s2x + seam(u), s2y + seam(u), sheet2W, sheet2H);
  ctx.fillStyle = '#6db6eb';
  ctx.fillRect(s2x, s2y, sheet2W, sheet2H);
  ctx.fillStyle = '#d7f0ff';
  ctx.fillRect(s2x + u, s2y + u * 2, sheet2W - u * 2, seam(u));
  ctx.fillRect(s2x + u, s2y + u * 4, Math.round(sheet2W * 0.6), seam(u));
  ctx.fillRect(s2x + u, s2y + u * 6, sheet2W - u * 3, seam(u));
  ctx.fillStyle = '#ffd84d';
  ctx.fillRect(s2x + Math.round(sheet2W / 2) - seam(u), s2y + seam(u), u, u);

  // Small integrated brass/navy label bar embedded on the bottom wood molding
  const label = 'UPGRADES';
  ctx.font = `700 ${Math.max(8, Math.round(u * 3.1))}px "Chakra Petch", sans-serif`;
  const tagW = Math.min(b.w - u * 4, Math.ceil(ctx.measureText(label).width) + u * 4);
  const tagH = Math.max(u * 4.5, 10);
  const tagX = Math.round(b.x + (b.w - tagW) / 2);
  const tagY = Math.round(b.y + b.h - tagH - seam(u));
  ctx.fillStyle = '#13244b';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = '#ffd84d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2, tagW - u * 2);
  ctx.textAlign = 'start';
}

/** Draws one recessed sunlit meadow window seated cleanly into the solid PokéMart wall. */
function drawSunlitWindow(ctx: CanvasRenderingContext2D, wRect: Rect, u: number): void {
  const sillH = u * 2;
  // Soft wall drop shadow beneath the projecting oak window sill
  ctx.fillStyle = 'rgba(10, 20, 38, 0.22)';
  ctx.fillRect(wRect.x, wRect.y + wRect.h + sillH, wRect.w + u, u * 1.5);

  // Outer recessed royal-navy window casing
  ctx.fillStyle = '#162f61';
  ctx.fillRect(wRect.x, wRect.y, wRect.w, wRect.h);
  ctx.fillStyle = '#315a9e';
  ctx.fillRect(wRect.x + seam(u), wRect.y + seam(u), wRect.w - u, seam(u));

  // Sunlit sky interior (crisp upper sky + warm horizon glow)
  const gx = wRect.x + u * 1.5;
  const gy = wRect.y + u * 1.5;
  const gw = Math.max(u * 4, wRect.w - u * 3);
  const gh = Math.max(u * 4, wRect.h - u * 3);
  ctx.fillStyle = '#79c4f6';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(gx, gy + Math.round(gh * 0.44), gw, Math.round(gh * 0.56));

  // Soft drifting white pixel clouds seen outside
  ctx.fillStyle = '#f5fbff';
  if (gw >= u * 26) {
    ctx.fillRect(gx + u * 4, gy + u * 2, u * 8, u * 2);
    ctx.fillRect(gx + u * 6, gy + u, u * 4, u);
  }
  if (gw >= u * 44) {
    ctx.fillRect(gx + Math.round(gw * 0.62), gy + u * 3, u * 9, u * 2);
    ctx.fillRect(gx + Math.round(gw * 0.65), gy + u * 2, u * 5, u);
  } else if (gw >= u * 18) {
    ctx.fillRect(gx + Math.round(gw * 0.34), gy + u * 2.5, u * 7, u * 2);
  }

  // Distant sunlit green meadow treetop horizon along the lower edge of the glass panes
  const treeLineY = gy + gh - u * 3;
  ctx.fillStyle = '#4e9648';
  ctx.fillRect(gx, treeLineY, gw, u * 3);
  ctx.fillStyle = '#3b7a37';
  for (let tx = gx + u * 2; tx < gx + gw - u * 4; tx += u * 7) {
    ctx.fillRect(tx, treeLineY - u, u * 4, u * 2);
  }

  // Subtle diagonal glass specular reflection stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
  ctx.fillRect(gx + u * 2, gy + u, u * 2, u * 4);
  ctx.fillRect(gx + u * 4, gy + u * 3, u, u * 2);
  if (gw >= u * 38) {
    ctx.fillRect(gx + Math.round(gw * 0.55), gy + u, u * 2, u * 4);
  }

  // Crisp center mullion (for wide windows) + horizontal sash bar
  ctx.fillStyle = '#1b3d7a';
  if (wRect.w >= u * 36) {
    ctx.fillRect(wRect.x + Math.round(wRect.w / 2) - seam(u), wRect.y, u, wRect.h);
  }
  ctx.fillRect(wRect.x, wRect.y + Math.round(wRect.h * 0.58), wRect.w, u);

  // Projecting warm oak/cream window sill ledge
  ctx.fillStyle = '#2d1c0f';
  ctx.fillRect(wRect.x - u, wRect.y + wRect.h - seam(u), wRect.w + u * 2, sillH + seam(u));
  ctx.fillStyle = '#dec7a1';
  ctx.fillRect(wRect.x - seam(u), wRect.y + wRect.h, wRect.w + u, sillH - seam(u));
}

/** Draws a lush transparent-background potted indoor plant grounded on a tight floor shadow. */
function drawPottedPlant(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  u: number,
): void {
  const { w: pw, h: ph } = bitmapSize(POTTED_PLANT_BITMAP);
  const drawW = pw * u;
  const drawH = ph * u;
  drawPixelShadow(ctx, centerX, feetY, drawW * 0.82, u, 0.28);
  drawBitmap(
    ctx,
    POTTED_PLANT_BITMAP,
    Math.round(centerX - drawW / 2),
    Math.round(feetY - drawH + u),
    u,
    POTTED_PLANT_COLORS,
  );
}

function drawMartWall(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const { wall, unit: u, width } = layout;

  // 1. Solid Gen 4 PokéMart upper wall (pale ivory-sky plaster with subtle architectural seams)
  const corniceH = Math.max(u * 4, Math.round(wall.h * 0.14));
  ctx.fillStyle = '#18366e';
  ctx.fillRect(wall.x, wall.y, wall.w, corniceH);
  ctx.fillStyle = '#4876c4';
  ctx.fillRect(wall.x, corniceH - u, wall.w, u);

  ctx.fillStyle = '#eaf1f9';
  ctx.fillRect(wall.x, corniceH, wall.w, Math.max(0, wall.h - corniceH));
  ctx.fillStyle = '#d6e3f0';
  for (let x = u * 16; x < width; x += u * 24) {
    ctx.fillRect(x, corniceH, seam(u), wall.h - corniceH);
  }

  // 2. Warm oak chair-rail molding + solid Gen 4 royal-blue recessed wainscoting (replaces glass boxes)
  const chairRailY = Math.min(
    wall.h - u * 14,
    Math.max(corniceH + u * 8, layout.window.y + layout.window.h + u * 4),
  );
  const wainH = Math.max(u * 10, wall.h - chairRailY);
  ctx.fillStyle = '#254a8a';
  ctx.fillRect(0, chairRailY, width, wainH);

  // Subtle recessed architectural wainscoting panels evenly spaced along the lower wall
  const panelStep = u * 24;
  const panelTop = chairRailY + u * 4;
  const panelH = Math.max(u * 4, wall.h - panelTop - u * 4);
  for (let px = u * 4; px + panelStep - u * 4 <= width; px += panelStep) {
    const pw = panelStep - u * 6;
    ctx.fillStyle = '#1e3e75';
    ctx.fillRect(px, panelTop, pw, panelH);
    ctx.fillStyle = '#3864b0';
    ctx.fillRect(px + seam(u), panelTop + seam(u), pw - u, seam(u));
    ctx.fillStyle = '#17305c';
    ctx.fillRect(px, panelTop + panelH - seam(u), pw, seam(u));
  }

  // Warm oak chair-rail trim capping the wainscoting cleanly
  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(0, chairRailY - seam(u), width, u * 3);
  ctx.fillStyle = '#a87849';
  ctx.fillRect(0, chairRailY, width, u * 2);
  ctx.fillStyle = '#e0c092';
  ctx.fillRect(0, chairRailY, width, seam(u));

  // Crisp navy baseboard separating solid PokéMart wall and tile floor
  ctx.fillStyle = '#13244b';
  ctx.fillRect(0, wall.h - u * 2, width, u * 2);
  ctx.fillStyle = '#2c5394';
  ctx.fillRect(0, wall.h - u * 2, width, seam(u));

  // 3. Multiple sunlit meadow windows all aligned on the exact same vertical datum
  drawSunlitWindow(ctx, layout.window, u);
  for (const extraWin of layout.extraWindows ?? []) {
    drawSunlitWindow(ctx, extraWin, u);
  }

  // 4. Framed oak Upgrades Notice Board mounted directly on the upper-right wall
  drawWallUpgradesBoard(ctx, layout);

  // 5. Lush grounded potted plants flanking the room corners with snug pixel-oval shadows
  const plantW = bitmapSize(POTTED_PLANT_BITMAP).w * u;
  const leftPlantX = Math.max(plantW / 2 + u * 2, Math.round((layout.counter.x - u * 2) / 2));
  if (layout.counter.x >= plantW + u * 2) {
    drawPottedPlant(ctx, leftPlantX, wall.h + u * 4, u);
  }
  const rightMarginStart = layout.door.x + layout.door.w + u * 2;
  if (width - rightMarginStart >= plantW) {
    const rightPlantX = Math.round(rightMarginStart + (width - rightMarginStart) / 2);
    drawPottedPlant(ctx, rightPlantX, wall.h + u * 4, u);
  }

  // 6. Subtle pendant ceiling lamps positioned in clear architectural gaps
  for (const lamp of layout.lamps) {
    ctx.fillStyle = '#24180d';
    ctx.fillRect(lamp.x - seam(u), 0, seam(u), Math.max(u * 4, lamp.y - u * 3));
    ctx.fillStyle = PALETTE.honey;
    ctx.fillRect(lamp.x - u * 3, lamp.y - u * 2, u * 6, u * 2);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(lamp.x - u, lamp.y, u * 2, u);
  }
}

/**
 * Renders the enlarged, dynamically animated Gen 4 PokéMart wall clock centered directly
 * over the Checkout Counter and aligned vertically with the sunlit windows.
 * Visually counts down the shift from `0` toward `shiftDurationTicks` via a remaining-time
 * dial sweep and rotating clock hands, freezing cleanly when the shop is closed/paused.
 */
function drawDynamicWallClock(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  shiftTick: number,
  shiftDurationTicks: number,
  shiftRunning: boolean,
): void {
  const u = layout.unit;
  const cx = Math.round(layout.counter.x + layout.counter.w / 2);
  const cy = Math.round(layout.window.y + layout.window.h / 2);
  const outerR = Math.max(u * 10, Math.round(layout.window.h * 0.64));
  const brassR = outerR - Math.max(2, u);
  const faceR = brassR - Math.max(2, Math.round(u * 1.1));

  const duration = Math.max(1, shiftDurationTicks);
  const clampedTick = Math.max(0, Math.min(duration, shiftTick));
  const progress = clampedTick / duration;
  const remaining = 1 - progress;

  // Soft cast drop shadow behind the mounted wall clock
  ctx.fillStyle = 'rgba(10, 20, 40, 0.28)';
  ctx.beginPath();
  ctx.arc(cx + seam(u), cy + u, outerR, 0, Math.PI * 2);
  ctx.fill();

  // Outer royal-navy housing ring
  ctx.fillStyle = '#112142';
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  // Brushed gold PokéMart bezel
  ctx.fillStyle = '#e8b938';
  ctx.beginPath();
  ctx.arc(cx, cy, brassR, 0, Math.PI * 2);
  ctx.fill();

  // Subtle upper-left specular highlight on brass rim
  ctx.strokeStyle = '#fff1a8';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.beginPath();
  ctx.arc(cx, cy, brassR - seam(u) * 0.5, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();

  // Warm cream clock dial face
  ctx.fillStyle = '#fdf9ef';
  ctx.beginPath();
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
  ctx.fill();

  // Dynamic remaining-shift countdown pie wedge (starts full at 12 o'clock and shrinks clockwise)
  const startAngle = -Math.PI / 2 + progress * Math.PI * 2;
  const endAngle = Math.PI * 1.5;
  if (remaining > 0.005) {
    ctx.fillStyle = !shiftRunning
      ? 'rgba(116, 146, 192, 0.28)'
      : remaining > 0.45
        ? 'rgba(46, 204, 113, 0.34)'
        : remaining > 0.2
          ? 'rgba(245, 184, 46, 0.44)'
          : 'rgba(231, 76, 60, 0.44)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Math.max(2, faceR - seam(u)), startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
  }

  // Crisp 12-hour dial ticks (cardinal 12/3/6/9 ticks darker & slightly longer)
  for (let i = 0; i < 12; i += 1) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    const isCardinal = i % 3 === 0;
    const innerTickR = faceR - (isCardinal ? Math.max(3, u * 1.8) : Math.max(2, u * 1.1));
    const outerTickR = faceR - seam(u);
    ctx.strokeStyle = isCardinal ? '#142447' : '#7b8ead';
    ctx.lineWidth = isCardinal ? Math.max(1.5, u * 0.75) : Math.max(1, seam(u));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerTickR, cy + Math.sin(a) * innerTickR);
    ctx.lineTo(cx + Math.cos(a) * outerTickR, cy + Math.sin(a) * outerTickR);
    ctx.stroke();
  }

  // Secondary slow shift-hour reference hand (moves gently through a quarter arc over the shift)
  const hourAngle = -Math.PI / 2 + progress * Math.PI * 0.5;
  const hourLen = Math.max(3, faceR * 0.46);
  ctx.strokeStyle = '#c48d1d';
  ctx.lineWidth = Math.max(1.5, u * 0.85);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourAngle) * hourLen, cy + Math.sin(hourAngle) * hourLen);
  ctx.stroke();

  // Primary countdown hand sweeping smoothly from 12 o'clock around the full dial as shift counts down
  const handAngle = -Math.PI / 2 + progress * Math.PI * 2;
  const handLen = Math.max(4, faceR * 0.74);
  ctx.strokeStyle = shiftRunning ? '#142447' : '#5f708f';
  ctx.lineWidth = Math.max(1.5, u * 0.85);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(handAngle) * handLen, cy + Math.sin(handAngle) * handLen);
  ctx.stroke();

  // Crisp center hub rivet
  ctx.fillStyle = '#d94638';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5, u * 0.85), 0, Math.PI * 2);
  ctx.fill();

  // Live OPEN/CLOSED running status LED pip nestled at the bottom of the brass rim
  ctx.fillStyle = '#070d1f';
  ctx.fillRect(cx - u, cy + brassR - u * 1.4, u * 2, u * 1.6);
  ctx.fillStyle = shiftRunning ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(cx - seam(u), cy + brassR - u * 1.1, u, u);
}

/** Paints the cozy stitched Checkout Mat on the floor directly in front of the counter. */
function drawCounterFloorMat(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const c = layout.counter;
  const u = layout.unit;
  const matX = c.x + u * 4;
  const matY = c.y + c.h + u * 4;
  const matW = c.w - u * 8;
  const matH = u * 18;

  // Soft woven royal-blue & cream checkout runner mat flush on the tile floor
  ctx.fillStyle = '#223e73';
  ctx.fillRect(matX, matY, matW, matH);
  ctx.fillStyle = '#335a9e';
  ctx.fillRect(matX + u, matY + u, matW - u * 2, matH - u * 2);
  ctx.strokeStyle = '#d4e4ff';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(matX + u * 2, matY + u * 2, matW - u * 4, matH - u * 4);
}

/**
 * Draws the substantial, deep Gen 4 Checkout Counter foreground (desk top, front paneling,
 * cash register, glass Poké Ball display stand, and brass-trimmed PokéMart emblem).
 * Rendered AFTER `drawClerk` so Clerk Leo's legs are naturally occluded behind the counter!
 */
function drawCounterForeground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const c = layout.counter;
  const u = layout.unit;

  // Crisp grounded floor shadow cast below and right of the counter base
  ctx.fillStyle = 'rgba(10, 22, 16, 0.26)';
  ctx.fillRect(c.x + u * 2, c.y + c.h, c.w, u * 3);
  ctx.fillRect(c.x + c.w, c.y + u * 3, u * 2, c.h);

  const topDepth = Math.max(u * 8, Math.round(c.h * 0.4));
  const frontY = c.y + topDepth;
  const frontH = c.h - topDepth;

  // Outer pixel border around counter body
  ctx.fillStyle = '#142038';
  ctx.fillRect(c.x - u, c.y, c.w + u * 2, c.h + u);

  // Counter top plane: warm light-oak / cream Gen 4 beveled desk top
  ctx.fillStyle = '#e7d7b8';
  ctx.fillRect(c.x, c.y + u, c.w, topDepth - u);
  ctx.fillStyle = '#f7edd8';
  ctx.fillRect(c.x, c.y + u, c.w, u * 2);
  // Front lip bevel of the counter desk
  ctx.fillStyle = '#b99b6d';
  ctx.fillRect(c.x, frontY - u * 2, c.w, u * 2);

  // Vertical Gen 4 PokéMart blue & oak front paneling
  ctx.fillStyle = '#26539c';
  ctx.fillRect(c.x, frontY, c.w, frontH);
  ctx.fillStyle = '#1b3e78';
  ctx.fillRect(c.x, frontY + frontH - u * 3, c.w, u * 3);
  ctx.fillStyle = '#4e83d4';
  ctx.fillRect(c.x + u, frontY + u, c.w - u * 2, u);

  // Recessed vertical panel grooves across the counter front
  ctx.fillStyle = '#18376b';
  const grooveStep = Math.max(u * 14, Math.round(c.w / 6));
  for (let gx = c.x + grooveStep; gx < c.x + c.w - u * 4; gx += grooveStep) {
    ctx.fillRect(gx, frontY + u * 2, seam(u), frontH - u * 5);
  }

  // Left counter prop: Pixel Cash Register with glowing green screen
  const regW = u * 13;
  const regH = u * 10;
  const regX = c.x + u * 4;
  const regY = c.y - u * 4;
  ctx.fillStyle = '#1c2638';
  ctx.fillRect(regX, regY, regW, regH);
  ctx.fillStyle = '#7c8ca3';
  ctx.fillRect(regX + u, regY + u, regW - u * 2, regH - u * 2);
  ctx.fillStyle = '#25334a';
  ctx.fillRect(regX + u * 2, regY + u * 2, regW - u * 4, u * 3);
  ctx.fillStyle = '#6ee7a0';
  ctx.fillRect(regX + u * 3, regY + u * 3, regW - u * 6, u);
  ctx.fillStyle = '#cfd9e8';
  for (let k = 0; k < 4; k += 1) {
    ctx.fillRect(regX + u * (2 + k * 2.5), regY + u * 6, u * 1.5, u);
  }

  // Right counter prop: Glass Poké Ball Display Stand showing 3 mini Poké Balls
  const caseW = u * 22;
  const caseH = u * 9;
  const caseX = c.x + c.w - caseW - u * 6;
  const caseY = c.y - u * 3;
  ctx.fillStyle = '#1c2e4f';
  ctx.fillRect(caseX, caseY, caseW, caseH);
  ctx.fillStyle = '#a5dcff';
  ctx.fillRect(caseX + u, caseY + u, caseW - u * 2, caseH - u * 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(caseX + u * 2, caseY + u, u * 3, u);
  ctx.fillStyle = '#8b5e36';
  ctx.fillRect(caseX + u, caseY + caseH - u * 2, caseW - u * 2, u);
  const ballU = Math.max(1, Math.round(u * 0.72));
  for (let i = 0; i < 3; i += 1) {
    drawBitmap(
      ctx,
      POKE_BALL,
      Math.round(caseX + u * 2.5 + i * u * 6.2),
      Math.round(caseY + u * 2),
      ballU,
      BALL_COLORS,
    );
  }

  // Brass-trimmed royal-navy PokéMart emblem centered on the front paneling
  const label = 'PokéMart';
  ctx.font = `700 ${Math.max(10, Math.round(u * 4.2))}px "Chakra Petch", sans-serif`;
  const plateW = Math.min(c.w - u * 10, Math.ceil(ctx.measureText(label).width) + u * 6);
  const plateH = Math.min(frontH - u * 4, u * 7);
  const plateX = c.x + Math.round((c.w - plateW) / 2);
  const plateY = frontY + Math.round((frontH - plateH) / 2) - seam(u);
  ctx.fillStyle = '#0f1f44';
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(plateX, plateY, plateW, plateH);
  ctx.fillStyle = '#ffd84d';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, plateX + plateW / 2, plateY + plateH / 2, plateW - u * 2);
  ctx.textAlign = 'start';
}

/** Paints an Organic Habitat Display Pen (floor shadow, mottled grass/dirt habitat, back & side wood borders). */
function drawStaticPen(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
  const { inner } = pen;
  const rail = Math.max(u * 3, inner.x - pen.x);

  // Subtle grounded drop shadow cast by the pen frame onto the PokéMart floor tiles
  ctx.fillStyle = 'rgba(10, 22, 16, 0.24)';
  ctx.fillRect(pen.x + u * 2, pen.y + pen.h, pen.w, u * 2.5);
  ctx.fillRect(pen.x + pen.w, pen.y + u * 2, u * 2, pen.h);

  // Outer stone/oak low habitat enclosure frame
  ctx.fillStyle = '#362314';
  ctx.fillRect(pen.x, pen.y, pen.w, pen.h);
  ctx.fillStyle = '#8d623b';
  ctx.fillRect(pen.x + seam(u), pen.y + seam(u), pen.w - u, pen.h - u);
  ctx.fillStyle = '#ab7d51';
  ctx.fillRect(pen.x + u, pen.y + u, pen.w - u * 2, Math.max(u, rail - u * 2));

  // Organic indoor habitat ground (mottled meadow grass + dithered dirt basking spot + tufts)
  drawOrganicPenHabitat(ctx, inner.x, inner.y, inner.w, inner.h, u, pen.index);

  // Subtle interior shadow along the top & left inner border for recessed soil depth
  ctx.fillStyle = 'rgba(16, 36, 18, 0.22)';
  ctx.fillRect(inner.x, inner.y, inner.w, u * 2);
  ctx.fillRect(inner.x, inner.y, u, inner.h);

  // Top & side wooden fence posts
  const post = Math.max(u * 3, rail);
  ctx.fillStyle = '#4e321b';
  ctx.fillRect(pen.x, pen.y, post, post);
  ctx.fillRect(pen.x + pen.w - post, pen.y, post, post);
  ctx.fillStyle = '#ba8e60';
  ctx.fillRect(pen.x + seam(u), pen.y + seam(u), post - u, u);
  ctx.fillRect(pen.x + pen.w - post + seam(u), pen.y + seam(u), post - u, u);

  // Compact wooden/navy Pen number plaque nestled at the top-left corner
  ctx.font = `600 ${Math.max(10, Math.round(u * 3.8))}px "Chakra Petch", sans-serif`;
  const label = `Pen ${pen.index + 1}`;
  const plateW = Math.ceil(ctx.measureText(label).width) + u * 4;
  const plateX = inner.x + u * 2;
  const plateY = inner.y + u * 2;
  ctx.fillStyle = 'rgba(19, 36, 75, 0.88)';
  ctx.fillRect(plateX - seam(u), plateY - seam(u), plateW + seam(u) * 2, u * 5.5 + seam(u) * 2);
  ctx.fillStyle = '#ffd84d';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, plateX + u * 2, plateY + u * 2.8);
}

/**
 * Draws the pen's bottom front timber rail in the Y-sorted entity pass so Pokémon walking
 * near the front edge stay naturally *inside* the pen behind the front fence.
 */
function drawPenFrontRail(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
  const railH = Math.max(u * 3, pen.inner.x - pen.x);
  const railY = pen.y + pen.h - railH;
  ctx.fillStyle = '#362314';
  ctx.fillRect(pen.x, railY, pen.w, railH);
  ctx.fillStyle = '#8d623b';
  ctx.fillRect(pen.x + seam(u), railY + seam(u), pen.w - u, railH - u);
  ctx.fillStyle = '#b48759';
  ctx.fillRect(pen.x + u, railY + seam(u), pen.w - u * 2, u);

  // Bottom-left and bottom-right timber corner post caps
  const post = Math.max(u * 3, railH);
  ctx.fillStyle = '#4e321b';
  ctx.fillRect(pen.x, pen.y + pen.h - post, post, post);
  ctx.fillRect(pen.x + pen.w - post, pen.y + pen.h - post, post, post);
  ctx.fillStyle = '#c4986a';
  ctx.fillRect(pen.x + seam(u), pen.y + pen.h - post + seam(u), post - u, u);
  ctx.fillRect(pen.x + pen.w - post + seam(u), pen.y + pen.h - post + seam(u), post - u, u);
}

function drawCushionedBed(
  ctx: CanvasRenderingContext2D,
  bed: Rect,
  u: number,
  bedImg: HTMLImageElement | null,
): void {
  // Subtle contact shadow directly beneath each wooden pet bed frame
  ctx.fillStyle = 'rgba(18, 28, 22, 0.24)';
  ctx.fillRect(bed.x + u, bed.y + bed.h, bed.w - u, u * 2);

  if (bedImg) {
    ctx.drawImage(bedImg, bed.x, bed.y, bed.w, bed.h);
    return;
  }

  // Cozy oak-trimmed pet cushion bed fallback
  ctx.fillStyle = '#4d321c';
  fillPixelRoundRect(ctx, bed.x, bed.y, bed.w, bed.h, u * 2);
  ctx.fillStyle = PALETTE.berry;
  fillPixelRoundRect(ctx, bed.x + u, bed.y + u, bed.w - u * 2, bed.h - u * 2, u * 2);
  ctx.fillStyle = PALETTE.berryLight;
  fillPixelRoundRect(ctx, bed.x + u * 2, bed.y + u * 2, bed.w - u * 4, bed.h - u * 4, u);
  ctx.fillStyle = PALETTE.cream;
  fillPixelRoundRect(ctx, bed.x + u * 4, bed.y + u * 3, bed.w - u * 8, Math.round(bed.h * 0.28), u);
  const quiltY = bed.y + Math.round(bed.h * 0.62);
  ctx.fillStyle = '#f4d58a';
  ctx.fillRect(bed.x + u * 2, quiltY, bed.w - u * 4, u * 2);
}

/**
 * Modular renderer for the Resting / Nap Corner care alcove.
 * Renders a warm woven-carpet & oak-trimmed rug sitting seamlessly on the PokéMart floor
 * tiles with cushioned pixel beds (zero detached UI box), cleanly isolated for future
 * Resting Pen expansions.
 */
export function drawRestingPensArea(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const nap = layout.napArea;
  const u = layout.unit;
  const rugImg = getTileImage('indoor', 'healing-rug');
  const bedImg = getTileImage('indoor', 'healing-bed');

  // Subtle drop shadow + stitched oak carpet trim flush on the PokéMart floor tiles
  ctx.fillStyle = 'rgba(12, 26, 18, 0.2)';
  ctx.fillRect(nap.x + u, nap.y + nap.h, nap.w - u, u * 2);

  ctx.fillStyle = '#5c4028';
  fillPixelRoundRect(ctx, nap.x, nap.y, nap.w, nap.h, u * 2);

  const innerRug: Rect = {
    x: nap.x + u * 2,
    y: nap.y + u * 2,
    w: nap.w - u * 4,
    h: nap.h - u * 4,
  };
  if (rugImg) {
    tileImageRect(ctx, rugImg, innerRug, u * 16, u * 16);
  } else {
    ctx.fillStyle = '#cfe4c4';
    ctx.fillRect(innerRug.x, innerRug.y, innerRug.w, innerRug.h);
  }

  // Woven sage-and-cream decorative inner border stitching
  ctx.strokeStyle = '#e7f0d6';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(
    innerRug.x + u * 1.5,
    innerRug.y + u * 1.5,
    innerRug.w - u * 3,
    innerRug.h - u * 3,
  );

  // Small warm wooden plaque nestled at top-left of the Resting Corner rug
  const label = 'Resting Corner';
  ctx.font = `600 ${Math.max(10, Math.round(u * 3.6))}px "Chakra Petch", sans-serif`;
  const tagW = Math.ceil(ctx.measureText(label).width) + u * 4;
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(innerRug.x + u * 2, innerRug.y + u, tagW, u * 5.5);
  ctx.fillStyle = '#f5dfb8';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, innerRug.x + u * 4, innerRug.y + u * 3.8);

  for (const bed of layout.beds) {
    drawCushionedBed(ctx, bed, u, bedImg);
  }
}

/**
 * Paints a flush brushed-aluminum sliding door track and a woven PokéMart entrance welcome mat
 * resting naturally on the green indoor tile floor (no flat grey concrete slab).
 */
function drawEntranceFoyer(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const u = layout.unit;
  const d = layout.door;
  const f = layout.foyer;

  // Flush brushed-metal automatic door floor track right along the wall threshold
  ctx.fillStyle = '#334663';
  ctx.fillRect(d.x - u, layout.wall.h - seam(u), d.w + u * 2, u * 2.5);
  ctx.fillStyle = '#9bb0cc';
  ctx.fillRect(d.x, layout.wall.h, d.w, u);
  ctx.fillStyle = '#53698a';
  ctx.fillRect(d.x + u, layout.wall.h + u, d.w - u * 2, seam(u));

  // Cozy stitched crimson-and-gold woven welcome mat flush on the floor tiles
  const matX = d.x + u;
  const matY = layout.wall.h + u * 3;
  const matW = d.w - u * 2;
  const matH = Math.max(u * 8, f.h - u * 4);

  // Subtle grounded mat shadow
  ctx.fillStyle = 'rgba(12, 24, 18, 0.22)';
  ctx.fillRect(matX + seam(u), matY + matH, matW, u);

  // Dark crimson stitched border + plush warm berry center + subtle woven gold piping
  ctx.fillStyle = '#5e1c26';
  ctx.fillRect(matX, matY, matW, matH);
  ctx.fillStyle = '#a83645';
  ctx.fillRect(matX + u, matY + u, matW - u * 2, matH - u * 2);
  ctx.strokeStyle = '#f2cc6b';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(matX + u * 2, matY + u * 2, matW - u * 4, matH - u * 4);

  // Subtle woven rib texture lines across the mat
  ctx.fillStyle = 'rgba(255, 232, 196, 0.16)';
  for (let ry = matY + u * 3; ry < matY + matH - u * 3; ry += u * 2) {
    ctx.fillRect(matX + u * 3, ry, matW - u * 6, seam(u));
  }
}

/** Paints static indoor background geometry once per layout size / DPR / tileset decode. */
export function drawIndoorBackground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  ctx.imageSmoothingEnabled = false;
  drawMartFloor(ctx, layout);
  drawMartWall(ctx, layout);
  drawCounterFloorMat(ctx, layout);
  drawEntranceFoyer(ctx, layout);
  for (const pen of layout.pens) {
    drawStaticPen(ctx, pen, layout.unit);
  }
  drawRestingPensArea(ctx, layout);
}

/** Offscreen cache layer builder for `indoorRenderer`. */
export function buildIndoorBackgroundLayer(layout: ShopLayout): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const layer = document.createElement('canvas');
  layer.width = layout.width;
  layer.height = layout.height;
  const ctx = layer.getContext('2d');
  if (!ctx) return null;
  drawIndoorBackground(ctx, layout);
  return layer;
}

/**
 * Renders the recessed Gen 4 PokéMart Automatic Sliding Glass Vestibule integrated
 * seamlessly into the solid back wall, complete with outdoor sunlit meadow daylight,
 * smooth animated translucent glass leaves, frosted Poké Ball decal, and flush header transom.
 */
function drawSlidingDoors(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  shiftRunning: boolean,
): void {
  const d = layout.door;
  const u = layout.unit;
  const openAmt = Math.max(0, Math.min(1, world.doorOpenAmount));

  // Recessed brushed-slate architectural door casing built cleanly into the wall
  const headerH = Math.max(u * 7, Math.round(d.h * 0.24));
  ctx.fillStyle = '#132447';
  ctx.fillRect(d.x - u * 1.5, d.y - u, d.w + u * 3, d.h + u);
  ctx.fillStyle = '#335285';
  ctx.fillRect(d.x - u, d.y - seam(u), d.w + u * 2, d.h);

  // Recessed interior glass aperture showing warm sunlit outdoor meadow matching the windows
  const innerX = d.x + u;
  const innerY = d.y + headerH;
  const innerW = Math.max(u * 8, d.w - u * 2);
  const innerH = Math.max(u * 10, d.h - headerH);

  ctx.fillStyle = '#82cbf7';
  ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.fillStyle = '#c8ecff';
  ctx.fillRect(innerX, innerY + Math.round(innerH * 0.32), innerW, Math.round(innerH * 0.3));
  // Distant green meadow & sunlit stone walkway outside the store entrance
  const horizonY = innerY + Math.round(innerH * 0.56);
  ctx.fillStyle = '#5da84f';
  ctx.fillRect(innerX, horizonY, innerW, innerY + innerH - horizonY);
  ctx.fillStyle = '#478a3e';
  ctx.fillRect(innerX, horizonY - u, innerW, u * 1.5);
  const pathY = innerY + Math.round(innerH * 0.74);
  ctx.fillStyle = '#e8dfc4';
  ctx.fillRect(innerX + u * 2, pathY, innerW - u * 4, innerY + innerH - pathY);
  ctx.fillStyle = '#d3c59e';
  ctx.fillRect(innerX + u * 2, pathY, innerW - u * 4, seam(u));

  // Two translucent automatic sliding glass leaves parting smoothly toward left & right jambs,
  // each carrying its own half of the frosted Poké Ball decal so the emblem splits naturally
  // as the doors slide open and rejoins seamlessly when closed.
  const halfW = innerW / 2;
  const leafW = Math.max(u * 2.5, Math.round(halfW * (1 - openAmt * 0.76)));
  const leftLeafX = innerX;
  const rightLeafX = innerX + innerW - leafW;
  const ballU = Math.max(1, Math.round(u * 0.75));
  const { w: halfBallW, h: ballH } = bitmapSize(POKE_BALL_LEFT);
  const decalY = Math.round(innerY + innerH * 0.38 - (ballH * ballU) / 2);

  const leaves: Array<{ x: number; side: 'left' | 'right' }> = [
    { x: leftLeafX, side: 'left' },
    { x: rightLeafX, side: 'right' },
  ];

  for (const leaf of leaves) {
    const lx = leaf.x;
    // Tinted translucent glass pane
    ctx.fillStyle = shiftRunning ? 'rgba(148, 218, 255, 0.46)' : 'rgba(78, 126, 176, 0.66)';
    ctx.fillRect(lx, innerY, leafW, innerH);
    // Crisp white diagonal glass specular glare
    ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
    ctx.fillRect(lx + u, innerY + u * 2, Math.min(u * 2, Math.max(0, leafW - u * 2)), u * 6);
    // Horizontal brushed safety rail bar
    ctx.fillStyle = 'rgba(225, 242, 255, 0.75)';
    ctx.fillRect(lx + seam(u), innerY + Math.round(innerH * 0.56), Math.max(0, leafW - u), seam(u) * 1.5);

    // Split frosted Poké Ball half clipped cleanly inside this sliding glass panel
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx, innerY, leafW, innerH);
    ctx.clip();
    ctx.globalAlpha = 0.82;
    if (leaf.side === 'left') {
      drawBitmap(
        ctx,
        POKE_BALL_LEFT,
        Math.round(lx + leafW - halfBallW * ballU),
        decalY,
        ballU,
        BALL_COLORS,
      );
    } else {
      drawBitmap(ctx, POKE_BALL_RIGHT, Math.round(lx), decalY, ballU, BALL_COLORS);
    }
    ctx.restore();

    // Brushed aluminum vertical frame stiles + horizontal kickplate
    ctx.fillStyle = '#243c66';
    ctx.fillRect(lx, innerY, seam(u) * 1.5, innerH);
    ctx.fillRect(lx + leafW - seam(u) * 1.5, innerY, seam(u) * 1.5, innerH);
    ctx.fillRect(lx, innerY + innerH - u * 2, leafW, u * 2);
  }

  // Integrated dark-navy automatic-door transom header with glowing status LED + OPEN/CLOSED sign
  ctx.fillStyle = '#0e1d3b';
  ctx.fillRect(d.x, d.y, d.w, headerH);
  ctx.fillStyle = '#4e79c4';
  ctx.fillRect(d.x, d.y + headerH - seam(u), d.w, seam(u));

  // Motion-sensor LED pip on the left of the transom header
  const ledSize = Math.max(u * 1.5, 3);
  ctx.fillStyle = shiftRunning ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(d.x + u * 2, Math.round(d.y + (headerH - ledSize) / 2), ledSize, ledSize);

  // Illuminated OPEN / CLOSED transom plaque embedded cleanly inside the door header
  const signX = d.x + u * 5;
  const signW = Math.max(u * 14, d.w - u * 7);
  const signH = Math.max(u * 4.5, headerH - u * 2);
  const signY = Math.round(d.y + (headerH - signH) / 2);
  ctx.fillStyle = shiftRunning ? '#1b7a43' : '#9c2d23';
  ctx.fillRect(signX, signY, signW, signH);
  ctx.strokeStyle = shiftRunning ? '#6ee7a0' : '#ff9b91';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(signX, signY, signW, signH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(8, Math.round(u * 3.1))}px "Chakra Petch", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shiftRunning ? 'OPEN' : 'CLOSED', signX + signW / 2, signY + signH / 2, signW - u);
  ctx.textAlign = 'start';
}

/**
 * Renders the standing Gen 4 PokéMart PC Kiosk flush against the back wall (beside the
 * counter) with grounded floor shadow, live screen glow, and optional VIP! alert — zero
 * detached dark UI container.
 */
function drawWholesalePcKiosk(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  pulse: boolean,
): void {
  const pc = layout.pcStation;
  const u = layout.unit;
  const pcImg = getTileImage('indoor', 'pc-terminal');

  // Grounded contact shadow directly beneath the standing PC kiosk base
  drawPixelShadow(ctx, pc.x + pc.w / 2, pc.y + pc.h - u, pc.w * 0.88, u, 0.30);

  if (pcImg) {
    const drawH = pc.h - u * 4;
    const drawW = Math.min(pc.w, Math.round((drawH * 16) / 24));
    const drawX = Math.round(pc.x + (pc.w - drawW) / 2);
    const drawY = Math.round(pc.y + u * 2);
    ctx.drawImage(pcImg, drawX, drawY, drawW, drawH);

    // Subtle live monitor glow overlay inside the PC screen bezel
    ctx.fillStyle = world.hasVipContract
      ? pulse
        ? '#ffd84d'
        : '#f5b82e'
      : pulse
        ? 'rgba(120, 224, 255, 0.78)'
        : 'rgba(79, 183, 230, 0.45)';
    ctx.fillRect(
      drawX + Math.round(drawW * 0.2),
      drawY + Math.round(drawH * 0.16),
      Math.round(drawW * 0.6),
      Math.round(drawH * 0.24),
    );
  } else {
    // Crisp Gen 4 standing PC kiosk pixel architecture fallback
    const kx = pc.x + u * 3;
    const kw = pc.w - u * 6;
    const kh = pc.h - u * 4;
    ctx.fillStyle = '#182438';
    ctx.fillRect(kx, pc.y + u * 2, kw, kh);
    ctx.fillStyle = '#c5d2e3';
    ctx.fillRect(kx + u, pc.y + u * 3, kw - u * 2, kh - u * 2);
    ctx.fillStyle = '#2d5ca8';
    ctx.fillRect(kx + u, pc.y + u * 3, kw - u * 2, u * 3);
    ctx.fillStyle = world.hasVipContract
      ? pulse
        ? '#ffd84d'
        : '#f5b82e'
      : pulse
        ? '#78e0ff'
        : '#4fb7e6';
    ctx.fillRect(kx + u * 3, pc.y + u * 7, kw - u * 6, Math.round(kh * 0.34));
    ctx.fillStyle = '#4e5d75';
    ctx.fillRect(kx + u * 2, pc.y + Math.round(kh * 0.56), kw - u * 4, u * 3);
  }

  // Compact physical nameplate on the PC base + glowing VIP! alert when contract active
  const label = world.hasVipContract ? 'PC ★VIP' : 'PC';
  ctx.font = `700 ${Math.max(9, Math.round(u * 3.3))}px "Chakra Petch", sans-serif`;
  const tagW = Math.ceil(ctx.measureText(label).width) + u * 3.5;
  const tagH = Math.max(u * 4.8, 11);
  const tagX = Math.round(pc.x + (pc.w - tagW) / 2);
  const tagY = Math.round(pc.y + pc.h - tagH);
  ctx.fillStyle = world.hasVipContract ? '#5c3e00' : 'rgba(15, 31, 68, 0.92)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = world.hasVipContract ? '#ffd84d' : '#78a8f0';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = world.hasVipContract ? '#ffd84d' : '#eef5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
  ctx.textAlign = 'start';
}

/**
 * Renders the physical Oak & Glass Egg Incubator Care Pedestal directly on the PokéMart
 * floor tiles (no detached dark box), complete with floor shadow, warming glass pod, and
 * wobbling pixel eggs inside.
 */
function drawIncubatorPedestal(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  pulse: boolean,
): void {
  const inc = layout.incubatorStation;
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const incImg = getTileImage('indoor', 'incubator-pod');

  // Grounded floor contact shadow directly beneath the oak care table
  const tableW = Math.min(inc.w - u * 4, u * 44);
  const tableH = Math.round(inc.h * 0.42);
  const tableX = Math.round(inc.x + (inc.w - tableW) / 2);
  const tableY = Math.round(inc.y + inc.h - tableH - u * 2);

  drawPixelShadow(ctx, inc.x + inc.w / 2, tableY + tableH + u, tableW * 1.02, u, 0.28);

  // Warm oak care pedestal base sitting cleanly on the tile floor
  ctx.fillStyle = '#362314';
  ctx.fillRect(tableX, tableY, tableW, tableH);
  ctx.fillStyle = '#9b6e44';
  ctx.fillRect(tableX + u, tableY + u, tableW - u * 2, tableH - u * 2);
  ctx.fillStyle = '#cfa270';
  ctx.fillRect(tableX + u, tableY + u, tableW - u * 2, u * 2.5);
  // Subtle recessed drawer + brass pull on cabinet front
  ctx.fillStyle = '#7c5330';
  ctx.fillRect(tableX + u * 3, tableY + u * 5, tableW - u * 6, Math.max(u * 4, tableH - u * 10));
  ctx.fillStyle = '#ffd84d';
  ctx.fillRect(Math.round(tableX + tableW / 2 - u * 2), tableY + u * 6.5, u * 4, u);

  // Glowing glass Incubator pod resting cleanly on top of the oak table
  const podH = Math.max(u * 18, Math.round(inc.h * 0.62));
  const podW = Math.round((podH * 32) / 36);
  const podX = Math.round(inc.x + (inc.w - podW) / 2);
  const podY = Math.round(tableY - podH + u * 5);

  if (incImg) {
    ctx.drawImage(incImg, podX, podY, podW, podH);
  } else {
    ctx.fillStyle = '#1b3d7a';
    ctx.fillRect(podX, podY, podW, podH);
    ctx.fillStyle = '#9be8ff';
    ctx.fillRect(podX + u * 2, podY + u * 2, podW - u * 4, podH - u * 6);
  }

  // Golden ready-to-hatch highlight ring around the pod top when eggs are ready
  if (world.readyEggCount > 0) {
    ctx.strokeStyle = pulse ? '#ffd84d' : '#f5b82e';
    ctx.lineWidth = u;
    ctx.strokeRect(podX - seam(u), podY - seam(u), podW + u, podH + u);
  }

  // Wobbling pixel eggs nestled inside the incubator glass dome
  const eggScale = Math.max(1, Math.round(u * 1.0));
  const eggCountDraw = Math.min(3, Math.max(1, world.eggCount));
  for (let i = 0; i < eggCountDraw; i += 1) {
    const wobble =
      !still && world.eggCount > 0 ? Math.round(Math.sin(world.eggWobblePhase + i) * u * 0.8) : 0;
    const ex = Math.round(
      podX + podW * (eggCountDraw === 1 ? 0.5 : (i + 1) / (eggCountDraw + 1)) - 4 * eggScale + wobble,
    );
    const bob = !still && world.readyEggCount > 0 && pulse ? -u : 0;
    const ey = Math.round(podY + podH * 0.45 - 3.5 * eggScale + bob);
    if (world.eggCount > 0) {
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
    } else if (!incImg) {
      ctx.globalAlpha = 0.3;
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
      ctx.globalAlpha = 1;
    }
  }

  // Integrated wooden/navy label plaque along the bottom rail of the oak table
  const label = world.readyEggCount > 0 ? 'Eggs ★Ready' : 'Incubator';
  ctx.font = `600 ${Math.max(9, Math.round(u * 3.4))}px "Chakra Petch", sans-serif`;
  const tagW = Math.min(tableW - u * 2, Math.ceil(ctx.measureText(label).width) + u * 4);
  const tagH = Math.max(u * 5, 11);
  const tagX = Math.round(inc.x + (inc.w - tagW) / 2);
  const tagY = Math.round(tableY + tableH - tagH + seam(u));
  ctx.fillStyle = world.readyEggCount > 0 ? '#5c3e00' : 'rgba(15, 31, 68, 0.92)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = world.readyEggCount > 0 ? '#ffd84d' : '#6ee7a0';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = world.readyEggCount > 0 ? '#ffd84d' : '#eef5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
  ctx.textAlign = 'start';
}

function drawDynamicStations(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
): void {
  const still = world.reducedMotion || world.motionPaused;
  const pulse = still ? false : Math.floor(world.time * 2) % 2 === 0;
  drawWholesalePcKiosk(ctx, layout, world, pulse);
  drawIncubatorPedestal(ctx, layout, world, pulse);
}

function drawHumanFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  shirtColor: string,
  hairColor: string,
  walking: boolean,
  distance: number,
  facingLeft: boolean,
): void {
  const frameIdx = walking ? walkFrame(distance, u * 4) : 0;
  const bitmap = SHOPPER_FRAMES[frameIdx];
  const { w: bw, h: bh } = bitmapSize(bitmap);
  const colors = {
    h: hairColor,
    s: PALETTE.skin,
    e: PALETTE.woodDeep,
    c: shirtColor,
    p: '#5b4a3a',
    b: PALETTE.woodDeep,
  };
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (facingLeft) ctx.scale(-1, 1);
  drawBitmap(ctx, bitmap, -(bw * u) / 2, -bh * u, u, colors);
  ctx.restore();
}

/**
 * Exact 1:1 integer scale matching Human Trainer overworld pixels (`16×32` cells)
 * to the GBA floor tile art-pixel `unit`.
 */
function getHumanSpriteScale(layout: ShopLayout): number {
  return Math.max(2, layout.unit);
}

/**
 * Returns the exact backing-store Y coordinate of the top of a Human Trainer's visible
 * head/hat. Normalized `pret/pokeemerald` `16×32` frames contain ~10 transparent source
 * rows at the top (visible body spans rows `10..30`, i.e. 21px tall), so anchoring
 * indicators here places Patience Bars, `!` badges, and browsing icons snugly right
 * above each trainer's head instead of floating high above transparent frame padding.
 */
export function getHumanHeadTopY(feetY: number, layout: ShopLayout): number {
  const scale = getHumanSpriteScale(layout);
  return Math.round(feetY - 21 * scale);
}

function drawHumanSprite(
  ctx: CanvasRenderingContext2D,
  npcId: string,
  direction: CardinalDirection,
  isWalking: boolean,
  distancePx: number,
  x: number,
  y: number,
  layout: ShopLayout,
): number | null {
  const frame = getHumanNpcFrame(npcId, direction, isWalking, distancePx);
  if (!frame) return null;
  const scale = getHumanSpriteScale(layout);
  const drawW = frame.sw * scale;
  const drawH = frame.sh * scale;
  // Visible boots end at row 30 of 32 (1px bottom pad), so `+ scale` plants boots exactly at `y`.
  ctx.drawImage(
    frame.image,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    Math.round(x - drawW / 2),
    Math.round(y - drawH + scale),
    drawW,
    drawH,
  );
  return getHumanHeadTopY(y, layout);
}

/**
 * Draws all hired Shopkeepers standing physically *behind* the deep Checkout Counter.
 * Slot 0 (chosen starter clerk) stands right beside the Cash Register (`0.21 * counter.w`);
 * additional randomly hired clerks (from the Hire Counter Clerk upgrade) fill the center
 * (`0.50`) and right (`0.75`) stations cleanly behind the oak desk top.
 */
function drawShopkeepers(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  shopkeepers: readonly string[],
): void {
  const u = layout.unit;
  const roster = shopkeepers.length > 0 ? shopkeepers.slice(0, 3) : ['mart_employee'];
  const slotRatios = [0.21, 0.5, 0.75] as const;
  const cy = Math.round(layout.counter.y + u * 5);

  roster.forEach((clerkId, idx) => {
    const cx = Math.round(layout.counter.x + layout.counter.w * slotRatios[idx]);
    drawPixelShadow(ctx, cx, cy, getHumanSpriteScale(layout) * 10, u, 0.24);
    const drawnH = drawHumanSprite(ctx, clerkId, 'down', false, 0, cx, cy, layout);
    if (drawnH === null) {
      drawHumanFallback(ctx, cx, cy, u, '#2d5ca8', HAIR_COLORS[idx % HAIR_COLORS.length], false, 0, false);
    }
    // Subtle welcoming wave sparkle/nod timer on the primary register clerk
    if (idx === 0 && world.clerkWaveTimer > 0 && !world.reducedMotion && !world.motionPaused) {
      const headY = drawnH ?? cy - u * 15;
      drawBitmap(
        ctx,
        SPARKLE,
        Math.round(cx + u * 7),
        Math.round(headY - u * 2),
        Math.max(1, Math.round(u * 0.65)),
        ICON_COLORS,
      );
    }
  });
}

function drawPokemon(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  ent: PokemonEntity,
  adapter: SpriteEntityAdapter,
  hovered: boolean,
): void {
  const u = layout.unit;
  const pose = getPokemonPose(world, ent);
  const feetX = Math.round(ent.x);
  const feetY = Math.round(ent.y);

  const animTime = world.reducedMotion || world.motionPaused ? 0 : world.time;
  const frame = adapter.getFrame(ent.speciesId, ent.isShiny, ent.state, animTime, ent.direction);

  let shadowW = u * 9;
  let visibleH = u * 16;
  let drawW = 0;
  let drawH = 0;
  let frameScale = u;
  if (frame) {
    const sized = computeFrameDrawSize(frame, layout);
    drawW = sized.drawW;
    drawH = sized.drawH;
    frameScale = drawH / Math.max(1, frame.sh);
    const visW = frame.visibleWidthPx ?? Math.round(frame.sw * 0.56);
    const visH = frame.visibleHeightPx ?? Math.round(frame.sh * 0.56);
    shadowW = Math.max(u * 6, Math.round(visW * frameScale * 0.78));
    visibleH = Math.max(u * 10, Math.round(visH * frameScale));
  }

  // Tight grounded pixel-oval contact shadow directly beneath the Pokémon's feet
  drawPixelShadow(ctx, feetX, feetY, shadowW * pose.scaleX, u, ent.state === 'sleep' ? 0.24 : 0.36);

  if (hovered) {
    ctx.fillStyle = 'rgba(255, 216, 77, 0.58)';
    ctx.fillRect(Math.round(feetX - shadowW * 0.52), feetY - seam(u), Math.round(shadowW * 1.04), u * 2);
  }

  ctx.save();
  ctx.translate(feetX, feetY);
  if (frame) {
    const mirror = frame.usesDirectionRow ? 1 : frame.facesLeft ? ent.facing : -ent.facing;
    ctx.scale(mirror * pose.scaleX, pose.scaleY);
    // Align the lowest opaque pixel row directly onto feetY (eliminates PMD cell padding float)
    const footPad = frame.usesDirectionRow
      ? Math.round((frame.bottomPadPx ?? Math.round(frame.sh * 0.28)) * frameScale)
      : 6 * layout.spriteScale;
    ctx.drawImage(
      frame.image,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      Math.round(-drawW / 2),
      Math.round(-drawH + footPad),
      drawW,
      drawH,
    );
  } else {
    ctx.scale(ent.facing * pose.scaleX, pose.scaleY);
    ctx.fillStyle = PALETTE.creamDeep;
    fillPixelRoundRect(ctx, -u * 4, -u * 8, u * 8, u * 8, u);
  }
  ctx.restore();

  if (hovered) {
    const still = world.reducedMotion || world.motionPaused;
    const bob = still ? 0 : Math.round(Math.sin(world.time * 6) * u);
    const { w: cw } = bitmapSize(HOVER_CARET);
    drawBitmap(
      ctx,
      HOVER_CARET,
      Math.round(feetX - (cw * u) / 2),
      Math.round(feetY - visibleH - u * 4 + bob),
      u,
      ICON_COLORS,
    );
  }
}

function drawWalker(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  walker: CustomerWalker,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const walking = walker.state !== 'browsing' && !still;

  drawPixelShadow(ctx, walker.x, walker.y, getHumanSpriteScale(layout) * 10, u, 0.32);

  const drawnH = drawHumanSprite(
    ctx,
    walker.npcId,
    walker.cardinalDir,
    walking,
    walker.distance,
    walker.x,
    walker.y,
    layout,
  );
  if (drawnH !== null) return;

  drawHumanFallback(
    ctx,
    walker.x,
    walker.y,
    u,
    ARCHETYPE_SHIRTS[walker.archetypeId],
    HAIR_COLORS[Math.floor(walker.look * HAIR_COLORS.length) % HAIR_COLORS.length],
    walking,
    walker.distance,
    walker.facing === -1,
  );
}

function drawQueuedShopper(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  q: QueuedShopperEntity,
  hovered: boolean,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const walking = q.state === 'walking-to-counter' && !still;
  drawPixelShadow(ctx, q.x, q.y, getHumanSpriteScale(layout) * 10, u, 0.34);

  const spriteHeadTop = drawHumanSprite(
    ctx,
    q.npcId,
    q.cardinalDir,
    walking,
    q.distance,
    q.x,
    q.y,
    layout,
  );
  let headTopY = spriteHeadTop ?? Math.round(q.y - u * 15);
  if (spriteHeadTop === null) {
    drawHumanFallback(
      ctx,
      q.x,
      q.y,
      u,
      ARCHETYPE_SHIRTS[q.archetypeId],
      '#3c2918',
      walking,
      q.distance,
      q.cardinalDir === 'left',
    );
    headTopY = Math.round(q.y - u * 15);
  }

  // Live Patience Bar anchored snugly just a few pixels above the trainer's hat
  const ratio = q.maxPatience > 0 ? Math.min(1, Math.max(0, q.patience / q.maxPatience)) : 1;
  const barW = Math.max(u * 11, 22);
  const barH = Math.max(u * 2, 4);
  const bx = Math.round(q.x - barW / 2);
  const by = Math.round(headTopY - barH - u * 1.5);
  ctx.fillStyle = '#070d1f';
  ctx.fillRect(bx - seam(u), by - seam(u), barW + seam(u) * 2, barH + seam(u) * 2);
  ctx.fillStyle = '#1b2b4d';
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = ratio > 0.6 ? '#2ecc71' : ratio > 0.35 ? '#ffd84d' : '#e74c3c';
  ctx.fillRect(bx, by, Math.round(barW * ratio), barH);

  // Compact bouncing clickable `!` offer bubble sitting right above the Patience Bar
  const bob = still ? 0 : Math.round(Math.sin(q.time * 5) * u * 0.75);
  const { w: ew, h: eh } = bitmapSize(EXCLAMATION_MARK);
  const bubW = (ew + 5) * u;
  const bubH = (eh + 2) * u;
  const bubX = Math.round(q.x - bubW / 2);
  const bubY = Math.round(by - bubH - u * 1.5 + bob);
  ctx.fillStyle = hovered || q.isVip ? '#ffd84d' : '#1a3160';
  ctx.fillRect(bubX, bubY, bubW, bubH);
  ctx.strokeStyle = hovered ? '#ffffff' : '#78a8f0';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(bubX, bubY, bubW, bubH);
  drawBitmap(
    ctx,
    EXCLAMATION_MARK,
    Math.round(bubX + (bubW - ew * u) / 2),
    Math.round(bubY + (bubH - eh * u) / 2),
    u,
    {
      kk: hovered || q.isVip ? '#261600' : '#ffd84d',
      k: hovered || q.isVip ? '#261600' : '#ffd84d',
    },
  );
}

function drawWalkerBubble(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  walker: CustomerWalker,
): void {
  const showing = walker.state === 'browsing' || (walker.state === 'leaving' && walker.happy);
  if (!showing) return;
  const u = layout.unit;
  const icon = walker.happy ? HEART : BUBBLE_ICONS[walker.archetypeId];
  const { w: iw, h: ih } = bitmapSize(icon);
  const bw = (iw + 4) * u;
  const bh = (ih + 4) * u;
  const still = world.reducedMotion || world.motionPaused;
  const float = still ? 0 : Math.round(Math.sin(walker.time * 3) * 0.6 * u);
  const headTopY = getHumanHeadTopY(walker.y, layout);
  const x = Math.round(walker.x - bw / 2);
  const y = Math.round(headTopY - bh - u * 1.5 + float);

  ctx.fillStyle = '#0c1733';
  ctx.fillRect(x - seam(u), y - seam(u), bw + seam(u) * 2, bh + seam(u) * 2);
  ctx.fillStyle = '#1e3a73';
  ctx.fillRect(x, y, bw, bh);
  drawBitmap(ctx, icon, x + u * 2, y + u * 2, u, ICON_COLORS);
}

function drawParticle(ctx: CanvasRenderingContext2D, layout: ShopLayout, p: Particle): void {
  const u = layout.unit;
  const small = Math.max(1, Math.round(u * 0.75));
  ctx.globalAlpha = particleAlpha(p);
  switch (p.kind) {
    case 'heart':
      drawBitmap(ctx, HEART, p.x - 3.5 * small, p.y - 3 * small, small, ICON_COLORS);
      break;
    case 'sparkle':
      drawBitmap(ctx, SPARKLE, p.x - 3.5 * small, p.y - 2.5 * small, small, ICON_COLORS);
      break;
    case 'sweat':
      drawBitmap(ctx, SWEAT_DROP, p.x - 2.5 * small, p.y - 2.5 * small, small, ICON_COLORS);
      break;
    case 'zzz': {
      const sway = Math.sin(p.age * 3 + p.phase) * u * 2;
      const zu = Math.max(1, Math.round(small * (0.7 + (p.age / p.life) * 0.8)));
      drawBitmap(ctx, LETTER_Z, p.x + sway, p.y, zu, ICON_COLORS);
      break;
    }
    case 'coin': {
      drawBitmap(ctx, COIN, p.x - 3.5 * u, p.y - 3 * u, u, ICON_COLORS);
      if (p.label) {
        ctx.font = `700 ${Math.max(10, Math.round(u * 5))}px "Chakra Petch", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, u);
        ctx.strokeStyle = '#070d1f';
        ctx.strokeText(p.label, p.x + u * 5, p.y);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText(p.label, p.x + u * 5, p.y);
      }
      break;
    }
  }
  ctx.globalAlpha = 1;
}

function drawHoverHighlight(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  target: CanvasHitTarget | null,
): void {
  if (!target) return;
  const u = layout.unit;

  let rect: Rect | null = null;
  if (target.kind === 'station') {
    if (target.station === 'wholesale') rect = layout.pcStation;
    else if (target.station === 'breeding') rect = layout.incubatorStation;
    else if (target.station === 'upgrades') rect = layout.upgradesStation;
    else if (target.station === 'healing') rect = layout.napArea;
  } else if (target.kind === 'empty-pen') {
    rect = layout.pens[target.penIndex] ?? null;
  }

  if (rect) {
    const arm = Math.max(u * 4, Math.min(u * 8, Math.round(Math.min(rect.w, rect.h) * 0.22)));
    const lw = Math.max(2, u);
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + arm);
    ctx.lineTo(rect.x, rect.y);
    ctx.lineTo(rect.x + arm, rect.y);
    ctx.moveTo(rect.x + rect.w - arm, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + arm);
    ctx.moveTo(rect.x + rect.w, rect.y + rect.h - arm);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w - arm, rect.y + rect.h);
    ctx.moveTo(rect.x + arm, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h - arm);
    ctx.stroke();
  }
}

/** Renders one complete frame of the full-viewport cohesive Indoor PokéMart scene. */
export function renderIndoorScene(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  background: CanvasImageSource | null,
  adapter: SpriteEntityAdapter,
  options: IndoorRenderOptions,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Always re-apply after resize/DPR reset so pixel art stays razor-sharp.
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (background) ctx.drawImage(background, 0, 0);
  else drawIndoorBackground(ctx, layout);

  drawDynamicWallClock(
    ctx,
    layout,
    options.shiftTick ?? 0,
    options.shiftDurationTicks ?? 100,
    options.shiftRunning,
  );
  drawSlidingDoors(ctx, layout, world, options.shiftRunning);

  // True behind-counter layering: hired Shopkeepers render behind the desk (Slot 0 right beside
  // the Cash Register), then the deep Counter desk/front/register overlays their lower legs.
  drawShopkeepers(ctx, layout, world, options.shopkeepers ?? ['mart_employee']);
  drawCounterForeground(ctx, layout);

  drawDynamicStations(ctx, layout, world);

  const hoverPokemonUid = options.hoverTarget?.kind === 'pokemon' ? options.hoverTarget.uid : null;
  const hoverOfferUid =
    options.hoverTarget?.kind === 'counter-offer' ? options.hoverTarget.offerUid : null;

  // Unified 2.5D Y-sort across grounded Pokémon, Pen front wooden rails, and Human Shoppers
  const drawables: Array<{ y: number; draw: () => void }> = [];
  for (const pen of layout.pens) {
    drawables.push({
      y: pen.y + pen.h,
      draw: () => drawPenFrontRail(ctx, pen, layout.unit),
    });
  }
  for (const ent of world.pokemon.values()) {
    drawables.push({
      y: ent.y,
      draw: () => drawPokemon(ctx, layout, world, ent, adapter, ent.uid === hoverPokemonUid),
    });
  }
  for (const walker of world.walkers.values()) {
    drawables.push({
      y: walker.y + 0.5,
      draw: () => drawWalker(ctx, layout, world, walker),
    });
  }
  for (const q of world.queuedShoppers.values()) {
    drawables.push({
      y: q.y + 0.6,
      draw: () => drawQueuedShopper(ctx, layout, world, q, q.offerUid === hoverOfferUid),
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Subtle corner hover highlight cleanly above the hovered station/pen
  drawHoverHighlight(ctx, layout, options.hoverTarget);

  for (const walker of world.walkers.values()) drawWalkerBubble(ctx, layout, world, walker);
  for (const p of world.particles) drawParticle(ctx, layout, p);
}
