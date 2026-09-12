// Builds public/assets/atlas/{game,ui}.{png,json} from scripts/asset-manifest.json.
// - Each entry's `file` may be a glob (first sorted match wins); on zero matches the pack's
//   directory listing (two levels) is printed and the script exits non-zero.
// - `size` = in-game pixel size of the longest side (game atlas only); ui frames keep native size.
// - Procedural frames (fx_slash, icon_plasmaBlade, bar_bg, bar_fill, px) are drawn here so they exist in game.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';
import { packAsync } from 'free-tex-packer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'kenney');
/** custom art from scripts/gen-art.mjs wins over the Kenney frame of the same name */
const CUSTOM = join(ROOT, 'art', 'generated');
const OUT = join(ROOT, 'public', 'assets', 'atlas');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'asset-manifest.json'), 'utf8'));

function walk(dir, depth, out = []) {
  if (depth < 0 || !existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, depth - 1, out);
    else out.push(p);
  }
  return out;
}

function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp('^' + esc + '$');
}

export function resolveFile(pack, glob) {
  const base = join(CACHE, pack);
  if (!existsSync(base)) throw new Error(`pack not fetched: ${pack} (run npm run assets:fetch)`);
  const re = globToRegex(glob);
  const matches = walk(base, 6).map((p) => p.slice(base.length + 1).split(sep).join('/')).filter((rel) => re.test(rel)).sort();
  if (matches.length === 0) {
    console.error(`No match for "${glob}" in pack ${pack}. Directory listing:`);
    for (const p of walk(base, 2)) console.error('  ' + p.slice(base.length + 1));
    throw new Error(`asset not found: ${pack}/${glob}`);
  }
  return join(base, matches[0]);
}

async function loadScaled(path, size) {
  const img = await Jimp.read(path);
  if (size) {
    const longest = Math.max(img.width, img.height);
    if (longest !== size) img.scaleToFit({ w: size, h: size });
  }
  return img;
}

/** A generated image: trimmed of its transparent margin, then scaled like any other frame. */
async function loadCustom(path, size) {
  const img = await Jimp.read(path);
  img.autocrop({ cropOnlyFrames: false, tolerance: 0.02 });
  if (size) img.scaleToFit({ w: size, h: size });
  return img;
}

/**
 * A nine-sliced sci-fi button: dark glass with a thin cyan edge and clipped corners. Drawn here so
 * the UI does not depend on a third art pack for its most-touched element.
 */
function drawTechButton(size = 48, edge = [0x4f, 0xe0, 0xff], fill = [0x10, 0x1c, 0x2e], edgeAlpha = 0.85) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  const cut = 7; // clipped corner
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.min(x, size - 1 - x);
    const dy = Math.min(y, size - 1 - y);
    if (dx + dy < cut) continue; // outside the clipped corner
    const onEdge = dx + dy < cut + 2 || dx < 2 || dy < 2;
    // a faint vertical gradient so the face reads as glass
    const g = 1 - (y / size) * 0.35;
    const [r, gg, b] = onEdge ? edge : fill.map((c) => Math.round(c * g));
    const a = onEdge ? Math.round(255 * edgeAlpha) : 235;
    img.setPixelColor(((r << 24) | (gg << 16) | (b << 8) | a) >>> 0, x, y);
  }
  return img;
}


/** A flat energy beam: a bright core with a soft falloff, used for the arc and the lance. */
function drawBeam(w, h, rgb) {
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.abs(y - (h - 1) / 2) / ((h - 1) / 2 || 1);
    // a hard core and a wide glow, so it reads at any length once the view stretches it
    const a = Math.max(0, 1 - t * t * t);
    const core = Math.max(0, 1 - t * 3);
    const mix = rgb.map((c) => Math.round(c + (255 - c) * core));
    // taper the ends so a segment between two bodies does not look like a cut bar
    const ex = Math.min(1, Math.min(x, w - 1 - x) / Math.max(1, w * 0.06));
    const alpha = Math.round(255 * a * ex);
    if (alpha <= 2) continue;
    img.setPixelColor(((mix[0] << 24) | (mix[1] << 16) | (mix[2] << 8) | alpha) >>> 0, x, y);
  }
  return img;
}

/** The stake the sapper drives into the deck: a lit post seen from above, drawn upright. */
function drawStake(w = 22, h = 44) {
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = w / 2;
    const halfW = x < cx ? cx - x : x - cx;
    const taper = 2 + (1 - y / h) * (w / 2 - 3);
    if (halfW > taper) continue;
    const lit = y < h * 0.42;
    const [r, g, b] = lit ? [0x9c, 0xff, 0xd8] : [0x24, 0x3a, 0x4e];
    const edge = halfW > taper - 1.6 ? 0.55 : 1;
    img.setPixelColor((((r * edge) << 24) | ((g * edge) << 16) | ((b * edge) << 8) | 0xff) >>> 0, x, y);
  }
  return img;
}

// --- procedural frames -------------------------------------------------------
function drawSlash(w = 128, h = 48) {
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  const cx = w / 2, cy = h + 52; // arc centre below the image -> convex-up crescent
  const rOuter = cy - 2, rInner = cy - 22;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > rOuter || d < rInner) continue;
    const t = Math.abs(x - cx) / (w / 2); // 0 centre .. 1 edge
    const edge = Math.max(0, 1 - t * t);
    const band = 1 - Math.abs((d - (rOuter + rInner) / 2) / ((rOuter - rInner) / 2));
    const a = Math.round(255 * Math.min(1, edge * 1.4) * Math.min(1, band * 1.6));
    img.setPixelColor(((0xff << 24) | (0xff << 16) | (0xff << 8) | a) >>> 0, x, y);
  }
  return img;
}

function drawIconBlade(size = 40) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // diagonal blade: distance to the line y = size - x
    const d = Math.abs(x + y - (size - 1)) / Math.SQRT2;
    const along = (x - y + size) / (2 * size); // 0..1 along the blade
    if (d < 5 && along > 0.08 && along < 0.92) {
      const a = Math.round(255 * Math.min(1, (5 - d) / 2));
      img.setPixelColor(((0x4f << 24) | (0xe0 << 16) | (0xff << 8) | a) >>> 0, x, y);
    }
  }
  return img;
}

function drawPauseIcon(size = 32) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  const barW = Math.round(size * 0.22);
  const gap = Math.round(size * 0.16);
  const top = Math.round(size * 0.18);
  const bottom = size - top;
  const left = Math.round(size / 2 - gap / 2 - barW);
  for (let y = top; y < bottom; y++) for (let x = 0; x < size; x++) {
    const inLeft = x >= left && x < left + barW;
    const inRight = x >= left + barW + gap && x < left + 2 * barW + gap;
    if (inLeft || inRight) img.setPixelColor(0x0b1a2aff, x, y);
  }
  return img;
}

/**
 * A soft ground shadow. Every character sits on one, which is what pulls sprites drawn from
 * slightly different angles (top-down soldiers, hovering saucers, a vertical-shmup hull) onto the
 * same floor and makes the mix read as one scene.
 */
function drawShadow(w) {
  const h = Math.round(w * 0.42);
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  const rx = w / 2;
  const ry = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - rx) / rx;
    const ny = (y + 0.5 - ry) / ry;
    const d = Math.hypot(nx, ny);
    if (d >= 1) continue;
    // dense in the middle, feathered at the rim
    const a = Math.round(205 * Math.pow(1 - d, 0.5));
    if (a <= 0) continue;
    img.setPixelColor(((0x00 << 24) | (0x02 << 16) | (0x06 << 8) | a) >>> 0, x, y);
  }
  return img;
}

/**
 * An experience crystal: a faceted diamond with a bright core, a darker lower half and a rim.
 * The Kenney power-up sprites are rounded squares, which read as debris rather than as the thing
 * the whole run is spent collecting.
 */
function drawGem(size, rgb) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  const c = (size - 1) / 2;
  const [r, g, b] = rgb;
  const mixTo = (v, t, target) => Math.round(v + (target - v) * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - c) / c;
    const ny = (y - c) / c;
    const d = Math.abs(nx) + Math.abs(ny); // diamond
    if (d > 1) continue;
    const rim = d > 0.78;
    // the upper-left facet catches the light, the lower half falls into shade
    const lightT = Math.max(0, Math.min(1, 0.55 - (nx + ny) * 0.5));
    let cr = mixTo(r, lightT * 0.75, 255);
    let cg = mixTo(g, lightT * 0.75, 255);
    let cb = mixTo(b, lightT * 0.75, 255);
    if (ny > 0.15) {
      cr = Math.round(cr * 0.62);
      cg = Math.round(cg * 0.62);
      cb = Math.round(cb * 0.62);
    }
    if (rim) {
      cr = Math.round(cr * 0.45);
      cg = Math.round(cg * 0.45);
      cb = Math.round(cb * 0.45);
    }
    img.setPixelColor(((cr << 24) | (cg << 16) | (cb << 8) | 0xff) >>> 0, x, y);
  }
  return img;
}

/**
 * A supply chest. The Kenney sci-fi packs have no chest — the frame this replaces was a factory
 * building, which reads as scenery rather than as the reward the whole run is now built around,
 * both on the ground and floating over the elite that is carrying it.
 */
function drawChest(w = 48) {
  const h = Math.round(w * 0.82);
  const img = new Jimp({ width: w, height: h, color: 0x00000000 });
  const put = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    img.setPixelColor(((r << 24) | (g << 16) | (b << 8) | a) >>> 0, x, y);
  };
  const lidH = Math.round(h * 0.42);
  const inset = Math.round(w * 0.06);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < inset || x >= w - inset || y < 1 || y >= h - 1) continue;
      const inLid = y < lidH;
      // the lid is a shallow arc, so the silhouette is a chest and not a crate
      if (inLid) {
        const t = (x - w / 2) / (w / 2 - inset);
        const top = Math.round(lidH * 0.32 * t * t) + 1;
        if (y < top) continue;
      }
      const edge = x < inset + 2 || x >= w - inset - 2 || y === h - 2 || (inLid && y <= lidH * 0.34 + 2);
      const band = Math.abs(x - w / 2) < w * 0.07;
      const seam = !inLid && y < lidH + 3;
      let r, g, b;
      if (seam) [r, g, b] = [0x3a, 0x2a, 0x12];
      else if (band) [r, g, b] = [0xf4, 0xd9, 0x7a];
      else if (edge) [r, g, b] = [0x6b, 0x4c, 0x1c];
      else if (inLid) [r, g, b] = [0xe0, 0xa8, 0x3c];
      else [r, g, b] = [0xc2, 0x86, 0x2c];
      // a highlight down the upper left so it does not read flat
      const lit = Math.max(0, 1 - (x / w + y / h));
      put(x, y, Math.min(255, Math.round(r + lit * 60)), Math.min(255, Math.round(g + lit * 60)), Math.min(255, Math.round(b + lit * 40)));
    }
  }
  // the latch
  const lx = Math.round(w / 2);
  for (let y = lidH - 2; y < lidH + 5; y++) {
    for (let x = lx - 3; x <= lx + 2; x++) put(x, y, 0xff, 0xf1, 0xb8);
  }
  return img;
}

/** A chevron pointing right, for the relic guide at the edge of the view. */
function drawArrow(size = 32) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cy = size / 2;
    const t = 1 - Math.abs(y - cy) / cy; // 1 at the middle row, 0 at the edges
    const tip = size * 0.15 + t * size * 0.75; // the point of the chevron
    const back = tip - size * 0.3;
    if (x <= tip && x >= back) img.setPixelColor(0xffffffff, x, y);
  }
  return img;
}

/**
 * A shipping container seen from above: a ribbed slab with a darker rim. Tiled over the cargo
 * deck's walls; the small Kenney structures tiled into a row of little towers instead of a wall.
 */
function drawContainer(size, [r, g, b]) {
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const rim = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
    const rib = !rim && (x % 12 === 6 || x % 12 === 7);
    const lit = Math.max(0, 1 - (x / size + y / size) * 0.5);
    let cr = r, cg = g, cb = b;
    if (rim) { cr *= 0.45; cg *= 0.45; cb *= 0.45; }
    else if (rib) { cr *= 0.72; cg *= 0.72; cb *= 0.72; }
    cr = Math.min(255, Math.round(cr + lit * 40));
    cg = Math.min(255, Math.round(cg + lit * 40));
    cb = Math.min(255, Math.round(cb + lit * 30));
    img.setPixelColor(((cr << 24) | (cg << 16) | (cb << 8) | 0xff) >>> 0, x, y);
  }
  return img;
}

function solid(w, h, rgba) {
  return new Jimp({ width: w, height: h, color: rgba >>> 0 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const groups = { game: [], ui: [] };
  const seen = new Set();
  for (const e of manifest.entries) {
    if (seen.has(e.frame)) throw new Error(`duplicate frame ${e.frame}`);
    seen.add(e.frame);
    const custom = join(CUSTOM, `${e.frame}.png`);
    let img;
    if (existsSync(custom)) {
      img = await loadCustom(custom, e.atlas === 'game' ? e.size : undefined);
      console.log(`${e.frame.padEnd(22)} <- art/generated (custom) ${img.width}x${img.height}`);
    } else {
      const path = resolveFile(e.pack, e.file);
      img = await loadScaled(path, e.atlas === 'game' ? e.size : undefined);
      console.log(`${e.frame.padEnd(22)} <- ${e.pack}/${path.slice(join(CACHE, e.pack).length + 1)} ${img.width}x${img.height}`);
    }
    groups[e.atlas].push({ path: e.frame + '.png', contents: await img.getBuffer('image/png') });
  }
  groups.ui.push({ path: 'button_tech.png', contents: await drawTechButton().getBuffer('image/png') });
  groups.ui.push({ path: 'button_tech_dim.png', contents: await drawTechButton(48, [0x3a, 0x4a, 0x60], [0x0c, 0x14, 0x20], 0.7).getBuffer('image/png') });
  groups.ui.push({ path: 'panel_tech.png', contents: await drawTechButton(64, [0x4f, 0xe0, 0xff], [0x0b, 0x14, 0x22], 0.45).getBuffer('image/png') });
  const procedural = [
    ['fx_slash', drawSlash()],
    // a beam is long and thin, so it cannot be a manifest entry: those are fitted into a square box
    ['fx_arc', drawBeam(192, 14, [0x4f, 0xe0, 0xff])],
    ['fx_lance', drawBeam(448, 64, [0xff, 0x8a, 0x3d])],
    ['pylon_stake', drawStake()],
    ['pk_chest', existsSync(join(CUSTOM, 'pk_chest.png')) ? await loadCustom(join(CUSTOM, 'pk_chest.png'), 48) : drawChest()],
    ['ui_arrow', drawArrow()],
    ['wall_orange', drawContainer(64, [0xd8, 0x74, 0x3a])],
    ['wall_grey', drawContainer(64, [0x8a, 0x94, 0xa0])],
    ['icon_plasmaBlade', drawIconBlade()],
    ['bar_bg', solid(40, 5, 0x101418ff)],
    ['bar_fill', solid(40, 5, 0x5ee06aff)],
    ['px', solid(4, 4, 0xffffffff)],
    ['icon_pause', drawPauseIcon()],
    ['gem_blue', drawGem(16, [0x3f, 0x9c, 0xff])],
    ['gem_green', drawGem(16, [0x4f, 0xd6, 0x6a])],
    ['gem_red', drawGem(18, [0xff, 0x5f, 0x6b])],
    ['gem_big', drawGem(28, [0xff, 0xd1, 0x66])],
    ['shadow_s', drawShadow(28)],
    ['shadow_m', drawShadow(44)],
    ['shadow_l', drawShadow(68)],
    ['shadow_xl', drawShadow(140)],
  ];
  for (const [name, img] of procedural) {
    groups.game.push({ path: name + '.png', contents: await img.getBuffer('image/png') });
  }

  for (const [name, images] of Object.entries(groups)) {
    const files = await packAsync(images, {
      textureName: name,
      width: 2048,
      height: 2048,
      fixedSize: false,
      powerOfTwo: false,
      padding: 2,
      allowRotation: false,
      allowTrim: false,
      detectIdentical: true,
      packer: 'MaxRectsBin',
      packerMethod: 'BestShortSideFit',
      exporter: 'Phaser3',
      removeFileExtension: true,
      prependFolderName: false,
    });
    for (const f of files) writeFileSync(join(OUT, f.name), f.buffer);
    const json = JSON.parse(readFileSync(join(OUT, `${name}.json`), 'utf8'));
    const frames = json.textures ? json.textures[0].frames : json.frames;
    const count = Array.isArray(frames) ? frames.length : Object.keys(frames).length;
    console.log(`atlas ${name}: ${count} frames -> ${files.map((f) => f.name).join(', ')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
