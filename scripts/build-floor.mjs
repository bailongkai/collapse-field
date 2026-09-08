// Composes public/assets/tiles/floor_<stage>.png (grid x grid tiles) for every stage in manifest.floors.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';
import { resolveFile } from './build-atlas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'asset-manifest.json'), 'utf8'));
const outDir = join(ROOT, 'public', 'assets', 'tiles');
mkdirSync(outDir, { recursive: true });

for (const [stage, { pack, tiles, tileSize, grid }] of Object.entries(manifest.floors)) {
  const canvas = new Jimp({ width: tileSize * grid, height: tileSize * grid, color: 0x000000ff });
  const images = [];
  for (const t of tiles) {
    const img = await Jimp.read(resolveFile(pack, t));
    if (img.width !== tileSize || img.height !== tileSize) img.resize({ w: tileSize, h: tileSize });
    images.push(img);
  }
  // deterministic pseudo-random layout so the composed texture does not read as a checkerboard;
  // the first tile is the common one and the rest are accents
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
    const r = rnd();
    const img = images.length === 1 ? images[0] : images[r < 0.7 ? 0 : r < 0.85 ? 1 : r < 0.95 ? 2 : images.length - 1];
    canvas.composite(img, gx * tileSize, gy * tileSize);
  }
  await canvas.write(join(outDir, `floor_${stage}.png`));
  console.log(`floor_${stage}.png ${canvas.width}x${canvas.height} from ${tiles.length} tile(s)`);
}
