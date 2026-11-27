/**
 * Orchestrator for the full-screen Indoor Gen 4 PokéMart pixel renderer.
 *
 * Coordinates the layered 2.5D Y-sorted render pass across cohesive submodules:
 * - `indoorConstants.ts`    — shared palettes, bitmaps, icon maps & primitives
 * - `indoorArchitecture.ts` — floor tiling, wall, windows, dynamic clock, sliding doors & static cache
 * - `indoorStations.ts`     — counter, display pens, resting alcove, PC kiosk & egg incubator
 * - `indoorEntities.ts`     — grounded Pokémon, shopkeepers, shoppers, overlays & particles
 *
 * Re-exports all historical public symbols so callers and tests remain 100% compatible.
 */
import {
  buildIndoorBackgroundLayer,
  drawDynamicWallClock,
  drawIndoorBackground,
  drawSlidingDoors,
} from './indoorArchitecture';
import type { IndoorRenderOptions } from './indoorConstants';
import {
  drawHoverHighlight,
  drawParticle,
  drawPokemon,
  drawQueuedShopper,
  drawShopkeepers,
  drawWalker,
  drawWalkerBubble,
  getHumanHeadTopY,
} from './indoorEntities';
import {
  drawCounterForeground,
  drawDynamicStations,
  drawPenFrontRail,
  drawRestingPensArea,
} from './indoorStations';
import type { ShopLayout, SpriteEntityAdapter } from './types';
import type { ShopWorld } from './world';

export type { IndoorRenderOptions };
export {
  buildIndoorBackgroundLayer,
  drawIndoorBackground,
  drawRestingPensArea,
  getHumanHeadTopY,
};

/** Renders one complete frame of the full-viewport cohesive Indoor PokéMart scene. */
export function renderIndoorScene(
  ctx: CanvasRenderingContext2D,
  layout: ShopLayout,
  world: ShopWorld,
  background: CanvasImageSource | null,
  adapter: SpriteEntityAdapter,
  options: IndoorRenderOptions,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Always re-apply after resize/DPR reset so pixel art stays razor-sharp.
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (background) ctx.drawImage(background, 0, 0);
  else drawIndoorBackground(ctx, layout);

  drawDynamicWallClock(
    ctx,
    layout,
    options.shiftTick ?? 0,
    options.shiftDurationTicks ?? 100,
    options.shiftRunning,
  );
  drawSlidingDoors(ctx, layout, world, options.shiftRunning);

  // True behind-counter layering: hired Shopkeepers render behind the desk (Slot 0 right beside
  // the Cash Register), then the deep Counter desk/front/register overlays their lower legs.
  drawShopkeepers(ctx, layout, world, options.shopkeepers ?? ['mart_employee']);
  drawCounterForeground(ctx, layout);

  drawDynamicStations(ctx, layout, world);

  const hoverPokemonUid = options.hoverTarget?.kind === 'pokemon' ? options.hoverTarget.uid : null;
  const hoverOfferUid =
    options.hoverTarget?.kind === 'counter-offer' ? options.hoverTarget.offerUid : null;

  // Unified 2.5D Y-sort across grounded Pokémon, Pen front wooden rails, and Human Shoppers
  const drawables: Array<{ y: number; draw: () => void }> = [];
  for (const pen of layout.pens) {
    drawables.push({
      y: pen.y + pen.h,
      draw: () => drawPenFrontRail(ctx, pen, layout.unit),
    });
  }
  for (const ent of world.pokemon.values()) {
    drawables.push({
      y: ent.y,
      draw: () => drawPokemon(ctx, layout, world, ent, adapter, ent.uid === hoverPokemonUid),
    });
  }
  for (const walker of world.walkers.values()) {
    drawables.push({
      y: walker.y + 0.5,
      draw: () => drawWalker(ctx, layout, world, walker),
    });
  }
  for (const q of world.queuedShoppers.values()) {
    drawables.push({
      y: q.y + 0.6,
      draw: () => drawQueuedShopper(ctx, layout, world, q, q.offerUid === hoverOfferUid),
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Subtle corner hover highlight cleanly above the hovered station/pen
  drawHoverHighlight(ctx, layout, options.hoverTarget);

  for (const walker of world.walkers.values()) drawWalkerBubble(ctx, layout, world, walker);
  for (const p of world.particles) drawParticle(ctx, layout, p);
}
