/**
 * PMD SpriteCollab `AnimData.xml` parser and 8-directional frame slicer.
 *
 * Parses `<ShadowSize>`, `<FrameWidth>`, `<FrameHeight>`, `<Durations>`, and
 * `<CopyOf>` references, then advances sprite frames strictly by PMD's 60 fps
 * duration ticks while clamping 1-row sheets (such as `Sleep-Anim.png`) cleanly.
 */
import type { PmdDirection } from './types';

/** Parsed definition for a single PMD animation sheet (e.g., `Walk`, `Idle`, `Sleep`). */
export interface PmdAnimDefinition {
  name: string;
  /** Actual sheet file prefix (follows `<CopyOf>` chains when present). */
  sourceAnim: string;
  frameWidth: number;
  frameHeight: number;
  /** Frame hold counts measured in 1/60-second ticks. */
  durations: number[];
  /** Total loop length in 1/60-second ticks. */
  totalTicks: number;
}

/** Complete parsed contents of one species' `AnimData.xml`. */
export interface ParsedAnimData {
  shadowSize: number;
  anims: Record<string, PmdAnimDefinition>;
}

interface RawAnimEntry {
  name: string;
  frameWidth?: number;
  frameHeight?: number;
  durations?: number[];
  copyOf?: string;
}

function readTagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Parses a PMDCollab `AnimData.xml` string cleanly without requiring browser DOMParser.
 * Resolves `<CopyOf>` chains safely with cycle detection so copied animations
 * inherit their target's `FrameWidth`, `FrameHeight`, `Durations`, and sheet name.
 */
export function parseAnimDataXml(xml: string): ParsedAnimData {
  const shadowRaw = readTagValue(xml, 'ShadowSize');
  const shadowSize = shadowRaw ? Number(shadowRaw) || 1 : 1;

  const rawMap = new Map<string, RawAnimEntry>();
  const animRegex = /<Anim>([\s\S]*?)<\/Anim>/gi;
  let match: RegExpExecArray | null;

  while ((match = animRegex.exec(xml)) !== null) {
    const block = match[1];
    const name = readTagValue(block, 'Name');
    if (!name) continue;

    const copyOf = readTagValue(block, 'CopyOf') ?? undefined;
    const fwRaw = readTagValue(block, 'FrameWidth');
    const fhRaw = readTagValue(block, 'FrameHeight');
    const durations: number[] = [];
    const durRegex = /<Duration>\s*(\d+)\s*<\/Duration>/gi;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = durRegex.exec(block)) !== null) {
      const val = Number(dMatch[1]);
      if (Number.isFinite(val) && val > 0) durations.push(val);
    }

    rawMap.set(name, {
      name,
      frameWidth: fwRaw ? Number(fwRaw) : undefined,
      frameHeight: fhRaw ? Number(fhRaw) : undefined,
      durations: durations.length > 0 ? durations : undefined,
      copyOf,
    });
  }

  const resolved: Record<string, PmdAnimDefinition> = {};

  const resolveEntry = (name: string, visited = new Set<string>()): PmdAnimDefinition | null => {
    if (resolved[name]) return resolved[name];
    if (visited.has(name)) return null;
    const entry = rawMap.get(name);
    if (!entry) return null;
    visited.add(name);

    const parent = entry.copyOf ? resolveEntry(entry.copyOf, visited) : null;
    const frameWidth = entry.frameWidth ?? parent?.frameWidth ?? 32;
    const frameHeight = entry.frameHeight ?? parent?.frameHeight ?? 32;
    const durations =
      entry.durations && entry.durations.length > 0
        ? entry.durations
        : parent?.durations ?? [10];
    const sourceAnim = entry.copyOf ? parent?.sourceAnim ?? entry.copyOf : entry.name;
    const totalTicks = durations.reduce((sum, d) => sum + d, 0) || 1;

    const def: PmdAnimDefinition = {
      name: entry.name,
      sourceAnim,
      frameWidth,
      frameHeight,
      durations,
      totalTicks,
    };
    resolved[name] = def;
    return def;
  };

  for (const name of rawMap.keys()) {
    resolveEntry(name);
  }

  return { shadowSize, anims: resolved };
}

/**
 * Converts a 2D velocity/displacement vector `(dx, dy)` into the nearest PMD
 * 8-directional row (`0 = S, 1 = SE, 2 = E, 3 = NE, 4 = N, 5 = NW, 6 = W, 7 = SW`).
 * Notice canvas `+y` points South while `+x` points East.
 */
export function vectorToPmdDirection(
  dx: number,
  dy: number,
  fallback: PmdDirection = 0,
  threshold = 0.25,
): PmdDirection {
  if (Math.hypot(dx, dy) < threshold) {
    return fallback;
  }
  // Angle in radians where 0 = South (+Y), PI/2 = East (+X), etc. clockwise:
  // Wait: standard atan2(dx, dy) gives 0 at +Y (South), +PI/2 at +X (East),
  // ±PI at -Y (North), -PI/2 at -X (West)! Dividing by PI/4 maps directly to 0..7!
  const angle = Math.atan2(dx, dy);
  const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return octant as PmdDirection;
}

export interface PmdFrameSlice {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  frameIndex: number;
  rowIndex: number;
}

/**
 * Computes the exact source pixel rectangle inside a loaded PMD spritesheet for
 * `direction` (`0..7`) and `elapsedSec` using PMD's 60 fps tick durations.
 * Automatically clamps `rowIndex` so 1-row sheets (`Sleep`) always sample row 0.
 */
export function computePmdFrameRect(
  anim: PmdAnimDefinition,
  sheetWidth: number,
  sheetHeight: number,
  direction: PmdDirection,
  elapsedSec: number,
): PmdFrameSlice {
  const sw = Math.max(1, anim.frameWidth);
  const sh = Math.max(1, anim.frameHeight);
  const cols = Math.max(1, Math.floor(sheetWidth / sw));
  const rows = Math.max(1, Math.floor(sheetHeight / sh));

  const rowIndex = Math.min(rows - 1, Math.max(0, direction));

  // Advance elapsed ticks at 60 fps and wrap cleanly across totalTicks
  const totalTicks = Math.max(1, anim.totalTicks);
  const tickPos = (((elapsedSec * 60) % totalTicks) + totalTicks) % totalTicks;

  let frameIndex = 0;
  let accum = 0;
  const maxFrames = Math.min(cols, anim.durations.length);
  for (let i = 0; i < maxFrames; i += 1) {
    accum += anim.durations[i];
    if (tickPos < accum) {
      frameIndex = i;
      break;
    }
    frameIndex = i;
  }

  return {
    sx: frameIndex * sw,
    sy: rowIndex * sh,
    sw,
    sh,
    frameIndex,
    rowIndex,
  };
}
