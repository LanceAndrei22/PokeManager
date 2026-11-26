---
trigger: model_decision
description: Rules for PMDCollab SpriteCollab sheets, AnimData.xml parsing, 8-directional row slicing, HTML5 2D Canvas shop floor rendering, PMD Pokémon NPCs, and pixel particle effects.
---

# Sprites & Animation Guidelines — PokéMart: Low Cortisol Shift (v2)

## 1. PMDCollab / SpriteCollab Architecture (`CC BY-NC 4.0`)
- All Pokémon (including all 493 Gen 1–4 species `#001–#493`) and shop NPCs (`0352` Kecleon clerk + 12 Pokémon shoppers) render using **PMDCollab / SpriteCollab** multi-frame spritesheets (`Walk-Anim.png`, `Idle-Anim.png`, `Sleep-Anim.png`, `Hop-Anim.png`), `AnimData.xml`, and `portrait/{paddedId}/Normal.png` (`0000/0001/` for Shiny forms).
- Use `crossOrigin = "anonymous"` for remote GitHub Raw sprite images and cache fetched resources in memory and the browser Cache API.
- **Zero-404 Availability Gating:** Always consult `species.pmdAnims` (pre-extracted from SpriteCollab `tracker.json` into `src/data/species.json`) before requesting secondary animations (`Hop-Anim.png`, `Sleep-Anim.png`) or shiny variants, falling back cleanly (`Hop` → `Idle` → `Walk`; `Sleep` → `Idle` → `Walk`; Shiny → Normal if unavailable) so missing sheets never trigger browser 404 console errors.

## 2. `AnimData.xml` Slicing & 8-Directional Motion
- Parse `<ShadowSize>`, `<FrameWidth>`, `<FrameHeight>`, `<Durations><Duration>…</Duration></Durations>`, and `<CopyOf>` tags cleanly in `src/canvas/pmdAnimator.ts`.
- **PMD 8-Directional Row Layout:** Rows `0..7` correspond clockwise from South:
  - `0: S`, `1: SE`, `2: E`, `3: NE`, `4: N`, `5: NW`, `6: W`, `7: SW`.
  - Compute `direction` smoothly from `(dx, dy)` movement vectors; default counter Clerk (`0352` Kecleon) to South (`0`) facing customers.
  - 1-row sheets (such as `Sleep-Anim.png`) always clamp to row `0`.
- Advance frames strictly using PMD 60 fps duration ticks (`duration / 60` seconds per frame).

## 3. Crisp Pixel Rendering & Reduced Motion
- Re-apply `ctx.imageSmoothingEnabled = false` on every frame (canvas resize/DPR resets 2D context state).
- Apply CSS `image-rendering: pixelated` (and `crisp-edges` fallback) on `<canvas>` elements and portrait `<img>` tags.
- Clamp `requestAnimationFrame` delta time (`Math.min(dt, 0.05)`), pause off-screen rendering via `content-visibility` / `IntersectionObserver`, provide a visible Pause/Play animation button, and freeze motion when `prefers-reduced-motion: reduce` is active.
- Keep procedural pixel particles (`heart`, `zzz`, `sparkle`, `+₽` coin) and PMD NPC thought bubbles crisp on whole art-pixel boundaries.
