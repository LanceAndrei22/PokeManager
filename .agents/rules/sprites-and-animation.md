---
trigger: model_decision
description: Rules for Pokémon Platinum sprites, HTML5 2D Canvas shop floor rendering, pixel-art floor tiles, squash-and-stretch hops, idle breathing bobs, sleep squish, directional flips, customer walkers, and pixel particle effects.
---

# Sprites & Animation Guidelines — PokéMart: Low Cortisol Shift

## 1. Mandatory Claude Opus 5.5 Confirmation Gate
- **DO NOT** create or edit files inside `src/canvas/` or implement HTML5 Canvas sprite rendering, custom pixel-art shop tiles, squash-and-stretch hops, idle breathing bobs, sleep squish, directional flips (`scaleX(-1)`), customer walker animations, procedural pixel particles, or optional PMD spritesheet frame loops without first pausing and receiving explicit user confirmation to switch to **Claude Opus 5.5**.

## 2. Crisp Pixel Rendering Standards
- Always set `ctx.imageSmoothingEnabled = false` before drawing sprites or pixel tiles onto any HTML5 2D Canvas (and re-apply after canvas resize/DPR scaling).
- Always apply CSS `image-rendering: pixelated` (and `crisp-edges` fallback) on `<canvas>` elements and static sprite `<img>` previews.
- Scale 80×80 Pokémon Platinum sprites cleanly using integer or crisp pixel ratios inside shop pens and nap beds without blurring.

## 3. Lightweight Platinum Sprite Animation Rules
- Animate static 80×80 Platinum front sprites gently to preserve the cozy, low-cortisol Gen 4 vibe:
  - **Idle Breathing Bob:** Subtle vertical sine-wave bob (`±1–2 px`) and micro scale pulse.
  - **Wandering Hop:** Soft squash-and-stretch hop arc when a Pokémon hops between pen spots.
  - **Horizontal Facing Flip:** Apply clean horizontal flip (`ctx.scale(-1, 1)`) toward movement direction while wandering pens.
  - **Sleepy Nap Squish:** Flattened vertical squash (`~0.88×` height, `~1.08×` width) in plush nap beds paired with floating `Zzz` pixels.
  - **Procedural Pixel Particles:** Crisp pixel hearts on care/petting, floating `Zzz` above napping strays, warm gold sparkles around Shiny Pokémon, and rising `+$` coin pixels on happy adoptions.

## 4. Canvas Architecture & Comments
- Document `requestAnimationFrame` delta-time clamping (`Math.min(dt, 0.05)`), DPR coordinate transforms, pen bounding boxes, and sprite animation state machines with concise comments.
- Keep the sprite renderer decoupled behind a clean `SpriteEntityAdapter` interface so optional PMD overworld spritesheet loops can be plugged in later without rewriting `src/engine/` simulation logic.
