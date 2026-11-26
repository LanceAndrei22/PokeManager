/**
 * Full-screen Indoor Gen 4 PokéMart pixel renderer:
 * - Caches tiled GBA PokéMart architecture (`floor-tile`, `wall-tile`, `clock-wall`,
 *   `shelf-blue`, `plant-pot`, `counter-left/mid/right`, `pen-grass` + `pen-fence`,
 *   `healing-rug` + `healing-bed`, `mat`, `upgrades-board`) into an offscreen background layer.
 * - Renders live dynamic states every frame: sliding glass entrance doors (`door-closed` /
 *   `door-open` + `OPEN`/`CLOSED`), Human Store Clerk Leo (`mart_employee`) behind the
 *   register, blinking Wholesale PC (`pc-terminal`), glowing Egg Incubator (`incubator-pod` +
 *   wobbling eggs), depth-sorted 100% PMD SpriteCollab store Pokémon, Human Trainer shoppers,
 *   queued register shoppers with Patience Bars & `!` badges, hover highlights, and particles.
 */
import type { CustomerArchetypeId } from '../data/types';
import {
  HOP_DURATION,
  STATIC_POSE,
  STATIC_SLEEP_POSE,
  breathingPose,
  hopPose,
  sleepPose,
  walkFrame,
  type Pose,
} from './animation';
import { getHumanNpcFrame, type CardinalDirection } from './humanNpcAnimator';
import { particleAlpha, type Particle } from './particles';
import {
  COIN,
  EGG_ICON,
  EXCLAMATION_MARK,
  HEART,
  ICON_COLORS,
  LETTER_Z,
  PALETTE,
  PC_ICON,
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
const BALL_COLORS = { r: '#e04848', k: PALETTE.woodDeep, w: PALETTE.white };
const HOVER_CARET: PixelBitmap = ['yyyyy', '.yyy.', '..y..'];

function seam(unit: number): number {
  return Math.max(1, Math.round(unit / 2));
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function computeFrameDrawSize(
  frame: SpriteFrame,
  layout: ShopLayout,
): { drawW: number; drawH: number } {
  const maxDim = Math.max(frame.sw, frame.sh);
  if (!frame.usesDirectionRow) {
    return { drawW: layout.spriteSize, drawH: layout.spriteSize };
  }
  const maxAllowed = layout.spriteSize * 1.75;
  const scale =
    maxDim * layout.unit <= maxAllowed
      ? layout.unit
      : Math.max(1, Math.floor(maxAllowed / maxDim));
  return { drawW: frame.sw * scale, drawH: frame.sh * scale };
}

function getPokemonPose(world: ShopWorld, ent: PokemonEntity, size: number, unit: number): Pose {
  const still = world.reducedMotion || world.motionPaused;
  if (ent.state === 'sleep') return still ? STATIC_SLEEP_POSE : sleepPose(world.time, ent.phase);
  if (ent.state === 'hop' && !still) return hopPose(ent.stateTime / HOP_DURATION, size * 0.14);
  if (ent.state === 'walk' && !still) return breathingPose(world.time * 1.8, ent.phase, unit * 0.95);
  return still ? STATIC_POSE : breathingPose(world.time, ent.phase, unit * 0.75);
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
    return;
  }
  drawPlankFloor(ctx, floorRect, layout.unit);
}

function drawMartWall(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const { wall, unit: u, width } = layout;
  const wallImg = getTileImage('indoor', 'wall-tile');
  const shelfImg = getTileImage('indoor', 'shelf-blue');
  const plantImg = getTileImage('indoor', 'plant-pot');
  const clockImg = getTileImage('indoor', 'clock-wall');

  if (wallImg) {
    // Upper Gen 4 PokéMart ceiling molding + wainscot + GBA wall-tile band
    ctx.fillStyle = '#1b3d7a';
    ctx.fillRect(wall.x, wall.y, wall.w, Math.max(u * 4, Math.round(wall.h * 0.2)));
    ctx.fillStyle = '#dde6f0';
    ctx.fillRect(wall.x, wall.y + u * 4, wall.w, Math.max(0, wall.h - u * 4));
    ctx.fillStyle = '#c8d6e8';
    for (let x = 0; x < width; x += u * 16) {
      ctx.fillRect(x, wall.y + u * 4, seam(u), wall.h - u * 4);
    }
    const tileW = u * 16;
    const bandH = Math.min(wall.h - u * 4, u * 32);
    const bandY = wall.h - bandH;
    for (let x = 0; x < width; x += tileW) {
      ctx.drawImage(wallImg, x, bandY, tileW, bandH);
    }
  } else {
    ctx.fillStyle = '#e8dfc9';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = '#d8cbb0';
    for (let row = 0, y = u * 4; y < wall.h - u * 12; row += 1, y += u * 6) {
      for (let x = row % 2 === 0 ? 0 : u * 4; x < width; x += u * 8) {
        ctx.fillRect(x, y, u, u);
      }
    }
    const wainTop = wall.h - u * 11;
    ctx.fillStyle = '#2d5ca8';
    ctx.fillRect(0, wainTop, width, wall.h - wainTop);
    ctx.fillStyle = '#4e7dd1';
    ctx.fillRect(0, wainTop, width, u);
    ctx.fillStyle = '#1b3d7a';
    for (let x = u * 2; x < width; x += u * 6) {
      ctx.fillRect(x, wainTop + u * 2, seam(u), wall.h - wainTop - u * 4);
    }
  }

  ctx.fillStyle = '#0c1733';
  ctx.fillRect(0, wall.h - u * 2, width, u * 2);

  // Sunlit window
  const wRect = layout.window;
  ctx.fillStyle = '#1b3d7a';
  ctx.fillRect(wRect.x, wRect.y, wRect.w, wRect.h);
  ctx.fillStyle = '#a5dcff';
  ctx.fillRect(wRect.x + u, wRect.y + u, wRect.w - u * 2, wRect.h - u * 2);
  ctx.fillStyle = '#1b3d7a';
  ctx.fillRect(wRect.x + Math.round(wRect.w / 2) - seam(u), wRect.y, u, wRect.h);
  ctx.fillRect(wRect.x, wRect.y + Math.round(wRect.h / 2) - seam(u), wRect.w, u);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(wRect.x + u * 2, wRect.y + u * 2, u * 2, u);

  // Wall clock & merchandise shelves flanking clear wall sections
  if (clockImg) {
    const cs = u * 12;
    const cx = Math.min(wRect.x - cs - u * 4, layout.counter.x + layout.counter.w + u * 6);
    if (cx > layout.counter.x + layout.counter.w + u * 2) {
      ctx.drawImage(clockImg, cx, wall.h - u * 28, cs, cs);
    }
  }
  if (shelfImg) {
    const sw = u * 28;
    const sh = u * 28;
    const shelfX = wRect.x + wRect.w + u * 6;
    if (shelfX + sw < layout.door.x - u * 4) {
      ctx.drawImage(shelfImg, shelfX, wall.h - sh + u * 2, sw, sh);
    }
  }
  if (plantImg) {
    const pw = u * 12;
    const ph = u * 24;
    if (layout.counter.x - pw >= u * 2) {
      ctx.drawImage(plantImg, layout.counter.x - pw, wall.h - ph + u * 2, pw, ph);
    }
    if (layout.door.x + layout.door.w + pw + u * 2 < width) {
      ctx.drawImage(plantImg, layout.door.x + layout.door.w + u, wall.h - ph + u * 2, pw, ph);
    }
  }

  // Pendant lamps
  for (const lamp of layout.lamps) {
    ctx.fillStyle = '#24180d';
    ctx.fillRect(lamp.x - seam(u), 0, seam(u), lamp.y - u * 3);
    ctx.fillStyle = PALETTE.honey;
    ctx.fillRect(lamp.x - u * 3, lamp.y - u * 2, u * 6, u * 2);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(lamp.x - u, lamp.y, u * 2, u);
  }
}

function drawStaticCounter(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const c = layout.counter;
  const u = layout.unit;
  const leftImg = getTileImage('indoor', 'counter-left');
  const midImg = getTileImage('indoor', 'counter-mid');
  const rightImg = getTileImage('indoor', 'counter-right');

  if (leftImg && midImg && rightImg) {
    const endW = Math.min(u * 16, Math.round(c.w * 0.25));
    const rightH = Math.round(c.h * 1.35);
    ctx.drawImage(leftImg, c.x, c.y, endW, c.h);
    const midArea: Rect = { x: c.x + endW, y: c.y, w: Math.max(0, c.w - endW * 2), h: c.h };
    if (midArea.w > 0) {
      tileImageRect(ctx, midImg, midArea, u * 16, c.h);
    }
    ctx.drawImage(rightImg, c.x + c.w - endW, c.y + c.h - rightH, endW, rightH);
  } else {
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(c.x, c.y + u * 2, c.w, c.h - u * 2);
    ctx.fillStyle = '#7e5c3b';
    for (let x = c.x + u * 8; x < c.x + c.w; x += u * 8) {
      ctx.fillRect(x, c.y + u * 2, seam(u), c.h - u * 2);
    }
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(c.x - u, c.y, c.w + u * 2, u * 2);

    ctx.fillStyle = '#4d5d73';
    ctx.fillRect(c.x + u * 3, c.y - u * 6, u * 10, u * 6);
    ctx.fillStyle = '#78e0ff';
    ctx.fillRect(c.x + u * 5, c.y - u * 5, u * 6, u * 2);
    drawBitmap(ctx, POKE_BALL, c.x + c.w - u * 9, c.y - u * 5, u, BALL_COLORS);
  }

  // Crisp PokéMart signboard front plate in Pixelify Sans
  const label = 'PokéMart';
  ctx.font = `600 ${Math.max(10, Math.round(u * 4.2))}px "Chakra Petch", sans-serif`;
  const plateW = Math.min(c.w - u * 6, Math.ceil(ctx.measureText(label).width) + u * 5);
  const plateX = c.x + Math.round((c.w - plateW) / 2);
  const plateY = c.y + Math.max(u * 2, Math.round(c.h * 0.22));
  const plateH = Math.min(c.h - u * 3, u * 7);
  ctx.fillStyle = '#13244b';
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

function drawStaticPen(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
  const { inner } = pen;
  const grassTile = getTileImage('indoor', 'pen-grass');
  const fenceTile = getTileImage('indoor', 'pen-fence');

  ctx.fillStyle = '#6f4e2e';
  ctx.fillRect(pen.x, pen.y, pen.w, pen.h);

  if (grassTile) {
    tileImageRect(ctx, grassTile, inner, u * 16, u * 16);
  } else {
    ctx.fillStyle = '#f6e2a6';
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    const speckles = Math.floor((inner.w * inner.h) / (u * u * 44));
    for (let i = 0; i < speckles; i += 1) {
      const h = hash(i * 7 + pen.index * 1013);
      const sx = inner.x + (h % Math.max(1, inner.w - u * 2));
      const sy = inner.y + ((h >>> 11) % Math.max(1, inner.h - u));
      ctx.fillStyle = h % 3 === 0 ? '#d9b257' : '#e7c46b';
      ctx.fillRect(sx, sy, u * 2, seam(u));
    }
  }

  ctx.fillStyle = 'rgba(20, 40, 20, 0.14)';
  ctx.fillRect(inner.x, inner.y, inner.w, u * 2);

  if (fenceTile) {
    const fw = Math.max(u * 4, inner.x - pen.x);
    tileImageRect(ctx, fenceTile, { x: pen.x, y: pen.y, w: pen.w, h: fw }, u * 12, fw);
    tileImageRect(
      ctx,
      fenceTile,
      { x: pen.x, y: pen.y + pen.h - fw, w: pen.w, h: fw },
      u * 12,
      fw,
    );
  }

  // Timber corner posts & borders
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

  // Crisp pen label plate
  ctx.font = `600 ${Math.max(10, Math.round(u * 4))}px "Chakra Petch", sans-serif`;
  const label = `Pen ${pen.index + 1}`;
  const plateW = Math.ceil(ctx.measureText(label).width) + u * 4;
  const plateX = inner.x + u * 2;
  const plateY = inner.y + u * 2;
  ctx.fillStyle = 'rgba(19, 36, 75, 0.92)';
  ctx.fillRect(plateX - seam(u), plateY - seam(u), plateW + seam(u) * 2, u * 6 + seam(u) * 2);
  ctx.fillStyle = '#ffd84d';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, plateX + u * 2, plateY + u * 3);
}

function drawStaticBed(
  ctx: CanvasRenderingContext2D,
  bed: Rect,
  u: number,
  bedImg: HTMLImageElement | null,
): void {
  if (bedImg) {
    ctx.drawImage(bedImg, bed.x, bed.y, bed.w, bed.h);
    return;
  }
  ctx.fillStyle = PALETTE.berry;
  fillPixelRoundRect(ctx, bed.x, bed.y, bed.w, bed.h, u * 2);
  ctx.fillStyle = PALETTE.berryLight;
  fillPixelRoundRect(ctx, bed.x + u, bed.y + u, bed.w - u * 2, bed.h - u * 2, u * 2);
  ctx.fillStyle = PALETTE.cream;
  fillPixelRoundRect(ctx, bed.x + u * 3, bed.y + u * 2, bed.w - u * 6, Math.round(bed.h * 0.3), u);
  const quiltY = bed.y + Math.round(bed.h * 0.64);
  ctx.fillStyle = '#f4d58a';
  ctx.fillRect(bed.x + u, quiltY, bed.w - u * 2, u * 2);
}

function drawStationLabelBadge(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  u: number,
): void {
  ctx.font = `600 ${Math.max(10, Math.round(u * 3.8))}px "Chakra Petch", sans-serif`;
  const badgeW = Math.min(rect.w - u * 2, Math.ceil(ctx.measureText(label).width) + u * 4);
  const badgeH = u * 6;
  const bx = Math.round(rect.x + (rect.w - badgeW) / 2);
  const by = rect.y + rect.h - badgeH - u;
  ctx.fillStyle = 'rgba(12, 23, 51, 0.9)';
  ctx.fillRect(bx, by, badgeW, badgeH);
  ctx.strokeStyle = '#78a8f0';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(bx, by, badgeW, badgeH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef5ff';
  ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2, badgeW - u * 2);
  ctx.textAlign = 'start';
}

function drawStaticStations(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const u = layout.unit;
  const matImg = getTileImage('indoor', 'mat');
  const rugImg = getTileImage('indoor', 'healing-rug');
  const bedImg = getTileImage('indoor', 'healing-bed');
  const upgImg = getTileImage('indoor', 'upgrades-board');

  // Entrance stone foyer + authentic welcome mat
  const f = layout.foyer;
  ctx.fillStyle = '#6f7c91';
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = '#8b99b0';
  for (let gx = f.x + u * 2; gx < f.x + f.w - u * 2; gx += u * 6) {
    ctx.fillRect(gx, f.y + u * 2, u * 4, u * 2);
  }
  const matH = Math.max(u * 5, f.h - u * 4);
  if (matImg) {
    ctx.drawImage(matImg, layout.door.x, f.y + u * 2, layout.door.w, matH);
  } else {
    ctx.fillStyle = PALETTE.berry;
    ctx.fillRect(layout.door.x, f.y + u * 2, layout.door.w, matH);
  }

  // Healing Corner rug & pixel pet beds
  const nap = layout.napArea;
  if (rugImg) {
    tileImageRect(ctx, rugImg, nap, u * 16, u * 16);
    ctx.strokeStyle = '#26532c';
    ctx.lineWidth = Math.max(1, seam(u));
    ctx.strokeRect(nap.x, nap.y, nap.w, nap.h);
  } else {
    ctx.fillStyle = '#d9ecd2';
    fillPixelRoundRect(ctx, nap.x, nap.y, nap.w, nap.h, u * 2);
  }
  ctx.font = `600 ${Math.max(10, Math.round(u * 4))}px "Chakra Petch", sans-serif`;
  const napTagW = Math.ceil(ctx.measureText('Nap Corner').width) + u * 4;
  ctx.fillStyle = 'rgba(19, 36, 75, 0.9)';
  ctx.fillRect(nap.x + u * 2, nap.y + u * 1.5, napTagW, u * 6);
  ctx.fillStyle = '#9be89b';
  ctx.textBaseline = 'middle';
  ctx.fillText('Nap Corner', nap.x + u * 4, nap.y + u * 4.5);
  for (const bed of layout.beds) {
    drawStaticBed(ctx, bed, u, bedImg);
  }

  // Base station pads for Incubator, PC Terminal, Upgrades Board
  const stations: Array<{ rect: Rect; label: string; bg: string; border: string }> = [
    { rect: layout.incubatorStation, label: 'Incubator', bg: '#213a66', border: '#6ee7a0' },
    { rect: layout.pcStation, label: 'Wholesale PC', bg: '#1b315e', border: '#78e0ff' },
    { rect: layout.upgradesStation, label: 'Upgrades', bg: '#4e3520', border: '#ffd84d' },
  ];

  for (const st of stations) {
    ctx.fillStyle = '#070d1f';
    ctx.fillRect(st.rect.x, st.rect.y, st.rect.w, st.rect.h);
    ctx.fillStyle = st.bg;
    ctx.fillRect(st.rect.x + u, st.rect.y + u, st.rect.w - u * 2, st.rect.h - u * 2);
    ctx.fillStyle = st.border;
    ctx.fillRect(st.rect.x + u, st.rect.y + u, st.rect.w - u * 2, seam(u));
    drawStationLabelBadge(ctx, st.rect, st.label, u);
  }

  // Static oak Upgrades Board sprite when loaded
  if (upgImg) {
    const upg = layout.upgradesStation;
    const maxW = upg.w - u * 6;
    const maxH = upg.h - u * 10;
    const drawW = Math.min(maxW, Math.round((maxH * 48) / 36));
    const drawH = Math.min(maxH, Math.round((drawW * 36) / 48));
    ctx.drawImage(
      upgImg,
      Math.round(upg.x + (upg.w - drawW) / 2),
      Math.round(upg.y + u * 2),
      drawW,
      drawH,
    );
  }
}

/** Paints static indoor background geometry once per layout size / DPR / tileset decode. */
export function drawIndoorBackground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  ctx.imageSmoothingEnabled = false;
  drawMartFloor(ctx, layout);
  drawMartWall(ctx, layout);
  drawStaticCounter(ctx, layout);
  for (const pen of layout.pens) {
    drawStaticPen(ctx, pen, layout.unit);
  }
  drawStaticStations(ctx, layout);
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

function drawSlidingDoors(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  shiftRunning: boolean,
): void {
  const d = layout.door;
  const u = layout.unit;
  const doorClosed = getTileImage('indoor', 'door-closed');
  const doorOpen = getTileImage('indoor', 'door-open');

  // Door slides open smoothly when shoppers cross threshold (or partly invites during open shift)
  const slideOpen = world.doorOpenAmount > 0.2;

  ctx.fillStyle = '#1b3d7a';
  ctx.fillRect(d.x - u, d.y - u, d.w + u * 2, d.h + u);

  if (slideOpen && doorOpen) {
    ctx.drawImage(doorOpen, d.x, d.y, d.w, d.h);
  } else if (!slideOpen && doorClosed) {
    ctx.drawImage(doorClosed, d.x, d.y, d.w, d.h);
  } else if (shiftRunning || slideOpen) {
    ctx.fillStyle = '#fff5cf';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    const leafRatio = 0.28 - world.doorOpenAmount * 0.14;
    const leafW = Math.max(u * 2, Math.round(d.w * leafRatio));
    ctx.fillStyle = '#5bb8e8';
    ctx.fillRect(d.x, d.y, leafW, d.h);
    ctx.fillRect(d.x + d.w - leafW, d.y, leafW, d.h);
  } else {
    ctx.fillStyle = '#4d9fd1';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#1b3d7a';
    ctx.fillRect(d.x + Math.round(d.w / 2) - seam(u), d.y, u, d.h);
    ctx.fillStyle = '#a5dcff';
    ctx.fillRect(d.x + u * 2, d.y + u * 3, u * 2, d.h - u * 8);
  }

  // Crisp OPEN / CLOSED sign plaque in Pixelify Sans
  const badgeH = u * 6;
  const badgeY = d.y - badgeH;
  ctx.fillStyle = shiftRunning ? '#1e8449' : '#b03a2e';
  ctx.fillRect(d.x, badgeY, d.w, badgeH);
  ctx.strokeStyle = '#070d1f';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(d.x, badgeY, d.w, badgeH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(9, Math.round(u * 3.5))}px "Chakra Petch", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shiftRunning ? 'OPEN' : 'CLOSED', d.x + d.w / 2, badgeY + badgeH / 2, d.w - u);
  ctx.textAlign = 'start';
}

function drawDynamicStations(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const pulse = still ? false : Math.floor(world.time * 2) % 2 === 0;
  const incImg = getTileImage('indoor', 'incubator-pod');
  const pcImg = getTileImage('indoor', 'pc-terminal');
  const upgImg = getTileImage('indoor', 'upgrades-board');

  // 1. Egg Incubator Pod + wobbling pixel eggs
  const inc = layout.incubatorStation;
  if (world.readyEggCount > 0) {
    ctx.strokeStyle = pulse ? '#ffd84d' : '#f5b82e';
    ctx.lineWidth = u;
    ctx.strokeRect(inc.x + seam(u), inc.y + seam(u), inc.w - u, inc.h - u);
  }
  if (incImg) {
    const maxH = inc.h - u * 10;
    const drawH = Math.max(u * 12, maxH);
    const drawW = Math.round((drawH * 32) / 36);
    ctx.drawImage(incImg, Math.round(inc.x + (inc.w - drawW) / 2), Math.round(inc.y + u * 2), drawW, drawH);
  }
  const eggScale = Math.max(1, Math.round(u * 1.1));
  const eggCountDraw = Math.min(3, Math.max(1, world.eggCount));
  for (let i = 0; i < eggCountDraw; i += 1) {
    const wobble = !still && world.eggCount > 0 ? Math.round(Math.sin(world.eggWobblePhase + i) * u * 0.9) : 0;
    const ex = Math.round(
      inc.x + inc.w * (eggCountDraw === 1 ? 0.5 : (i + 1) / (eggCountDraw + 1)) - 4 * eggScale + wobble,
    );
    const bob = !still && world.readyEggCount > 0 && pulse ? -u : 0;
    const ey = Math.round(inc.y + inc.h * 0.38 - 3.5 * eggScale + bob);
    if (world.eggCount > 0) {
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
    } else if (!incImg) {
      ctx.globalAlpha = 0.32;
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
      ctx.globalAlpha = 1;
    }
  }

  // 2. Wholesale PC Terminal + monitor pulse + VIP indicator
  const pc = layout.pcStation;
  if (pcImg) {
    const maxH = pc.h - u * 10;
    const drawH = Math.max(u * 12, maxH);
    const drawW = Math.round((drawH * 16) / 24);
    const drawX = Math.round(pc.x + (pc.w - drawW) / 2);
    const drawY = Math.round(pc.y + u * 2);
    ctx.drawImage(pcImg, drawX, drawY, drawW, drawH);
    // Live screen glow pixel rectangle overlay
    ctx.fillStyle = world.hasVipContract
      ? pulse
        ? '#ffd84d'
        : '#f5b82e'
      : pulse
        ? 'rgba(120, 224, 255, 0.72)'
        : 'rgba(79, 183, 230, 0.45)';
    ctx.fillRect(
      drawX + Math.round(drawW * 0.2),
      drawY + Math.round(drawH * 0.16),
      Math.round(drawW * 0.6),
      Math.round(drawH * 0.25),
    );
  } else {
    const pcScale = Math.max(1, Math.round(u * 1.3));
    drawBitmap(
      ctx,
      PC_ICON,
      Math.round(pc.x + pc.w / 2 - 4 * pcScale),
      Math.round(pc.y + pc.h * 0.42 - 3.5 * pcScale),
      pcScale,
      {
        b: world.hasVipContract ? '#f5b82e' : '#3b82f6',
        c: world.hasVipContract ? (pulse ? '#ffd84d' : '#ffea85') : pulse ? '#78e0ff' : '#4fb7e6',
        w: '#ffffff',
      },
    );
  }
  if (world.hasVipContract) {
    ctx.fillStyle = '#ffd84d';
    ctx.font = `700 ${Math.max(10, Math.round(u * 3.8))}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VIP!', pc.x + pc.w / 2, pc.y + u * 5);
    ctx.textAlign = 'start';
  }

  // 3. Upgrades pinned notes fallback if tile isn't decoded yet
  if (!upgImg) {
    const upg = layout.upgradesStation;
    const pw = Math.max(u * 4, Math.round(upg.w * 0.22));
    const ph = Math.max(u * 4, Math.round(upg.h * 0.26));
    ctx.fillStyle = '#fdf3cf';
    ctx.fillRect(upg.x + Math.round(upg.w * 0.24), upg.y + u * 4, pw, ph);
    ctx.fillStyle = '#a5e6ff';
    ctx.fillRect(upg.x + Math.round(upg.w * 0.56), upg.y + u * 5, pw, ph);
    ctx.fillStyle = PALETTE.berry;
    ctx.fillRect(upg.x + Math.round(upg.w * 0.24) + seam(u), upg.y + u * 4 - seam(u), u, u);
    ctx.fillRect(upg.x + Math.round(upg.w * 0.56) + seam(u), upg.y + u * 5 - seam(u), u, u);
  }
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
  return Math.round(feetY - 22 * scale + layout.unit * 2);
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
  ctx.drawImage(
    frame.image,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    Math.round(x - drawW / 2),
    Math.round(y - drawH + layout.unit * 2),
    drawW,
    drawH,
  );
  return getHumanHeadTopY(y, layout);
}

function drawClerk(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const waveLift =
    !still && world.clerkWaveTimer > 0 ? Math.round(Math.sin(world.clerkWaveTimer * 16) * u) : 0;
  const cx = Math.round(layout.counter.x + layout.counter.w * 0.52);
  const cy = Math.round(layout.counter.y + u * 4 + waveLift);

  const drawnH = drawHumanSprite(ctx, 'mart_employee', 'down', false, 0, cx, cy, layout);
  if (drawnH === null) {
    drawHumanFallback(ctx, cx, cy, u, '#2d5ca8', '#1f2937', false, 0, false);
  }
}

function drawPokemon(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  ent: PokemonEntity,
  adapter: SpriteEntityAdapter,
  hovered: boolean,
): void {
  const size = layout.spriteSize;
  const u = layout.unit;
  const pose = getPokemonPose(world, ent, size, u);
  const feetX = Math.round(ent.x);
  const feetY = Math.round(ent.y);

  const lift = Math.max(0, -pose.offsetY);
  const shadowScale = 1 - Math.min(0.45, lift / (size * 0.35));
  drawPixelShadow(ctx, feetX, feetY, size * 0.42 * shadowScale * pose.scaleX, u, 0.24);

  const animTime = world.reducedMotion || world.motionPaused ? 0 : world.time;
  const frame = adapter.getFrame(ent.speciesId, ent.isShiny, ent.state, animTime, ent.direction);
  let drawnH = Math.max(u * 12, size * 0.45);

  if (hovered) {
    ctx.fillStyle = 'rgba(255, 216, 77, 0.55)';
    ctx.fillRect(feetX - u * 6, feetY - seam(u), u * 12, u * 2);
  }

  ctx.save();
  ctx.translate(feetX, Math.round(feetY + pose.offsetY));
  if (frame) {
    const mirror = frame.usesDirectionRow ? 1 : frame.facesLeft ? ent.facing : -ent.facing;
    ctx.scale(mirror * pose.scaleX, pose.scaleY);
    const { drawW, drawH } = computeFrameDrawSize(frame, layout);
    drawnH = drawH;
    const footPad = frame.usesDirectionRow ? u * 1.5 : 6 * layout.spriteScale;
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
      Math.round(feetY - drawnH + pose.offsetY - u * 4 + bob),
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

  drawPixelShadow(ctx, walker.x, walker.y, u * 7, u, 0.24);

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
  drawPixelShadow(ctx, q.x, q.y, u * 7, u, 0.25);

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
    // Top-left bracket
    ctx.moveTo(rect.x, rect.y + arm);
    ctx.lineTo(rect.x, rect.y);
    ctx.lineTo(rect.x + arm, rect.y);
    // Top-right bracket
    ctx.moveTo(rect.x + rect.w - arm, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + arm);
    // Bottom-right bracket
    ctx.moveTo(rect.x + rect.w, rect.y + rect.h - arm);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.lineTo(rect.x + rect.w - arm, rect.y + rect.h);
    // Bottom-left bracket
    ctx.moveTo(rect.x + arm, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h - arm);
    ctx.stroke();
  }
}

/** Renders one complete frame of the full-viewport Indoor PokéMart scene. */
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

  drawSlidingDoors(ctx, layout, world, options.shiftRunning);
  drawDynamicStations(ctx, layout, world);
  drawHoverHighlight(ctx, layout, options.hoverTarget);
  drawClerk(ctx, layout, world);

  const hoverPokemonUid = options.hoverTarget?.kind === 'pokemon' ? options.hoverTarget.uid : null;
  const hoverOfferUid =
    options.hoverTarget?.kind === 'counter-offer' ? options.hoverTarget.offerUid : null;

  const drawables: Array<{ y: number; draw: () => void }> = [];
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

  for (const walker of world.walkers.values()) drawWalkerBubble(ctx, layout, world, walker);
  for (const p of world.particles) drawParticle(ctx, layout, p);
}
