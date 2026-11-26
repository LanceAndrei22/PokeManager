# PokéMart: Low Cortisol Shift

> [!NOTE]
> **Simple, Completely Free Fan Project (Entertainment Only):**
> **PokéMart: Low Cortisol Shift** is a simple, completely free, non-commercial fan-made web game built purely for entertainment and cozy relaxation. Pokémon and all related character names, designs, and sprites belong to **Nintendo, Creatures Inc., and Game Freak**.

A lightweight, static 2D pixel-art Pokémon pet shop, stray healing center, and breeding management simulation web game with a warm, stress-free lo-fi convenience store vibe—designed to run completely client-side and deploy cleanly on GitHub Pages.

---

## Cozy Gameplay Highlights

- **Zero-Stress Live-Tick Shifts:** Open the shop floor at `1×` or `2×` speed, pause anytime, or close the shift early to rest—with no rent penalties, no bankruptcy, and no angry customer walk-outs.
- **Rotating Wholesale & Rescue Catalog:** Welcome healthy adoptables, discounted tired strays in need of plush nap recovery, and Mystery Eggs every shift.
- **Cozy Market Trends & Customer Archetypes:** Adapt to shifting daily trends (*Rainy Afternoon Nap*, *Tea Club Visit*, *Sinnoh Park Stroll*, etc.), watch out for gentle species oversupply saturation, adjust markup sliders, and meet four distinct shopper personalities (*Cozy Collector*, *Bargain Browser*, *Trend Fan*, *Shiny Seeker*).
- **Active Shop Items & Stone Evolutions:** Use Evolution Stones (`Fire`, `Water`, `Thunder`, `Leaf`, `Moon`), Care Berries & Drinks (`Oran Berry`, `Sitrus Berry`, `Fresh Water`, `Moomoo Milk`, `Potion`), `Rare Candy`, and specialty checkout gift-wrap balls (`Heal`, `Friend`, `Luxury`).
- **Breeding & Genetics Incubator:** Pair compatible egg groups to hatch inherited `Cute`, `Comfort`, and `Rarity` stats, chill traits, and rare **Shiny** variants (`3×` value, Platinum shiny sprite).
- **Healing & Stray Nap Station:** Tucked-in plush beds let rescued strays recover smoothly over live ticks or via soothing drinks and berries.
- **Multi-Profile Local Saves & Web Audio SFX:** Every Shift Manager gets isolated `localStorage` saves, auto-save every 15 seconds, versioned Base64 Export/Import, and soft synthesized chiptune SFX with per-profile mute controls.

---

## Tech Stack

- **Frontend:** Vite 8 + React + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)
- **Shop Floor Rendering:** Static Platinum pixel-art preview in Phase 4; HTML5 2D Canvas sprite animation engine planned for Phase 5
- **Sprites & Icons:** Curated Gen 1–4 (`#1–#493`) **Pokémon Platinum (80×80)** Normal & Shiny sprites + Gen 4 item icons (`< 2 MB` total bundled assets)
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
│   ├── platinum/normal/       # Curated Platinum 80×80 normal front PNGs
│   ├── platinum/shiny/        # Curated Platinum 80×80 shiny front PNGs
│   ├── items/                 # Curated pixel item icons
│   └── CREDITS.md             # Non-commercial fan project attribution
├── scripts/fetch-assets.mjs   # Reproducible asset download & manifest generator
├── src/
│   ├── data/                  # Species, items, trends, archetypes, upgrades, manifest
│   ├── engine/                # Pure simulation, economy, breeding, healing, storage, SFX
│   ├── canvas/                # Phase 5: HTML5 2D Canvas shop floor & Platinum animations
│   └── components/            # Cozy React + Tailwind UI panels & accessible modals
└── tests/                     # Engine unit tests & React Testing Library UI tests
```

---

## Local Development & Verification

```bash
# 1. Install dependencies (uses repo-local .npm-cache when .npmrc is present)
npm install

# 2. (Optional) Re-fetch curated Platinum sprites and item icons
npm run fetch-assets

# 3. Start local dev server
npm run dev

# 4. Run typecheck, unit/UI test suite, and production build
npm run typecheck
npm test
npm run build
```

---

## GitHub Pages Deployment (Future Publish)

The repository is preconfigured with `base: './'` in `vite.config.ts` and a ready-to-use `.github/workflows/deploy.yml` workflow pinned to **Node.js 26.13.1**. When you are ready to publish to GitHub Pages:

1. Create a GitHub repository and push your local `main` branch.
2. In GitHub **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Pushing to `main` automatically runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and deploys `dist/`.

---

## Asset Credits

All sprite sources, asset URLs, and non-commercial fan-project attributions are documented in [`public/assets/CREDITS.md`](./public/assets/CREDITS.md).
