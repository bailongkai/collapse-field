// Composes art/generated/*.png into a contact sheet (art/sheet.png) for a quick look.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Jimp } from 'jimp';
const dir = 'art/generated';
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const files = readdirSync(dir).filter((f) => f.endsWith('.png') && (!only || only.has(f.replace('.png', '')))).sort();
const cell = 160, cols = 6, rows = Math.ceil(files.length / cols);
const sheet = new Jimp({ width: cols * cell, height: rows * cell, color: 0x2a2f3aff });
for (let i = 0; i < files.length; i++) {
  const img = await Jimp.read(join(dir, files[i]));
  img.autocrop({ tolerance: 0.02 }); img.scaleToFit({ w: cell - 16, h: cell - 16 });
  sheet.composite(img, (i % cols) * cell + (cell - img.width) / 2, Math.floor(i / cols) * cell + (cell - img.height) / 2);
}
await sheet.write(process.argv[3] ?? 'art/sheet.png');
console.log(files.join(' '));
