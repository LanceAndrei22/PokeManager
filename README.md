# PokéMart: Low Cortisol Shift

> [!NOTE]
> **Simple, Completely Free Fan Project (Entertainment Only):**
> **PokéMart: Low Cortisol Shift** is a simple, completely free, non-commercial fan-made web game built purely for entertainment purposes only. Pokémon and all related character names, designs, and sprites belong to **Nintendo, Creatures Inc., and Game Freak**.

A full-screen, click-to-manage 2D pixel-art Gen 4 Pokémon pet shop, healing center, breeding, and counter-haggling tycoon web game powered by **PMDCollab / SpriteCollab** multi-frame spritesheets and all **493 Gen 1–4 Pokémon (`#001 Bulbasaur` → `#493 Arceus`)**—prepared for free static hosting on GitHub Pages.

> *(Note: "Low Cortisol Shift" is the game's title aesthetic—under the hood v2 is an active Click-to-Manage tycoon simulator with timed shifts, live-clock counter haggling, daily rent, 3 difficulty modes, emergency liquidation, and bankruptcy.)*

---

## Gameplay Highlights (v2)

- **Full-Screen Indoor Gen 4 PokéMart & PMD Navy/Gold HUD:**
  - **Main Menu & Title Screen:** Live animated PMD woodland canvas backdrop, profile switcher, New Trainer Creator (**6 bundled iconic Starter Mascots**: Eevee, Pikachu, Bulbasaur, Charmander, Squirtle, Piplup + **3-Tier Difficulty Box**), floating **Your Mascot** spotlight card, Save Transfer, Audio toggle, and Credits.
  - **Click-to-Manage Indoor Canvas:** Directly click display pens, napping strays, **Kecleon's** register queue (`!` offer bubbles & Patience Bars), glowing **Egg Incubator Bench**, blinking **Wholesale PC** (`VIP!` indicator), **Healing Corner**, and **Upgrades Board**—adapting automatically between desktop landscape (`1280×800`) and mobile portrait (`390×844`).
- **Active Timed Shifts & Live Counter Haggling:** Prep stock while closed, open shop doors (`1×` / `2×` speed), watch PMD Pokémon shoppers inspect pens and line up at the counter with decaying Patience meters and sweat-drop cues, and negotiate via the non-blocking **Counter-Offer Panel** (**Accept**, **Haggle +15%**, **Haggle +30%**, **Decline**, + Gift-Wrap Balls).
- **3 Difficulty Modes (`Relaxed`, `Standard`, `High Stakes`):** Governs starting funds (`₽3,500` / `₽2,000` / `₽1,200`), daily rent + pen/bed upkeep, shopper patience, haggle risk, Debt Grace shifts (`1` / `1` / `0`), and High Stakes Shiny & VIP Contract bonuses.
- **Debt Grace, Emergency Liquidation & Bankruptcy:** End-of-shift rent shortfalls open **Debt Settlement & Emergency Liquidation** where companions can be returned at 50% base value before touching Debt Grace or triggering **Store Foreclosure (Bankruptcy)**.
- **Full 493 Gen 1–4 Pokédex & VIP Legendary Contracts:** Browse `#001–#493` with search, Legendaries/Mythicals filter, and pagination; evolve via 9 Gen 1–4 Evolution Stones + `Rare Candy`; breed Egg Groups (including Manaphy → Phione); promote any owned Pokémon via **Set as Shop Mascot**; and chase **VIP Legendary Contracts**.

---

## Tech Stack

- **Frontend:** Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)
- **UI Typography:** Self-hosted **Pixelify Sans** & **Silkscreen** WOFF2 pixel fonts (`public/assets/fonts/`, SIL OFL 1.1)
- **Shop Floor Rendering:** Plain HTML5 2D Canvas with `imageSmoothingEnabled = false`, `AnimData.xml` frame-duration slicing, 8-directional PMD spritesheets, and Cache API hybrid sprite loading
- **Sprites & Data:** [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (`CC BY-NC 4.0`) + [PokeAPI](https://github.com/PokeAPI/pokeapi) 493 Gen 1–4 Pokédex & item icons
- **Audio:** Zero-KB Web Audio API sine/triangle chiptune synthesizer
- **Testing:** Vitest + React Testing Library (`jsdom`)

---

## Project Structure

```text
D:\PokeManager\
├── README.md
├── AGENTS.md
├── .agents/rules/sprites-and-animation.md
├── .github/workflows/deploy.yml
├── public/assets/
│   ├── fonts/                 # Self-hosted Pixelify Sans & Silkscreen WOFF2 pixel fonts
│   ├── pmd/                   # Bundled core 21 PMD NPCs & 6 starter mascots (local offline boot)
│   ├── items/                 # Curated Gen 4 pixel item icons
│   └── CREDITS.md             # Non-commercial PMDCollab CC BY-NC 4.0, PokeAPI & OFL font credits
├── scripts/build-pokedex.mjs  # Generates 493-species Gen 1–4 catalog & core PMD bundle
├── src/
│   ├── data/                  # 493 species JSON/TS, difficulties, NPCs, items, trends, upgrades
│   ├── engine/                # Pure tycoon simulation, haggling, rent, debt, breeding, storage, SFX
│   ├── canvas/                # Indoor 2D Canvas, menu backdrop, PMD loader & AnimData.xml animator
│   └── components/            # PMD Navy/Gold Main Menu, HUD, DS dock, counter panel & modals
└── tests/                     # Engine, canvas/PMD animator & React UI tests
```

---

## Local Development & Verification

```bash
# 1. Install dependencies (uses repo-local .npm-cache when .npmrc is present)
npm install

# 2. Rebuild the 493 Gen 1–4 Pokédex & core PMD bundle (optional; generated files checked in)
npm run build-pokedex

# 3. Start local dev server
npm run dev

# 4. Run typecheck, unit/UI test suite, and production build
npm run typecheck
npm test
npm run build
```

---

## Asset Credits

All sprite sources, **PMDCollab / SpriteCollab (`CC BY-NC 4.0`)** licensing details, PokeAPI attribution, self-hosted SIL OFL font credits, and the non-commercial entertainment-only disclaimer are documented in [`public/assets/CREDITS.md`](./public/assets/CREDITS.md).
