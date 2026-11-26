/**
 * Compact PMD-styled audio controls featuring 1-click BGM/SFX mute buttons and an
 * accessible mixer popover with native range sliders synced to profile preferences.
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
  const [mixerOpen, setMixerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bgmSliderId = useId();
  const sfxSliderId = useId();
  const bgmPct = Math.round(bgmVolume * 100);
  const sfxPct = Math.round(sfxVolume * 100);

  useEffect(() => {
    if (!mixerOpen) return;
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
  }, [mixerOpen]);

  const btnPad = compact
    ? 'px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0'
    : 'px-2.5 py-1 text-sm font-semibold whitespace-nowrap shrink-0';

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
      <button
        type="button"
        aria-pressed={!bgmMuted}
        aria-label={bgmMuted ? 'Unmute background music' : 'Mute background music'}
        onClick={onToggleBgmMute}
        className={`pmd-btn pmd-num ${btnPad} ${bgmMuted ? 'text-[#a8c4f0]' : 'text-[#ffd84d]'}`}
      >
        BGM: {bgmMuted ? 'Off' : 'On'}
      </button>

      <button
        type="button"
        aria-pressed={!sfxMuted}
        aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
        onClick={onToggleSfxMute}
        className={`pmd-btn pmd-num ${btnPad} ${sfxMuted ? 'text-[#a8c4f0]' : 'text-[#eef5ff]'}`}
      >
        SFX: {sfxMuted ? 'Off' : 'On'}
      </button>

      <button
        type="button"
        aria-expanded={mixerOpen}
        aria-label="Audio volume mixer"
        onClick={() => setMixerOpen((prev) => !prev)}
        className={`pmd-btn ${btnPad} ${mixerOpen ? 'text-[#ffd84d]' : 'text-[#cfe0ff]'}`}
      >
        Vol
      </button>

      {mixerOpen && (
        <div
          role="region"
          aria-label="Audio Mixer"
          className="pmd-panel absolute right-0 top-full z-40 mt-2 w-60 space-y-2.5 p-3 text-sm"
        >
          <div className="flex items-center justify-between border-b border-[#4e78bd] pb-1.5">
            <span className="font-semibold text-[#ffd84d]">Audio Mixer</span>
            <button
              type="button"
              onClick={() => setMixerOpen(false)}
              className="pmd-btn px-2 py-0.5 text-xs font-semibold"
            >
              Done
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#dbe8ff]">
              <label htmlFor={bgmSliderId}>Music (BGM)</label>
              <span className="pmd-num text-[#ffd84d]">{bgmMuted ? 'Muted' : `${bgmPct}%`}</span>
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

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#dbe8ff]">
              <label htmlFor={sfxSliderId}>Effects (SFX)</label>
              <span className="pmd-num text-[#6ee7a0]">{sfxMuted ? 'Muted' : `${sfxPct}%`}</span>
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
        </div>
      )}
    </div>
  );
}
