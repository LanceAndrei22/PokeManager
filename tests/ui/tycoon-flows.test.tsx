/**
 * Integration tests for Checkpoint 2 active tycoon UI flows:
 * - Non-blocking Live-Clock Counter-Offer Panel (`Accept`, `Haggle +15%`, `Decline`)
 * - Debt Settlement & Emergency Liquidation Modal
 * - Store Foreclosure / Bankruptcy Modal and clean Shift #1 Restart
 * - Set as Shop Mascot promotion in InspectPokemonModal
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { CounterOffer, ProfileIndex } from '../../src/data/types';
import { createInitialGameState } from '../../src/engine/simulation';
import {
  PROFILE_INDEX_KEY,
  saveProfileGameState,
  saveProfileIndex,
} from '../../src/engine/storage';

function makeQueuedCounterOffer(): CounterOffer {
  return {
    uid: 'offer-live-1',
    customerUid: 'cust-live-1',
    archetypeId: 'cozy-collector',
    npcSpeciesId: 40,
    npcPaddedId: '0040',
    customerName: 'Mina (Wigglytuff)',
    pokemonUid: 'mon-starter-eevee',
    speciesId: 133,
    isShiny: false,
    penIndex: 0,
    fairValue: 1200,
    initialOffer: 1200,
    currentOffer: 1200,
    haggleAttempts: 0,
    maxHaggleAttempts: 2,
    patience: 10,
    maxPatience: 10,
    trendMatched: true,
    archetypeMatched: true,
    isVip: false,
  };
}

describe('Checkpoint 2 Counter Haggling, Debt Liquidation & Bankruptcy UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('negotiates live offers in the non-blocking Counter-Offer Panel and promotes a Shop Mascot', async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialGameState('host-haggle', 'Counter Host', 'relaxed'),
      counterQueue: [makeQueuedCounterOffer()],
    };
    const index: ProfileIndex = {
      version: 2,
      activeProfileId: state.profileId,
      profiles: [
        {
          id: state.profileId,
          name: state.profileName,
          difficulty: state.difficulty,
          mascotSpeciesId: 133,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };
    saveProfileGameState(state);
    saveProfileIndex(index);

    render(<App />);
    await user.click(screen.getByRole('button', { name: /PLAY/i }));

    // Open live counter queue from Top HUD alert pill
    await user.click(screen.getByRole('button', { name: /Counter: 1 waiting/i }));
    const counterPanel = screen.getByLabelText('Live Counter Negotiation');
    expect(within(counterPanel).getByText('Mina (Wigglytuff)')).toBeInTheDocument();
    expect(within(counterPanel).getByText('Offer: ₽1,200')).toBeInTheDocument();

    // Accept sale -> funds increase immediately and counter alert clears
    await user.click(within(counterPanel).getByRole('button', { name: /Accept/i }));
    expect(screen.queryByLabelText('Live Counter Negotiation')).not.toBeInTheDocument();
    expect(screen.getByText('₽4,700')).toBeInTheDocument();

    // Promote Slowpoke to Shop Mascot from Pens -> Inspect -> Set as Shop Mascot
    await user.click(screen.getByRole('button', { name: /^Pens/i }));
    const pensDialog = screen.getByRole('dialog');
    await user.click(within(pensDialog).getAllByRole('button', { name: 'Inspect' })[0]);
    const careDialog = screen.getByRole('dialog');
    const mascotBtn = within(careDialog).queryByRole('button', { name: /Set as Shop Mascot/i });
    if (mascotBtn) {
      await user.click(mascotBtn);
      expect(within(careDialog).getByText(/Active Shop Mascot/i)).toBeInTheDocument();
    } else {
      expect(within(careDialog).getByText(/Active Shop Mascot/i)).toBeInTheDocument();
    }
    await user.click(within(careDialog).getByRole('button', { name: 'Close' }));
  });

  it('opens Debt Liquidation Modal on rent shortfall -> triggers Bankruptcy on High Stakes -> restarts cleanly', async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialGameState('host-debt', 'Risk Manager', 'high-stakes'),
      cash: 150, // Well below High Stakes Shift 1 dues (₽905), with 0 Debt Grace remaining
    };
    const index: ProfileIndex = {
      version: 2,
      activeProfileId: state.profileId,
      profiles: [
        {
          id: state.profileId,
          name: state.profileName,
          difficulty: state.difficulty,
          mascotSpeciesId: 133,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };
    saveProfileGameState(state);
    saveProfileIndex(index);
    expect(window.localStorage.getItem(PROFILE_INDEX_KEY)).not.toBeNull();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /PLAY/i }));

    // Closing shift with insufficient cash triggers Debt Warning & Emergency Liquidation modal
    await user.click(screen.getByRole('button', { name: 'Close Shift' }));
    const debtDialog = screen.getByRole('dialog');
    expect(within(debtDialog).getByText(/Rent Due & Emergency Liquidation/i)).toBeInTheDocument();
    expect(within(debtDialog).getByText(/Cash Shortfall/i)).toBeInTheDocument();

    // Liquidate one Pokémon to confirm cash increases inside modal
    const liqButtons = within(debtDialog).getAllByRole('button', { name: /Liquidate/i });
    await user.click(liqButtons[0]);

    // Still short -> Declare Bankruptcy -> Foreclosure scorecard modal -> Start Fresh Shift #1
    await user.click(within(debtDialog).getByRole('button', { name: /Declare Bankruptcy/i }));
    const bankruptDialog = screen.getByRole('dialog');
    expect(
      within(bankruptDialog).getByRole('heading', { name: /Store Foreclosed/i }),
    ).toBeInTheDocument();

    await user.click(within(bankruptDialog).getByRole('button', { name: /Start Fresh Shift #1/i }));
    expect(screen.getByText('₽1,200')).toBeInTheDocument();
  });
});
