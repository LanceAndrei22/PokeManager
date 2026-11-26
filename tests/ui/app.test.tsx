/**
 * React Testing Library integration tests for PokéMart: Low Cortisol Shift (v2) UI:
 * Main Menu -> New Trainer Creator (Difficulty + Starter Mascot) -> Play Indoor Shop ->
 * Open/Pause Shift -> Wholesale PC -> Healing -> Care Modal (Evolve & Set Mascot) ->
 * Breeding Incubator -> Shift Settlement & Rent -> 493 Pokédex Search & Legendaries ->
 * Save Transfer Modal.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('PokéMart: Low Cortisol Shift Full-Screen PMD UI Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('navigates Main Menu, trainer creation, indoor store dock, evolution/mascot, breeding, settlement, 493-Dex, and Save Transfer', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Main Menu renders chunky title, AudioControls (BGM/SFX/Vol), mascot spotlight, and New Trainer Creator
    expect(screen.getByRole('heading', { name: /PokéMart: Low Cortisol Shift/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mute background music/i }));
    expect(screen.getByRole('button', { name: /Unmute background music/i })).toHaveTextContent('BGM: Off');
    await user.click(screen.getByRole('button', { name: /Unmute background music/i }));

    await user.click(screen.getByRole('button', { name: /Audio volume mixer/i }));
    const mixerRegion = screen.getByRole('region', { name: 'Audio Mixer' });
    expect(within(mixerRegion).getByLabelText(/Music \(BGM\)/i)).toBeInTheDocument();
    expect(within(mixerRegion).getByLabelText(/Effects \(SFX\)/i)).toBeInTheDocument();
    await user.click(within(mixerRegion).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: /\+ New Trainer/i }));
    await user.type(screen.getByLabelText('Trainer Name'), 'Dawn');
    await user.click(screen.getByRole('button', { name: /Eevee/i }));
    await user.click(screen.getByRole('button', { name: /Relaxed/i }));
    await user.click(screen.getByRole('button', { name: /Create Trainer & Save/i }));

    expect(screen.getByLabelText('Shift Manager Profile')).toHaveDisplayValue(/Dawn/i);

    // 2. Click PLAY tile to enter full-screen Indoor PokéMart canvas
    await user.click(screen.getByRole('button', { name: /PLAY/i }));
    expect(screen.getByTestId('shop-floor-canvas')).toBeInTheDocument();

    // 3. Toggle Open Shop / Pause Shift in Floating Top HUD Bar
    await user.click(screen.getByRole('button', { name: 'Open Shop' }));
    expect(screen.getByRole('button', { name: 'Pause Shift' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause Shift' }));
    expect(screen.getByRole('button', { name: 'Open Shop' })).toBeInTheDocument();

    // 4. Open Wholesale PC from Bottom DS Action Dock & welcome first offer
    await user.click(screen.getByRole('button', { name: /Wholesale/i }));
    const wholesaleDialog = screen.getByRole('dialog');
    const buyButtons = within(wholesaleDialog).getAllByRole('button', {
      name: /^(Welcome|Rescue|Incubate)$/,
    });
    expect(buyButtons.length).toBeGreaterThan(0);
    await user.click(buyButtons[0]);
    await user.click(within(wholesaleDialog).getByRole('button', { name: 'Close' }));

    // 5. Open Healing Corner & heal napping Psyduck using Moomoo Milk
    await user.click(screen.getByRole('button', { name: /Healing/i }));
    const healDialog = screen.getByRole('dialog');
    await user.click(within(healDialog).getByRole('button', { name: /Moomoo Milk/i }));
    expect(within(healDialog).getByText(/All plush nap beds are empty/i)).toBeInTheDocument();
    await user.click(within(healDialog).getByRole('button', { name: 'Close' }));

    // 6. Open Pens -> Inspect Pen #1 Eevee -> Promote Slowpoke as Shop Mascot or Evolve Eevee -> Vaporeon
    await user.click(screen.getByRole('button', { name: /^Pens/i }));
    const pensDialog = screen.getByRole('dialog');
    const inspectBtns = within(pensDialog).getAllByRole('button', { name: 'Inspect' });
    await user.click(inspectBtns[0]);

    const careDialog = screen.getByRole('dialog');
    expect(within(careDialog).getByRole('heading', { name: /Eevee/i })).toBeInTheDocument();
    await user.click(within(careDialog).getByRole('button', { name: 'Evolve' }));
    expect(within(careDialog).getByRole('heading', { name: /Vaporeon/i })).toBeInTheDocument();
    await user.click(within(careDialog).getByRole('button', { name: 'Close' }));

    // 7. Open Breeding -> pair Vaporeon & healed Psyduck -> Start Incubation
    await user.click(screen.getByRole('button', { name: /Breeding/i }));
    const breedDialog = screen.getByRole('dialog');
    await user.click(within(breedDialog).getByRole('button', { name: /Start Incubation/i }));
    expect(within(breedDialog).getByText(/Warming Egg/i)).toBeInTheDocument();
    await user.click(within(breedDialog).getByRole('button', { name: 'Close' }));

    // 8. Close Shift -> verify Rent & Upkeep Settlement modal -> advance to Shift #2
    await user.click(screen.getByRole('button', { name: 'Close Shift' }));
    const summaryDialog = screen.getByRole('dialog');
    expect(within(summaryDialog).getByText(/Shift #1 Complete/i)).toBeInTheDocument();
    expect(within(summaryDialog).getByText(/Daily Rent/i)).toBeInTheDocument();
    await user.click(within(summaryDialog).getByRole('button', { name: /Start Next Shift \(#2\)/i }));
    expect(screen.getByText('Shift #2')).toBeInTheDocument();

    // 9. Open 493-Species Pokédex -> search for #493 Arceus & Legendaries filter
    await user.click(screen.getByRole('button', { name: /Pokédex/i }));
    const dexDialog = screen.getByRole('dialog');
    await user.click(within(dexDialog).getByRole('tab', { name: /Legendaries & Mythicals/i }));
    await user.type(within(dexDialog).getByLabelText('Search Pokédex'), 'Arceus');
    expect(within(dexDialog).getByText('Arceus')).toBeInTheDocument();
    await user.click(within(dexDialog).getByRole('button', { name: 'Close' }));

    // 10. Return to Main Menu -> Verify Save / Profiles Base64 Export Code
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /Save \/ Profiles/i }));
    const saveDialog = screen.getByRole('dialog');
    const exportBox = within(saveDialog).getByLabelText('Export Save Code') as HTMLTextAreaElement;
    expect(exportBox.value.length).toBeGreaterThan(20);
    await user.click(within(saveDialog).getByRole('button', { name: 'Close' }));
  }, 15000);

  it('opens the stylized PokéMart Manager Guide from both Main Menu and In-Store Top HUD across all sections', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open Guide from Main Menu top-right bar
    await user.click(screen.getByRole('button', { name: 'Guide' }));
    const menuGuide = screen.getByRole('dialog');
    expect(within(menuGuide).getByText(/The 4-Step Shift Loop/i)).toBeInTheDocument();

    // Switch through all handbook sections
    await user.click(within(menuGuide).getByRole('tab', { name: /Shoppers & Haggling/i }));
    expect(within(menuGuide).getByText(/6 Human Trainer Archetypes/i)).toBeInTheDocument();
    expect(within(menuGuide).getByText(/Haggle \+15%/i)).toBeInTheDocument();

    await user.click(within(menuGuide).getByRole('tab', { name: /Staff & Upgrades/i }));
    expect(within(menuGuide).getByText(/Shopkeepers & Hiring Counter Clerks/i)).toBeInTheDocument();

    await user.click(within(menuGuide).getByRole('tab', { name: /Care, Breeding & Items/i }));
    expect(within(menuGuide).getByText(/Egg Breeding & Shiny Sparkle Hunting/i)).toBeInTheDocument();

    await user.click(within(menuGuide).getByRole('tab', { name: /Rent, Stakes & Saves/i }));
    expect(within(menuGuide).getByText(/3 Difficulty Modes & Daily Dues/i)).toBeInTheDocument();

    await user.click(within(menuGuide).getByRole('button', { name: 'Close' }));

    // Enter Indoor Store and open Guide from Top HUD pill
    await user.click(screen.getByRole('button', { name: /PLAY/i }));
    await user.click(screen.getByRole('button', { name: 'Guide' }));
    const storeGuide = screen.getByRole('dialog');
    expect(within(storeGuide).getByRole('heading', { name: /PokéMart Manager's Guide/i })).toBeInTheDocument();
    await user.click(within(storeGuide).getByRole('button', { name: 'Close' }));
  }, 15000);
});
