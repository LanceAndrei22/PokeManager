# Asset Credits & Fan-Project Notice

> **Non-Commercial Entertainment Notice:**
> **PokéMart: Low Cortisol Shift** is a simple, completely free fan project made purely for entertainment purposes only. Pokémon, PokéMart, character names, items, and all original sprite designs are trademarks and copyrights of **Nintendo, Creatures Inc., and Game Freak**.

## Sprite, Tileset, Portrait, Font & Data Sources

1. **PMD Pokémon Spritesheets, Animations & Portraits (Gen 1–4 `#0001–#0493`)**
   - **Project:** [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
   - **License:** [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)
   - **Usage:** Multi-frame animated `Walk-Anim.png`, `Idle-Anim.png`, `Sleep-Anim.png`, `Hop-Anim.png`, `AnimData.xml`, and character portraits (`portrait/{paddedId}/Normal.png` + Shiny `0000/0001/`), loaded via the bundled offline core (`public/assets/pmd/`, 21 species) + on-demand GitHub Raw with `tracker.json` availability gating.
   - **Artist Attribution:** Individual sprite and portrait artist credits are preserved in PMDCollab/SpriteCollab's upstream `credit_names.txt` and `tracker.json` metadata.

2. **Outdoor/Indoor Environment Tilesets & Human Trainer Overworlds**
   - **Project:** [pret/pokeemerald](https://github.com/pret/pokeemerald) decompilation tilesets (`general`, `petalburg`, `poke_mart`, `shop`, `building`, `door_anims/poke_mart`) and object event trainer sheets (`mart_employee`, `camper`, `hiker`, `lass`, `youngster`, `picnicker`, `beauty`, `artist`, `gentleman`, `rich_boy`, `steven`, etc.) decoded into local RGBA PNGs via `scripts/fetch-world-assets.mjs`, paired with cohesive GBA-palette custom Pet Shop stations (`healing-bed`, `incubator-pod`, `upgrades-board`, `pen-grass`, `pen-fence`, `healing-rug`).

3. **Human Trainer Counter Negotiation Portraits**
   - **Source:** [Pokémon Showdown Sprite Repository](https://play.pokemonshowdown.com/sprites/trainers/) bundled locally under `public/assets/npcs/portraits/`.

4. **Item Icons & Pokédex Metadata (Gen 1–4 `#1–#493`)**
   - **Sources:** [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (`sprites/items/{slug}.png`) & [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi) CSVs
   - **Egg Icon Fallback:** [msikma/pokesprite](https://github.com/msikma/pokesprite)

5. **Self-Hosted Typography (`public/assets/fonts/`)**
   - **Fonts:** [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch), [Silkscreen](https://fonts.google.com/specimen/Silkscreen), and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)
   - **License:** [SIL Open Font License 1.1 (OFL-1.1)](https://openfontlicense.org/)
