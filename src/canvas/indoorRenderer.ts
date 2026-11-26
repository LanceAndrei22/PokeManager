/**
 * Full-screen Indoor Gen 4 PokéMart pixel renderer:
 * - Caches static indoor shop architecture (wall, windows, pendant lamps, PokéMart
 *   awning, checkout counter, oak plank floor, sliding door track, Display Pens,
 *   Healing Corner, and base station furniture) into an offscreen background layer.
 * - Renders live dynamic states every frame: animated sliding glass doors (`OPEN` /
 *   `CLOSED`), Store Clerk Kecleon (`0352`), blinking Wholesale PC (gold VIP glow),
 *   glowing Egg Incubator Bench, Wooden Upgrades Board, depth-sorted PMD Pokémon,
 *   browsing PMD shoppers, queued register shoppers with live Patience Bars +
 *   bouncing `!` offer bubbles, hover highlights + pixel tooltip, and pixel particles.
 */
import { CLERK_NPC } from '../data/npcs';
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
  'cozy-collector': PALETTE.berry,
  'bargain-browser': PALETTE.sage,
  'trend-fan': PALETTE.honeyDeep,
  'shiny-seeker': PALETTE.lavender,
  'vip-seeker': '#7c3aed',
};

const BUBBLE_ICONS: Record<CustomerArchetypeId, PixelBitmap> = {
  'cozy-collector': HEART,
  'bargain-browser': COIN,
  'trend-fan': STAR,
  'shiny-seeker': SPARKLE,
  'vip-seeker': SPARKLE,
};

const HAIR_COLORS = ['#3c2918', '#7a4a2a', '#c27c3e', '#2f3a56', '#8e5b9a', '#d9a441'];
const POKE_BALL: PixelBitmap = ['.rrrr.', 'rrrrrr', 'kkwwkk', 'wwwwww', '.wwww.'];
const BALL_COLORS = { r: '#e04848', k: PALETTE.woodDeep, w: PALETTE.white };

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
  return still ? STATIC_POSE : breathingPose(world.time, ent.phase, unit * 0.75);
}

function drawMartWall(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const { wall, unit: u, width } = layout;
  // Upper Gen 4 PokéMart wall with royal-blue/cream wainscot strip
  ctx.fillStyle = '#e8dfc9';
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

  // Subtle wallpaper dots
  ctx.fillStyle = '#d8cbb0';
  for (let row = 0, y = u * 4; y < wall.h - u * 12; row += 1, y += u * 6) {
    for (let x = row % 2 === 0 ? 0 : u * 4; x < width; x += u * 8) {
      ctx.fillRect(x, y, u, u);
    }
  }

  // PokéMart iconic blue wainscot trim
  const wainTop = wall.h - u * 11;
  ctx.fillStyle = '#2d5ca8';
  ctx.fillRect(0, wainTop, width, wall.h - wainTop);
  ctx.fillStyle = '#4e7dd1';
  ctx.fillRect(0, wainTop, width, u);
  ctx.fillStyle = '#1b3d7a';
  for (let x = u * 2; x < width; x += u * 6) {
    ctx.fillRect(x, wainTop + u * 2, seam(u), wall.h - wainTop - u * 4);
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

  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(c.x, c.y + u * 2, c.w, c.h - u * 2);
  ctx.fillStyle = '#7e5c3b';
  for (let x = c.x + u * 8; x < c.x + c.w; x += u * 8) {
    ctx.fillRect(x, c.y + u * 2, seam(u), c.h - u * 2);
  }
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(c.x - u, c.y, c.w + u * 2, u * 2);

  // Classic PokéMart signboard front plate
  const label = 'PokéMart';
  ctx.font = `bold ${Math.max(8, Math.round(u * 4))}px "Pixelify Sans", sans-serif`;
  const plateW = Math.min(c.w - u * 4, Math.ceil(ctx.measureText(label).width) + u * 5);
  const plateX = c.x + Math.round((c.w - plateW) / 2);
  const plateY = c.y + u * 4;
  ctx.fillStyle = '#1e3a73';
  ctx.fillRect(plateX, plateY, plateW, u * 6);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(plateX, plateY, plateW, u * 6);
  ctx.fillStyle = '#ffd84d';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, plateX + plateW / 2, plateY + u * 3, plateW - u * 2);
  ctx.textAlign = 'start';

  // Counter register & display Poké Ball
  ctx.fillStyle = '#4d5d73';
  ctx.fillRect(c.x + u * 3, c.y - u * 6, u * 10, u * 6);
  ctx.fillStyle = '#78e0ff';
  ctx.fillRect(c.x + u * 5, c.y - u * 5, u * 6, u * 2);
  drawBitmap(ctx, POKE_BALL, c.x + c.w - u * 9, c.y - u * 5, u, BALL_COLORS);
}

function drawStaticPen(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
  const { inner } = pen;
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(pen.x, pen.y, pen.w, pen.h);
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
  ctx.fillStyle = 'rgba(186, 124, 24, 0.16)';
  ctx.fillRect(inner.x, inner.y, inner.w, u * 2);

  // Posts & rails
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

  // Pen plate
  ctx.font = `bold ${Math.max(8, Math.round(u * 3.8))}px "Pixelify Sans", sans-serif`;
  const label = `Pen ${pen.index + 1}`;
  const plateW = Math.ceil(ctx.measureText(label).width) + u * 4;
  const plateX = inner.x + u * 2;
  const plateY = inner.y + u * 2;
  ctx.fillStyle = '#13244b';
  ctx.fillRect(plateX - seam(u), plateY - seam(u), plateW + seam(u) * 2, u * 6 + seam(u) * 2);
  ctx.fillStyle = '#ffd84d';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, plateX + u * 2, plateY + u * 3);
}

function drawStaticBed(ctx: CanvasRenderingContext2D, bed: Rect, u: number): void {
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

function drawStaticStations(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  const u = layout.unit;

  // Entrance stone foyer + red welcome mat
  const f = layout.foyer;
  ctx.fillStyle = '#6f7c91';
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = '#8b99b0';
  for (let gx = f.x + u * 2; gx < f.x + f.w - u * 2; gx += u * 6) {
    ctx.fillRect(gx, f.y + u * 2, u * 4, u * 2);
  }
  ctx.fillStyle = PALETTE.berry;
  ctx.fillRect(layout.door.x, f.y + u * 2, layout.door.w, Math.max(u * 4, f.h - u * 5));

  // Healing Corner
  const nap = layout.napArea;
  ctx.fillStyle = '#d9ecd2';
  fillPixelRoundRect(ctx, nap.x, nap.y, nap.w, nap.h, u * 2);
  ctx.fillStyle = '#4e7d4a';
  ctx.font = `bold ${Math.max(8, Math.round(u * 3.8))}px "Pixelify Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Nap Corner', nap.x + u * 4, nap.y + u * 5);
  for (const bed of layout.beds) {
    drawStaticBed(ctx, bed, u);
  }

  // Base wooden/metallic pads for Incubator, PC Terminal, Upgrades Board
  const stations: Array<{ rect: Rect; label: string; bg: string; border: string }> = [
    { rect: layout.incubatorStation, label: 'Incubator', bg: '#27406b', border: '#6ee7a0' },
    { rect: layout.pcStation, label: 'Wholesale PC', bg: '#1e3566', border: '#78e0ff' },
    { rect: layout.upgradesStation, label: 'Upgrades', bg: '#5a3d24', border: '#ffd84d' },
  ];

  for (const st of stations) {
    ctx.fillStyle = '#070d1f';
    ctx.fillRect(st.rect.x, st.rect.y, st.rect.w, st.rect.h);
    ctx.fillStyle = st.bg;
    ctx.fillRect(st.rect.x + u, st.rect.y + u, st.rect.w - u * 2, st.rect.h - u * 2);
    ctx.fillStyle = st.border;
    ctx.fillRect(st.rect.x + u, st.rect.y + u, st.rect.w - u * 2, seam(u));
    ctx.font = `bold ${Math.max(7, Math.round(u * 3.3))}px "Pixelify Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      st.label,
      st.rect.x + st.rect.w / 2,
      st.rect.y + st.rect.h - u * 2,
      st.rect.w - u * 3,
    );
  }
  ctx.textAlign = 'start';
}

/** Paints static indoor background geometry once per layout size / DPR. */
export function drawIndoorBackground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
  ctx.imageSmoothingEnabled = false;
  drawPlankFloor(
    ctx,
    { x: 0, y: layout.wall.h, w: layout.width, h: layout.height - layout.wall.h },
    layout.unit,
  );
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

function drawSlidingDoors(ctx: CanvasRenderingContext2D, layout: ShopLayout, open: boolean): void {
  const d = layout.door;
  const u = layout.unit;
  ctx.fillStyle = '#1b3d7a';
  ctx.fillRect(d.x - u, d.y - u, d.w + u * 2, d.h + u);

  if (open) {
    // Open sliding glass panels parted to left & right sides revealing bright threshold
    ctx.fillStyle = '#fff5cf';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    const leafW = Math.max(u * 3, Math.round(d.w * 0.22));
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

  // OPEN / CLOSED awning plaque
  const badgeH = u * 5;
  const badgeY = d.y - badgeH;
  ctx.fillStyle = open ? '#27ae60' : '#c0392b';
  ctx.fillRect(d.x, badgeY, d.w, badgeH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(7, Math.round(u * 3))}px "Silkscreen", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'OPEN' : 'CLOSED', d.x + d.w / 2, badgeY + badgeH / 2, d.w - u);
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

  // 1. Egg Incubator Bench live eggs + ready golden glow
  const inc = layout.incubatorStation;
  if (world.readyEggCount > 0) {
    ctx.strokeStyle = pulse ? '#ffd84d' : '#f5b82e';
    ctx.lineWidth = u;
    ctx.strokeRect(inc.x + seam(u), inc.y + seam(u), inc.w - u, inc.h - u);
  }
  const eggScale = Math.max(1, Math.round(u * (layout.isPortrait ? 0.9 : 1.3)));
  const eggCountDraw = Math.min(3, Math.max(1, world.eggCount));
  for (let i = 0; i < eggCountDraw; i += 1) {
    const ex = Math.round(
      inc.x + inc.w * (eggCountDraw === 1 ? 0.5 : (i + 1) / (eggCountDraw + 1)) - 4 * eggScale,
    );
    const bob = !still && world.readyEggCount > 0 && pulse ? -u : 0;
    const ey = Math.round(inc.y + inc.h * 0.42 - 3.5 * eggScale + bob);
    if (world.eggCount > 0) {
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
    } else {
      ctx.globalAlpha = 0.32;
      drawBitmap(ctx, EGG_ICON, ex, ey, eggScale, ICON_COLORS);
      ctx.globalAlpha = 1;
    }
  }

  // 2. Blinking Wholesale PC Terminal (pulses gold when VIP Legendary Contract available!)
  const pc = layout.pcStation;
  const pcScale = Math.max(1, Math.round(u * (layout.isPortrait ? 0.9 : 1.35)));
  const pcColors = {
    b: world.hasVipContract ? '#f5b82e' : '#3b82f6',
    c: world.hasVipContract ? (pulse ? '#ffd84d' : '#ffea85') : pulse ? '#78e0ff' : '#4fb7e6',
    w: '#ffffff',
  };
  drawBitmap(
    ctx,
    PC_ICON,
    Math.round(pc.x + pc.w / 2 - 4 * pcScale),
    Math.round(pc.y + pc.h * 0.42 - 3.5 * pcScale),
    pcScale,
    pcColors,
  );
  if (world.hasVipContract) {
    ctx.fillStyle = '#ffd84d';
    ctx.font = `bold ${Math.max(7, Math.round(u * 3))}px "Silkscreen", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('VIP!', pc.x + pc.w / 2, pc.y + u * 4);
    ctx.textAlign = 'start';
  }

  // 3. Wooden Upgrades Board pinned papers
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

function drawClerk(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  adapter: SpriteEntityAdapter,
): void {
  const still = world.reducedMotion || world.motionPaused;
  const animTime = still ? 0 : world.time;
  const frame = adapter.getFrame(CLERK_NPC.speciesId, false, 'idle', animTime, 0);
  const cx = Math.round(layout.counter.x + layout.counter.w * 0.55);
  const cy = Math.round(layout.counter.y + layout.unit * 2);

  if (!frame) return;
  const { drawW, drawH } = computeFrameDrawSize(frame, layout);
  ctx.drawImage(
    frame.image,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    Math.round(cx - drawW / 2),
    Math.round(cy - drawH + layout.unit * 2),
    drawW,
    drawH,
  );
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

  ctx.save();
  ctx.translate(feetX, Math.round(feetY + pose.offsetY));
  if (frame) {
    const mirror = frame.usesDirectionRow ? 1 : frame.facesLeft ? ent.facing : -ent.facing;
    ctx.scale(mirror * pose.scaleX, pose.scaleY);
    const { drawW, drawH } = computeFrameDrawSize(frame, layout);
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
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = Math.max(2, u);
    ctx.strokeRect(
      Math.round(feetX - size * 0.35),
      Math.round(feetY - size * 0.8),
      Math.round(size * 0.7),
      Math.round(size * 0.84),
    );
  }
}

function drawWalker(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  walker: CustomerWalker,
  adapter: SpriteEntityAdapter,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const walking = walker.state !== 'browsing' && !still;
  const animState = walking ? 'walk' : 'idle';
  const animTime = still ? 0 : walker.time;

  drawPixelShadow(ctx, walker.x, walker.y, u * 7, u, 0.22);

  const pmdFrame = adapter.getFrame(
    walker.npcSpeciesId,
    false,
    animState,
    animTime,
    walker.direction,
  );
  if (pmdFrame) {
    const { drawW, drawH } = computeFrameDrawSize(pmdFrame, layout);
    ctx.drawImage(
      pmdFrame.image,
      pmdFrame.sx,
      pmdFrame.sy,
      pmdFrame.sw,
      pmdFrame.sh,
      Math.round(walker.x - drawW / 2),
      Math.round(walker.y - drawH + u),
      drawW,
      drawH,
    );
    return;
  }

  const frameIdx = walking ? walkFrame(walker.distance, u * 4) : 0;
  const bitmap = SHOPPER_FRAMES[frameIdx];
  const { w: bw, h: bh } = bitmapSize(bitmap);
  const colors = {
    h: HAIR_COLORS[Math.floor(walker.look * HAIR_COLORS.length) % HAIR_COLORS.length],
    s: PALETTE.skin,
    e: PALETTE.woodDeep,
    c: ARCHETYPE_SHIRTS[walker.archetypeId],
    p: '#5b4a3a',
    b: PALETTE.woodDeep,
  };
  ctx.save();
  ctx.translate(Math.round(walker.x), Math.round(walker.y));
  if (walker.facing === -1) ctx.scale(-1, 1);
  drawBitmap(ctx, bitmap, -(bw * u) / 2, -bh * u, u, colors);
  ctx.restore();
}

function drawQueuedShopper(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  q: QueuedShopperEntity,
  adapter: SpriteEntityAdapter,
  hovered: boolean,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const animTime = still ? 0 : q.time;
  drawPixelShadow(ctx, q.x, q.y, u * 7, u, 0.25);

  const frame = adapter.getFrame(q.npcSpeciesId, false, 'idle', animTime, 4);
  let topY = q.y - u * 16;
  if (frame) {
    const { drawW, drawH } = computeFrameDrawSize(frame, layout);
    ctx.drawImage(
      frame.image,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      Math.round(q.x - drawW / 2),
      Math.round(q.y - drawH + u),
      drawW,
      drawH,
    );
    topY = q.y - drawH;
  }

  // Live Patience Bar above shopper head
  const ratio = q.maxPatience > 0 ? Math.min(1, Math.max(0, q.patience / q.maxPatience)) : 1;
  const barW = Math.max(u * 11, 22);
  const barH = Math.max(u * 2, 4);
  const bx = Math.round(q.x - barW / 2);
  const by = Math.round(topY - barH - u * 2);
  ctx.fillStyle = '#070d1f';
  ctx.fillRect(bx - seam(u), by - seam(u), barW + seam(u) * 2, barH + seam(u) * 2);
  ctx.fillStyle = '#1b2b4d';
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = ratio > 0.6 ? '#2ecc71' : ratio > 0.35 ? '#ffd84d' : '#e74c3c';
  ctx.fillRect(bx, by, Math.round(barW * ratio), barH);

  // Bouncing clickable `!` offer bubble
  const bob = still ? 0 : Math.round(Math.sin(q.time * 5) * u * 1.3);
  const bubW = u * 8;
  const bubH = u * 8;
  const bubX = Math.round(q.x - bubW / 2);
  const bubY = Math.round(by - bubH - u * 3 + bob);
  ctx.fillStyle = hovered || q.isVip ? '#ffd84d' : '#1a3160';
  ctx.fillRect(bubX, bubY, bubW, bubH);
  ctx.strokeStyle = hovered ? '#ffffff' : '#78a8f0';
  ctx.lineWidth = Math.max(1, seam(u));
  ctx.strokeRect(bubX, bubY, bubW, bubH);
  drawBitmap(ctx, EXCLAMATION_MARK, bubX + u * 3, bubY + u * 1.5, u, {
    kk: hovered || q.isVip ? '#261600' : '#ffd84d',
    k: hovered || q.isVip ? '#261600' : '#ffd84d',
  });
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
  const float = still ? 0 : Math.round(Math.sin(walker.time * 3) * 0.8) * u;
  const x = Math.round(walker.x - bw / 2);
  const y = Math.round(walker.y - layout.spriteSize * 0.65 - bh - u * 2 + float);

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
        ctx.font = `bold ${Math.max(9, Math.round(u * 5))}px "Pixelify Sans", sans-serif`;
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
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = Math.max(2, u);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
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
  // Always re-apply after resize/DPR reset so sprites stay razor-sharp.
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (background) ctx.drawImage(background, 0, 0);
  else drawIndoorBackground(ctx, layout);

  drawSlidingDoors(ctx, layout, options.shiftRunning);
  drawDynamicStations(ctx, layout, world);
  drawHoverHighlight(ctx, layout, options.hoverTarget);
  drawClerk(ctx, layout, world, adapter);

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
      draw: () => drawWalker(ctx, layout, world, walker, adapter),
    });
  }
  for (const q of world.queuedShoppers.values()) {
    drawables.push({
      y: q.y + 0.6,
      draw: () => drawQueuedShopper(ctx, layout, world, q, adapter, q.offerUid === hoverOfferUid),
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  for (const walker of world.walkers.values()) drawWalkerBubble(ctx, layout, world, walker);
  for (const p of world.particles) drawParticle(ctx, layout, p);
}
