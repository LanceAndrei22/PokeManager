/**
 * React Testing Library integration tests for PokéMart: Low Cortisol Shift UI flows:
 * profile creation, live-tick open/pause, Wholesale adoption, Inspect item usage (Berry & Stone),
 * Breeding incubator pairing, Shift Summary, Adoption Dex, and Save Export modal.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('PokéMart: Low Cortisol Shift UI Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('supports profile creation, wholesale purchase, open/pause, item use, breeding, summary, dex, and save export', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Create a new Shift Manager profile
    await user.click(screen.getByRole('button', { name: '+ New Profile' }));
    await user.type(screen.getByLabelText('New profile name'), 'Dawn');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Shift Manager Profile')).toHaveDisplayValue('Dawn');

    // 2. Toggle Open Shop / Pause
    await user.click(screen.getByRole('button', { name: 'Open Shop' }));
    expect(screen.getByRole('button', { name: 'Pause Shift' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause Shift' }));
    expect(screen.getByRole('button', { name: 'Open Shop' })).toBeInTheDocument();

    // 3. Buy an item / adopt from Wholesale & Supplies
    await user.click(screen.getByRole('tab', { name: 'Wholesale & Supplies' }));
    const wholesaleButtons = screen.getAllByRole('button', { name: /^(Welcome|Rescue|Incubate)$/ });
    expect(wholesaleButtons.length).toBeGreaterThan(0);
    await user.click(wholesaleButtons[0]);

    // 4. Heal starter Psyduck in Nap Station using Moomoo Milk (auto-promotes Psyduck out of Nap Bed!)
    await user.click(screen.getByRole('tab', { name: /Nap Station/ }));
    const milkBtn = screen.getByRole('button', { name: /Moomoo Milk/i });
    await user.click(milkBtn);
    expect(screen.getByText(/All plush nap beds are empty/i)).toBeInTheDocument();

    // 5. Evolve starter Eevee into Vaporeon using Water Stone in Inspect Modal
    await user.click(screen.getByRole('tab', { name: /Display Pens/ }));
    const eeveeInspectBtn = screen.getAllByRole('button', { name: 'Inspect' })[0];
    await user.click(eeveeInspectBtn);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Eevee/i })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Evolve' }));
    expect(within(dialog).getByRole('heading', { name: /Vaporeon/i })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    // 6. Pair rested Vaporeon (Field) & healed Psyduck (Water/Field) in Breeding Incubator
    await user.click(screen.getByRole('tab', { name: /Incubator/ }));
    const startBreedBtn = screen.getByRole('button', { name: /Start Incubation/i });
    expect(startBreedBtn).toBeEnabled();
    await user.click(startBreedBtn);
    expect(screen.getByText(/Warming Egg/i)).toBeInTheDocument();

    // 7. Close Shift & Rest -> review Shift Summary -> Start Next Shift
    await user.click(screen.getByRole('button', { name: /Close Shift & Rest/i }));
    const summaryDialog = screen.getByRole('dialog');
    expect(within(summaryDialog).getByText(/Shift #1 Complete/i)).toBeInTheDocument();
    await user.click(within(summaryDialog).getByRole('button', { name: /Start Next Shift \(#2\)/i }));
    expect(screen.getByText('Shift #2')).toBeInTheDocument();

    // 8. Open Adoption Dex Modal
    await user.click(screen.getByRole('button', { name: /Dex \(/ }));
    const dexDialog = screen.getByRole('dialog');
    expect(within(dexDialog).getByText(/Adoption Dex/i)).toBeInTheDocument();
    expect(within(dexDialog).getByText('Vaporeon')).toBeInTheDocument();
    await user.click(within(dexDialog).getByRole('button', { name: 'Close' }));

    // 9. Open Save / Profiles Modal and confirm Base64 export code exists
    await user.click(screen.getByRole('button', { name: 'Save / Profiles' }));
    const saveDialog = screen.getByRole('dialog');
    const exportBox = within(saveDialog).getByLabelText('Export Save Code') as HTMLTextAreaElement;
    expect(exportBox.value.length).toBeGreaterThan(20);
    await user.click(within(saveDialog).getByRole('button', { name: 'Close' }));
  });
});
