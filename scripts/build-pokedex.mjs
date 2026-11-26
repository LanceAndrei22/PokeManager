#!/usr/bin/env node
/**
 * Builds the complete 493 Gen 1–4 (#001 Bulbasaur -> #0493 Arceus) Pokédex catalog
 * (`src/data/species.json`) from canonical PokeAPI CSVs + PMDCollab SpriteCollab
 * `tracker.json`, fetches 5 additional Gen 4 item icons, and bundles the core
 * PMD NPC + starter spritesheets/portraits locally under `public/assets/pmd/`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'src', 'data');
const ITEMS_DIR = path.join(ROOT_DIR, 'public', 'assets', 'items');
const PMD_DIR = path.join(ROOT_DIR, 'public', 'assets', 'pmd');

const POKEAPI_CSV_BASE =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const POKEAPI_ITEM_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const SPRITECOLLAB_BASE =
  'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';

const MAX_SPECIES_ID = 493;
const EVOLUTION_STONES = new Set([
  'fire-stone',
  'water-stone',
  'thunder-stone',
  'leaf-stone',
  'moon-stone',
  'sun-stone',
  'shiny-stone',
  'dusk-stone',
  'dawn-stone',
]);
const EXTRA_ITEMS = ['sun-stone', 'shiny-stone', 'dusk-stone', 'dawn-stone', 'cherish-ball'];
const CORE_PMD_IDS = [
  352, // Kecleon (Store Clerk)
  52, 399, 263, // Bargain Browsers: Meowth, Bidoof, Zigzagoon
  40, 113, 143, // Cozy Collectors: Wigglytuff, Chansey, Snorlax
  279, 272, 417, // Trend Fans: Pelipper, Ludicolo, Pachirisu
  53, 430, 448, // Shiny & VIP Seekers: Persian, Honchkrow, Lucario
  133, 79, 54, // Starter Store Mascots: Eevee, Slowpoke, Psyduck
];

const EGG_GROUP_LABELS = {
  monster: 'Monster',
  water1: 'Water 1',
  bug: 'Bug',
  flying: 'Flying',
  ground: 'Field',
  fairy: 'Fairy',
  plant: 'Grass',
  humanshape: 'Human-Like',
  water3: 'Water 3',
  mineral: 'Mineral',
  indeterminate: 'Amorphous',
  water2: 'Water 2',
  ditto: 'Ditto',
  dragon: 'Dragon',
  'no-eggs': 'Undiscovered',
};

const PSEUDO_LINES = new Set([147, 148, 149, 246, 247, 248, 371, 372, 373, 374, 375, 376, 443, 444, 445]);
const STARTER_RANK1_FAVORITES = new Set([
  1, 4, 7, 10, 13, 16, 19, 25, 35, 37, 39, 43, 52, 54, 58, 60, 63, 79,
  133, 152, 155, 158, 175, 179, 183, 194, 252, 255, 258, 280, 287, 300,
  363, 387, 390, 393, 399, 403, 417, 427,
]);

/** Minimal RFC 4180 CSV parser handling quoted commas cleanly. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows;
  return body.map((cols) => Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? ''])));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw lastError;
}

async function mapConcurrent(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return out;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function padId(id) {
  return String(id).padStart(4, '0');
}

function deriveCozyNote(name, tier, types) {
  if (tier === 'mythical') return `Mythical visitor ${name} radiates timeless calm across the counter.`;
  if (tier === 'legendary') return `Legendary ${name} commands awe from every VIP collector in town.`;
  if (tier === 'pseudo') return `Rare ${types[0]}-type powerhouse prized by seasoned trainers.`;
  if (types.includes('water')) return `${name} enjoys cool mist trays and quiet afternoon ripples.`;
  if (types.includes('fire')) return `${name} warms the nearby shelf like a gentle hearth lantern.`;
  if (types.includes('grass')) return `${name} basks near potted herbs and scents the aisle with tea leaves.`;
  if (types.includes('electric')) return `${name} lets out tiny cozy sparks whenever the register bell chimes.`;
  if (types.includes('fairy')) return `${name} charms browsers with plush pastel vibes and lucky tips.`;
  return `${name} settles calmly into straw pens waiting for a kind trainer.`;
}

async function main() {
  console.log('Fetching PokeAPI CSVs & SpriteCollab tracker.json...');
  const [
    speciesCsv,
    namesCsv,
    typesCsv,
    pokemonTypesCsv,
    eggGroupsCsv,
    pokemonEggCsv,
    statsCsv,
    evolutionCsv,
    itemsCsv,
    trackerJson,
  ] = await Promise.all([
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_species.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_species_names.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/types.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_types.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/egg_groups.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_egg_groups.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_stats.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/pokemon_evolution.csv`).then(parseCsv),
    fetchText(`${POKEAPI_CSV_BASE}/items.csv`).then(parseCsv),
    fetchText(`${SPRITECOLLAB_BASE}/tracker.json`).then(JSON.parse),
  ]);

  const englishNames = new Map();
  for (const row of namesCsv) {
    if (row.local_language_id === '9') {
      englishNames.set(Number(row.pokemon_species_id), row.name);
    }
  }

  const typeNames = new Map(typesCsv.map((r) => [Number(r.id), r.identifier]));
  const typesBySpecies = new Map();
  for (const row of pokemonTypesCsv) {
    const pid = Number(row.pokemon_id);
    if (pid < 1 || pid > MAX_SPECIES_ID) continue;
    const tName = typeNames.get(Number(row.type_id));
    if (!tName) continue;
    if (!typesBySpecies.has(pid)) typesBySpecies.set(pid, []);
    typesBySpecies.get(pid).push({ slot: Number(row.slot), type: tName });
  }

  const eggGroupMap = new Map(
    eggGroupsCsv.map((r) => [Number(r.id), EGG_GROUP_LABELS[r.identifier] ?? r.identifier]),
  );
  const eggsBySpecies = new Map();
  for (const row of pokemonEggCsv) {
    const sid = Number(row.species_id);
    if (sid < 1 || sid > MAX_SPECIES_ID) continue;
    const label = eggGroupMap.get(Number(row.egg_group_id));
    if (!label) continue;
    if (!eggsBySpecies.has(sid)) eggsBySpecies.set(sid, []);
    eggsBySpecies.get(sid).push(label);
  }

  const statsBySpecies = new Map();
  for (const row of statsCsv) {
    const pid = Number(row.pokemon_id);
    if (pid < 1 || pid > MAX_SPECIES_ID) continue;
    if (!statsBySpecies.has(pid)) statsBySpecies.set(pid, {});
    statsBySpecies.get(pid)[Number(row.stat_id)] = Number(row.base_stat);
  }

  const itemIdToSlug = new Map(itemsCsv.map((r) => [Number(r.id), r.identifier]));
  const speciesRows = speciesCsv
    .filter((r) => Number(r.id) >= 1 && Number(r.id) <= MAX_SPECIES_ID)
    .sort((a, b) => Number(a.id) - Number(b.id));

  const parentOf = new Map();
  const childrenOf = new Map();
  for (const row of speciesRows) {
    const id = Number(row.id);
    const parentId = row.evolves_from_species_id ? Number(row.evolves_from_species_id) : null;
    if (parentId && parentId <= MAX_SPECIES_ID) {
      parentOf.set(id, parentId);
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId).push(id);
    }
  }

  // Stone evolution map parentId -> { [stoneSlug]: targetId }
  const stoneEvosByParent = new Map();
  for (const row of evolutionCsv) {
    const targetId = Number(row.evolved_species_id);
    if (targetId < 1 || targetId > MAX_SPECIES_ID) continue;
    const parentId = parentOf.get(targetId);
    if (!parentId) continue;
    const itemSlug = row.trigger_item_id ? itemIdToSlug.get(Number(row.trigger_item_id)) : null;
    if (itemSlug && EVOLUTION_STONES.has(itemSlug)) {
      if (!stoneEvosByParent.has(parentId)) stoneEvosByParent.set(parentId, {});
      stoneEvosByParent.get(parentId)[itemSlug] = targetId;
    }
  }
  // Ensure Leafeon (#470) and Umbreon (#197) also support stone evolutions from Eevee (#133)
  if (!stoneEvosByParent.has(133)) stoneEvosByParent.set(133, {});
  stoneEvosByParent.get(133)['leaf-stone'] = 470;
  stoneEvosByParent.get(133)['moon-stone'] = 197;

  const ANIMS_FILTER = ['Walk', 'Idle', 'Sleep', 'Hop'];
  const catalog = speciesRows.map((row) => {
    const id = Number(row.id);
    const paddedId = padId(id);
    const name = englishNames.get(id) ?? row.identifier;
    const isLegendary = row.is_legendary === '1';
    const isMythical = row.is_mythical === '1';
    const isBaby = row.is_baby === '1';
    const types = (typesBySpecies.get(id) ?? [{ slot: 1, type: 'normal' }])
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => entry.type);
    const eggGroups = eggsBySpecies.get(id) ?? ['Undiscovered'];

    const sMap = statsBySpecies.get(id) ?? {};
    const hp = sMap[1] ?? 60;
    const atk = sMap[2] ?? 60;
    const def = sMap[3] ?? 60;
    const spa = sMap[4] ?? 60;
    const spd = sMap[5] ?? 60;
    const spe = sMap[6] ?? 60;
    const bst = hp + atk + def + spa + spd + spe;

    const children = (childrenOf.get(id) ?? []).slice().sort((a, b) => a - b);
    const evolutions = stoneEvosByParent.get(id);
    const stoneTargets = new Set(Object.values(evolutions ?? {}));
    const levelEvolutionId = children.find((c) => !stoneTargets.has(c)) ?? null;

    // Root baby species within #1..#493 (special case: Manaphy #490 breeds Phione #489)
    let rootId = id;
    while (parentOf.has(rootId)) {
      rootId = parentOf.get(rootId);
    }
    const babySpeciesId = id === 490 ? 489 : rootId;
    const canBreed =
      id === 490 || (!isLegendary && !isMythical && !eggGroups.includes('Undiscovered'));

    let rarityTier = 'common';
    if (isMythical) rarityTier = 'mythical';
    else if (isLegendary) rarityTier = 'legendary';
    else if (PSEUDO_LINES.has(id) || bst >= 580) rarityTier = 'pseudo';
    else if (bst >= 480 || (children.length === 0 && bst >= 445)) rarityTier = 'rare';
    else if (bst >= 375 || parentOf.has(id)) rarityTier = 'uncommon';

    let unlockRank = 1;
    if (rarityTier === 'mythical') unlockRank = 10;
    else if (rarityTier === 'legendary') unlockRank = 9;
    else if (rarityTier === 'pseudo') unlockRank = bst >= 580 ? 8 : 7;
    else if (rarityTier === 'rare') unlockRank = bst >= 520 ? 6 : 5;
    else if (rarityTier === 'uncommon') unlockRank = bst >= 420 ? 4 : STARTER_RANK1_FAVORITES.has(id) ? 1 : 2;
    else unlockRank = STARTER_RANK1_FAVORITES.has(id) || id <= 25 ? 1 : 2;

    if (id === 489) unlockRank = 8; // Phione

    let basePrice;
    if (rarityTier === 'mythical') basePrice = Math.round(5200 + (bst - 500) * 8);
    else if (rarityTier === 'legendary') basePrice = Math.round(3600 + (bst - 500) * 6);
    else if (rarityTier === 'pseudo') basePrice = Math.round(1350 + (bst - 300) * 3.2);
    else if (rarityTier === 'rare') basePrice = Math.round(820 + (bst - 350) * 2.5);
    else if (rarityTier === 'uncommon') basePrice = Math.round(520 + Math.max(0, bst - 280) * 1.6);
    else basePrice = Math.round(320 + Math.max(0, bst - 180) * 1.1);

    const happy = Number(row.base_happiness) || 70;
    const cute = clamp(
      Math.round(52 + (isBaby ? 22 : 0) + (happy - 50) * 0.35 + (types.includes('fairy') ? 12 : 0) + (spe - 55) * 0.16),
      35,
      98,
    );
    const comfort = clamp(
      Math.round(54 + (hp - 60) * 0.28 + (spd - 60) * 0.22 + (types.includes('normal') || types.includes('water') ? 8 : 0)),
      35,
      99,
    );
    const rarity = clamp(
      Math.round(
        rarityTier === 'mythical'
          ? 97
          : rarityTier === 'legendary'
            ? 92
            : rarityTier === 'pseudo'
              ? 82
              : 32 + (bst - 220) * 0.14,
      ),
      25,
      99,
    );

    const tEntry = trackerJson[paddedId] ?? {};
    const normalSpriteKeys = Object.keys(tEntry.sprite_files ?? {}).filter((a) => ANIMS_FILTER.includes(a));
    const shinyNode = tEntry.subgroups?.['0000']?.subgroups?.['0001'];
    const shinySpriteKeys = Object.keys(shinyNode?.sprite_files ?? {}).filter((a) => ANIMS_FILTER.includes(a));
    const hasNormalPortrait = Object.prototype.hasOwnProperty.call(tEntry.portrait_files ?? {}, 'Normal');
    const hasShinyPortrait = Object.prototype.hasOwnProperty.call(shinyNode?.portrait_files ?? {}, 'Normal');

    return {
      id,
      paddedId,
      name,
      types,
      eggGroups,
      basePrice,
      baseStats: { cute, comfort, rarity },
      rarityTier,
      unlockRank,
      isLegendary,
      isMythical,
      canBreed,
      babySpeciesId,
      ...(evolutions && Object.keys(evolutions).length > 0 ? { evolutions } : {}),
      ...(levelEvolutionId ? { levelEvolutionId } : {}),
      cozyNote: deriveCozyNote(name, rarityTier, types),
      pmdAnims: {
        normal: normalSpriteKeys,
        shiny: shinySpriteKeys,
        portrait: hasNormalPortrait,
        shinyPortrait: hasShinyPortrait,
      },
    };
  });

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(ITEMS_DIR, { recursive: true });
  await fs.mkdir(PMD_DIR, { recursive: true });

  await fs.writeFile(
    path.join(DATA_DIR, 'species.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote src/data/species.json with ${catalog.length} Gen 1–4 species.`);

  // Fetch 5 additional Gen 4 items if not already present
  await mapConcurrent(EXTRA_ITEMS, 5, async (slug) => {
    const outPath = path.join(ITEMS_DIR, `${slug}.png`);
    const buf = await fetchBuffer(`${POKEAPI_ITEM_BASE}/${slug}.png`);
    await fs.writeFile(outPath, buf);
  });
  console.log(`Verified/fetched ${EXTRA_ITEMS.length} additional item icons.`);

  // Bundle tiny local PMD core set (13 NPCs + 3 starter mascots) for instant offline boot
  const coreManifest = {};
  await mapConcurrent(CORE_PMD_IDS, 4, async (id) => {
    const padded = padId(id);
    const outDir = path.join(PMD_DIR, padded);
    await fs.mkdir(outDir, { recursive: true });

    const [animXml, walkBuf, idleBuf, sleepBuf, portraitBuf] = await Promise.all([
      fetchBuffer(`${SPRITECOLLAB_BASE}/sprite/${padded}/AnimData.xml`),
      fetchBuffer(`${SPRITECOLLAB_BASE}/sprite/${padded}/Walk-Anim.png`),
      fetchBuffer(`${SPRITECOLLAB_BASE}/sprite/${padded}/Idle-Anim.png`),
      fetchBuffer(`${SPRITECOLLAB_BASE}/sprite/${padded}/Sleep-Anim.png`),
      fetchBuffer(`${SPRITECOLLAB_BASE}/portrait/${padded}/Normal.png`),
    ]);

    await Promise.all([
      fs.writeFile(path.join(outDir, 'AnimData.xml'), animXml),
      fs.writeFile(path.join(outDir, 'Walk-Anim.png'), walkBuf),
      fs.writeFile(path.join(outDir, 'Idle-Anim.png'), idleBuf),
      fs.writeFile(path.join(outDir, 'Sleep-Anim.png'), sleepBuf),
      fs.writeFile(path.join(outDir, 'Normal.png'), portraitBuf),
    ]);

    coreManifest[padded] = {
      anims: ['Walk', 'Idle', 'Sleep'],
      portrait: true,
    };
  });

  await fs.writeFile(
    path.join(DATA_DIR, 'pmdCoreManifest.json'),
    `${JSON.stringify(coreManifest, null, 2)}\n`,
    'utf8',
  );
  console.log(`Bundled core PMD assets for ${CORE_PMD_IDS.length} species in public/assets/pmd/.`);
}

main().catch((err) => {
  console.error('build-pokedex failed:', err);
  process.exit(1);
});
