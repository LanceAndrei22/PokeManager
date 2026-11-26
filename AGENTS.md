# AGENTS.md — PokéMart: Low Cortisol Shift (v2)

## 1. Project Identity & Gameplay Philosophy
- **Title:** **PokéMart: Low Cortisol Shift**
  - **Note:** *"Low Cortisol Shift"* is solely the title aesthetic—not a passive or zero-stakes constraint.
- **Genre & Core Loop:** Active **Click-to-Manage** Pokémon pet shop, healing center, breeding, and counter-haggling tycoon simulator with timed shifts (`Open → Run Shift → Close & Pay Rent`), live-clock counter negotiation, **3 Difficulty Modes** (`relaxed`, `standard`, `high-stakes`), daily rent and pen/bed upkeep, Debt Grace, **Emergency Liquidation**, and **Bankruptcy**.
- **Target Platform:** **PC desktop web browsers only** (minimum `1280×720`, optimized for `1920×1080` and `2560×1440+` widescreen displays with mouse & keyboard; mobile/phone viewports are intentionally unsupported).
- **Visual Direction:** Gen 4 DS / Pokémon Mystery Dungeon pixel-art aesthetic — royal navy & gold DS HUD framing over lush pixel-art tilesets; crisp integer pixel scaling; `image-rendering: pixelated` sprites; `ctx.imageSmoothingEnabled = false`.
- **Tech Stack:** Vite 8, React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), plain HTML5 2D Canvas, Vitest + React Testing Library (`jsdom`), and zero-KB Web Audio API chiptune SFX. Ignore all backend, PHP, or Laravel conventions.

## 2. Strict Workspace & Tooling Isolation
- Every file, script, downloaded sprite, npm cache (`.npm-cache/`), `.npmrc`, test artifact, Git config, and build output MUST remain strictly inside `D:\PokeManager`.
- Never write, edit, or delete files outside `D:\PokeManager`.
- Never install global npm packages or run `git config --global`. Use repo-local `.npmrc` (`cache=.npm-cache`) and `NPM_CONFIG_CACHE=D:\PokeManager\.npm-cache`.
- Target **Node.js 26.13.1** and relative `./assets/...` paths (`base: './'` in `vite.config.ts`) for static GitHub Pages compatibility.

## 3. PMD SpriteCollab Store Pokémon, Human NPCs & GBA Tilesets (v2.1)
- **Store Pokémon Sprites (100% PMDCollab / SpriteCollab, `CC BY-NC 4.0`):** Multi-frame grounded spritesheets (`Walk-Anim.png`, `Idle-Anim.png`, `Sleep-Anim.png` — no jumping/hopping), `AnimData.xml`, and `portrait/{paddedId}/Normal.png` (plus shiny `0000/0001/` subfolders) covering **all 493 Gen 1–4 (`#001–#493`)** species (including Legendaries and Mythicals), automatically foot-grounded via opaque-bound measurement onto snug pixel-oval contact shadows.
- **Hybrid Loader Strategy:** Bundle the 21 core species (`Walk`, `Idle`, `Sleep`, `Hop`) locally under `public/assets/pmd/` for instant offline boot, embed per-species animation/portrait availability from SpriteCollab `tracker.json` in `src/data/species.json` so missing sheets are never fetched (0 404 errors), and load all other 493 species + shiny forms dynamically via GitHub Raw (`crossOrigin = "anonymous"`) + browser Cache API.
- **Human Trainer NPCs (`pret/pokeemerald` + Pokémon Showdown):** Clerk Leo (`mart_employee`) and 15 Human Trainer shoppers across 6 archetypes — including **Normal Shopper** (~40% spawn weight, accepts non-Legendaries fairly without trait/trend match and never offers on Legendaries/Mythicals) — rendered with 4-direction `64×128` overworlds and counter trainer portraits.
- **Tilesets, Audio & Sharp Pixel Typography:** Authentic decoded `pret/pokeemerald` outdoor meadow (continuously rolling Main Menu nature background) & PokéMart indoor tilesets (`public/assets/tiles/`) plus custom GBA-palette Pet Shop stations (`scripts/fetch-world-assets.mjs`), cross-browser capture-unlocked Web Audio SFX + dual BGM tracks (`menu` ~80 BPM & `shop` ~100 BPM) + per-profile mixer (`sfx.ts`, `bgm.ts`, `AudioControls.tsx`), and self-hosted **Chakra Petch** (`500/600/700` Latin + Latin-Ext `₽`) UI/currency typography paired with **Silkscreen** (`400` ONLY on `>= 18px` headings/logo).

## 4. Documentation & Code Commenting Standards
- Add concise file-level summary headers on source modules.
- Write JSDoc comments on exported interfaces, types, functions, and React components.
- Add brief inline comments explaining PMD `AnimData.xml` frame-slicing math, haggle probability curves, rent/upkeep/debt formulas, VIP Legendary contracts, and storage serialization/checksums.
- Keep `D:\PokeManager\README.md` synchronized with shipped mechanics, controls, scripts, and credits, and always preserve the prominent disclaimer that **PokéMart: Low Cortisol Shift** is a **simple, completely free fan project made for entertainment purposes only** (non-commercial; Pokémon IP belongs to Nintendo, Creatures Inc., and Game Freak).

## 5. Local-Only Git & Commit Hygiene
- Local Git author MUST be configured repo-locally as:
  - `user.name = "Lance Andrei C. Bolaños"`
  - `user.email = "bolanoslanceandrei@gmail.com"`
- **Strict Local-Only Rule:** NEVER run `gh repo create`, `git remote add`, or `git push` unless the user explicitly asks to publish.
- Commit every completed step, feature slice, or fix locally with:
  - A short, concise summary line (`< 60` characters).
  - A brief 1–3 line description body summarizing changes and verification.
- Never commit `node_modules/`, `dist/`, `.npm-cache/`, `.npmrc`, `*.log`, or temporary files.

## 6. Per-User Local Storage Architecture (v2)
- All saves stay strictly local in browser `localStorage` with multi-profile support (isolated v2 namespace leaving v1 keys untouched):
  - Profile index key: `pokemart-low-cortisol:v2:index`
  - Isolated per-profile save key: `pokemart-low-cortisol:v2:save:<profileId>`
- Support profile creation (with per-profile Difficulty selection), switching, reset, deletion, auto-save on state mutations + 15-second interval, per-profile SFX mute state, and versioned checksum-validated UTF-8 Base64 Save Export/Import.

## 7. Folder Layout
```text
D:\PokeManager\
├── README.md                          # Project guide, setup, credits, free fan-project notice
├── AGENTS.md                          # Always-on project rules & architecture source of truth
├── .agents/rules/sprites-and-animation.md # Model-decision rules for PMD SpriteCollab & Canvas
├── public/assets/
│   ├── fonts/                         # Self-hosted Chakra Petch, Pixelify Sans & Silkscreen WOFF2 fonts
│   ├── npcs/                          # 16 pret/pokeemerald overworlds + Showdown Human Trainer portraits
│   ├── tiles/                         # Decoded pret/pokeemerald outdoor & indoor tiles + Pet Shop props
│   ├── pmd/                           # Bundled core 21 PMD species sheets (Walk/Idle/Sleep/Hop) & portraits
│   ├── items/                         # Curated Gen 4 pixel item icons
│   └── CREDITS.md                     # Non-commercial PMDCollab, pret/pokeemerald, Showdown & PokeAPI credits
├── scripts/
│   ├── build-pokedex.mjs              # Generates 493-species Gen 1–4 catalog & core PMD bundle
│   └── fetch-world-assets.mjs         # Decodes pret/pokeemerald metatiles, trainers & Pet Shop props
├── src/
│   ├── data/                          # 493 species JSON/TS, difficulties, Human NPCs, items, trends, upgrades
│   ├── engine/                        # Tycoon sim, haggling, rent, debt, breeding, storage, SFX & dual BGM
│   ├── canvas/                        # Tiled indoor floor, nature backdrop, PMD & Human animators
│   └── components/                    # React + Tailwind HUD, AudioControls, Counter & accessible modals
└── tests/                             # Vitest unit tests & React Testing Library integration tests
```

## 8. Mandatory Self-Verification Rules & Waived Opus Gate
- After every checkpoint or fix, run `npm run typecheck`, `npm test`, and `npm run build` and resolve all failures.
- Verify UI flows on desktop (`1280×800`) and Full HD widescreen (`1920×1080`) viewports with **0 runtime console errors** and **0 failed (`404`) asset requests**.
- **Model Gate Status:** The v1 Claude Opus 5.5 gate is explicitly waived for this v2 overhaul.
