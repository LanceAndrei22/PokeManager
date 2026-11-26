/**
 * Unit tests for PokéMart's cross-browser Web Audio SFX and dual BGM synthesizer:
 * volume clamping, mute toggles, safe headless/jsdom guards, unlock hook cleanup,
 * and BGM track transitions (`menu` / `shop` / `quiet`).
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
  getBgmVolume,
  getCurrentBgmTrack,
  setBgmMuted,
  setBgmTrack,
  setBgmVolume,
  stopBgm,
} from '../../src/engine/bgm';

describe('Cross-Browser Audio SFX & Dual BGM Engine', () => {
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

  it('switches safely across menu, shop, and quiet BGM tracks and clamps volume', () => {
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

    setBgmMuted(true);
    expect(getBgmMuted()).toBe(true);
    setBgmMuted(false);
    expect(getBgmMuted()).toBe(false);

    setBgmTrack('quiet');
    expect(getCurrentBgmTrack()).toBe('quiet');
    stopBgm();
  });
});
