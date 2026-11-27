/**
 * Dynamic indoor PokéMart floor actors and visual overlays:
 * - Grounded PMD SpriteCollab Pokémon (uniform integer scaling & opaque-foot grounding),
 * - Behind-counter Shopkeepers & browsing/queued Human Trainer NPCs (`pret/pokeemerald`),
 * - Snug head-anchored Patience Bars, clickable `!` counter offer bubbles & thought bubbles,
 * - Floating pixel particles (hearts, sparkles, sweat, zzz, coins) and station/pen hover brackets.
 */
import {
  STATIC_POSE,
  STATIC_SLEEP_POSE,
  breathingPose,
  sleepPose,
  walkFrame,
  type Pose,
} from './animation';
import { getHumanNpcFrame, type CardinalDirection } from './humanNpcAnimator';
import {
  ARCHETYPE_SHIRTS,
  BALL_COLORS,
  BUBBLE_ICONS,
  HAIR_COLORS,
  HOVER_CARET,
  POKE_BALL,
  seam,
} from './indoorConstants';
import { particleAlpha, type Particle } from './particles';
import {
  COIN,
  EXCLAMATION_MARK,
  HEART,
  ICON_COLORS,
  LETTER_Z,
  PALETTE,
  SHOPPER_FRAMES,
  SPARKLE,
  SWEAT_DROP,
  bitmapSize,
  drawBitmap,
  drawPixelShadow,
} from './pixelArt';
import type {
  CanvasHitTarget,
  Rect,
  ShopLayout,
  SpriteEntityAdapter,
  SpriteFrame,
} from './types';
import type { CustomerWalker, PokemonEntity, QueuedShopperEntity, ShopWorld } from './world';

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
  const still = world.reducedMotion;
  if (ent.state === 'sleep') return still ? STATIC_SLEEP_POSE : sleepPose(world.time, ent.phase);
  // Keep walking Pokémon strictly un-distorted (native PMD Walk-Anim frames planted at feetY)
  if (ent.state === 'walk' || still) return STATIC_POSE;
  return breathingPose(world.time, ent.phase);
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
export function drawShopkeepers(
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
    if (idx === 0 && world.clerkWaveTimer > 0 && !world.reducedMotion) {
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

/** Draws a grounded PMD Pokémon (or wobbling Poké Ball placeholder while remote art decodes). */
export function drawPokemon(
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

  const animTime = world.reducedMotion ? 0 : world.time;
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
    // Crisp pixel Poké Ball placeholder with gentle wobble while a remote sheet decodes
    const still = world.reducedMotion;
    const wobble = still ? 0 : Math.round(Math.sin(world.time * 6 + ent.phase) * seam(u));
    const ballU = Math.max(2, Math.round(u * 1.4));
    const { w: bw, h: bh } = bitmapSize(POKE_BALL);
    drawBitmap(
      ctx,
      POKE_BALL,
      Math.round(-(bw * ballU) / 2 + wobble),
      Math.round(-bh * ballU),
      ballU,
      BALL_COLORS,
    );
  }
  ctx.restore();

  if (hovered) {
    const still = world.reducedMotion;
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

/** Draws a browsing or entering/leaving Human Trainer shopper on the store floor. */
export function drawWalker(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  walker: CustomerWalker,
): void {
  const u = layout.unit;
  const still = world.reducedMotion;
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

/** Draws a counter-queued Human Trainer shopper with live Patience Bar and clickable `!` badge. */
export function drawQueuedShopper(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  q: QueuedShopperEntity,
  hovered: boolean,
): void {
  const u = layout.unit;
  const still = world.reducedMotion;
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

/** Draws the overhead browsing/happy thought bubble anchored cleanly above a shopper's head. */
export function drawWalkerBubble(
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
  const still = world.reducedMotion;
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

/** Draws a single floating pixel particle (heart, sparkle, sweat drop, zzz, or coin pop). */
export function drawParticle(ctx: CanvasRenderingContext2D, layout: ShopLayout, p: Particle): void {
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

/** Draws golden corner focus brackets around hovered floor stations or empty display pens. */
export function drawHoverHighlight(
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
