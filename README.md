# PokéMart: Low Cortisol Shift

> [!NOTE]
> **Simple, Completely Free Fan Project (Entertainment Only):**
> **PokéMart: Low Cortisol Shift** is a simple, completely free, non-commercial fan-made web game built purely for entertainment purposes only. Pokémon and all related character names, designs, and sprites belong to **Nintendo, Creatures Inc., and Game Freak**.

A full-screen, **PC desktop web browser** click-to-manage 2D pixel-art Gen 4 Pokémon pet shop, healing center, breeding, and counter-haggling tycoon web game powered by **PMDCollab / SpriteCollab** multi-frame animations for all **493 Gen 1–4 Pokémon (`#001 Bulbasaur` → `#493 Arceus`)**, authentic **pret/pokeemerald** indoor/outdoor pixel tilesets, and **Human Trainer** clerk & shoppers—prepared for free static hosting on GitHub Pages.

> *(Note: "Low Cortisol Shift" is the game's title aesthetic—under the hood this is an active Click-to-Manage tycoon simulator with timed shifts, live-clock counter haggling, daily rent, 3 difficulty modes, emergency liquidation, and bankruptcy. Designed for **PC desktop browsers only**: `1280×720` minimum, optimized for `1920×1080` and `2560×1440+` widescreen monitors with mouse & keyboard.)*

---

## Gameplay Highlights (v2.2 — Desktop Edition)

- **Rolling Nature Main Menu & High-Res Tiled Indoor PokéMart (`1280×800` → `2560×1440+`):**
  - **Main Menu & Title Screen:** Continuously rolling pixel-art nature meadow (`pret/pokeemerald` grass, wildflowers, winding country dirt path, layered oak/pine tree groves, drifting clouds, and falling blossom petals) populated by 12 actively roaming, walking, and hopping multi-frame PMD SpriteCollab Pokémon alongside the Profile Switcher, New Trainer Creator (**6 starters + 3-Tier Difficulty Box**), **Your Mascot** card, Save Transfer, Audio Mixer, and Credits.
  - **Click-to-Manage Indoor Store (`1280×720` min; crisp integer scaling for `1920×1080` & `2560×1440+`):** Tiled GBA PokéMart floor/wall/merchandise shelves/plants, animated sliding glass doors (`OPEN` / `CLOSED`), Store **Clerk Leo** behind the counter, lively 8-directional wandering/hopping PMD companions inside pens, glowing **Egg Incubator** (`wobbling eggs`), blinking **Wholesale PC** (`VIP!` indicator), **Nap Corner**, and **Upgrades Board**.
- **Human Trainer Shoppers & `Normal Shopper` Archetype:**
  - **Clerk Leo** (`mart_employee`) greets visitors while **15 Gen 3/4 Human Trainer shoppers** across **6 archetypes** browse pens and queue at the counter with pixel trainer portraits: **Normal Shopper** (~40% spawn weight, cheerfully adopts regular non-Legendary Pokémon at fair tags without needing trait/trend matches, never offering on Legendaries/Mythicals), **Bargain Browser**, **Cozy Collector**, **Trend Fan**, **Shiny Seeker**, and **VIP Collector**.
- **Active Timed Shifts & Live Counter Haggling:** Prep stock while closed, open doors (`1×` / `2×`), and negotiate at the non-blocking **PokéMart Counter** (**Accept**, **Haggle +15%**, **Haggle +30%**, **Decline**, + Gift-Wrap Balls) before shopper Patience expires.
- **3 Difficulty Modes (`Relaxed`, `Standard`, `High Stakes`), Debt Grace & Bankruptcy:** Governs starting capital (`₽3,500` / `₽2,000` / `₽1,200`), daily rent + pen/bed upkeep, patience decay, Debt Grace (`1` / `1` / `0`), Emergency Liquidation (50% wholesale return), and **Store Foreclosure**.
- **Full 493 Gen 1–4 Pokédex & VIP Legendary Contracts:** Browse `#001–#493` with search, rarity filter & pagination; evolve via 9 Evolution Stones + `Rare Candy`; breed Egg Groups (including Manaphy → Phione); promote mascots; and fulfill **VIP Legendary Contracts**.
- **Cross-Browser Web Audio SFX, Dual BGM Tracks & Razor-Sharp Pixel Typography:** Capture-phase gesture-unlocked SFX + polyphonic **Menu (~80 BPM)** & **Shop (~100 BPM)** chiptune BGM tracks with 1-click mute toggles and per-profile volume mixer sliders (`BGM` / `SFX`), framed in crisp self-hosted **Chakra Petch** & **Silkscreen** typography.

---

## Tech Stack

- **Frontend:** Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)
- **UI Typography:** Self-hosted **Chakra Petch** (`500/600/700` Latin + Latin-Ext `₽`), **Silkscreen** (`400` headings/logo), and **Pixelify Sans** WOFF2 fonts (`public/assets/fonts/`, SIL OFL 1.1)
- **Rendering:** Plain HTML5 2D Canvas (`imageSmoothingEnabled = false`), `AnimData.xml` 60 fps slicing + 4-dir Human Trainer walking animation, decoded GBA metatile sheets, and Cache API hybrid PMD sprite loading
- **Assets & Data:** [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (`CC BY-NC 4.0`), [pret/pokeemerald](https://github.com/pret/pokeemerald) tilesets & overworld trainers, [Pokémon Showdown](https://play.pokemonshowdown.com/sprites/trainers/) trainer portraits, and [PokeAPI](https://github.com/PokeAPI/pokeapi)
- **Audio:** Cross-browser Web Audio API chiptune SFX + dual BGM sequencer (`src/engine/sfx.ts`, `src/engine/bgm.ts`)
- **Testing:** Vitest + React Testing Library (`jsdom`) — 15 suites, 56 tests

---

## Project Structure

```text
D:\PokeManager\
├── README.md
├── AGENTS.md
├── .agents/rules/sprites-and-animation.md
├── .github/workflows/deploy.yml
├── public/assets/
│   ├── fonts/                 # Self-hosted Chakra Petch, Silkscreen & Pixelify Sans WOFF2 fonts
│   ├── npcs/                  # 16 pret/pokeemerald Human Trainer overworlds & Showdown portraits
│   ├── tiles/                 # Decoded pret/pokeemerald outdoor & indoor tiles + Pet Shop furniture
│   ├── pmd/                   # Bundled core 21 PMD species sheets (Walk/Idle/Sleep/Hop) & portraits
│   ├── items/                 # Curated Gen 4 pixel item icons
│   └── CREDITS.md             # Attribution & non-commercial entertainment-only disclaimer
├── scripts/
│   ├── build-pokedex.mjs      # Generates 493-species Gen 1–4 catalog & core PMD bundle
│   └── fetch-world-assets.mjs # Decodes pret/pokeemerald tilesets, trainers & Pet Shop props
├── src/
│   ├── data/                  # 493 species JSON/TS, difficulties, Human NPCs, items, trends, upgrades
│   ├── engine/                # Tycoon sim, haggling, rent, debt, breeding, storage, SFX & dual BGM
│   ├── canvas/                # Tiled indoor store, living nature backdrop, PMD & Human animators
│   └── components/            # Main Menu, HUD, AudioControls, DS Dock, Counter Panel & modals
└── tests/                     # Engine, audio, canvas/PMD/Human animator & React UI tests (56 tests)
```

---

## Local Development & Verification

```bash
# 1. Install dependencies (uses repo-local .npm-cache when .npmrc is present)
npm install

# 2. Optional: refresh Pokédex / world tilesets & trainer assets
npm run build-pokedex
npm run fetch-world-assets

# 3. Start local dev server
npm run dev

# 4. Run typecheck, unit/UI test suite, and production build
npm run typecheck
npm test
npm run build
```

---

## Asset Credits

All sprite sources, **PMDCollab / SpriteCollab (`CC BY-NC 4.0`)**, **pret/pokeemerald**, **Pokémon Showdown**, **PokeAPI**, self-hosted SIL OFL font credits, and the non-commercial entertainment-only fan project disclaimer are documented in [`public/assets/CREDITS.md`](./public/assets/CREDITS.md).
