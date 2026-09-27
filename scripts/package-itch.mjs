// Packs dist/ into the zip itch.io takes for an HTML5 game: index.html at the root of the archive.
//
// itch serves the upload from a path of its own inside an iframe (html-classic.itch.zone/html/<id>/),
// so a single reference that starts with "/" loads from the wrong place and the page comes up blank.
// The checks below are the ones that fail silently once uploaded, which is why they fail loudly here:
// absolute references, and itch's limits on file count and size.
//
// Run with `npm run package:itch`; it builds first. The zip lands in release/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const OUT_DIR = 'release';
const OUT = join(OUT_DIR, 'collapse-field-html5.zip');
// itch's documented limits for an HTML5 upload
const MAX_FILES = 1000;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const fail = (msg) => {
  console.error(`package-itch: ${msg}`);
  process.exit(1);
};

if (!existsSync(join(DIST, 'index.html'))) fail('dist/index.html is missing; the build did not run');

const files = walk(DIST);
let total = 0;
for (const f of files) {
  const size = statSync(f).size;
  total += size;
  if (size > MAX_FILE_BYTES) fail(`${relative(DIST, f)} is ${(size / 1e6).toFixed(1)} MB, over itch's per-file limit`);
}
if (files.length > MAX_FILES) fail(`${files.length} files, over itch's limit of ${MAX_FILES}`);
if (total > MAX_TOTAL_BYTES) fail(`${(total / 1e6).toFixed(1)} MB in total, over the limit`);

// A root-relative reference ("/assets/x.js") resolves against itch's host, not the game's folder.
const absolute = [];
for (const f of files.filter((p) => /\.(html|css|js|json|webmanifest)$/.test(p))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*)["']/g)) absolute.push(`${relative(DIST, f)}: ${m[1]}`);
  for (const m of text.matchAll(/url\(\s*["']?(\/(?!\/)[^"')]*)/g)) absolute.push(`${relative(DIST, f)}: url(${m[1]})`);
}
if (absolute.length > 0) fail(`root-relative references would break under itch's path:\n  ${absolute.join('\n  ')}`);

mkdirSync(OUT_DIR, { recursive: true });
rmSync(OUT, { force: true });
// zipped from inside dist/ so index.html is at the root of the archive, not under dist/
execFileSync('zip', ['-qr', '-X', join('..', OUT), '.'], { cwd: DIST, stdio: 'inherit' });
console.log(`package-itch: ${OUT} (${files.length} files, ${(total / 1e6).toFixed(1)} MB unpacked, ${(statSync(OUT).size / 1e6).toFixed(1)} MB zipped)`);
