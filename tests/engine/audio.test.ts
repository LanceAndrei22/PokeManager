/**
 * Unit tests for PokéMart's cross-browser Web Audio SFX and adaptive BGM synthesizer:
 * volume clamping, mute toggles, safe headless/jsdom guards, unlock hook cleanup,
 * dedicated `'bankrupt'` DS-era minor-key track sequence, and track resolution/transitions
 * (`menu` / `shop` / `bankrupt` / `quiet`).
 */
import { describe, expect, it } from 'vitest';
import {
  getSfxMuted,
  getSfxVolume,
  initAudioUnlockListeners,
  playSfx,
  setSfxMuted,
  setSfxVolume,
} from '../../src/engine/audio';
import {
  getBgmMuted,
  getBgmTrackDefinition,
  getBgmVolume,
  getCurrentBgmTrack,
  resolveActiveBgmTrack,
  setBgmMuted,
  setBgmTrack,
  setBgmVolume,
  stopBgm,
} from '../../src/engine/bgm';

describe('Cross-Browser Audio SFX & Adaptive BGM Engine', () => {
  it('clamps SFX volume, manages mute state, and plays safely without AudioContext in jsdom', () => {
    setSfxMuted(true);
    expect(getSfxMuted()).toBe(true);
    setSfxMuted(false);
    expect(getSfxMuted()).toBe(false);

    setSfxVolume(-0.4);
    expect(getSfxVolume()).toBe(0);
    setSfxVolume(2.5);
    expect(getSfxVolume()).toBe(1);
    setSfxVolume(0.65);
    expect(getSfxVolume()).toBe(0.65);

    const dispose = initAudioUnlockListeners();
    expect(() => playSfx('bell')).not.toThrow();
    expect(() => playSfx('sale')).not.toThrow();
    expect(() => playSfx('shiny')).not.toThrow();
    expect(() => playSfx('haggle')).not.toThrow();
    expect(() => playSfx('walkout')).not.toThrow();
    dispose();
  });

  it('defines a valid non-empty DS-era minor-key bankrupt BGM sequence and resolves screen/bankruptcy transitions', () => {
    const bankruptDef = getBgmTrackDefinition('bankrupt');
    expect(bankruptDef).not.toBeNull();
    expect(bankruptDef!.pattern.length).toBeGreaterThanOrEqual(16);
    expect(bankruptDef!.pattern.some((step) => typeof step.lead === 'number')).toBe(true);
    expect(bankruptDef!.pattern.some((step) => typeof step.bass === 'number')).toBe(true);
    // Gentle ~76-84 BPM tempo range (0.357s .. 0.395s per eighth/beat step)
    expect(bankruptDef!.stepSec).toBeGreaterThanOrEqual(0.35);
    expect(bankruptDef!.stepSec).toBeLessThanOrEqual(0.41);
    expect(getBgmTrackDefinition('quiet')).toBeNull();

    // Active store with bankrupt profile -> 'bankrupt'; menu always -> 'menu'; healthy store -> 'shop'
    expect(resolveActiveBgmTrack('shop', true)).toBe('bankrupt');
    expect(resolveActiveBgmTrack('menu', true)).toBe('menu');
    expect(resolveActiveBgmTrack('menu', false)).toBe('menu');
    expect(resolveActiveBgmTrack('shop', false)).toBe('shop');
  });

  it('switches safely across menu, shop, bankrupt, and quiet BGM tracks and applies mute/volume during bankrupt', () => {
    stopBgm();
    expect(getCurrentBgmTrack()).toBe('quiet');

    setBgmVolume(-1);
    expect(getBgmVolume()).toBe(0);
    setBgmVolume(4);
    expect(getBgmVolume()).toBe(1);
    setBgmVolume(0.35);
    expect(getBgmVolume()).toBe(0.35);

    setBgmTrack('menu');
    expect(getCurrentBgmTrack()).toBe('menu');
    setBgmTrack('shop');
    expect(getCurrentBgmTrack()).toBe('shop');

    // Transition into dedicated bankrupt BGM track and verify mute + volume controls remain responsive
    setBgmTrack('bankrupt');
    expect(getCurrentBgmTrack()).toBe('bankrupt');
    setBgmMuted(true);
    expect(getBgmMuted()).toBe(true);
    expect(getCurrentBgmTrack()).toBe('bankrupt');
    setBgmVolume(0.5);
    expect(getBgmVolume()).toBe(0.5);
    setBgmMuted(false);
    expect(getBgmMuted()).toBe(false);

    // Recover cleanly back to menu or fresh shop shift
    setBgmTrack('menu');
    expect(getCurrentBgmTrack()).toBe('menu');
    setBgmTrack('bankrupt');
    expect(getCurrentBgmTrack()).toBe('bankrupt');
    setBgmTrack('shop');
    expect(getCurrentBgmTrack()).toBe('shop');

    setBgmTrack('quiet');
    expect(getCurrentBgmTrack()).toBe('quiet');
    setBgmVolume(0.35);
    stopBgm();
  });
});
