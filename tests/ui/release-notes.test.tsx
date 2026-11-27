/**
 * Unit & React Testing Library tests for the version-gated Release Notes /
 * Initial Playtest Release popup system (`src/data/releaseNotes.ts` & `ReleaseNotesModal`).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { ReleaseNotesModal } from '../../src/components/ReleaseNotesModal';
import {
  APP_VERSION,
  RELEASE_LABEL,
  RELEASE_NOTES,
  SEEN_RELEASE_VERSION_KEY,
  getSeenReleaseVersion,
  markReleaseNotesSeen,
  shouldShowReleaseNotes,
} from '../../src/data/releaseNotes';

describe('Release Notes Version Gating & Modal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('detects first launch and version bumps via localStorage and persists dismissal', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(1);
    expect(RELEASE_NOTES[0].version).toBe(APP_VERSION);

    // Unseen first launch -> show popup
    expect(getSeenReleaseVersion()).toBeNull();
    expect(shouldShowReleaseNotes()).toBe(true);

    // Dismissing records APP_VERSION so refresh stays clean
    markReleaseNotesSeen();
    expect(window.localStorage.getItem(SEEN_RELEASE_VERSION_KEY)).toBe(APP_VERSION);
    expect(shouldShowReleaseNotes()).toBe(false);

    // Advancing APP_VERSION in a future update triggers the popup again automatically
    expect(shouldShowReleaseNotes('0.2.0-playtest')).toBe(true);
  });

  it('handles restricted or throwing storage cleanly without crashing', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(getSeenReleaseVersion(brokenStorage)).toBeNull();
    expect(shouldShowReleaseNotes(APP_VERSION, brokenStorage)).toBe(true);
    expect(() => markReleaseNotesSeen(APP_VERSION, brokenStorage)).not.toThrow();
  });

  it('renders Initial Playtest Release disclaimer, save warning, and dismiss callback in ReleaseNotesModal', async () => {
    const user = userEvent.setup();
    let dismissed = false;
    render(<ReleaseNotesModal open={true} onDismiss={() => (dismissed = true)} />);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { level: 1, name: new RegExp(RELEASE_LABEL, 'i') }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Initial Playtest Release Notice/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/trainer profiles and saved progress may be modified or deleted/i),
    ).toBeInTheDocument();

    // Verify single inner .pmd-scroll container is keyboard-focusable and pinned footer stays outside it
    const scrollers = dialog.querySelectorAll('.pmd-scroll');
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0]).toHaveAttribute('tabindex', '0');
    const dismissButton = within(dialog).getByRole('button', { name: /Got It — Start Playing/i });
    expect(scrollers[0].contains(dismissButton)).toBe(false);

    await user.click(dismissButton);
    expect(dismissed).toBe(true);
  });

  it('auto-opens on first App launch, stays closed after dismiss, and reopens via Main Menu version button', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    // First launch auto-opens ReleaseNotesModal over the Main Menu
    const initialDialog = screen.getByRole('dialog');
    expect(
      within(initialDialog).getByText(/Initial Playtest Release Notice/i),
    ).toBeInTheDocument();

    await user.click(
      within(initialDialog).getByRole('button', { name: /Got It — Start Playing/i }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_RELEASE_VERSION_KEY)).toBe(APP_VERSION);

    // Simulating a page refresh does not reopen the modal
    unmount();
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Clicking the subtle Main Menu version button reopens Patch Notes on demand
    await user.click(screen.getByRole('button', { name: new RegExp(`v${APP_VERSION}`, 'i') }));
    const reopened = screen.getByRole('dialog');
    expect(within(reopened).getByText(/Initial Playtest Release Notice/i)).toBeInTheDocument();
  });
});
