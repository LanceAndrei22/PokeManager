/**
 * Static Pokémon Platinum (80×80 front sprite) adapter for the canvas floor.
 * Images are lazily created once per URL and cached; until decoded the renderer
 * draws a tiny pixel placeholder. A future PMD overworld adapter can implement the
 * same `SpriteEntityAdapter` interface to return per-state, per-time sheet frames.
 */
import { getPlatinumSpriteUrl } from '../components/PokemonSprite';
import type { SpriteEntityAdapter, SpriteFrame } from './types';

/** Creates a cached Platinum front-sprite adapter (one HTMLImageElement per URL). */
export function createPlatinumSpriteAdapter(): SpriteEntityAdapter {
  const cache = new Map<string, HTMLImageElement>();

  return {
    getFrame(speciesId, isShiny): SpriteFrame | null {
      if (typeof Image === 'undefined') return null;
      const url = getPlatinumSpriteUrl(speciesId, isShiny);
      let img = cache.get(url);
      if (!img) {
        img = new Image();
        img.decoding = 'async';
        img.src = url;
        cache.set(url, img);
      }
      if (!img.complete || img.naturalWidth === 0) return null;
      return {
        image: img,
        sx: 0,
        sy: 0,
        sw: img.naturalWidth,
        sh: img.naturalHeight,
        // Gen 4 front sprites look toward the left of the screen.
        facesLeft: true,
      };
    },
  };
}
