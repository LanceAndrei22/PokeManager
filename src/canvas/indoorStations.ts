/**
 * Physical indoor PokéMart store furniture and interactive station renderers:
 * - Oak-framed Upgrades Notice Board mounted on the back wall,
 * - Checkout welcome runner mat & deep Gen 4 Checkout Counter foreground,
 * - Organic Habitat Display Pens (static interior + Y-sorted front timber rails),
 * - Isolated Resting Corner / Cushioned Beds care alcove (`drawRestingPensArea`),
 * - Standing Wholesale PC Kiosk & Oak-and-Glass Egg Incubator Pedestal.
 */
import { BALL_COLORS, POKE_BALL, seam, tileImageRect } from './indoorConstants';
import { drawOrganicPenHabitat } from './organicTerrain';
import {
  EGG_ICON,
  ICON_COLORS,
  PALETTE,
  drawBitmap,
  drawPixelShadow,
  fillPixelRoundRect,
} from './pixelArt';
import { getTileImage } from './tilesetLoader';
import type { PenRect, Rect, ShopLayout } from './types';
import type { ShopWorld } from './world';

/** Renders the physical oak-framed Upgrades Notice Board mounted directly on the back wall. */
export function drawWallUpgradesBoard(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
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

/** Paints the cozy stitched Checkout Mat on the floor directly in front of the counter. */
export function drawCounterFloorMat(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
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
 * Rendered AFTER `drawShopkeepers` so clerks' legs are naturally occluded behind the counter.
 */
export function drawCounterForeground(ctx: CanvasRenderingContext2D, layout: ShopLayout): void {
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
export function drawStaticPen(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
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
export function drawPenFrontRail(ctx: CanvasRenderingContext2D, pen: PenRect, u: number): void {
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

/* ============================================================================
 * Resting Pens / Cushioned Beds Care Alcove (Isolated for Resting Pen features)
 * ============================================================================ */

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

/* ============================================================================
 * Dynamic Floor Stations (Wholesale PC Kiosk & Egg Incubator Pedestal)
 * ============================================================================ */

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
  const still = world.reducedMotion;
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

/** Draws dynamic live-animated floor stations (Wholesale PC Kiosk & Egg Incubator). */
export function drawDynamicStations(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
): void {
  const still = world.reducedMotion;
  const pulse = still ? false : Math.floor(world.time * 2) % 2 === 0;
  drawWholesalePcKiosk(ctx, layout, world, pulse);
  drawIncubatorPedestal(ctx, layout, world, pulse);
}
