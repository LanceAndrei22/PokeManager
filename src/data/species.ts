/**
 * Complete Gen 1–4 (#001 Bulbasaur -> #0493 Arceus) Pokédex catalog backed by
 * `species.json` (generated reproducibly via `scripts/build-pokedex.mjs`).
 */
import rawSpecies from './species.json';
import type { SpeciesDefinition } from './types';

/** Ordered list of all 493 Gen 1–4 Pokémon Platinum National Dex species. */
export const SPECIES_CATALOG: SpeciesDefinition[] = rawSpecies as SpeciesDefinition[];

/** Fast O(1) lookup table from National Dex ID (`1..493`) to `SpeciesDefinition`. */
export const SPECIES_BY_ID: Record<number, SpeciesDefinition> = Object.fromEntries(
  SPECIES_CATALOG.map((species) => [species.id, species]),
);

/** Resolves a species safely by National Dex ID (`1..493`) or throws clearly. */
export function getSpecies(speciesId: number): SpeciesDefinition {
  const found = SPECIES_BY_ID[speciesId];
  if (!found) {
    throw new Error(`Unknown Gen 1–4 species ID: ${speciesId}`);
  }
  return found;
}
