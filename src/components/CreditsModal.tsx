/**
 * Credits & Fan Project Disclaimer Modal styled in PMD Navy & Gold.
 * Documents non-commercial attribution for PMDCollab/SpriteCollab (CC BY-NC 4.0),
 * pret/pokeemerald tilesets & overworld trainers, Pokémon Showdown portraits,
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
      <div className="space-y-3 text-sm leading-relaxed text-[#dbe8ff]">
        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-base font-semibold text-[#ffd84d]">Free Non-Commercial Fan Project</h2>
          <p>
            <strong>PokéMart: Low Cortisol Shift</strong> is a simple, completely free fan project made
            strictly for entertainment purposes only — no ads, no paywalls, and no monetization.
          </p>
          <p className="text-[#b5d4ff]">
            Pokémon, PokéMart, and all species/trainer concepts belong to{' '}
            <strong>Nintendo, Creatures Inc., and GAME FREAK</strong>.
          </p>
        </section>

        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-base font-semibold text-[#ffd84d]">PMD Pokémon Sprites &amp; Portraits</h2>
          <p>
            All 493 Gen 1–4 (#001 Bulbasaur to #493 Arceus) multi-frame animations, shiny spritesheets,
            and portraits are provided by the community{' '}
            <strong>PMDCollab / SpriteCollab</strong> repository under{' '}
            <strong className="text-[#ffd84d]">CC BY-NC 4.0</strong>.
          </p>
        </section>

        <section className="pmd-inset space-y-1.5 p-3">
          <h2 className="text-base font-semibold text-[#ffd84d]">Tilesets, Trainers, Data &amp; Audio</h2>
          <ul className="list-disc space-y-1 pl-5 text-[#cfe0ff]">
            <li>
              Outdoor meadow, PokéMart indoor tilesets, and Human Trainer overworlds: decompiled tiles
              from <strong>pret/pokeemerald</strong> plus cohesive GBA-palette custom Pet Shop stations.
            </li>
            <li>Human Trainer counter negotiation portraits: <strong>Pokémon Showdown</strong> sprites.</li>
            <li>National Dex species metadata, evolutions, and item icons: PokeAPI (MIT / BSD).</li>
            <li>Self-hosted pixel typography: Chakra Petch &amp; Silkscreen (SIL Open Font License 1.1).</li>
            <li>Original dual BGM tracks &amp; Web Audio API SFX synthesizer built cleanly in-browser.</li>
          </ul>
        </section>
      </div>
    </CozyDialog>
  );
}
