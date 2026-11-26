/**
 * Seamless organic pixel-art terrain generator shared by the rolling Main Menu meadow
 * and Indoor Organic Habitat Display Pens.
 *
 * Produces cohesive, non-grid pixel nature modeled after PokéSurvivor's Shady Forest:
 * - Periodic multi-octave value noise for mottled forest/meadow grass with zero seams.
 * - Organic irregular dirt clearings and winding trails with 4×4 Bayer dithered pixel edges.
 * - Tiny 3×3 scattered pixel wildflowers, nestled pebbles, dark-outlined tall grass tufts,
 *   and shaded slate boulders that Y-depth-sort cleanly with grounded PMD Pokémon.
 */
import { drawBitmap, drawPixelShadow, type PixelBitmap } from './pixelArt';

/** RGB triplet helper for direct ImageData pixel painting. */
export type Rgb = readonly [number, number, number];

/** 4×4 Bayer ordered dithering matrix normalized to [0, 1) for organic grass/dirt feathering. */
const BAYER_4X4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
] as const;

/** Crisp 16×14 dark-outlined tall grass clump modeled after PokéSurvivor's Shady Forest. */
export const TALL_GRASS_CLUMP: PixelBitmap = [
  '..k...k..k...k..',
  '.klk.klkklk.klk.',
  '.kmgkkmmgmmkkmk.',
  'kkmmgkmmgmmkgmmk',
  'klmmgkmmgmmkmmmk',
  'kmmmgkmmgmmkmmgk',
  'kmmgdmmgdmmgdmgk',
  'kmdgddmgddmgddmk',
  'kddgdddgdddgdddk',
  'kddddddddddddddk',
  '.kddddddddddddk.',
  '..kkddddddddkk..',
];

export const TALL_GRASS_COLORS: Record<string, string> = {
  k: '#0d1d11',
  d: '#1b421f',
  g: '#295d2b',
  m: '#3b7c37',
  l: '#59a148',
};

/** Compact 9×7 soft indoor/meadow grass tuft for smaller accents inside habitats. */
export const SMALL_GRASS_TUFT: PixelBitmap = [
  '.k..k..k.',
  'klkklkklk',
  'kmmgmgmmk',
  'kmgdddgmk',
  '.kdddddk.',
];

/** Rounded 18×13 pixel slate boulder with crisp dark outline and top-left light sheen. */
export const MEADOW_BOULDER: PixelBitmap = [
  '.....kkkkkkkk.....',
  '...kkhhhhhhhhkk...',
  '..khssmmmmmmmmhk..',
  '.khssmmmmmmmmmmmk.',
  '.khsmmmmmmmmmmddk.',
  'khmmmmmmmmmmmddddk',
  'kmmmmmmmmmmmdddddk',
  'kmmmmmmmmmdddddddd',
  'kmmmmmmmdddddddddk',
  '.kddmmddddddddddk.',
  '.kkddddddddddddkk.',
  '...kkkkkkkkkkkk...',
];

export const BOULDER_COLORS: Record<string, string> = {
  k: '#161e26',
  d: '#46525e',
  m: '#6b7987',
  h: '#8c9aa8',
  s: '#b0bec9',
};

/** Deterministic integer hash for reproducible pixel grain and flower placement. */
export function pixelHash(x: number, y: number, seed = 1337): number {
  let h = Math.imul(x + seed * 37, 0x27d4eb2d) ^ Math.imul(y + seed * 17, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Horizontally periodic 2D smooth value noise: `periodicNoise(x + periodX, y) === periodicNoise(x, y)`.
 * Guarantees zero seam lines when a scrolling meadow strip wraps seamlessly from right to left.
 */
export function periodicNoise(
  x: number,
  y: number,
  periodX: number,
  seed: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const px = Math.max(1, Math.round(periodX));
  const wx0 = ((x0 % px) + px) % px;
  const wx1 = (wx0 + 1) % px;

  const v00 = pixelHash(wx0, y0, seed);
  const v10 = pixelHash(wx1, y0, seed);
  const v01 = pixelHash(wx0, y0 + 1, seed);
  const v11 = pixelHash(wx1, y0 + 1, seed);

  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

/** Multi-octave horizontally periodic fBm noise in [0, 1]. */
export function periodicFbm(
  x: number,
  y: number,
  baseScale: number,
  stripWidth: number,
  seed: number,
): number {
  const p1 = Math.max(1, Math.round(stripWidth / baseScale));
  const n1 = periodicNoise(x / baseScale, y / baseScale, p1, seed);
  const n2 = periodicNoise((x * 2) / baseScale, (y * 2) / baseScale, p1 * 2, seed + 19);
  const n3 = periodicNoise((x * 4) / baseScale, (y * 4) / baseScale, p1 * 4, seed + 53);
  return n1 * 0.56 + n2 * 0.3 + n3 * 0.14;
}

const MEADOW_GRASS_PALETTE: readonly Rgb[] = [
  [47, 98, 45],
  [54, 110, 50],
  [62, 122, 56],
  [71, 134, 62],
  [82, 146, 69],
];

const INDOOR_GRASS_PALETTE: readonly Rgb[] = [
  [72, 128, 56],
  [82, 142, 62],
  [92, 154, 68],
  [104, 166, 76],
  [116, 178, 84],
];

const DIRT_PALETTE: readonly Rgb[] = [
  [99, 74, 50],
  [116, 88, 60],
  [131, 102, 71],
  [145, 114, 81],
];

const FLOWER_COLORS: readonly { petal: Rgb; center: Rgb }[] = [
  { petal: [238, 243, 232], center: [242, 212, 92] }, // white daisy
  { petal: [244, 216, 98], center: [212, 144, 42] }, // buttercup
  { petal: [232, 164, 192], center: [248, 238, 194] }, // wild rose
];

function writePixel(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  rgb: Rgb,
): void {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = (y * w + x) * 4;
  data[idx] = rgb[0];
  data[idx + 1] = rgb[1];
  data[idx + 2] = rgb[2];
  data[idx + 3] = 255;
}

/** Organic prop anchored in strip-local art-pixel coordinates. */
export interface MeadowProp {
  kind: 'tall-grass' | 'boulder' | 'tree';
  /** Horizontal center in art pixels `[0, stripW)`. */
  x: number;
  /** Ground base Y in art pixels `[0, stripH)`. */
  y: number;
}

/** Pre-rendered seamless rolling meadow strip plus Y-sortable organic props. */
export interface OrganicMeadowStrip {
  canvas: HTMLCanvasElement;
  stripW: number;
  stripH: number;
  props: MeadowProp[];
}

/**
 * Computes the organic dirt-clearing / winding-trail density in `[0, 1]` at `(x, y)`
 * on a horizontally wrapping meadow strip. Values `> 0.50` transition via Bayer dithering
 * into warm irregular dirt clearings and trails.
 */
export function sampleMeadowDirtMask(
  x: number,
  y: number,
  stripW: number,
  stripH: number,
): number {
  const theta = (x / stripW) * Math.PI * 2;
  // Gently meandering woodland trail across the middle-lower meadow
  const trailY =
    stripH * 0.56 +
    Math.sin(theta * 2 + 0.4) * (stripH * 0.14) +
    Math.cos(theta * 3 - 0.8) * (stripH * 0.06);
  const warp = (periodicFbm(x, y, 40, stripW, 401) - 0.5) * 34;
  const distTrail = Math.abs(y - trailY + warp * 0.55);
  const trailStrength = Math.max(0, 1 - distTrail / (stripH * 0.095));

  // Secondary irregular woodland clearings (top-right & lower-left style)
  const clearingNoise = periodicFbm(x, y, 80, stripW, 911);
  const clearingStrength = Math.max(0, (clearingNoise - 0.58) * 2.9);

  return Math.max(trailStrength, clearingStrength);
}

/**
 * Generates a horizontally seamless (`stripW × stripH` art px) organic pixel meadow canvas
 * plus Y-sorted clusters of dark-outlined tall grass tufts, slate boulders, and edge trees.
 */
export function buildOrganicMeadowStrip(
  stripW: number,
  stripH: number,
): OrganicMeadowStrip | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = stripW;
  canvas.height = stripH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(stripW, stripH);
  const data = imgData.data;

  for (let y = 0; y < stripH; y += 1) {
    for (let x = 0; x < stripW; x += 1) {
      const grassNoise = periodicFbm(x, y, 32, stripW, 101);
      const bladeGrain = pixelHash(x, y, 709);
      const dirtMask = sampleMeadowDirtMask(x, y, stripW, stripH);
      const bayer = BAYER_4X4[y & 3][x & 3];

      // Feathered/dithered transition band [0.34 .. 0.62] produces authentic pixel scatter
      const dirtEdge = (dirtMask - 0.34) / 0.28;
      const isDirt = dirtEdge > bayer * 0.82 + (bladeGrain - 0.5) * 0.22;

      if (isDirt) {
        const dirtNoise = periodicFbm(x, y, 20, stripW, 307);
        const rimDarken = dirtEdge < 0.85 ? -0.18 : 0;
        const tone = Math.min(
          DIRT_PALETTE.length - 1,
          Math.max(
            0,
            Math.floor((dirtNoise + rimDarken + (bladeGrain - 0.5) * 0.25) * DIRT_PALETTE.length),
          ),
        );
        writePixel(data, stripW, stripH, x, y, DIRT_PALETTE[tone]);
      } else {
        // Subtle 1px dark/bright grass-blade stippling over smooth dappled meadow shades
        const stipple = bladeGrain < 0.14 ? -0.22 : bladeGrain > 0.88 ? 0.2 : 0;
        const shade = Math.min(
          MEADOW_GRASS_PALETTE.length - 1,
          Math.max(0, Math.floor((grassNoise + stipple) * MEADOW_GRASS_PALETTE.length)),
        );
        writePixel(data, stripW, stripH, x, y, MEADOW_GRASS_PALETTE[shade]);
      }
    }
  }

  // Tiny scattered 3×3 pixel wildflowers across open grass + tiny dirt pebbles
  for (let y = 4; y < stripH - 4; y += 5) {
    for (let x = 4; x < stripW - 4; x += 5) {
      const r = pixelHash(x, y, 2027);
      const fx = x + Math.floor(pixelHash(x, y, 2039) * 4);
      const fy = y + Math.floor(pixelHash(x, y, 2053) * 4);
      const dirt = sampleMeadowDirtMask(fx, fy, stripW, stripH);
      if (dirt < 0.30 && r > 0.968) {
        const flower = FLOWER_COLORS[Math.floor(pixelHash(fx, fy, 2063) * FLOWER_COLORS.length)];
        writePixel(data, stripW, stripH, fx, fy - 1, flower.petal);
        writePixel(data, stripW, stripH, fx - 1, fy, flower.petal);
        writePixel(data, stripW, stripH, fx + 1, fy, flower.petal);
        writePixel(data, stripW, stripH, fx, fy + 1, flower.petal);
        writePixel(data, stripW, stripH, fx, fy, flower.center);
      } else if (dirt > 0.65 && r > 0.985) {
        // Subtle 2×1 pebble fleck on dirt clearings
        writePixel(data, stripW, stripH, fx, fy, [82, 62, 44]);
        writePixel(data, stripW, stripH, fx + 1, fy, [154, 126, 92]);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Build organic tall-grass clusters, nestled boulders, and corner woodland trees
  const props: MeadowProp[] = [];
  const clusterCenters = [
    { x: 0.08, y: 0.16, count: 10 },
    { x: 0.24, y: 0.22, count: 7 },
    { x: 0.44, y: 0.14, count: 9 },
    { x: 0.68, y: 0.18, count: 8 },
    { x: 0.87, y: 0.24, count: 10 },
    { x: 0.15, y: 0.84, count: 8 },
    { x: 0.54, y: 0.86, count: 9 },
    { x: 0.82, y: 0.83, count: 8 },
  ];

  clusterCenters.forEach((cluster, ci) => {
    const cx = cluster.x * stripW;
    const cy = cluster.y * stripH;
    for (let i = 0; i < cluster.count; i += 1) {
      const ox = (pixelHash(ci * 31 + i, 11, 5051) - 0.5) * 68;
      const oy = (pixelHash(ci * 31 + i, 29, 5077) - 0.5) * 34;
      const px = (((cx + ox) % stripW) + stripW) % stripW;
      const py = Math.max(14, Math.min(stripH - 8, Math.round(cy + oy)));
      if (sampleMeadowDirtMask(px, py, stripW, stripH) < 0.42) {
        props.push({ kind: 'tall-grass', x: Math.round(px), y: py });
      }
    }
    // Nestle a smooth boulder beside every second tall-grass grove
    if (ci % 2 === 1) {
      const bx = (((cx + 22) % stripW) + stripW) % stripW;
      const by = Math.max(18, Math.min(stripH - 10, Math.round(cy + 8)));
      if (sampleMeadowDirtMask(bx, by, stripW, stripH) < 0.48) {
        props.push({ kind: 'boulder', x: Math.round(bx), y: by });
      }
    }
  });

  // Soft woodland edge trees tucked along upper & lower margins
  const treeSpots = [
    { x: 0.04, y: 0.08 },
    { x: 0.35, y: 0.07 },
    { x: 0.62, y: 0.09 },
    { x: 0.93, y: 0.08 },
    { x: 0.30, y: 0.96 },
    { x: 0.74, y: 0.97 },
  ];
  for (const t of treeSpots) {
    props.push({
      kind: 'tree',
      x: Math.round(t.x * stripW),
      y: Math.round(t.y * stripH),
    });
  }

  return { canvas, stripW, stripH, props };
}

/** Draws a single tall-grass clump or boulder prop at backing-store `(x, y)` with grounded shadow. */
export function drawMeadowProp(
  ctx: CanvasRenderingContext2D,
  prop: MeadowProp,
  screenX: number,
  screenY: number,
  u: number,
  treeImg: HTMLImageElement | null,
): void {
  if (prop.kind === 'tall-grass') {
    const w = TALL_GRASS_CLUMP[0].length * u;
    const h = TALL_GRASS_CLUMP.length * u;
    // Subtle dark ground contact shading tucked directly below the tall grass clump
    ctx.fillStyle = 'rgba(10, 22, 12, 0.28)';
    ctx.fillRect(Math.round(screenX - w * 0.44), Math.round(screenY - u), Math.round(w * 0.88), u * 2);
    drawBitmap(
      ctx,
      TALL_GRASS_CLUMP,
      Math.round(screenX - w / 2),
      Math.round(screenY - h + u),
      u,
      TALL_GRASS_COLORS,
    );
  } else if (prop.kind === 'boulder') {
    const w = MEADOW_BOULDER[0].length * u;
    const h = MEADOW_BOULDER.length * u;
    drawPixelShadow(ctx, screenX, screenY, w * 0.92, u, 0.36);
    drawBitmap(
      ctx,
      MEADOW_BOULDER,
      Math.round(screenX - w / 2),
      Math.round(screenY - h + u),
      u,
      BOULDER_COLORS,
    );
  } else if (prop.kind === 'tree') {
    const tw = u * 32;
    const th = u * 32;
    drawPixelShadow(ctx, screenX, screenY, tw * 0.72, u, 0.30);
    if (treeImg) {
      ctx.drawImage(treeImg, Math.round(screenX - tw / 2), Math.round(screenY - th + u * 2), tw, th);
    } else {
      ctx.fillStyle = '#24592c';
      ctx.fillRect(Math.round(screenX - tw / 2), Math.round(screenY - th + u * 2), tw, th);
    }
  }
}

/**
 * Paints an organic indoor habitat floor (mottled bright meadow grass, dithered warm basking
 * sand/dirt patch, subtle pebbles, tiny flowers, and soft grass tufts) inside a Display Pen.
 */
export function drawOrganicPenHabitat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  u: number,
  penIndex: number,
): void {
  const artW = Math.max(8, Math.ceil(w / u));
  const artH = Math.max(8, Math.ceil(h / u));

  if (typeof document !== 'undefined' && typeof ctx.createImageData === 'function') {
    const off = document.createElement('canvas');
    off.width = artW;
    off.height = artH;
    const octx = off.getContext('2d');
    if (octx && typeof octx.createImageData === 'function') {
      const imgData = octx.createImageData(artW, artH);
      const data = imgData.data;
      const seed = 701 + penIndex * 197;

      // Each pen gets a distinct organic warm dirt basking spot with feathered pixel edges
      const patchCx = artW * (0.34 + ((penIndex * 29) % 35) / 100);
      const patchCy = artH * (0.46 + ((penIndex * 17) % 20) / 100);
      const patchRx = artW * 0.22;
      const patchRy = artH * 0.24;

      for (let py = 0; py < artH; py += 1) {
        for (let px = 0; px < artW; px += 1) {
          const grassN = periodicFbm(px, py, 18, Math.max(36, artW), seed);
          const grain = pixelHash(px, py, seed + 41);
          const nx = (px - patchCx) / Math.max(4, patchRx);
          const ny = (py - patchCy) / Math.max(4, patchRy);
          const warp = (periodicFbm(px, py, 14, Math.max(28, artW), seed + 83) - 0.5) * 0.65;
          const dist = Math.hypot(nx, ny) + warp;
          const dirtEdge = (1.05 - dist) / 0.36;
          const bayer = BAYER_4X4[py & 3][px & 3];
          const isDirt = dirtEdge > bayer * 0.85 + (grain - 0.5) * 0.18;

          if (isDirt) {
            const dn = periodicFbm(px, py, 10, Math.max(20, artW), seed + 131);
            const tone = Math.min(
              DIRT_PALETTE.length - 1,
              Math.max(0, Math.floor((dn + 0.12 + (grain - 0.5) * 0.2) * DIRT_PALETTE.length)),
            );
            writePixel(data, artW, artH, px, py, DIRT_PALETTE[tone]);
          } else {
            const stipple = grain < 0.12 ? -0.22 : grain > 0.89 ? 0.2 : 0;
            const shade = Math.min(
              INDOOR_GRASS_PALETTE.length - 1,
              Math.max(0, Math.floor((grassN + stipple) * INDOOR_GRASS_PALETTE.length)),
            );
            writePixel(data, artW, artH, px, py, INDOOR_GRASS_PALETTE[shade]);
          }
        }
      }

      // Tiny pebbles & wildflowers inside the habitat pen
      for (let i = 0; i < 8; i += 1) {
        const fx = 4 + Math.floor(pixelHash(i, 7, seed + 211) * Math.max(1, artW - 8));
        const fy = 4 + Math.floor(pixelHash(i, 13, seed + 223) * Math.max(1, artH - 8));
        if (i < 5) {
          const fl = FLOWER_COLORS[(penIndex + i) % FLOWER_COLORS.length];
          writePixel(data, artW, artH, fx, fy - 1, fl.petal);
          writePixel(data, artW, artH, fx - 1, fy, fl.petal);
          writePixel(data, artW, artH, fx + 1, fy, fl.petal);
          writePixel(data, artW, artH, fx, fy + 1, fl.petal);
          writePixel(data, artW, artH, fx, fy, fl.center);
        } else {
          writePixel(data, artW, artH, fx, fy, [88, 96, 104]);
          writePixel(data, artW, artH, fx + 1, fy, [126, 136, 146]);
        }
      }

      octx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, Math.round(x), Math.round(y), Math.round(w), Math.round(h));

      // 2-3 small dark-outlined grass tufts nestled near pen corners (never blocking center)
      const tufts = [
        { rx: 0.14, ry: 0.24 },
        { rx: 0.84, ry: 0.28 },
        { rx: 0.78, ry: 0.78 },
      ];
      for (let i = 0; i < tufts.length; i += 1) {
        const tx = Math.round(x + w * tufts[i].rx);
        const ty = Math.round(y + h * tufts[i].ry);
        drawBitmap(ctx, SMALL_GRASS_TUFT, tx, ty, Math.max(1, Math.round(u * 0.8)), TALL_GRASS_COLORS);
      }
      return;
    }
  }

  // Headless/jsdom fallback when ImageData canvas buffer is unavailable
  ctx.fillStyle = '#5c9a44';
  ctx.fillRect(x, y, w, h);
}
