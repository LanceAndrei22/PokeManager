#!/usr/bin/env node
/**
 * Fetches & decodes authentic Pokémon pixel-art assets locally under `public/assets/`:
 * 1. 16 pret/pokeemerald Human Overworld NPC spritesheets (stripped palette-index-0 alpha,
 *    normalized into 64x128 4-dir walk sheets: down / up / left / right).
 * 2. 16 Gen 4/5 Pixel Trainer Portraits from Pokemon Showdown.
 * 3. Authentic pret/pokeemerald decoded outdoor (OldaleTown / general / petalburg) &
 *    indoor (Mart / PokemonCenter_1F / door_anims) tiles + cohesive GBA-palette Pet Shop
 *    furniture sprites.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OVERWORLD_DIR = path.join(ROOT_DIR, 'public', 'assets', 'npcs', 'overworld');
const PORTRAITS_DIR = path.join(ROOT_DIR, 'public', 'assets', 'npcs', 'portraits');
const OUTDOOR_DIR = path.join(ROOT_DIR, 'public', 'assets', 'tiles', 'outdoor');
const INDOOR_DIR = path.join(ROOT_DIR, 'public', 'assets', 'tiles', 'indoor');

const EMERALD_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/master';
const SHOWDOWN_PORTRAITS_BASE = 'https://play.pokemonshowdown.com/sprites/trainers';

const HUMAN_OVERWORLD_SLUGS = [
  'mart_employee',
  'camper',
  'hiker',
  'woman_2',
  'man_3',
  'youngster',
  'lass',
  'school_kid_m',
  'picnicker',
  'woman_1',
  'pokefan_f',
  'beauty',
  'artist',
  'gentleman',
  'rich_boy',
  'steven',
];

const TRAINER_PORTRAITS = [
  'clerk.png',
  'camper.png',
  'hiker-gen4.png',
  'pokemonbreederf-gen4.png',
  'pokemonbreeder-gen4.png',
  'youngster-gen4.png',
  'lass-gen4.png',
  'schoolkid-gen4.png',
  'picnicker.png',
  'lady-gen4.png',
  'pokefanf-gen4.png',
  'beauty-gen4dp.png',
  'artist-gen4.png',
  'gentleman-gen4.png',
  'richboy-gen4.png',
  'steven.png',
];

async function fetchBuffer(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw lastErr;
}

/** Pure-Node PNG decoder supporting 4bpp/8bpp indexed (`PLTE`+`tRNS`) and RGBA PNGs. */
function decodePng(buf) {
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let plte = null;
  let trns = null;
  const idats = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') {
      plte = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = Math.ceil((width * (colorType === 3 ? bitDepth : bpp * 8)) / 8);
  const indices = Buffer.alloc(width * height);
  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  const filterBpp = colorType === 3 ? 1 : bpp;

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const f = raw[pos++];
    const row = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    for (let i = 0; i < stride; i += 1) {
      const l = i >= filterBpp ? row[i - filterBpp] : 0;
      const u = prev[i];
      const ul = i >= filterBpp ? prev[i - filterBpp] : 0;
      if (f === 1) row[i] = (row[i] + l) & 0xff;
      else if (f === 2) row[i] = (row[i] + u) & 0xff;
      else if (f === 3) row[i] = (row[i] + ((l + u) >> 1)) & 0xff;
      else if (f === 4) row[i] = (row[i] + paeth(l, u, ul)) & 0xff;
    }
    row.copy(prev);

    for (let x = 0; x < width; x += 1) {
      const dst = (y * width + x) * 4;
      if (colorType === 3) {
        const ci = bitDepth === 4 ? ((x & 1) === 0 ? (row[x >> 1] >> 4) & 0x0f : row[x >> 1] & 0x0f) : row[x];
        indices[y * width + x] = ci;
        rgba[dst] = plte ? plte[ci * 3] : 0;
        rgba[dst + 1] = plte ? plte[ci * 3 + 1] : 0;
        rgba[dst + 2] = plte ? plte[ci * 3 + 2] : 0;
        const alpha = trns && ci < trns.length ? trns[ci] : ci === 0 ? 0 : 255;
        rgba[dst + 3] = ci === 0 ? 0 : alpha;
      } else if (colorType === 6) {
        rgba[dst] = row[x * 4];
        rgba[dst + 1] = row[x * 4 + 1];
        rgba[dst + 2] = row[x * 4 + 2];
        rgba[dst + 3] = row[x * 4 + 3];
      } else if (colorType === 2) {
        rgba[dst] = row[x * 3];
        rgba[dst + 1] = row[x * 3 + 1];
        rgba[dst + 2] = row[x * 3 + 2];
        rgba[dst + 3] = 255;
      }
    }
  }

  return { width, height, plte, indices, rgba };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodeRgbaPng(width, height, rgba) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Converts a pret/pokeemerald 144x32 overworld sheet (9 frames of 16x32) into a
 * crisp transparent 64x128 (4 cols x 4 rows) walk cycle spritesheet:
 * Row 0 = Down, Row 1 = Up, Row 2 = Left, Row 3 = Right (mirrored Left).
 */
function buildNormalizedOverworldSheet(pngBuf) {
  const decoded = decodePng(pngBuf);
  const frameW = Math.floor(decoded.width / 9);
  const frameH = decoded.height;
  const outW = frameW * 4;
  const outH = frameH * 4;
  const out = Buffer.alloc(outW * outH * 4);

  const blitFrame = (srcIndex, dstCol, dstRow, flipX) => {
    const sx0 = srcIndex * frameW;
    const dx0 = dstCol * frameW;
    const dy0 = dstRow * frameH;
    for (let y = 0; y < frameH; y += 1) {
      for (let x = 0; x < frameW; x += 1) {
        const sx = sx0 + (flipX ? frameW - 1 - x : x);
        const si = (y * decoded.width + sx) * 4;
        const di = ((dy0 + y) * outW + (dx0 + x)) * 4;
        out[di] = decoded.rgba[si];
        out[di + 1] = decoded.rgba[si + 1];
        out[di + 2] = decoded.rgba[si + 2];
        out[di + 3] = decoded.indices[y * decoded.width + sx] === 0 ? 0 : decoded.rgba[si + 3];
      }
    }
  };

  // Standard Emerald 9-frame order: [0:S, 1:N, 2:W, 3:S1, 4:S2, 5:N1, 6:N2, 7:W1, 8:W2]
  const cycles = [
    [0, 3, 0, 4], // Row 0: Down
    [1, 5, 1, 6], // Row 1: Up
    [2, 7, 2, 8], // Row 2: Left
  ];
  cycles.forEach((cols, row) => {
    cols.forEach((srcIdx, col) => blitFrame(srcIdx, col, row, false));
  });
  cycles[2].forEach((srcIdx, col) => blitFrame(srcIdx, col, 3, true)); // Row 3: Right

  return encodeRgbaPng(outW, outH, out);
}

function parsePal(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(3, 19)
    .map((line) => line.trim().split(/\s+/).map(Number));
}

function drawMetatileToBuffer(
  rgba,
  imgW,
  dx0,
  dy0,
  metatileId,
  primTiles,
  primMeta,
  primPals,
  secTiles,
  secMeta,
  secPals,
  options = {},
) {
  const buf = metatileId < 512 ? primMeta : secMeta;
  const idx = metatileId < 512 ? metatileId : metatileId - 512;
  const off = idx * 16;
  if (off + 16 > buf.length) return;

  const { topOnly = false, cutGroundSubtiles = false } = options;

  for (let layer = topOnly ? 1 : 0; layer < 2; layer += 1) {
    for (let q = 0; q < 4; q += 1) {
      const entry = buf.readUInt16LE(off + layer * 8 + q * 2);
      const tileIdx = entry & 0x3ff;
      const xFlip = (entry >> 10) & 1;
      const yFlip = (entry >> 11) & 1;
      const palIdx = (entry >> 12) & 0x0f;
      // In Emerald general tileset, tileIdx 0..7 are bare grass filler behind buildings/trees
      if (layer === 0 && cutGroundSubtiles && tileIdx <= 7) continue;

      const sp = tileIdx < 512 ? primTiles : secTiles;
      const localIdx = tileIdx < 512 ? tileIdx : tileIdx - 512;
      const tpr = sp.width >> 3;
      const tx = (localIdx % tpr) * 8;
      const ty = Math.floor(localIdx / tpr) * 8;
      const pal = palIdx < 6 ? primPals[palIdx] : (secPals[palIdx] || primPals[0]);

      const sxBase = dx0 + (q & 1) * 8;
      const syBase = dy0 + (q >> 1) * 8;
      for (let py = 0; py < 8; py += 1) {
        const sy = yFlip ? 7 - py : py;
        for (let px = 0; px < 8; px += 1) {
          const sx = xFlip ? 7 - px : px;
          const ci = sp.indices[(ty + sy) * sp.width + (tx + sx)];
          if (layer === 1 && ci === 0) continue;
          const [r, g, b] = pal[ci] || [0, 0, 0];
          const o = ((syBase + py) * imgW + (sxBase + px)) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
      }
    }
  }
}

function renderMetatileGrid(cols, rows, ids, sets, options = {}) {
  const w = cols * 16;
  const h = rows * 16;
  const rgba = Buffer.alloc(w * h * 4);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const id = ids[r * cols + c];
      if (id === null || id === undefined) continue;
      drawMetatileToBuffer(
        rgba,
        w,
        c * 16,
        r * 16,
        id,
        sets.primTiles,
        sets.primMeta,
        sets.primPals,
        sets.secTiles,
        sets.secMeta,
        sets.secPals,
        options,
      );
    }
  }
  return encodeRgbaPng(w, h, rgba);
}

function collectRgbSet(rgba) {
  const set = new Set();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 0) {
      set.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
    }
  }
  return set;
}

function cropPng(pngBuf, x0, y0, cw, ch) {
  const { width: w, rgba } = decodePng(pngBuf);
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y += 1) {
    const si = ((y0 + y) * w + x0) * 4;
    rgba.copy(out, y * cw * 4, si, si + cw * 4);
  }
  return encodeRgbaPng(cw, ch, out);
}

/**
 * Flood-fills contiguous background pixels matching `bgRgbSet` inward from all 4 outer
 * edges and sets their alpha to 0, leaving interior pixels (even matching greens inside
 * tree canopies) completely untouched.
 */
function stripEdgeBackground(pngBuf, bgRgbSet) {
  const { width: w, height: h, rgba } = decodePng(pngBuf);
  const visited = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const o = idx * 4;
    if (rgba[o + 3] === 0) {
      visited[idx] = 1;
      queue.push(idx);
      return;
    }
    if (bgRgbSet.has(`${rgba[o]},${rgba[o + 1]},${rgba[o + 2]}`)) {
      visited[idx] = 1;
      rgba[o + 3] = 0;
      queue.push(idx);
    }
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return encodeRgbaPng(w, h, rgba);
}

/** Horizontally mirrors one 16x16 metatile inside an RGBA buffer (useful for clean symmetrical roofs). */
function mirrorSubGridTile(pngBuf, srcTileX, dstTileX, tileY) {
  const { width: w, height: h, rgba } = decodePng(pngBuf);
  for (let py = 0; py < 16; py += 1) {
    for (let px = 0; px < 16; px += 1) {
      const si = ((tileY * 16 + py) * w + (srcTileX * 16 + (15 - px))) * 4;
      const di = ((tileY * 16 + py) * w + (dstTileX * 16 + px)) * 4;
      rgba[di] = rgba[si];
      rgba[di + 1] = rgba[si + 1];
      rgba[di + 2] = rgba[si + 2];
      rgba[di + 3] = rgba[si + 3];
    }
  }
  return encodeRgbaPng(w, h, rgba);
}

/** Paints crisp pixel-art sprite strings into an RGBA PNG buffer. */
function renderPixelSprite(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const line = rows[y];
    for (let x = 0; x < w; x += 1) {
      const col = palette[line[x]];
      if (!col) continue;
      const o = (y * w + x) * 4;
      rgba[o] = col[0];
      rgba[o + 1] = col[1];
      rgba[o + 2] = col[2];
      rgba[o + 3] = col[3] ?? 255;
    }
  }
  return encodeRgbaPng(w, h, rgba);
}

/** Generates cohesive GBA/DS-palette custom Pet Shop furniture sprites. */
async function generateCustomShopProps() {
  // 1. Pen Grass Tile (16x16 textured lush pen habitat turf)
  const penGrassPalette = {
    a: [152, 212, 112],
    b: [136, 198, 98],
    c: [176, 226, 130],
    d: [110, 174, 78],
  };
  const penGrass = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const h = (x * 17 + y * 31) % 19;
      if (h === 2) return 'c';
      if (h === 7 || h === 13) return 'd';
      return (x + y) % 3 === 0 ? 'b' : 'a';
    }).join(''),
  );
  await fs.writeFile(path.join(INDOOR_DIR, 'pen-grass.png'), renderPixelSprite(penGrass, penGrassPalette));

  // 2. Pen Fence Tile (16x16 shaded timber rail with emerald/mart outline palette)
  const fencePal = {
    k: [40, 48, 56],
    d: [120, 82, 46],
    m: [172, 120, 68],
    l: [216, 168, 108],
  };
  const fenceRows = [
    '..kkk......kkk..',
    '.klllk....klllk.',
    '.kmmmk....kmmmk.',
    'kkkkkkkkkkkkkkkk',
    'kllllllllllllllk',
    'kmmmmmmmmmmmmmmk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '.kmmmk....kmmmk.',
    'kkkkkkkkkkkkkkkk',
    'kllllllllllllllk',
    'kmmmmmmmmmmmmmmk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '.kdddk....kdddk.',
    '..kkk......kkk..',
  ];
  await fs.writeFile(path.join(INDOOR_DIR, 'pen-fence.png'), renderPixelSprite(fenceRows, fencePal));

  // 3. Healing Corner Rug (16x16 soft pastel sage woven tile)
  const rugPal = {
    a: [204, 232, 196],
    b: [186, 220, 180],
    c: [222, 244, 214],
  };
  const rugRows = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) =>
      x % 4 === 0 && y % 4 === 0 ? 'c' : (x + y) % 2 === 0 ? 'a' : 'b',
    ).join(''),
  );
  await fs.writeFile(path.join(INDOOR_DIR, 'healing-rug.png'), renderPixelSprite(rugRows, rugPal));

  // 4. Healing Pet Bed (48x32 cushioned berry & cream Poké Ball pet bed)
  const bedPal = {
    k: [40, 48, 56],
    r: [222, 92, 114],
    d: [172, 58, 78],
    l: [248, 168, 180],
    w: [252, 246, 236],
    c: [232, 218, 198],
    y: [244, 198, 92],
  };
  const bedRows = [];
  for (let y = 0; y < 32; y += 1) {
    let row = '';
    for (let x = 0; x < 48; x += 1) {
      if (y === 0 || y === 31 || x === 0 || x === 47) {
        row += y >= 2 && y <= 29 && x >= 2 && x <= 45 ? '.' : (x >= 2 && x <= 45 && (y === 1 || y === 30) ? 'k' : '.');
        continue;
      }
      if (y <= 2 || y >= 29 || x <= 2 || x >= 45) {
        row += 'k';
      } else if (y <= 5 || x <= 5 || x >= 42) {
        row += y <= 5 ? 'l' : 'd';
      } else if (y >= 6 && y <= 13 && x >= 8 && x <= 39) {
        row += y === 6 || y === 13 ? 'c' : 'w';
      } else if (y >= 20 && y <= 22) {
        row += 'y';
      } else if (y >= 15 && y <= 26) {
        row += y < 20 ? 'r' : 'l';
      } else {
        row += 'r';
      }
    }
    bedRows.push(row);
  }
  await fs.writeFile(path.join(INDOOR_DIR, 'healing-bed.png'), renderPixelSprite(bedRows, bedPal));

  // 5. Glowing Glass Egg Incubator Pod (32x36 sci-fi-cozy dome over warm brass base)
  const incPal = {
    k: [40, 48, 56],
    g: [132, 224, 248],
    h: [212, 248, 255],
    b: [76, 152, 216],
    s: [198, 214, 232],
    d: [110, 128, 156],
    y: [255, 216, 77],
    o: [224, 152, 32],
  };
  const incRows = [];
  for (let y = 0; y < 36; y += 1) {
    let row = '';
    for (let x = 0; x < 32; x += 1) {
      if (y < 4) {
        const capW = y === 0 ? 8 : y === 1 ? 14 : 18;
        const left = 16 - capW / 2;
        if (x < left || x >= left + capW) row += '.';
        else if (x === left || x === left + capW - 1 || y === 0) row += 'k';
        else row += 'y';
      } else if (y < 24) {
        if (x < 4 || x >= 28) row += '.';
        else if (x === 4 || x === 27) row += 'k';
        else if (x <= 7 || y === 6) row += 'h';
        else if (x >= 24) row += 'b';
        else row += 'g';
      } else {
        if (x < 2 || x >= 30) row += '.';
        else if (x === 2 || x === 29 || y === 24 || y === 35) row += 'k';
        else if (y === 27 || y === 28) row += x % 4 === 0 ? 'y' : 'o';
        else if (y < 32) row += 's';
        else row += 'd';
      }
    }
    incRows.push(row);
  }
  await fs.writeFile(path.join(INDOOR_DIR, 'incubator-pod.png'), renderPixelSprite(incRows, incPal));

  // 6. Upgrades Bulletin Board (48x36 framed mahogany corkboard with pinned shop notes)
  const brdPal = {
    k: [40, 48, 56],
    f: [138, 86, 46],
    h: [184, 122, 68],
    c: [196, 154, 102],
    d: [164, 122, 74],
    p: [252, 244, 212],
    b: [168, 224, 255],
    r: [224, 72, 72],
    y: [255, 216, 77],
  };
  const brdRows = [];
  for (let y = 0; y < 36; y += 1) {
    let row = '';
    for (let x = 0; x < 48; x += 1) {
      if (y === 0 || y === 35 || x === 0 || x === 47) {
        row += 'k';
      } else if (y <= 3 || y >= 32 || x <= 3 || x >= 44) {
        row += y <= 2 || x <= 2 ? 'h' : 'f';
      } else if (y >= 7 && y <= 20 && x >= 7 && x <= 19) {
        row += y === 8 && x === 13 ? 'r' : 'p';
      } else if (y >= 9 && y <= 24 && x >= 23 && x <= 39) {
        row += y === 10 && x === 31 ? 'y' : 'b';
      } else {
        row += (x + y) % 5 === 0 ? 'd' : 'c';
      }
    }
    brdRows.push(row);
  }
  await fs.writeFile(path.join(INDOOR_DIR, 'upgrades-board.png'), renderPixelSprite(brdRows, brdPal));
}

async function main() {
  await Promise.all([
    fs.mkdir(OVERWORLD_DIR, { recursive: true }),
    fs.mkdir(PORTRAITS_DIR, { recursive: true }),
    fs.mkdir(OUTDOOR_DIR, { recursive: true }),
    fs.mkdir(INDOOR_DIR, { recursive: true }),
  ]);

  console.log('1/4 Fetching & normalizing 16 pret/pokeemerald Human Overworld NPCs...');
  await Promise.all(
    HUMAN_OVERWORLD_SLUGS.map(async (slug) => {
      const buf = await fetchBuffer(`${EMERALD_BASE}/graphics/object_events/pics/people/${slug}.png`);
      const norm = buildNormalizedOverworldSheet(buf);
      await fs.writeFile(path.join(OVERWORLD_DIR, `${slug}.png`), norm);
    }),
  );

  console.log('2/4 Fetching 16 pixel Trainer Portraits...');
  await Promise.all(
    TRAINER_PORTRAITS.map(async (file) => {
      const buf = await fetchBuffer(`${SHOWDOWN_PORTRAITS_BASE}/${file}`);
      await fs.writeFile(path.join(PORTRAITS_DIR, file), buf);
    }),
  );

  console.log('3/4 Decoding pret/pokeemerald Outdoor & Indoor tilesets...');
  const loadSet = async (kind, name) => {
    const [tiles, meta, ...pals] = await Promise.all([
      fetchBuffer(`${EMERALD_BASE}/data/tilesets/${kind}/${name}/tiles.png`).then(decodePng),
      fetchBuffer(`${EMERALD_BASE}/data/tilesets/${kind}/${name}/metatiles.bin`),
      ...Array.from({ length: 13 }, (_, i) =>
        fetchBuffer(
          `${EMERALD_BASE}/data/tilesets/${kind}/${name}/palettes/${String(i).padStart(2, '0')}.pal`,
        ).then((b) => parsePal(b.toString('utf8'))),
      ),
    ]);
    return { tiles, meta, pals };
  };

  const [general, petalburg, building, shop, center, doorBuf] = await Promise.all([
    loadSet('primary', 'general'),
    loadSet('secondary', 'petalburg'),
    loadSet('primary', 'building'),
    loadSet('secondary', 'shop'),
    loadSet('secondary', 'pokemon_center'),
    fetchBuffer(`${EMERALD_BASE}/graphics/door_anims/poke_mart.png`),
  ]);

  const outdoorSets = {
    primTiles: general.tiles,
    primMeta: general.meta,
    primPals: general.pals,
    secTiles: petalburg.tiles,
    secMeta: petalburg.meta,
    secPals: petalburg.pals,
  };

  const grassBuf = renderMetatileGrid(1, 1, [0x001], outdoorSets);
  const grassRgb = collectRgbSet(decodePng(grassBuf).rgba);

  const treeRaw = renderMetatileGrid(
    2,
    2,
    [0x1d4, 0x1d5, 0x1dc, 0x1dd],
    outdoorSets,
  );
  const martRaw = renderMetatileGrid(
    4,
    4,
    [
      0x028, 0x029, 0x029, 0x028,
      0x030, 0x031, 0x032, 0x033,
      0x038, 0x039, 0x03a, 0x03b,
      0x060, 0x041, 0x042, 0x043,
    ],
    outdoorSets,
  );
  // Mirror top-left roof corner onto top-right corner so roof has zero overlapping background tree
  const martSym = mirrorSubGridTile(martRaw, 0, 3, 0);

  // Outdoor tiles from pret/pokeemerald general + petalburg
  await Promise.all([
    fs.writeFile(path.join(OUTDOOR_DIR, 'grass.png'), grassBuf),
    fs.writeFile(
      path.join(OUTDOOR_DIR, 'flowers.png'),
      renderMetatileGrid(1, 1, [0x004], outdoorSets, { topOnly: true }),
    ),
    fs.writeFile(
      path.join(OUTDOOR_DIR, 'grass-tuft.png'),
      renderMetatileGrid(1, 1, [0x015], outdoorSets),
    ),
    fs.writeFile(path.join(OUTDOOR_DIR, 'path.png'), renderMetatileGrid(1, 1, [0x1d9], outdoorSets)),
    fs.writeFile(path.join(OUTDOOR_DIR, 'water.png'), renderMetatileGrid(1, 1, [0x0b9], outdoorSets)),
    fs.writeFile(
      path.join(OUTDOOR_DIR, 'fence.png'),
      renderMetatileGrid(1, 1, [0x149], outdoorSets, { topOnly: true }),
    ),
    fs.writeFile(
      path.join(OUTDOOR_DIR, 'signpost.png'),
      renderMetatileGrid(1, 1, [0x01b], outdoorSets, { topOnly: true }),
    ),
    fs.writeFile(path.join(OUTDOOR_DIR, 'tree.png'), stripEdgeBackground(treeRaw, grassRgb)),
    fs.writeFile(
      path.join(OUTDOOR_DIR, 'pokemart-building.png'),
      stripEdgeBackground(martSym, grassRgb),
    ),
  ]);

  const shopSets = {
    primTiles: building.tiles,
    primMeta: building.meta,
    primPals: building.pals,
    secTiles: shop.tiles,
    secMeta: shop.meta,
    secPals: shop.pals,
  };
  const centerSets = {
    primTiles: building.tiles,
    primMeta: building.meta,
    primPals: building.pals,
    secTiles: center.tiles,
    secMeta: center.meta,
    secPals: center.pals,
  };

  // Compose 32x32 closed & open double sliding doors from graphics/door_anims/poke_mart.png (16x96)
  const doorDecoded = decodePng(doorBuf);
  const composeDoubleDoor = (frameIdx) => {
    const out = Buffer.alloc(32 * 32 * 4);
    const fy0 = frameIdx * 32;
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const si = ((fy0 + y) * 16 + x) * 4;
        const dLeft = (y * 32 + x) * 4;
        const dRight = (y * 32 + (31 - x)) * 4;
        for (let k = 0; k < 4; k += 1) {
          out[dLeft + k] = doorDecoded.rgba[si + k];
          out[dRight + k] = doorDecoded.rgba[si + k];
        }
      }
    }
    return encodeRgbaPng(32, 32, out);
  };

  const martFloorBuf = renderMetatileGrid(1, 1, [0x201], shopSets);
  const martFloorRgb = collectRgbSet(decodePng(martFloorBuf).rgba);
  const centerFloorBuf = renderMetatileGrid(1, 1, [0x202], centerSets);
  const centerFloorRgb = collectRgbSet(decodePng(centerFloorBuf).rgba);

  await Promise.all([
    fs.writeFile(path.join(INDOOR_DIR, 'floor-tile.png'), martFloorBuf),
    fs.writeFile(
      path.join(INDOOR_DIR, 'wall-tile.png'),
      renderMetatileGrid(1, 2, [0x213, 0x21b], shopSets),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'clock-wall.png'),
      renderMetatileGrid(1, 1, [0x222], shopSets),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'counter-left.png'),
      cropPng(renderMetatileGrid(1, 2, [0x318, 0x320], shopSets), 0, 12, 16, 20),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'counter-mid.png'),
      cropPng(renderMetatileGrid(1, 2, [0x318, 0x320], shopSets), 0, 12, 16, 20),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'counter-right.png'),
      cropPng(renderMetatileGrid(1, 2, [0x22a, 0x232], shopSets), 0, 4, 16, 28),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'shelf-blue.png'),
      stripEdgeBackground(
        cropPng(
          renderMetatileGrid(2, 3, [0x223, 0x224, 0x228, 0x229, 0x230, 0x231], shopSets),
          0,
          12,
          32,
          32,
        ),
        martFloorRgb,
      ),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'plant-pot.png'),
      stripEdgeBackground(renderMetatileGrid(1, 2, [0x225, 0x22d], shopSets), martFloorRgb),
    ),
    fs.writeFile(
      path.join(INDOOR_DIR, 'mat.png'),
      renderMetatileGrid(2, 1, [0x216, 0x217], shopSets),
    ),
    fs.writeFile(path.join(INDOOR_DIR, 'door-closed.png'), composeDoubleDoor(0)),
    fs.writeFile(path.join(INDOOR_DIR, 'door-open.png'), composeDoubleDoor(2)),
    fs.writeFile(
      path.join(INDOOR_DIR, 'pc-terminal.png'),
      stripEdgeBackground(
        cropPng(renderMetatileGrid(1, 2, [0x004, 0x224], centerSets), 0, 0, 16, 24),
        centerFloorRgb,
      ),
    ),
  ]);

  console.log('4/4 Generating cohesive GBA/DS-palette Pet Shop furniture sprites...');
  await generateCustomShopProps();

  console.log('Done! Bundled 16 Human Overworlds, 16 Portraits, and all Outdoor/Indoor tilesets.');
}

main().catch((err) => {
  console.error('fetch-world-assets failed:', err);
  process.exit(1);
});
