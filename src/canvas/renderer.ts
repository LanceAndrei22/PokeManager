/**
 * Per-frame shop floor renderer using PMD SpriteCollab 8-directional sheets:
 * blits the cached background, animates Kecleon (`0352`) behind the register,
 * depth-sorts store Pokémon and PMD Pokémon shoppers by feet Y, draws archetype
 * thought bubbles and pixel particles, and layers warm lamp lighting.
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
import {
  COIN,
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
import { particleAlpha, type Particle } from './particles';
import { drawBackground } from './tiles';
import type { ShopLayout, SpriteEntityAdapter, SpriteFrame } from './types';
import type { CustomerWalker, PokemonEntity, ShopWorld } from './world';

/** Per-frame render options supplied by the React host. */
export interface RenderOptions {
  shiftRunning: boolean;
  hoverUid: string | null;
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
const HOVER_CARET: PixelBitmap = ['yyyyy', '.yyy.', '..y..'];

/** Resolves the current pose for a Pokémon entity (static when motion is reduced/paused). */
export function getPokemonPose(
  world: ShopWorld,
  ent: PokemonEntity,
  size: number,
  unit: number,
): Pose {
  const still = world.reducedMotion || world.motionPaused;
  if (ent.state === 'sleep') return still ? STATIC_SLEEP_POSE : sleepPose(world.time, ent.phase);
  if (ent.state === 'hop' && !still) return hopPose(ent.stateTime / HOP_DURATION, size * 0.14);
  return still ? STATIC_POSE : breathingPose(world.time, ent.phase, unit * 0.75);
}

/**
 * Computes crisp integer scaling for variable-size PMD sprite frames so small/medium
 * Pokémon stay bold (~2× art scale) while large Legendaries still fit cleanly inside pens.
 */
function computeFrameDrawSize(
  frame: SpriteFrame,
  layout: ShopLayout,
): { drawW: number; drawH: number } {
  const maxDim = Math.max(frame.sw, frame.sh);
  if (!frame.usesDirectionRow) {
    return { drawW: layout.spriteSize, drawH: layout.spriteSize };
  }
  const maxAllowed = layout.spriteSize * 1.3;
  const scale =
    maxDim * layout.unit <= maxAllowed
      ? layout.unit
      : Math.max(1, Math.floor(maxAllowed / maxDim));
  return { drawW: frame.sw * scale, drawH: frame.sh * scale };
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
  drawPixelShadow(
    ctx,
    feetX,
    feetY,
    size * 0.44 * shadowScale * pose.scaleX,
    u,
    ent.state === 'sleep' ? 0.16 : 0.22,
  );

  const animTime = world.reducedMotion || world.motionPaused ? 0 : world.time;
  const frame = adapter.getFrame(ent.speciesId, ent.isShiny, ent.state, animTime, ent.direction);

  ctx.save();
  ctx.translate(feetX, Math.round(feetY + pose.offsetY));

  if (frame) {
    // PMD 8-directional sheets already provide each facing row; static sheets flip via scaleX(-1).
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
    const { w } = bitmapSize(HOVER_CARET);
    drawBitmap(
      ctx,
      HOVER_CARET,
      feetX - (w * u) / 2,
      feetY - size * 0.86 + pose.offsetY - u * 4,
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
  adapter: SpriteEntityAdapter,
): void {
  const u = layout.unit;
  const still = world.reducedMotion || world.motionPaused;
  const walking = walker.state !== 'browsing' && !still;
  const animState = walking ? 'walk' : 'idle';
  const animTime = still ? 0 : walker.time;

  drawPixelShadow(ctx, walker.x, walker.y, u * 7, u, 0.2);

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

  // Fallback pixel walker if PMD NPC sheet is still decoding
  const frameIdx = walking ? walkFrame(walker.distance, u * 4) : 0;
  const bitmap = SHOPPER_FRAMES[frameIdx];
  const { w: bw, h: bh } = bitmapSize(bitmap);
  const bounce = walking && frameIdx === 1 ? -u : 0;

  const colors = {
    h: HAIR_COLORS[Math.floor(walker.look * HAIR_COLORS.length) % HAIR_COLORS.length],
    s: PALETTE.skin,
    e: PALETTE.woodDeep,
    c: ARCHETYPE_SHIRTS[walker.archetypeId],
    p: '#5b4a3a',
    b: PALETTE.woodDeep,
  };
  ctx.save();
  ctx.translate(Math.round(walker.x), Math.round(walker.y + bounce));
  if (walker.facing === -1) ctx.scale(-1, 1);
  drawBitmap(ctx, bitmap, -(bw * u) / 2, -bh * u, u, colors);
  ctx.restore();
}

function drawBubble(
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
  const y = Math.round(walker.y - SHOPPER_FRAMES[0].length * u - bh - u * 4 + float);
  const tailX = x + Math.round(bw / 2);

  ctx.fillStyle = PALETTE.woodDark;
  fillPixelRoundRect(ctx, x - u, y - u, bw + u * 2, bh + u * 2, u);
  ctx.fillRect(tailX - u * 2, y + bh, u * 4, u * 2);
  ctx.fillStyle = PALETTE.cream;
  fillPixelRoundRect(ctx, x, y, bw, bh, u);
  ctx.fillRect(tailX - u, y + bh, u * 2, u);
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
    case 'zzz': {
      const sway = Math.sin(p.age * 3 + p.phase) * u * 2;
      const zu = Math.max(1, Math.round(small * (0.7 + (p.age / p.life) * 0.8)));
      drawBitmap(ctx, LETTER_Z, p.x + sway, p.y, zu, ICON_COLORS);
      break;
    }
    case 'coin': {
      drawBitmap(ctx, COIN, p.x - 3.5 * u, p.y - 3 * u, u, ICON_COLORS);
      if (p.label) {
        ctx.font = `bold ${Math.max(9, Math.round(u * 5))}px "Trebuchet MS", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, u);
        ctx.strokeStyle = PALETTE.cream;
        ctx.strokeText(p.label, p.x + u * 5, p.y);
        ctx.fillStyle = PALETTE.honeyDeep;
        ctx.fillText(p.label, p.x + u * 5, p.y);
      }
      break;
    }
    case 'sweat':
      drawBitmap(ctx, SWEAT_DROP, p.x - 2.5 * small, p.y - 2.5 * small, small, ICON_COLORS);
      break;
  }
  ctx.globalAlpha = 1;
}

function drawDoorSign(ctx: CanvasRenderingContext2D, layout: ShopLayout, open: boolean): void {
  const d = layout.door;
  const u = layout.unit;
  const x = d.x + u;
  const y = d.y + Math.round(d.h * 0.42);
  const w = d.w - u * 2;
  const h = u * 5;
  ctx.fillStyle = open ? PALETTE.sage : PALETTE.berry;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `bold ${Math.max(7, Math.round(u * 3.2))}px "Trebuchet MS", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'OPEN' : 'CLOSED', x + w / 2, y + h / 2, w - u);
  ctx.textAlign = 'start';
}

function drawLighting(ctx: CanvasRenderingContext2D, layout: ShopLayout, open: boolean): void {
  const { width, height } = layout;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const radius = Math.max(width, height) * 0.55;
  for (const lamp of layout.lamps) {
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, radius);
    glow.addColorStop(0, 'rgba(255, 210, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 210, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = 'multiply';
  const cx = width / 2;
  const cy = height / 2;
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(width, height) * 0.35,
    cx,
    cy,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, '#ffffff');
  vignette.addColorStop(1, '#e8d6bf');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  if (!open) {
    ctx.fillStyle = 'rgb(222, 216, 240)';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** Draws one full frame of the PMD animated shop floor. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  background: CanvasImageSource | null,
  adapter: SpriteEntityAdapter,
  options: RenderOptions,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Re-applied every frame: resizing a canvas resets 2D context smoothing state.
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (background) ctx.drawImage(background, 0, 0);
  else drawBackground(ctx, layout);

  drawDoorSign(ctx, layout, options.shiftRunning);
  drawClerk(ctx, layout, world, adapter);

  const drawables: Array<{ y: number; draw: () => void }> = [];
  for (const ent of world.pokemon.values()) {
    drawables.push({
      y: ent.y,
      draw: () => drawPokemon(ctx, layout, world, ent, adapter, ent.uid === options.hoverUid),
    });
  }
  for (const walker of world.walkers.values()) {
    drawables.push({
      y: walker.y + 0.5,
      draw: () => drawWalker(ctx, layout, world, walker, adapter),
    });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawLighting(ctx, layout, options.shiftRunning);

  for (const walker of world.walkers.values()) drawBubble(ctx, layout, world, walker);
  for (const p of world.particles) drawParticle(ctx, layout, p);
}
