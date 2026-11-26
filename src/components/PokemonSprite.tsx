/**
 * Static Pokémon Platinum (80×80) and Gen 4 item icon renderers using crisp
 * pixelated scaling and relative `./assets/...` URLs for GitHub Pages support.
 */
import type { ItemSlug } from '../data/types';

export interface PokemonSpriteProps {
  speciesId: number;
  name: string;
  isShiny?: boolean;
  size?: number;
  className?: string;
}

/** Resolves the static relative Platinum sprite URL for a species ID. */
export function getPlatinumSpriteUrl(speciesId: number, isShiny = false): string {
  return `./assets/platinum/${isShiny ? 'shiny' : 'normal'}/${speciesId}.png`;
}

/** Resolves the static relative Gen 4 item icon URL for an item slug. */
export function getItemIconUrl(slug: ItemSlug | 'egg'): string {
  return `./assets/items/${slug}.png`;
}

/** Renders a crisp pixelated Pokémon Platinum front sprite image. */
export function PokemonSprite({
  speciesId,
  name,
  isShiny = false,
  size = 72,
  className = '',
}: PokemonSpriteProps) {
  return (
    <img
      src={getPlatinumSpriteUrl(speciesId, isShiny)}
      alt={`${isShiny ? 'Shiny ' : ''}${name}`}
      width={size}
      height={size}
      loading="lazy"
      className={`pixel-art select-none object-contain ${className}`}
    />
  );
}

export interface ItemIconProps {
  slug: ItemSlug | 'egg';
  name: string;
  size?: number;
  className?: string;
}

/** Renders a crisp pixelated Gen 4 item icon image. */
export function ItemIcon({ slug, name, size = 24, className = '' }: ItemIconProps) {
  return (
    <img
      src={getItemIconUrl(slug)}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={`pixel-art select-none object-contain ${className}`}
    />
  );
}
