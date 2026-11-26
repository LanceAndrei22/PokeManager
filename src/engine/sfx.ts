/**
 * Cross-browser Web Audio API chiptune SFX synthesizer (`src/engine/sfx.ts`).
 *
 * Designed to work reliably across Chrome, Firefox, Opera, and Safari:
 * - Capture-phase gesture unlock (`pointerdown`, `keydown`, `click`) resumes suspended
 *   contexts and plays a 1-sample silent buffer for Safari/Opera/iOS WebKit unlock.
 * - Routes SFX through `SfxGain -> MasterGain -> destination` shared with BGM.
 * - Schedules envelopes `+0.015s` ahead of `ctx.currentTime` with `0.0001` ramp floors.
 */
import type { SfxCue } from './simulation';

let sharedCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let sfxMuted = false;
let sfxVolume = 0.65;
let audioUnlocked = false;
let unlockListenersAttached = false;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.65;
  return Math.min(1, Math.max(0, value));
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

function syncSfxGain(): void {
  if (!sharedCtx || !sfxGain) return;
  const target = sfxMuted ? 0 : sfxVolume;
  sfxGain.gain.setValueAtTime(target, sharedCtx.currentTime);
}

/**
 * Lazily initializes and returns the shared Web Audio graph (`SfxGain -> MasterGain`).
 * Returns `null` safely in headless/jsdom environments lacking Web Audio.
 */
export function ensureAudioGraph(): {
  ctx: AudioContext;
  masterGain: GainNode;
  sfxGain: GainNode;
} | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  if (!sharedCtx) {
    sharedCtx = new Ctor();
    masterGain = sharedCtx.createGain();
    masterGain.gain.setValueAtTime(1, sharedCtx.currentTime);
    masterGain.connect(sharedCtx.destination);

    sfxGain = sharedCtx.createGain();
    sfxGain.gain.setValueAtTime(sfxMuted ? 0 : sfxVolume, sharedCtx.currentTime);
    sfxGain.connect(masterGain);
  } else if (!masterGain || !sfxGain) {
    masterGain = sharedCtx.createGain();
    masterGain.gain.setValueAtTime(1, sharedCtx.currentTime);
    masterGain.connect(sharedCtx.destination);
    sfxGain = sharedCtx.createGain();
    sfxGain.gain.setValueAtTime(sfxMuted ? 0 : sfxVolume, sharedCtx.currentTime);
    sfxGain.connect(masterGain);
  }

  return { ctx: sharedCtx, masterGain, sfxGain };
}

/** Returns the shared `AudioContext` once created (or creates it safely). */
export function getSharedAudioContext(): AudioContext | null {
  return ensureAudioGraph()?.ctx ?? null;
}

/** Returns the shared `MasterGain` node so `bgm.ts` routes through the same mixer. */
export function getMasterGain(): GainNode | null {
  return ensureAudioGraph()?.masterGain ?? null;
}

/** Unlocks/resumes Web Audio using a 1-sample silent buffer on user interaction. */
export function unlockAudioFromGesture(): boolean {
  const graph = ensureAudioGraph();
  if (!graph) return false;

  const { ctx, masterGain: master } = graph;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!audioUnlocked) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.start(0);
      audioUnlocked = true;
    } catch {
      // Ignore strict autoplay/test environments
    }
  }
  return audioUnlocked;
}

/**
 * Registers capture-phase user gesture listeners (`pointerdown`, `keydown`, `click`)
 * so SFX and BGM unlock cleanly across Firefox, Chrome, Opera, and Safari.
 */
export function initAudioUnlockListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    unlockAudioFromGesture();
  };
  if (!unlockListenersAttached) {
    unlockListenersAttached = true;
    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('click', handler, { capture: true, passive: true });
  }
  return () => {
    if (unlockListenersAttached) {
      unlockListenersAttached = false;
      window.removeEventListener('pointerdown', handler, { capture: true });
      window.removeEventListener('keydown', handler, { capture: true });
      window.removeEventListener('click', handler, { capture: true });
    }
  };
}

/** Sets whether SFX playback is muted. */
export function setSfxMuted(muted: boolean): void {
  sfxMuted = Boolean(muted);
  syncSfxGain();
}

/** Returns current SFX mute flag. */
export function getSfxMuted(): boolean {
  return sfxMuted;
}

/** Sets normalized SFX volume (`0..1`). */
export function setSfxVolume(volume: number): void {
  sfxVolume = clampVolume(volume);
  syncSfxGain();
}

/** Returns normalized SFX volume (`0..1`). */
export function getSfxVolume(): number {
  return sfxVolume;
}

function playToneSequence(
  notes: Array<{
    freq: number;
    duration: number;
    delay: number;
    type?: OscillatorType;
    gain?: number;
  }>,
): void {
  const graph = ensureAudioGraph();
  if (!graph) return;

  const { ctx, sfxGain: sfxBus } = graph;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Schedule slightly ahead (`+0.015s`) so freshly resumed browsers never clip the attack
  const startBase = ctx.currentTime + 0.015;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = note.type ?? 'triangle';
    osc.frequency.setValueAtTime(note.freq, startBase + note.delay);

    const peak = Math.max(0.001, note.gain ?? 0.14);
    const t0 = startBase + note.delay;
    const tAttack = t0 + 0.015;
    const tEnd = Math.max(tAttack + 0.02, t0 + note.duration);

    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(peak, tAttack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    osc.connect(gainNode);
    gainNode.connect(sfxBus);
    osc.start(t0);
    osc.stop(tEnd + 0.02);
  }
}

/** Plays a soft Web Audio sound cue unless muted (`mutedOverride` overrides module state). */
export function playSfx(cue: SfxCue | 'haggle', mutedOverride?: boolean): void {
  const effectiveMuted = mutedOverride !== undefined ? mutedOverride : sfxMuted;
  if (effectiveMuted || sfxVolume <= 0) return;

  try {
    switch (cue) {
      case 'bell':
        playToneSequence([
          { freq: 784, duration: 0.14, delay: 0, type: 'sine', gain: 0.14 },
          { freq: 1046.5, duration: 0.25, delay: 0.09, type: 'sine', gain: 0.14 },
        ]);
        break;
      case 'sale':
        playToneSequence([
          { freq: 659.25, duration: 0.1, delay: 0, type: 'triangle', gain: 0.14 },
          { freq: 880, duration: 0.12, delay: 0.08, type: 'triangle', gain: 0.14 },
          { freq: 1174.66, duration: 0.22, delay: 0.16, type: 'sine', gain: 0.15 },
        ]);
        break;
      case 'haggle':
        playToneSequence([
          { freq: 587.33, duration: 0.08, delay: 0, type: 'triangle', gain: 0.12 },
          { freq: 783.99, duration: 0.14, delay: 0.07, type: 'triangle', gain: 0.13 },
        ]);
        break;
      case 'evolve':
        playToneSequence([
          { freq: 523.25, duration: 0.12, delay: 0, type: 'sine', gain: 0.14 },
          { freq: 659.25, duration: 0.12, delay: 0.09, type: 'sine', gain: 0.14 },
          { freq: 783.99, duration: 0.12, delay: 0.18, type: 'sine', gain: 0.14 },
          { freq: 1046.5, duration: 0.28, delay: 0.27, type: 'triangle', gain: 0.16 },
        ]);
        break;
      case 'hatch':
        playToneSequence([
          { freq: 587.33, duration: 0.11, delay: 0, type: 'triangle', gain: 0.14 },
          { freq: 739.99, duration: 0.11, delay: 0.1, type: 'triangle', gain: 0.14 },
          { freq: 880, duration: 0.22, delay: 0.2, type: 'sine', gain: 0.16 },
        ]);
        break;
      case 'heal':
        playToneSequence([
          { freq: 523.25, duration: 0.15, delay: 0, type: 'sine', gain: 0.13 },
          { freq: 659.25, duration: 0.15, delay: 0.12, type: 'sine', gain: 0.13 },
          { freq: 783.99, duration: 0.25, delay: 0.24, type: 'sine', gain: 0.13 },
        ]);
        break;
      case 'shiny':
        playToneSequence([
          { freq: 783.99, duration: 0.1, delay: 0, type: 'triangle', gain: 0.15 },
          { freq: 987.77, duration: 0.1, delay: 0.08, type: 'triangle', gain: 0.15 },
          { freq: 1174.66, duration: 0.1, delay: 0.16, type: 'triangle', gain: 0.15 },
          { freq: 1567.98, duration: 0.3, delay: 0.24, type: 'sine', gain: 0.17 },
        ]);
        break;
      case 'walkout':
        playToneSequence([
          { freq: 440, duration: 0.12, delay: 0, type: 'triangle', gain: 0.11 },
          { freq: 349.23, duration: 0.18, delay: 0.1, type: 'triangle', gain: 0.11 },
        ]);
        break;
      case 'click':
      default:
        playToneSequence([{ freq: 620, duration: 0.055, delay: 0, type: 'sine', gain: 0.1 }]);
        break;
    }
  } catch {
    // Ignore headless or blocked AudioContext gracefully
  }
}
