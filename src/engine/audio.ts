/**
 * Zero-KB Web Audio API chiptune synthesizer for PokéMart v2.
 * Uses soft sine and triangle oscillators with gentle envelopes, safely guarding
 * missing AudioContext in headless test runners and honoring per-profile mute state.
 */
import type { SfxCue } from './simulation';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
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
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = note.type ?? 'triangle';
    osc.frequency.setValueAtTime(note.freq, now + note.delay);

    const peak = note.gain ?? 0.06;
    gainNode.gain.setValueAtTime(0.0001, now + note.delay);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + note.delay + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now + note.delay);
    osc.stop(now + note.delay + note.duration + 0.02);
  }
}

/** Plays a soft Web Audio sound cue unless `muted` is true. */
export function playSfx(cue: SfxCue, muted: boolean): void {
  if (muted) return;

  try {
    switch (cue) {
      case 'bell':
        playToneSequence([
          { freq: 784, duration: 0.14, delay: 0, type: 'sine', gain: 0.05 },
          { freq: 1046.5, duration: 0.25, delay: 0.09, type: 'sine', gain: 0.05 },
        ]);
        break;
      case 'sale':
        playToneSequence([
          { freq: 659.25, duration: 0.1, delay: 0, type: 'triangle', gain: 0.05 },
          { freq: 880, duration: 0.12, delay: 0.08, type: 'triangle', gain: 0.05 },
          { freq: 1174.66, duration: 0.2, delay: 0.16, type: 'sine', gain: 0.05 },
        ]);
        break;
      case 'evolve':
        playToneSequence([
          { freq: 523.25, duration: 0.12, delay: 0, type: 'sine', gain: 0.05 },
          { freq: 659.25, duration: 0.12, delay: 0.09, type: 'sine', gain: 0.05 },
          { freq: 783.99, duration: 0.12, delay: 0.18, type: 'sine', gain: 0.05 },
          { freq: 1046.5, duration: 0.28, delay: 0.27, type: 'triangle', gain: 0.06 },
        ]);
        break;
      case 'hatch':
        playToneSequence([
          { freq: 587.33, duration: 0.11, delay: 0, type: 'triangle', gain: 0.05 },
          { freq: 739.99, duration: 0.11, delay: 0.1, type: 'triangle', gain: 0.05 },
          { freq: 880, duration: 0.22, delay: 0.2, type: 'sine', gain: 0.06 },
        ]);
        break;
      case 'heal':
        playToneSequence([
          { freq: 523.25, duration: 0.15, delay: 0, type: 'sine', gain: 0.045 },
          { freq: 659.25, duration: 0.15, delay: 0.12, type: 'sine', gain: 0.045 },
          { freq: 783.99, duration: 0.25, delay: 0.24, type: 'sine', gain: 0.045 },
        ]);
        break;
      case 'shiny':
        playToneSequence([
          { freq: 783.99, duration: 0.1, delay: 0, type: 'triangle', gain: 0.06 },
          { freq: 987.77, duration: 0.1, delay: 0.08, type: 'triangle', gain: 0.06 },
          { freq: 1174.66, duration: 0.1, delay: 0.16, type: 'triangle', gain: 0.06 },
          { freq: 1567.98, duration: 0.3, delay: 0.24, type: 'sine', gain: 0.065 },
        ]);
        break;
      case 'walkout':
        playToneSequence([
          { freq: 440, duration: 0.12, delay: 0, type: 'triangle', gain: 0.04 },
          { freq: 349.23, duration: 0.18, delay: 0.1, type: 'triangle', gain: 0.04 },
        ]);
        break;
      case 'click':
      default:
        playToneSequence([{ freq: 620, duration: 0.05, delay: 0, type: 'sine', gain: 0.03 }]);
        break;
    }
  } catch {
    // Ignore headless or blocked AudioContext gracefully
  }
}
