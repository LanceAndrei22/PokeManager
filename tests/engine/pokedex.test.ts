/**
 * Verification tests for the complete 493 Gen 1–4 (#001 Bulbasaur -> #0493 Arceus)
 * Pokédex catalog, rarity tiers, breeding rules, evolutions, and PMD availability.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES_BY_ID, SPECIES_CATALOG, getSpecies } from '../../src/data/species';
import { CLERK_NPC, SHOPPER_NPCS_BY_ARCHETYPE } from '../../src/data/npcs';

describe('Full Gen 1–4 Pokédex Catalog (493 Species)', () => {
  it('contains all 493 National Dex species without gaps from #001 Bulbasaur to #493 Arceus', () => {
    expect(SPECIES_CATALOG).toHaveLength(493);
    expect(SPECIES_CATALOG[0].id).toBe(1);
    expect(SPECIES_CATALOG[0].paddedId).toBe('0001');
    expect(SPECIES_CATALOG[0].name).toBe('Bulbasaur');

    expect(SPECIES_CATALOG[492].id).toBe(493);
    expect(SPECIES_CATALOG[492].paddedId).toBe('0493');
    expect(SPECIES_CATALOG[492].name).toBe('Arceus');

    for (let id = 1; id <= 493; id += 1) {
      const sp = SPECIES_BY_ID[id];
      expect(sp).toBeDefined();
      expect(sp.paddedId).toBe(String(id).padStart(4, '0'));
      expect(sp.types.length).toBeGreaterThanOrEqual(1);
      expect(sp.unlockRank).toBeGreaterThanOrEqual(1);
      expect(sp.unlockRank).toBeLessThanOrEqual(10);
      expect(sp.pmdAnims.normal.length).toBeGreaterThan(0);
    }
  });

  it('includes Legendaries & Mythicals with non-breedable flags except Manaphy -> Phione', () => {
    const legendaries = SPECIES_CATALOG.filter((s) => s.isLegendary);
    const mythicals = SPECIES_CATALOG.filter((s) => s.isMythical);
    expect(legendaries.length).toBeGreaterThanOrEqual(20);
    expect(mythicals.length).toBeGreaterThanOrEqual(8);

    const mewtwo = getSpecies(150);
    expect(mewtwo.rarityTier).toBe('legendary');
    expect(mewtwo.canBreed).toBe(false);

    const arceus = getSpecies(493);
    expect(arceus.rarityTier).toBe('mythical');
    expect(arceus.canBreed).toBe(false);

    const manaphy = getSpecies(490);
    expect(manaphy.isMythical).toBe(true);
    expect(manaphy.canBreed).toBe(true);
    expect(manaphy.babySpeciesId).toBe(489); // Phione
  });

  it('maps stone evolutions and Rare Candy standard evolutions across Gen 1–4', () => {
    const eevee = getSpecies(133);
    expect(eevee.evolutions?.['water-stone']).toBe(134);
    expect(eevee.evolutions?.['thunder-stone']).toBe(135);
    expect(eevee.evolutions?.['fire-stone']).toBe(136);
    expect(eevee.evolutions?.['leaf-stone']).toBe(470);
    expect(eevee.evolutions?.['moon-stone']).toBe(197);
    expect(eevee.levelEvolutionId).toBe(196); // Espeon

    const bulbasaur = getSpecies(1);
    expect(bulbasaur.levelEvolutionId).toBe(2);
    expect(getSpecies(2).levelEvolutionId).toBe(3);

    expect(getSpecies(176).evolutions?.['shiny-stone']).toBe(468); // Togetic -> Togekiss
    expect(getSpecies(198).evolutions?.['dusk-stone']).toBe(430); // Murkrow -> Honchkrow
    expect(getSpecies(281).evolutions?.['dawn-stone']).toBe(475); // Kirlia -> Gallade
  });

  it('defines Kecleon clerk and PMD shopper NPCs backed by bundled local manifest', () => {
    expect(CLERK_NPC.speciesId).toBe(352);
    expect(CLERK_NPC.paddedId).toBe('0352');
    expect(SHOPPER_NPCS_BY_ARCHETYPE['bargain-browser']).toHaveLength(3);
    expect(SHOPPER_NPCS_BY_ARCHETYPE['vip-seeker']).toHaveLength(3);
  });
});
