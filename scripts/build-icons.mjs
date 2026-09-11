// Draws the app icons for the web manifest: a dark tile with the plasma blade's cyan stroke.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(ROOT, 'public', 'icons');
mkdirSync(out, { recursive: true });

function icon(size) {
  const img = new Jimp({ width: size, height: size, color: 0x05070cff });
  const r = size * 0.22;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // rounded tile
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    if (Math.hypot(x - cx, y - cy) > r) { img.setPixelColor(0x00000000, x, y); continue; }
    // diagonal blade with a soft edge
    const d = Math.abs(x + y - (size - 1)) / Math.SQRT2;
    const along = (x - y + size) / (2 * size);
    const w = size * 0.075;
    if (d < w && along > 0.14 && along < 0.86) {
      const a = Math.min(1, (w - d) / (size * 0.02));
      const base = 0x0f1d33;
      const cyan = [0x4f, 0xe0, 0xff];
      const bg = [(base >> 16) & 255, (base >> 8) & 255, base & 255];
      const mix = cyan.map((c, i) => Math.round(bg[i] + (c - bg[i]) * a));
      img.setPixelColor(((mix[0] << 24) | (mix[1] << 16) | (mix[2] << 8) | 0xff) >>> 0, x, y);
    } else if (Math.hypot(x - size / 2, y - size / 2) < size * 0.42) {
      img.setPixelColor(0x0f1d33ff, x, y);
    }
  }
  return img;
}

for (const size of [192, 512, 1024]) {
  await icon(size).write(join(out, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}

// the stores want an opaque 1024 (no rounded corners, no alpha) and a square splash
const flat = new Jimp({ width: 1024, height: 1024, color: 0x05070cff });
flat.composite(icon(1024), 0, 0);
await flat.write(join(out, 'icon-store-1024.png'));
console.log('icon-store-1024.png');
const splash = new Jimp({ width: 2732, height: 2732, color: 0x05070cff });
splash.composite(icon(768), (2732 - 768) / 2, (2732 - 768) / 2);
await splash.write(join(out, 'splash-2732.png'));
console.log('splash-2732.png');
