# AGENTS.md — PokéMart: Low Cortisol Shift (v2)

## 1. Project Identity & Gameplay Philosophy
- **Title:** **PokéMart: Low Cortisol Shift**
  - **Note:** *"Low Cortisol Shift"* is solely the title aesthetic—not a passive or zero-stakes constraint.
- **Genre & Core Loop:** Active **Click-to-Manage** Pokémon pet shop, healing center, breeding, and counter-haggling tycoon simulator with timed shifts (`Open → Run Shift → Close & Pay Rent`), live-clock counter negotiation, **3 Difficulty Modes** (`relaxed`, `standard`, `high-stakes`), daily rent and pen/bed upkeep, Debt Grace, **Emergency Liquidation**, and **Bankruptcy**.
- **Visual Direction:** Gen 4 DS / Pokémon Mystery Dungeon pixel-art aesthetic — warm cream, soft oak wood, matcha sage, honey amber, and berry rose palette; crisp pixel borders; `image-rendering: pixelated` sprites; `ctx.imageSmoothingEnabled = false`.
- **Tech Stack:** Vite 8, React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), plain HTML5 2D Canvas, Vitest + React Testing Library (`jsdom`), and zero-KB Web Audio API chiptune SFX. Ignore all backend, PHP, or Laravel conventions.

## 2. Strict Workspace & Tooling Isolation
- Every file, script, downloaded sprite, npm cache (`.npm-cache/`), `.npmrc`, test artifact, Git config, and build output MUST remain strictly inside `D:\PokeManager`.
- Never write, edit, or delete files outside `D:\PokeManager`.
- Never install global npm packages or run `git config --global`. Use repo-local `.npmrc` (`cache=.npm-cache`) and `NPM_CONFIG_CACHE=D:\PokeManager\.npm-cache`.
- Target **Node.js 26.13.1** and relative `./assets/...` paths (`base: './'` in `vite.config.ts`) for static GitHub Pages compatibility.

## 3. PMD SpriteCollab Architecture & 493 Gen 1–4 Pokédex
- **Primary Sprite Set:** **PMDCollab / SpriteCollab (`CC BY-NC 4.0`)** multi-frame spritesheets (`Walk-Anim.png`, `Idle-Anim.png`, `Sleep-Anim.png`, `Hop-Anim.png`), `AnimData.xml`, and `portrait/{paddedId}/Normal.png` (plus shiny `0000/0001/` subfolders) covering **all 493 Gen 1–4 (`#001–#493`)** species (including Legendaries and Mythicals) plus **PMD Pokémon NPCs** (Kecleon clerk `0352` + 12 animated Pokémon shoppers).
- **Hybrid Loader Strategy:** Bundle the tiny core NPC cast (13) + 3 starter species locally under `public/assets/pmd/` for instant offline boot, embed per-species animation/portrait availability from SpriteCollab `tracker.json` in `src/data/species.json` so missing sheets are never fetched (0 404 errors), and load all other 493 species + shiny forms dynamically via GitHub Raw (`crossOrigin = "anonymous"`) + browser Cache API. (The old v1 `< 2 MB` static Platinum cap is lifted in favor of this hybrid loader.)

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
│   ├── pmd/                           # Bundled core PMD NPCs & starter spritesheets/portraits
│   ├── items/                         # Curated Gen 4 pixel item icons
│   └── CREDITS.md                     # Non-commercial PMDCollab CC BY-NC 4.0 & PokeAPI credits
├── scripts/build-pokedex.mjs          # Generates 493-species Gen 1–4 catalog & core PMD bundle
├── src/
│   ├── data/                          # 493 species JSON/TS, difficulties, NPCs, items, trends, upgrades
│   ├── engine/                        # Pure tycoon simulation, haggling, rent, debt, breeding, storage, SFX
│   ├── canvas/                        # HTML5 2D Canvas shop floor, PMD loader & AnimData.xml animator
│   └── components/                    # React + Tailwind UI components & accessible modals
└── tests/                             # Vitest unit tests & React Testing Library integration tests
```

## 8. Mandatory Self-Verification Rules & Waived Opus Gate
- After every checkpoint or fix, run `npm run typecheck`, `npm test`, and `npm run build` and resolve all failures.
- Verify UI flows on desktop (`1280×800`) and mobile (`390×844`) viewports in Checkpoint 2 with **0 runtime console errors** and **0 failed (`404`) asset requests**.
- **Model Gate Status:** The v1 Claude Opus 5.5 gate is explicitly waived for this v2 overhaul.
