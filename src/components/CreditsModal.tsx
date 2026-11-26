/**
 * Credits & Fan Project Disclaimer Modal styled in PMD Navy & Gold.
 * Highlights non-commercial attribution for PMDCollab/SpriteCollab (CC BY-NC 4.0),
 * PokeAPI Gen 1–4 data, and self-hosted SIL OFL pixel fonts.
 */
import { CozyDialog } from './CozyDialog';

export interface CreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreditsModal({ open, onClose }: CreditsModalProps) {
  return (
    <CozyDialog open={open} onClose={onClose} title="Credits &amp; Fan Disclaimer">
      <div className="space-y-3 text-xs leading-relaxed text-[#dbe8ff]">
        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-sm font-bold text-[#ffd84d]">Free Non-Commercial Fan Project</h2>
          <p>
            <strong>PokéMart: Low Cortisol Shift</strong> is a simple, completely free fan project made
            strictly for entertainment purposes only — no ads, no paywalls, and no monetization.
          </p>
          <p className="text-[#a8c4f0]">
            Pokémon, PokéMart, Kecleon, and all species names/concepts belong to{' '}
            <strong>Nintendo, Creatures Inc., and GAME FREAK</strong>.
          </p>
        </section>

        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-sm font-bold text-[#ffd84d]">PMD Animated Sprites &amp; Portraits</h2>
          <p>
            All 493 Gen 1–4 (#001 Bulbasaur to #493 Arceus) multi-frame animations, shiny spritesheets,
            portraits, and shopkeeper/shopper Pokémon NPCs are provided by the community{' '}
            <strong>PMDCollab / SpriteCollab</strong> repository under{' '}
            <strong className="text-[#ffd84d]">CC BY-NC 4.0</strong>.
          </p>
        </section>

        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-sm font-bold text-[#ffd84d]">Data, Icons &amp; Pixel Fonts</h2>
          <ul className="list-disc space-y-1 pl-4 text-[#cfe0ff]">
            <li>National Dex species metadata, types, evolutions, and item icons: PokeAPI (MIT / BSD).</li>
            <li>Self-hosted pixel typography: Pixelify Sans &amp; Silkscreen (SIL Open Font License 1.1).</li>
            <li>Zero-KB Web Audio API cozy chiptune synthesizer &amp; procedural indoor tile art.</li>
          </ul>
        </section>
      </div>
    </CozyDialog>
  );
}
