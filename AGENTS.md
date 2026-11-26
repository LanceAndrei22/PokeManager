# AGENTS.md — PokéMart: Low Cortisol Shift

## 1. Project Identity & Aesthetic
- **Title:** **PokéMart: Low Cortisol Shift**
- **Genre & Vibe:** Lightweight, 100% static client-side 2D pixel-art Pokémon pet shop, healing center, and breeding management simulation web game with a cozy, stress-free, lo-fi convenience store atmosphere.
- **Visual Direction:** Gen 4 DS-inspired cozy pixel aesthetic — warm cream, soft oak wood, matcha sage, honey amber, and berry rose palette; crisp pixel borders; `image-rendering: pixelated` sprites; relaxed live-tick pacing with Open/Pause and `1×` / `2×` controls; zero harsh fail-states, zero rent penalties, and zero angry customer walk-outs.
- **Tech Stack:** Vite 8, React, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), plain HTML5 2D Canvas (Phase 5), Vitest + React Testing Library (`jsdom`), and zero-KB Web Audio API soft sine/triangle chiptune SFX. Ignore all backend, PHP, or Laravel conventions.

## 2. Strict Workspace & Tooling Isolation
- Every file, script, downloaded sprite, npm cache (`.npm-cache/`), `.npmrc`, test artifact, Git config, and build output MUST remain strictly inside `D:\PokeManager`.
- Never write, edit, or delete files outside `D:\PokeManager`.
- Never install global npm packages or run `git config --global`. Use repo-local `.npmrc` (`cache=.npm-cache`) and `NPM_CONFIG_CACHE=D:\PokeManager\.npm-cache`.
- Target **Node.js 26.13.1** and relative `./assets/...` paths (`base: './'` in `vite.config.ts`) for static GitHub Pages compatibility.

## 3. Sprite Architecture & Asset Budget
- **Primary Sprite Set:** **Pokémon Platinum (Gen 4, `#1–#493`, 80×80 PNG)** Normal and Shiny front sprites curated via `scripts/fetch-assets.mjs` from `PokeAPI/sprites`, paired with curated Gen 4 pixel item icons (`msikma/pokesprite` fallback only if needed for an Egg icon).
- **Asset Budget:** Keep total bundled game assets under **`< 2 MB`** by curating 36–48 classic pet-shop and low-cortisol species (never clone upstream sprite repositories).

## 4. Documentation & Code Commenting Standards
- Add concise file-level summary headers on source modules.
- Write JSDoc comments on exported interfaces, types, functions, and React components.
- Add brief inline comments explaining game formulas (demand curves, oversupply saturation, archetype valuations, markup buy probability, breeding inheritance, shiny rolls), state transitions, and storage serialization/checksums.
- Keep `D:\PokeManager\README.md` synchronized with shipped mechanics, controls, scripts, and credits, and always preserve the prominent disclaimer that **PokéMart: Low Cortisol Shift** is a **simple, completely free fan project made for entertainment purposes only** (non-commercial; Pokémon IP belongs to Nintendo, Creatures Inc., and Game Freak).

## 5. Local-Only Git & Commit Hygiene
- Local Git author MUST be configured repo-locally as:
  - `user.name = "Lance Andrei C. Bolaños"`
  - `user.email = "bolanoslanceandrei@gmail.com"`
- **Strict Local-Only Rule:** NEVER run `gh repo create`, `git remote add`, or `git push` unless the user explicitly asks to publish.
- Commit every completed phase, feature slice, or fix locally with:
  - A short, concise summary line (`< 60` characters, conventional prefix like `feat(economy): ...`).
  - A brief 1–3 line description body summarizing changes and verification.
- Never commit `node_modules/`, `dist/`, `.npm-cache/`, `.npmrc`, `*.log`, or temporary files.

## 6. Per-User Local Storage Architecture
- All game saves stay strictly local in browser `localStorage` with multi-profile support per browser/device:
  - Profile index key: `pokemart-low-cortisol:v1:index`
  - Isolated per-profile save key: `pokemart-low-cortisol:v1:save:<profileId>`
- Support profile creation, switching, reset, deletion, auto-save on state mutations + 15-second interval, per-profile SFX mute state, and versioned checksum-validated UTF-8 Base64 Save Export/Import.

## 7. Folder Layout
```text
D:\PokeManager\
├── README.md                          # Project guide, setup, credits, free fan-project notice
├── AGENTS.md                          # Always-on project rules & architecture source of truth
├── .agents/rules/sprites-and-animation.md # Model-decision rules for canvas & Platinum animations
├── public/assets/
│   ├── platinum/normal/               # Curated Platinum 80×80 normal front PNGs
│   ├── platinum/shiny/                # Curated Platinum 80×80 shiny front PNGs
│   ├── items/                         # Curated Gen 4 pixel item icons
│   └── CREDITS.md                     # Non-commercial fan project asset attribution
├── scripts/fetch-assets.mjs           # Reproducible asset curation & manifest script
├── src/
│   ├── data/                          # Static species, items, trends, archetypes, upgrades, manifest
│   ├── engine/                        # Pure simulation, economy, breeding, healing, dex, storage, audio
│   ├── canvas/                        # HTML5 2D Canvas shop floor & sprite animation engine (Opus 5.5 gated)
│   └── components/                    # React + Tailwind UI components & accessible modals
└── tests/                             # Vitest unit tests & React Testing Library integration tests
```

## 8. Mandatory Self-Verification Rules
After every feature phase or bug fix:
1. Run `npm run typecheck`, `npm test`, and `npm run build` and resolve all failures or warnings.
2. Verify key UI flows on desktop (`1280×800`) and mobile (`390×844`) viewports using Antigravity's built-in `browser` subagent with **0 runtime console errors** and **0 failed (`404`) image/asset requests**.

## 9. Mandatory Claude Opus 5.5 Gate (Sprites & Animations)
- **STOP and ask the user for explicit confirmation** before creating or modifying `src/canvas/` or implementing any HTML5 Canvas sprite rendering, Platinum sprite scaling, pixel-art floor tiles, squash-and-stretch hops, idle breathing bobs, sleep squish, horizontal facing flips (`scaleX(-1)`), customer walker animations, pixel particle effects, or overworld sheet loops.
- Prompt the user to switch the model to **Claude Opus 5.5** and confirm before proceeding.
