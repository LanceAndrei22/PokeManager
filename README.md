# PokéMart: Low Cortisol Shift

> [!NOTE]
> **Simple, Completely Free Fan Project (Entertainment Only):**
> **PokéMart: Low Cortisol Shift** is a simple, completely free, non-commercial fan-made web game built purely for entertainment purposes only. Pokémon and all related character names, designs, and sprites belong to **Nintendo, Creatures Inc., and Game Freak**.

A static, client-side 2D pixel-art Pokémon pet shop, healing center, breeding, and counter-haggling tycoon web game powered by **PMDCollab / SpriteCollab** multi-frame spritesheets and all **493 Gen 1–4 Pokémon (`#001 Bulbasaur` → `#493 Arceus`)**—prepared for free static hosting on GitHub Pages.

> *(Note: "Low Cortisol Shift" is the game's title—under the hood v2 is an active Click-to-Manage tycoon game with timed shifts, live-clock counter haggling, daily rent, 3 difficulty modes, emergency liquidation, and bankruptcy.)*

---

## Gameplay Highlights (v2)

- **Active Timed Shifts & Counter Haggling:** Prep pens while closed, click **Open Shop** (`1×` / `2×` speed), watch PMD Pokémon shoppers inspect pens and queue in front of **Kecleon** at the register with live **Patience** meters, and negotiate manually (**Accept**, **Haggle +15%**, **Haggle +30%**, **Decline**) before patience hits zero!
- **3 Difficulty Modes (`Relaxed`, `Standard`, `High Stakes`):** Choose per-profile stakes governing starting funds (`₽3,500` / `₽2,000` / `₽1,200`), daily rent + pen/bed upkeep, shopper patience, haggle risk, and Debt Grace allowances (`1` / `1` / `0` shifts).
- **Debt Grace, Emergency Liquidation & Bankruptcy:** End-of-shift deficits enter a debt settlement warning where you can liquidate Pokémon at 50% base value—or exhaust Debt Grace and hit **Bankruptcy** with full run stats.
- **Full 493 Gen 1–4 Pokédex & VIP Legendary Contracts:** Discover all `#001–#493` species across 10 Shop Ranks, evolve via 9 Gen 1–4 Evolution Stones + `Rare Candy`, breed compatible Egg Groups (including Manaphy → Phione), and unlock high-stakes **VIP Legendary Contracts** (`#144–#151`, `#243–#251`, `#377–#386`, `#480–#493`).
- **Animated PMD Shop Floor:** Real 8-directional `AnimData.xml`-driven PMD animations (`Walk`, `Idle`, `Sleep`, `Hop`) for both store Pokémon and the PMD Pokémon NPC cast (`0352` Kecleon clerk + 12 shopper species).
- **Isolated Local v2 Profiles & Web Audio SFX:** Multi-profile `localStorage` saves (`pokemart-low-cortisol:v2:index` & `pokemart-low-cortisol:v2:save:<profileId>`), checksum-verified Base64 Save Export/Import, and soft synthesized chiptune SFX.

---

## Tech Stack

- **Frontend:** Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)
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
│   ├── pmd/                   # Bundled core PMD NPCs & starter spritesheets/portraits
│   ├── items/                 # Curated Gen 4 pixel item icons
│   └── CREDITS.md             # Non-commercial PMDCollab CC BY-NC 4.0 & PokeAPI credits
├── scripts/build-pokedex.mjs  # Generates 493-species Gen 1–4 catalog & core PMD bundle
├── src/
│   ├── data/                  # 493 species JSON/TS, difficulties, NPCs, items, trends, upgrades
│   ├── engine/                # Pure tycoon simulation, haggling, rent, debt, breeding, storage, SFX
│   ├── canvas/                # HTML5 2D Canvas shop floor, PMD loader & AnimData.xml animator
│   └── components/            # Cozy React + Tailwind UI panels & accessible modals
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

All sprite sources, **PMDCollab / SpriteCollab (`CC BY-NC 4.0`)** licensing details, PokeAPI attribution, and the non-commercial entertainment-only disclaimer are documented in [`public/assets/CREDITS.md`](./public/assets/CREDITS.md).
