/**
 * Polyphonic Web Audio cozy chiptune BGM sequencer for PokéMart: Low Cortisol Shift.
 *
 * Provides two relaxing original tracks routed through `BgmGain -> MasterGain`:
 * - `'menu'` (~80 BPM): Gentle F-major meadow breeze with triangle lead, warm pad chords, and soft bass.
 * - `'shop'` (~100 BPM): Warm upbeat C-major PokéMart counter groove.
 * - `'quiet'`: Smoothly crossfades to silence (used during Bankruptcy / hidden tab).
 */
import { ensureAudioGraph } from './sfx';

/** Available adaptive BGM tracks. */
export type BgmTrack = 'menu' | 'shop' | 'quiet';

interface BgmStep {
  lead?: number;
  harmony?: number;
  bass?: number;
}

// Peaceful ~80 BPM F-major meadow motif (0.375s eighth/beat step grid)
const MENU_PATTERN: BgmStep[] = [
  { lead: 523.25, harmony: 349.23, bass: 174.61 }, // C5 / F4 / F3
  { lead: 587.33 }, // D5
  { lead: 698.46, harmony: 440.0 }, // F5 / A4
  { lead: 659.25 }, // E5
  { lead: 587.33, harmony: 349.23, bass: 116.54 }, // D5 / F4 / Bb2
  { lead: 523.25 }, // C5
  { lead: 440.0, harmony: 293.66 }, // A4 / D4
  { lead: 523.25 }, // C5
  { lead: 587.33, harmony: 392.0, bass: 130.81 }, // D5 / G4 / C3
  { lead: 659.25 }, // E5
  { lead: 698.46, harmony: 440.0 }, // F5 / A4
  { lead: 783.99 }, // G5
  { lead: 659.25, harmony: 392.0, bass: 196.0 }, // E5 / G4 / G3
  { lead: 587.33 }, // D5
  { lead: 523.25, harmony: 349.23 }, // C5 / F4
  {},
];

// Cozy ~100 BPM C-major PokéMart groove (0.30s beat grid)
const SHOP_PATTERN: BgmStep[] = [
  { lead: 523.25, harmony: 329.63, bass: 130.81 }, // C5 / E4 / C3
  { lead: 659.25 }, // E5
  { lead: 783.99, harmony: 392.0, bass: 196.0 }, // G5 / G4 / G3
  { lead: 659.25 }, // E5
  { lead: 698.46, harmony: 349.23, bass: 174.61 }, // F5 / F4 / F3
  { lead: 880.0 }, // A5
  { lead: 783.99, harmony: 392.0, bass: 196.0 }, // G5 / G4 / G3
  { lead: 659.25 }, // E5
  { lead: 587.33, harmony: 349.23, bass: 146.83 }, // D5 / F4 / D3
  { lead: 659.25 }, // E5
  { lead: 523.25, harmony: 329.63, bass: 196.0 }, // C5 / E4 / G3
  { lead: 440.0 }, // A4
  { lead: 493.88, harmony: 293.66, bass: 196.0 }, // B4 / D4 / G3
  { lead: 587.33 }, // D5
  { lead: 523.25, harmony: 329.63, bass: 130.81 }, // C5 / E4 / C3
  {},
];

let bgmGain: GainNode | null = null;
let bgmMuted = false;
let bgmVolume = 0.35;
let currentTrack: BgmTrack = 'quiet';
let schedulerId: number | null = null;
let crossfadeTimerId: number | null = null;
let visibilityAttached = false;
let stepIndex = 0;
let nextNoteTime = 0;

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0.35;
  return Math.min(1, Math.max(0, v));
}

function ensureBgmGain(): { ctx: AudioContext; gain: GainNode } | null {
  const graph = ensureAudioGraph();
  if (!graph) return null;
  if (!bgmGain || bgmGain.context !== graph.ctx) {
    bgmGain = graph.ctx.createGain();
    bgmGain.gain.setValueAtTime(bgmMuted ? 0 : bgmVolume, graph.ctx.currentTime);
    bgmGain.connect(graph.masterGain);
  }
  return { ctx: graph.ctx, gain: bgmGain };
}

function rampBgmGain(target: number, fadeSec = 0.25): void {
  const bus = ensureBgmGain();
  if (!bus) return;
  const now = bus.ctx.currentTime;
  bus.gain.gain.cancelScheduledValues(now);
  bus.gain.gain.setValueAtTime(bus.gain.gain.value, now);
  bus.gain.gain.linearRampToValueAtTime(target, now + fadeSec);
}

function effectiveTargetGain(): number {
  if (bgmMuted || currentTrack === 'quiet') return 0;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return 0;
  return bgmVolume;
}

function scheduleBgmNote(
  ctx: AudioContext,
  bus: GainNode,
  freq: number,
  when: number,
  duration: number,
  type: OscillatorType,
  peak: number,
): void {
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);

  const safeEnd = Math.max(when + 0.06, when + duration);
  noteGain.gain.setValueAtTime(0.0001, when);
  noteGain.gain.exponentialRampToValueAtTime(peak, when + 0.025);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, safeEnd);

  osc.connect(noteGain);
  noteGain.connect(bus);
  osc.start(when);
  osc.stop(safeEnd + 0.02);
}

function stepScheduler(): void {
  if (currentTrack === 'quiet' || bgmMuted) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

  const bus = ensureBgmGain();
  if (!bus) return;
  const { ctx, gain } = bus;
  if (ctx.state === 'suspended') return;

  const pattern = currentTrack === 'menu' ? MENU_PATTERN : SHOP_PATTERN;
  const stepSec = currentTrack === 'menu' ? 0.375 : 0.3;

  if (nextNoteTime < ctx.currentTime) {
    nextNoteTime = ctx.currentTime + 0.02;
  }

  // Schedule up to 0.25s ahead so tempo stays rock-solid
  while (nextNoteTime < ctx.currentTime + 0.25) {
    const step = pattern[stepIndex % pattern.length];
    if (step.lead) {
      scheduleBgmNote(ctx, gain, step.lead, nextNoteTime, stepSec * 0.85, 'triangle', 0.16);
    }
    if (step.harmony) {
      scheduleBgmNote(ctx, gain, step.harmony, nextNoteTime, stepSec * 1.4, 'sine', 0.08);
    }
    if (step.bass) {
      scheduleBgmNote(ctx, gain, step.bass, nextNoteTime, stepSec * 1.5, 'sine', 0.12);
    }
    nextNoteTime += stepSec;
    stepIndex = (stepIndex + 1) % pattern.length;
  }
}

function attachVisibilityHandler(): void {
  if (visibilityAttached || typeof document === 'undefined') return;
  visibilityAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      rampBgmGain(0, 0.2);
    } else {
      const bus = ensureBgmGain();
      if (bus) {
        nextNoteTime = bus.ctx.currentTime + 0.04;
      }
      rampBgmGain(effectiveTargetGain(), 0.35);
    }
  });
}

function ensureSchedulerRunning(): void {
  if (typeof window === 'undefined' || schedulerId !== null) return;
  attachVisibilityHandler();
  schedulerId = window.setInterval(stepScheduler, 90);
}

/** Switches smoothly between `'menu'`, `'shop'`, and `'quiet'` BGM tracks (`0.5s` crossfade). */
export function setBgmTrack(track: BgmTrack): void {
  if (track === currentTrack) {
    rampBgmGain(effectiveTargetGain(), 0.25);
    return;
  }

  if (typeof window !== 'undefined' && crossfadeTimerId !== null) {
    window.clearTimeout(crossfadeTimerId);
    crossfadeTimerId = null;
  }

  const wasActive = currentTrack !== 'quiet';
  currentTrack = track;

  if (track === 'quiet') {
    rampBgmGain(0, 0.5);
    return;
  }

  ensureSchedulerRunning();
  const bus = ensureBgmGain();
  if (!bus) return;

  if (wasActive) {
    // Smooth 0.5s fade-down then fade-up transition between tracks
    rampBgmGain(0, 0.25);
    crossfadeTimerId = window.setTimeout(() => {
      crossfadeTimerId = null;
      stepIndex = 0;
      const b = ensureBgmGain();
      if (b) {
        nextNoteTime = b.ctx.currentTime + 0.03;
      }
      rampBgmGain(effectiveTargetGain(), 0.35);
    }, 250);
  } else {
    stepIndex = 0;
    nextNoteTime = bus.ctx.currentTime + 0.03;
    rampBgmGain(effectiveTargetGain(), 0.5);
  }
}

/** Sets BGM mute state (`true` ramps gain smoothly to 0). */
export function setBgmMuted(muted: boolean): void {
  bgmMuted = Boolean(muted);
  rampBgmGain(effectiveTargetGain(), 0.15);
}

/** Returns current BGM mute flag. */
export function getBgmMuted(): boolean {
  return bgmMuted;
}

/** Sets normalized BGM volume (`0..1`). */
export function setBgmVolume(volume: number): void {
  bgmVolume = clampVolume(volume);
  rampBgmGain(effectiveTargetGain(), 0.12);
}

/** Returns normalized BGM volume (`0..1`). */
export function getBgmVolume(): number {
  return bgmVolume;
}

/** Returns active BGM track identifier. */
export function getCurrentBgmTrack(): BgmTrack {
  return currentTrack;
}

/** Stops the BGM scheduler cleanly (useful on cleanup or tests). */
export function stopBgm(): void {
  currentTrack = 'quiet';
  if (typeof window !== 'undefined') {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
    if (crossfadeTimerId !== null) {
      window.clearTimeout(crossfadeTimerId);
      crossfadeTimerId = null;
    }
  }
  rampBgmGain(0, 0.1);
}
