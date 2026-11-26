/**
 * Backward-compatible re-export hub for PokéMart's Web Audio SFX and unlock system.
 */
export {
  ensureAudioGraph,
  getMasterGain,
  getSfxMuted,
  getSfxVolume,
  getSharedAudioContext,
  initAudioUnlockListeners,
  playSfx,
  setSfxMuted,
  setSfxVolume,
  unlockAudioFromGesture,
} from './sfx';
