// Downloads the Kenney CC0 packs listed in asset-manifest.json into .cache/kenney/<slug>/.
// Resolution order per pack:
//   1. manifest.resolvedUrls[slug].url (verified against sha256 when recorded)
//   2. scrape https://kenney.nl/assets/<slug> for the first /media/pages/assets/... .zip href
//   3. env KENNEY_ZIP_URL_<SLUG> (slug upper-cased, '-' -> '_')
//   4. manual drop at .cache/kenney/<slug>.zip
// Unattended: never prompts; exits non-zero listing the packs it could not obtain.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'scripts', 'asset-manifest.json');
const CACHE = join(ROOT, '.cache', 'kenney');
const UA = 'star-survivors-asset-fetch/1.0 (+https://kenney.nl)';

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
manifest.resolvedUrls ??= {};
mkdirSync(CACHE, { recursive: true });

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`suspiciously small download (${buf.length} B) for ${url}`);
  return buf;
}

async function scrapeZipUrl(slug) {
  const page = `https://kenney.nl/assets/${slug}`;
  const res = await fetch(page, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${page}`);
  const html = await res.text();
  const m = html.match(/(https?:\/\/(?:www\.)?kenney\.nl)?(\/media\/pages\/assets\/[^"']+\.zip)/);
  if (!m) throw new Error(`no zip href found on ${page}`);
  return `https://kenney.nl${m[2]}`;
}

function unzip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'inherit' });
}

function alreadyUnpacked(destDir) {
  return existsSync(destDir) && readdirSync(destDir).length > 0;
}

async function obtainZip(slug) {
  const zipPath = join(CACHE, `${slug}.zip`);
  const rec = manifest.resolvedUrls[slug];
  // 4. manual drop already present
  if (existsSync(zipPath)) {
    const buf = readFileSync(zipPath);
    if (!rec?.sha256 || rec.sha256 === sha256(buf)) return { zipPath, buf, source: 'cache' };
  }
  const candidates = [];
  if (rec?.url) candidates.push({ url: rec.url, source: 'pinned' });
  const envKey = `KENNEY_ZIP_URL_${slug.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey]) candidates.push({ url: process.env[envKey], source: 'env' });
  for (const c of candidates) {
    try {
      const buf = await download(c.url);
      if (rec?.sha256 && rec.sha256 !== sha256(buf)) throw new Error('sha256 mismatch');
      writeFileSync(zipPath, buf);
      return { zipPath, buf, source: c.source, url: c.url };
    } catch (e) {
      console.warn(`  [${slug}] ${c.source} url failed: ${e.message}`);
    }
  }
  try {
    const url = await scrapeZipUrl(slug);
    const buf = await download(url);
    writeFileSync(zipPath, buf);
    return { zipPath, buf, source: 'scraped', url };
  } catch (e) {
    console.warn(`  [${slug}] scrape failed: ${e.message}`);
  }
  return null;
}

const failed = [];
for (const slug of manifest.packs) {
  const destDir = join(CACHE, slug);
  if (alreadyUnpacked(destDir)) {
    console.log(`[${slug}] already unpacked`);
    continue;
  }
  console.log(`[${slug}] fetching...`);
  const got = await obtainZip(slug);
  if (!got) {
    failed.push(slug);
    continue;
  }
  const hash = sha256(got.buf);
  manifest.resolvedUrls[slug] = { url: got.url ?? manifest.resolvedUrls[slug]?.url ?? null, sha256: hash, bytes: got.buf.length };
  console.log(`[${slug}] ${got.source} ${(got.buf.length / 1048576).toFixed(1)} MB sha256=${hash.slice(0, 12)}`);
  unzip(got.zipPath, destDir);
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

if (failed.length) {
  console.error(`\nCould not obtain: ${failed.join(', ')}`);
  console.error('Set KENNEY_ZIP_URL_<SLUG> or drop the zip at .cache/kenney/<slug>.zip and re-run.');
  process.exit(1);
}
console.log('\nAll packs present under .cache/kenney/');
