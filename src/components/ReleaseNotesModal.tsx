/**
 * Versioned "What's New / Initial Playtest Release" popup modal in DS-era Royal Navy & Gold.
 *
 * Reuses `CozyDialog` (pinned header + single DS-themed `.pmd-scroll` body) and displays:
 * - A prominent Initial Playtest Release Notice warning about evolving features and save resets,
 * - Structured versioned changelog entries from `src/data/releaseNotes.ts`,
 * - A "Got It — Start Playing" confirmation button that records `APP_VERSION` in `localStorage`.
 */
import { APP_VERSION, RELEASE_LABEL, RELEASE_NOTES } from '../data/releaseNotes';
import { CozyDialog } from './CozyDialog';

export interface ReleaseNotesModalProps {
  open: boolean;
  onDismiss: () => void;
}

export function ReleaseNotesModal({ open, onDismiss }: ReleaseNotesModalProps) {
  return (
    <CozyDialog
      open={open}
      onClose={onDismiss}
      title={`What's New — ${RELEASE_LABEL} (v${APP_VERSION})`}
    >
      <div className="space-y-4 text-sm leading-relaxed text-[#dbe8ff]">
        {/* Prominent Initial Playtest Disclaimer & Save Warning */}
        <section
          aria-label="Initial Playtest Release Notice"
          className="border-2 border-[#ffd84d] bg-[#3d2900]/90 p-3.5 text-[#fff1c2]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#ffd84d]">
              Initial Playtest Release Notice
            </h2>
            <span className="pmd-num border border-[#ffd84d] bg-[#1a1200] px-2 py-0.5 text-xs font-semibold text-[#ffd84d]">
              v{APP_VERSION}
            </span>
          </div>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#ffefc2]">
            <li>
              <strong>PokéMart: Low Cortisol Shift</strong> is currently in its{' '}
              <strong>Initial Playtest Release</strong>.
            </li>
            <li>
              Features, game balance, UI, and mechanics{' '}
              <strong>may be added, changed, or removed</strong> as development continues.
            </li>
            <li>
              <strong>Save Warning:</strong> Your{' '}
              <strong>trainer profiles and saved progress may be modified or deleted</strong> in
              future updates. Use <em>Save / Profiles → Export Save Code</em> to keep a manual
              backup, though save format changes may still occur during playtesting.
            </li>
          </ul>
        </section>

        {/* Versioned Changelog History */}
        <div className="space-y-3">
          {RELEASE_NOTES.map((entry, idx) => (
            <article key={entry.version} className="pmd-inset space-y-2.5 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3b60a0] pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[#ffd84d]">{entry.label}</h2>
                  <span className="pmd-num border border-[#78a8f0] bg-[#0a1430] px-2 py-0.5 text-xs font-semibold text-[#b5d4ff]">
                    v{entry.version}
                  </span>
                  {idx === 0 && (
                    <span className="border border-[#2ecc71] bg-[#14472c] px-2 py-0.5 text-xs font-semibold text-[#9effc3]">
                      Current Build
                    </span>
                  )}
                </div>
                <span className="pmd-num text-xs text-[#9ec4ff]">{entry.date}</span>
              </div>

              <p className="text-sm text-[#e2eeff]">{entry.summary}</p>

              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#cfe0ff]">
                {entry.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Dismiss & Confirm Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#4e78bd] pt-3">
          <span className="text-xs text-[#9ec4ff]">
            Reopen anytime via the <strong>v{APP_VERSION} · Patch Notes</strong> button on the Main
            Menu.
          </span>
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="pmd-btn-gold px-4 py-1.5 text-sm font-semibold"
          >
            Got It — Start Playing
          </button>
        </div>
      </div>
    </CozyDialog>
  );
}
