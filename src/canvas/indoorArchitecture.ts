/**
 * Structural Gen 4 PokéMart indoor room architecture renderers:
 * - Tiled Mart floor & oak plank fallback,
 * - Upper plaster wall, wainscoting, sunlit meadow windows, potted plants, pendant lamps,
 * - Dynamic centered shift countdown wall clock,
 * - Entrance foyer welcome mat & animated automatic sliding glass vestibule doors,
 * - Static background layer composition & offscreen cache builder.
 */
import {
  BALL_COLORS,
  POKE_BALL_LEFT,
  POKE_BALL_RIGHT,
  POTTED_PLANT_BITMAP,
  POTTED_PLANT_COLORS,
  seam,
  tileImageRect,
} from './indoorConstants';
import {
  drawCounterFloorMat,
  drawRestingPensArea,
  drawStaticPen,
  drawWallUpgradesBoard,
} from './indoorStations';
import { PALETTE, bitmapSize, drawBitmap, drawPixelShadow } from './pixelArt';
import { drawPlankFloor } from './tiles';
import { getTileImage } from './tilesetLoader';
import type { Rect, ShopLayout } from './types';
import type { ShopWorld } from './world';

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
export function drawDynamicWallClock(
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
export function drawSlidingDoors(
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
