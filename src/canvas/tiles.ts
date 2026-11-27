/**
 * Procedural oak plank floor fallback used by `indoorArchitecture.ts` before the
 * decoded GBA `floor-tile.png` tileset finishes loading.
 */
import { seam } from './indoorConstants';
import type { Rect } from './types';

/** Deterministic integer hash so wood grain flecks never shimmer between redraws. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Staggered oak planks: alternating row tones, offset joints, and light grain flecks. */
export function drawPlankFloor(ctx: CanvasRenderingContext2D, area: Rect, unit: number): void {
  const plankH = unit * 6;
  const plankLen = unit * 28;
  const line = seam(unit);
  for (let row = 0, y = area.y; y < area.y + area.h; row += 1, y += plankH) {
    ctx.fillStyle = row % 2 === 0 ? '#c9a77d' : '#c3a074';
    ctx.fillRect(area.x, y, area.w, plankH);
    ctx.fillStyle = '#a98558';
    ctx.fillRect(area.x, y + plankH - line, area.w, line);
    // Joint offset shifts by 11 art px per row → classic staggered plank pattern.
    const offset = (row * 11 * unit) % plankLen;
    for (let jx = area.x - offset; jx < area.x + area.w; jx += plankLen) {
      if (jx > area.x) ctx.fillRect(jx, y, line, plankH);
    }
    ctx.fillStyle = '#d3b289';
    for (let g = 0; g < 6; g += 1) {
      const gx = area.x + (hash(row * 31 + g) % Math.max(1, Math.floor(area.w / unit))) * unit;
      const gy = y + unit + (hash(row * 17 + g) % 3) * unit;
      ctx.fillRect(gx, gy, unit * 2, line);
    }
  }
}
