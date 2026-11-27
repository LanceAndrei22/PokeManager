/**
 * Consolidated PMD-styled Volume control featuring a single `Volume` button that opens
 * a viewport-aware popover containing BGM/SFX On/Off toggles and synced volume sliders.
 * Uses native `popover="auto"` + CSS Anchor Positioning (`@supports (position-area: block-end)`)
 * with an automatic fallback for browsers/jsdom lacking the Popover API.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

export interface AudioControlsProps {
  bgmMuted: boolean;
  sfxMuted: boolean;
  bgmVolume: number;
  sfxVolume: number;
  onToggleBgmMute: () => void;
  onToggleSfxMute: () => void;
  onChangeBgmVolume: (volume: number) => void;
  onChangeSfxVolume: (volume: number) => void;
  compact?: boolean;
}

function supportsNativePopover(): boolean {
  return typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
}

export function AudioControls({
  bgmMuted,
  sfxMuted,
  bgmVolume,
  sfxVolume,
  onToggleBgmMute,
  onToggleSfxMute,
  onChangeBgmVolume,
  onChangeSfxVolume,
  compact = false,
}: AudioControlsProps) {
  const nativePopover = supportsNativePopover();
  const [mixerOpen, setMixerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const bgmSliderId = useId();
  const sfxSliderId = useId();
  const bgmPct = Math.round(bgmVolume * 100);
  const sfxPct = Math.round(sfxVolume * 100);
  const allMuted = bgmMuted && sfxMuted;

  // Sync `aria-expanded` from the native popover's `toggle` event when supported
  useEffect(() => {
    if (!nativePopover) return;
    const el = popoverRef.current;
    if (!el) return;
    const onToggle = (ev: Event) => {
      setMixerOpen((ev as ToggleEvent).newState === 'open');
    };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, [nativePopover]);

  // Fallback Escape & outside-pointer dismiss when native Popover API is absent (e.g. jsdom)
  useEffect(() => {
    if (nativePopover || !mixerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMixerOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMixerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [nativePopover, mixerOpen]);

  const btnClass = compact
    ? 'pmd-btn px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0'
    : 'pmd-btn px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0';

  const panelBody = (
    <>
      <div className="flex items-center justify-between border-b border-[#4e78bd] pb-1.5">
        <span className="font-semibold text-[#ffd84d]">Volume &amp; Audio</span>
        <button
          type="button"
          {...(nativePopover
            ? { popoverTarget: popoverId, popoverTargetAction: 'hide' as const }
            : { onClick: () => setMixerOpen(false) })}
          className="pmd-btn px-2 py-0.5 text-xs font-semibold"
        >
          Done
        </button>
      </div>

      {/* Music (BGM) Toggle + Volume Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#dbe8ff]">
          <label htmlFor={bgmSliderId}>Music (BGM)</label>
          <div className="flex items-center gap-1.5">
            <span className="pmd-num text-[#ffd84d]">{bgmMuted ? 'Muted' : `${bgmPct}%`}</span>
            <button
              type="button"
              aria-pressed={!bgmMuted}
              aria-label={bgmMuted ? 'Unmute background music' : 'Mute background music'}
              onClick={onToggleBgmMute}
              className={`pmd-btn pmd-num px-2 py-0.5 text-xs font-semibold ${
                bgmMuted ? 'text-[#a8c4f0]' : 'text-[#ffd84d]'
              }`}
            >
              BGM: {bgmMuted ? 'Off' : 'On'}
            </button>
          </div>
        </div>
        <input
          id={bgmSliderId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={bgmPct}
          aria-valuetext={`${bgmPct}%`}
          onChange={(e) => onChangeBgmVolume(Number(e.target.value) / 100)}
          className="pmd-slider"
          style={
            {
              '--attr-min': 0,
              '--attr-max': 100,
              '--control-value': bgmPct,
            } as CSSProperties
          }
        />
      </div>

      {/* Sound Effects (SFX) Toggle + Volume Slider */}
      <div className="space-y-1 border-t border-[#2d4a84] pt-2">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#dbe8ff]">
          <label htmlFor={sfxSliderId}>Effects (SFX)</label>
          <div className="flex items-center gap-1.5">
            <span className="pmd-num text-[#6ee7a0]">{sfxMuted ? 'Muted' : `${sfxPct}%`}</span>
            <button
              type="button"
              aria-pressed={!sfxMuted}
              aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              onClick={onToggleSfxMute}
              className={`pmd-btn pmd-num px-2 py-0.5 text-xs font-semibold ${
                sfxMuted ? 'text-[#a8c4f0]' : 'text-[#eef5ff]'
              }`}
            >
              SFX: {sfxMuted ? 'Off' : 'On'}
            </button>
          </div>
        </div>
        <input
          id={sfxSliderId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={sfxPct}
          aria-valuetext={`${sfxPct}%`}
          onChange={(e) => onChangeSfxVolume(Number(e.target.value) / 100)}
          className="pmd-slider"
          style={
            {
              '--attr-min': 0,
              '--attr-max': 100,
              '--control-value': sfxPct,
            } as CSSProperties
          }
        />
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 items-center whitespace-nowrap">
      <button
        type="button"
        aria-expanded={mixerOpen}
        aria-label="Volume settings"
        {...(nativePopover
          ? { popoverTarget: popoverId }
          : { onClick: () => setMixerOpen((prev) => !prev) })}
        className={`${btnClass} ${mixerOpen ? 'text-[#ffd84d]' : allMuted ? 'text-[#a8c4f0]' : 'text-[#eef5ff]'}`}
      >
        Volume
      </button>

      {nativePopover ? (
        <div
          ref={popoverRef}
          id={popoverId}
          popover="auto"
          role="region"
          aria-label="Audio Mixer"
          className="pmd-panel pmd-volume-popover space-y-2.5 p-3 text-sm"
        >
          {panelBody}
        </div>
      ) : (
        mixerOpen && (
          <div
            role="region"
            aria-label="Audio Mixer"
            className="pmd-panel absolute right-0 top-full z-40 mt-2 w-64 space-y-2.5 p-3 text-sm"
          >
            {panelBody}
          </div>
        )
      )}
    </div>
  );
}
