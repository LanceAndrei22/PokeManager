#!/usr/bin/env node
/**
 * Reproducible Pokémon Platinum (Gen 4) sprite & Gen 4 item curation script.
 *
 * Fetches ONLY the curated 45-species (#1–#493) roster and 17 item icons
 * directly into `public/assets/`, validates PNG headers, generates
 * `public/assets/CREDITS.md` and `src/data/assetManifest.json`, and enforces
 * the `< 2 MB` static asset budget without cloning upstream repositories.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_ASSETS_DIR = path.join(ROOT_DIR, 'public', 'assets');
const NORMAL_DIR = path.join(PUBLIC_ASSETS_DIR, 'platinum', 'normal');
const SHINY_DIR = path.join(PUBLIC_ASSETS_DIR, 'platinum', 'shiny');
const ITEMS_DIR = path.join(PUBLIC_ASSETS_DIR, 'items');
const CREDITS_PATH = path.join(PUBLIC_ASSETS_DIR, 'CREDITS.md');
const MANIFEST_PATH = path.join(ROOT_DIR, 'src', 'data', 'assetManifest.json');

const MAX_BUDGET_BYTES = 2 * 1024 * 1024;
const CONCURRENCY_LIMIT = 6;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Curated Gen 1–4 (#1–#493) pet-shop, stone-evolvable, and low-cortisol species. */
const CURATED_SPECIES = [
  { id: 1, name: 'Bulbasaur' },
  { id: 4, name: 'Charmander' },
  { id: 7, name: 'Squirtle' },
  { id: 25, name: 'Pikachu' },
  { id: 26, name: 'Raichu' },
  { id: 37, name: 'Vulpix' },
  { id: 38, name: 'Ninetales' },
  { id: 39, name: 'Jigglypuff' },
  { id: 40, name: 'Wigglytuff' },
  { id: 52, name: 'Meowth' },
  { id: 54, name: 'Psyduck' },
  { id: 58, name: 'Growlithe' },
  { id: 59, name: 'Arcanine' },
  { id: 79, name: 'Slowpoke' },
  { id: 113, name: 'Chansey' },
  { id: 133, name: 'Eevee' },
  { id: 134, name: 'Vaporeon' },
  { id: 135, name: 'Jolteon' },
  { id: 136, name: 'Flareon' },
  { id: 143, name: 'Snorlax' },
  { id: 147, name: 'Dratini' },
  { id: 152, name: 'Chikorita' },
  { id: 155, name: 'Cyndaquil' },
  { id: 158, name: 'Totodile' },
  { id: 175, name: 'Togepi' },
  { id: 179, name: 'Mareep' },
  { id: 194, name: 'Wooper' },
  { id: 195, name: 'Quagsire' },
  { id: 196, name: 'Espeon' },
  { id: 197, name: 'Umbreon' },
  { id: 252, name: 'Treecko' },
  { id: 255, name: 'Torchic' },
  { id: 258, name: 'Mudkip' },
  { id: 287, name: 'Slakoth' },
  { id: 300, name: 'Skitty' },
  { id: 363, name: 'Spheal' },
  { id: 387, name: 'Turtwig' },
  { id: 390, name: 'Chimchar' },
  { id: 393, name: 'Piplup' },
  { id: 399, name: 'Bidoof' },
  { id: 403, name: 'Shinx' },
  { id: 417, name: 'Pachirisu' },
  { id: 446, name: 'Munchlax' },
  { id: 447, name: 'Riolu' },
  { id: 470, name: 'Leafeon' },
];

const CURATED_ITEMS = [
  'lucky-egg',
  'poke-ball',
  'heal-ball',
  'friend-ball',
  'luxury-ball',
  'potion',
  'fresh-water',
  'moomoo-milk',
  'oran-berry',
  'sitrus-berry',
  'rare-candy',
  'fire-stone',
  'water-stone',
  'thunder-stone',
  'leaf-stone',
  'moon-stone',
];

const POKEAPI_PLATINUM_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/platinum';
const POKEAPI_ITEM_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const POKESPRITE_EGG_URL =
  'https://raw.githubusercontent.com/msikma/pokesprite/master/items/other/egg.png';

/**
 * Checks whether a buffer begins with the 8-byte PNG signature.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isValidPng(buffer) {
  return buffer.length >= PNG_MAGIC.length && buffer.subarray(0, 8).equals(PNG_MAGIC);
}

/**
 * Downloads a binary file with retries and validates that it is a valid PNG.
 * @param {string} url
 * @param {number} [attempts=3]
 * @returns {Promise<Buffer>}
 */
async function fetchPngWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (!isValidPng(buffer)) {
        throw new Error(`Invalid PNG signature returned from ${url}`);
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Runs async tasks with a fixed concurrency pool so upstream GitHub raw fetches remain polite.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/**
 * Recursively computes total bytes inside a directory.
 * @param {string} dirPath
 * @returns {Promise<number>}
 */
async function getDirectoryBytes(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectoryBytes(fullPath);
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      total += stats.size;
    }
  }
  return total;
}

async function main() {
  await fs.mkdir(NORMAL_DIR, { recursive: true });
  await fs.mkdir(SHINY_DIR, { recursive: true });
  await fs.mkdir(ITEMS_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  console.log(`Fetching ${CURATED_SPECIES.length} Pokémon Platinum Normal & Shiny sprites...`);

  const speciesManifest = await mapConcurrent(CURATED_SPECIES, CONCURRENCY_LIMIT, async (species) => {
    const normalUrl = `${POKEAPI_PLATINUM_BASE}/${species.id}.png`;
    const shinyUrl = `${POKEAPI_PLATINUM_BASE}/shiny/${species.id}.png`;

    const [normalBuffer, shinyBuffer] = await Promise.all([
      fetchPngWithRetry(normalUrl),
      fetchPngWithRetry(shinyUrl),
    ]);

    const normalFile = path.join(NORMAL_DIR, `${species.id}.png`);
    const shinyFile = path.join(SHINY_DIR, `${species.id}.png`);
    await Promise.all([fs.writeFile(normalFile, normalBuffer), fs.writeFile(shinyFile, shinyBuffer)]);

    return {
      id: species.id,
      name: species.name,
      normal: `./assets/platinum/normal/${species.id}.png`,
      shiny: `./assets/platinum/shiny/${species.id}.png`,
      normalBytes: normalBuffer.length,
      shinyBytes: shinyBuffer.length,
    };
  });

  console.log(`Fetching ${CURATED_ITEMS.length} PokéAPI item icons + cozy Egg icon...`);

  const itemEntries = await mapConcurrent(CURATED_ITEMS, CONCURRENCY_LIMIT, async (slug) => {
    const url = `${POKEAPI_ITEM_BASE}/${slug}.png`;
    const buffer = await fetchPngWithRetry(url);
    const outFile = path.join(ITEMS_DIR, `${slug}.png`);
    await fs.writeFile(outFile, buffer);
    return {
      slug,
      path: `./assets/items/${slug}.png`,
      bytes: buffer.length,
      source: 'PokeAPI/sprites',
    };
  });

  // Dedicated Pokémon Egg icon via msikma/pokesprite, falling back to PokeAPI lucky-egg if unreachable.
  let eggBuffer;
  let eggSource = 'msikma/pokesprite';
  try {
    eggBuffer = await fetchPngWithRetry(POKESPRITE_EGG_URL, 2);
  } catch {
    eggBuffer = await fs.readFile(path.join(ITEMS_DIR, 'lucky-egg.png'));
    eggSource = 'PokeAPI/sprites (lucky-egg fallback)';
  }
  await fs.writeFile(path.join(ITEMS_DIR, 'egg.png'), eggBuffer);
  itemEntries.push({
    slug: 'egg',
    path: './assets/items/egg.png',
    bytes: eggBuffer.length,
    source: eggSource,
  });

  const itemMap = Object.fromEntries(
    itemEntries.map((entry) => [
      entry.slug,
      { path: entry.path, bytes: entry.bytes, source: entry.source },
    ]),
  );

  const creditsContent = `# Asset Credits & Fan-Project Notice

> **Non-Commercial Entertainment Notice:**
> **PokéMart: Low Cortisol Shift** is a simple, completely free fan project made purely for entertainment purposes only. Pokémon, character names, items, and all original sprite artwork are trademarks and copyrights of **Nintendo, Creatures Inc., and Game Freak**.

## Curated Sprite Sources

1. **Pokémon Platinum (Gen 4, 80×80 Normal & Shiny Sprites)**
   - **Species Range:** Gen 1–4 (\`#1–#493\`), curated ${CURATED_SPECIES.length}-species pet-shop & cozy roster
   - **Source Repository:** [PokeAPI/sprites](https://github.com/PokeAPI/sprites)
   - **Paths:** \`sprites/pokemon/versions/generation-iv/platinum/{id}.png\` and \`.../shiny/{id}.png\`

2. **Item Icons**
   - **Source Repository:** [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (\`sprites/items/{slug}.png\`)
   - **Egg Icon Source:** [msikma/pokesprite](https://github.com/msikma/pokesprite) (\`items/other/egg.png\`, or \`lucky-egg\` fallback) — currently resolved via **${eggSource}**.
`;
  await fs.writeFile(CREDITS_PATH, creditsContent, 'utf8');

  const totalAssetBytes = await getDirectoryBytes(PUBLIC_ASSETS_DIR);
  const totalKB = (totalAssetBytes / 1024).toFixed(1);
  const totalMB = (totalAssetBytes / (1024 * 1024)).toFixed(3);

  const manifest = {
    generatedAt: new Date().toISOString(),
    spriteSet: 'pokemon-platinum-gen4-80x80',
    speciesCount: speciesManifest.length,
    itemCount: itemEntries.length,
    totalBytes: totalAssetBytes,
    totalKB: Number(totalKB),
    species: Object.fromEntries(speciesManifest.map((entry) => [String(entry.id), entry])),
    items: itemMap,
  };
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (totalAssetBytes > MAX_BUDGET_BYTES) {
    throw new Error(
      `Bundled asset size (${totalMB} MB) exceeded the 2.00 MB limit (${MAX_BUDGET_BYTES} bytes).`,
    );
  }

  console.log(
    `Done! Curated ${speciesManifest.length} species (normal + shiny) and ${itemEntries.length} items.`,
  );
  console.log(`Total public/assets size: ${totalKB} KB (${totalMB} MB) — under 2 MB budget.`);
}

main().catch((error) => {
  console.error('Asset fetch failed:', error);
  process.exit(1);
});
