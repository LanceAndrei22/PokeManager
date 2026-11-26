---
trigger: model_decision
description: Rules for PMDCollab SpriteCollab sheets, AnimData.xml parsing, 8-directional row slicing, pret/pokeemerald Human Trainer NPCs, PC desktop high-resolution HTML5 2D Canvas rendering, and pixel particle effects.
---

# Sprites & Animation Guidelines — PokéMart: Low Cortisol Shift (v2.2, Desktop Only)

## 1. PMDCollab / SpriteCollab Store Pokémon (`CC BY-NC 4.0`) & Human Trainer NPCs
- **Store Pokémon (100% PMDCollab / SpriteCollab):** All 493 Gen 1–4 store Pokémon (`#001–#493`) in Display Pens, Resting Corner beds, Mascot Spotlight, Pokédex, and the rolling Main Menu meadow render using grounded **PMDCollab / SpriteCollab** multi-frame spritesheets (`Walk-Anim.png`, `Idle-Anim.png`, `Sleep-Anim.png` — no jumping/hopping playback), `AnimData.xml`, and `portrait/{paddedId}/Normal.png` (`0000/0001/` for Shiny forms).
- **Grounded Contact Shadows:** `pmdLoader.ts` automatically measures each loaded PMD sheet's opaque bottom foot padding (`bottomPadPx`) and visible body width (`visibleWidthPx`) so every Pokémon and Human Trainer sits squarely on a tight pixel-oval contact shadow directly beneath `feetY` with zero floating gap or vertical bounce offsets.
- **Human Trainer NPCs (`pret/pokeemerald` + Pokémon Showdown):** Store **Clerk Leo** (`mart_employee`, layered behind the deep Gen 4 Checkout Counter) and 15 Human Trainer shoppers across 6 archetypes (`normal`, `bargain-browser`, `cozy-collector`, `trend-fan`, `shiny-seeker`, `vip-seeker`) render with bundled 4-direction `64×128` (`16×32` cells, visible body rows `10..30`) overworld sheets and Showdown portraits.
- Use `crossOrigin = "anonymous"` for remote GitHub Raw sprite images and cache fetched resources in memory and the browser Cache API.
- **Zero-404 Availability Gating:** Always consult `species.pmdAnims` (pre-extracted from SpriteCollab `tracker.json` into `src/data/species.json`) before requesting secondary animations (`Sleep-Anim.png`) or shiny variants, falling back cleanly (`Sleep` → `Idle` → `Walk`; Shiny → Normal if unavailable) so missing sheets never trigger browser 404 console errors.

## 2. `AnimData.xml` Slicing, 8-Directional PMD Motion & 4-Way Human Pathing
- Parse `<ShadowSize>`, `<FrameWidth>`, `<FrameHeight>`, `<Durations><Duration>…</Duration></Durations>`, and `<CopyOf>` tags cleanly in `src/canvas/pmdAnimator.ts`.
- **PMD 8-Directional Row Layout:** Rows `0..7` correspond clockwise from South:
  - `0: S`, `1: SE`, `2: E`, `3: NE`, `4: N`, `5: NW`, `6: W`, `7: SW`.
  - Compute `direction` smoothly from `(dx, dy)` movement vectors; 1-row sheets (such as `Sleep-Anim.png`) always clamp to row `0`.
- Advance PMD frames strictly using 60 fps duration ticks (`duration / 60` seconds per frame).
- **Human Trainer Indicator Anchoring:** Because `16×32` normalized `pret/pokeemerald` trainer frames carry ~10px of transparent top margin, anchor Patience Bars, `!` badges, and pen browsing bubbles directly to the visible head top (`feetY - 22 * humanScale + unit * 2`) rather than full cell height.

## 3. PC Desktop High-Resolution Pixel Rendering (`1280×720` → `2560×1440+`)
- Target **PC desktop web browsers only** (`1280×720` minimum; optimized for `1920×1080` and `2560×1440+` widescreen displays with mouse & keyboard). Never ship mobile/portrait canvas layout branches.
- Scale backing-store `unit` cleanly as an integer derived from desktop viewport scale × DPR (`Math.max(2, Math.round(2 * resScale * dpr))`) so tiles, sprites, stations, and hitboxes scale proportionally without letterboxing, stretching, or sub-pixel blur.
- Re-apply `ctx.imageSmoothingEnabled = false` on every frame (canvas resize/DPR resets 2D context state) and apply CSS `image-rendering: pixelated` on `<canvas>` elements and portrait `<img>` tags.
- Clamp `requestAnimationFrame` delta time (`Math.min(dt, 0.05)`). Keep gameplay sprite animations and trainer walking active by default on desktop browsers (do not freeze gameplay solely on OS reduced-motion settings); honor the explicit in-HUD **Anim / Play** motion pause button.
- Keep procedural pixel particles (`heart`, `zzz`, `sparkle`, `sweat`, `+₽` coin), hover carets, and trainer bubbles crisp on whole art-pixel boundaries.
