// Composes public/assets/tiles/floor_<stage>.png (grid x grid tiles) for every stage in manifest.floors.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';
import { resolveFile } from './build-atlas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'asset-manifest.json'), 'utf8'));
const outDir = join(ROOT, 'public', 'assets', 'tiles');
mkdirSync(outDir, { recursive: true });

for (const [stage, { pack, tiles, tileSize, grid }] of Object.entries(manifest.floors)) {
  // a generated seamless texture replaces the composed Kenney tiles
  const custom = join(ROOT, 'art', 'generated', `floor_${stage}.png`);
  if (existsSync(custom)) {
    // A diffusion model does not make seamless tiles: it frames the texture with a bevel. Cut
    // that margin off and mirror the middle into a 2x2, which wraps perfectly by construction
    // and, at floor contrast, reads as panel seams rather than a kaleidoscope.
    const src = await Jimp.read(custom);
    const m = Math.round(src.width * 0.1);
    src.crop({ x: m, y: m, w: src.width - 2 * m, h: src.height - 2 * m });
    const side = tileSize * grid;
    const half = side / 2;
    src.resize({ w: half, h: half });
    const img = new Jimp({ width: side, height: side, color: 0x000000ff });
    for (const [fx, fy] of [[false, false], [true, false], [false, true], [true, true]]) {
      const q = src.clone();
      if (fx) q.flip({ horizontal: true, vertical: false });
      if (fy) q.flip({ horizontal: false, vertical: true });
      img.composite(q, fx ? half : 0, fy ? half : 0);
    }
    await img.write(join(outDir, `floor_${stage}.png`));
    console.log(`floor_${stage}.png ${side}x${side} from art/generated (custom)`);
    continue;
  }
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
