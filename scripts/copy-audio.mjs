// Copies the selected .ogg files and the Kenney font into public/assets, and writes CREDITS.md + LICENSE.txt.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFile } from './build-atlas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'asset-manifest.json'), 'utf8'));

const audioDir = join(ROOT, 'public', 'assets', 'audio');
mkdirSync(audioDir, { recursive: true });
for (const [key, a] of Object.entries(manifest.audio)) {
  const src = resolveFile(a.pack, a.file);
  copyFileSync(src, join(audioDir, `${key}.ogg`));
  console.log(`audio ${key}.ogg <- ${a.pack}/${a.file}`);
}

const fontDir = join(ROOT, 'public', 'assets', 'fonts');
mkdirSync(fontDir, { recursive: true });
copyFileSync(resolveFile(manifest.font.pack, manifest.font.file), join(fontDir, manifest.font.out));
console.log(`font ${manifest.font.out} <- ${manifest.font.pack}/${manifest.font.file}`);

const CC0 = `CC0 1.0 Universal (CC0 1.0) Public Domain Dedication

The person who associated a work with this deed has dedicated the work to the public domain by waiving all of his or her rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law.

You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.

Full legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
`;

const packs = manifest.packs.map((slug) => {
  const r = manifest.resolvedUrls[slug] ?? {};
  return `- **${slug}** — https://kenney.nl/assets/${slug}${r.url ? `\n  - zip: ${r.url}` : ''}${r.sha256 ? `\n  - sha256: ${r.sha256}` : ''}`;
});

const credits = `# Credits

All art, UI, fonts and sound effects in \`public/assets/\` are by **Kenney** (https://www.kenney.nl), released under **CC0 1.0 Universal** (public domain). Attribution is not required but appreciated — thank you, Kenney!

Some frames were rescaled, tinted or composed by \`scripts/build-atlas.mjs\` / \`scripts/build-floor.mjs\`; \`fx_slash\`, \`icon_plasmaBlade\`, \`bar_bg\`, \`bar_fill\` and \`px\` are drawn procedurally.

## Packs used

${packs.join('\n')}

## License

${CC0}`;

writeFileSync(join(ROOT, 'CREDITS.md'), credits);
writeFileSync(join(ROOT, 'public', 'assets', 'LICENSE.txt'), `All files in this directory are by Kenney (www.kenney.nl), licensed CC0 1.0 Universal.\n\n${CC0}`);
console.log('CREDITS.md and public/assets/LICENSE.txt written');
