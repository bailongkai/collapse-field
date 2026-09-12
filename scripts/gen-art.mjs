// Generates the custom art listed in art/prompts.json with an image model and drops the results in
// art/generated/, where build-atlas.mjs and build-floor.mjs prefer them over the Kenney frames.
//
//   OPENAI_API_KEY=... node scripts/gen-art.mjs              # everything not generated yet
//   node scripts/gen-art.mjs --only player,enemy_mothership   # a subset
//   node scripts/gen-art.mjs --force                          # regenerate even if present
//   node scripts/gen-art.mjs --dry                            # print the prompts, call nothing
//
// Providers (ART_PROVIDER): 'fal' (default when FAL_KEY is set) runs FLUX on fal.ai against a plain
// white background and then a background-removal model for the alpha; 'openai' uses gpt-image-1
// with its native transparent output. Add a case to `generate()` returning PNG bytes for another.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'art', 'generated');
const { style, assets } = JSON.parse(readFileSync(join(ROOT, 'art', 'prompts.json'), 'utf8'));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const force = args.includes('--force');
const onlyArg = args[args.indexOf('--only') + 1];
const only = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;
const provider = process.env.ART_PROVIDER ?? (process.env.FAL_KEY ? 'fal' : 'openai');
const FAL_MODEL = process.env.FAL_MODEL ?? 'fal-ai/flux/dev';
const FAL_REMBG = process.env.FAL_REMBG ?? 'fal-ai/birefnet/v2';

function fullPrompt(a) {
  // the shared sprite style is appended once; floors carry their own and never get it
  if (a.kind === 'floor' || a.prompt.includes('transparent background')) return a.prompt;
  return `${a.prompt} ${style}`;
}

async function generate(a) {
  const prompt = fullPrompt(a);
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set');
    const body = {
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
      background: a.kind === 'floor' ? 'opaque' : 'transparent',
    };
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    return Buffer.from(json.data[0].b64_json, 'base64');
  }
  if (provider === 'fal') {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY is not set');
    const floor = a.kind === 'floor';
    // diffusion models have no alpha channel: ask for a flat white backdrop and cut it out after
    const p = floor ? prompt : prompt.replace(/fully transparent background|transparent background/g, 'plain solid pure white background, nothing else in the scene');
    const gen = await fal(key, FAL_MODEL, {
      prompt: p,
      image_size: 'square_hd',
      num_images: 1,
      output_format: 'png',
      enable_safety_checker: false,
      guidance_scale: 3.5,
      num_inference_steps: 28,
    });
    const url = gen.images?.[0]?.url;
    if (!url) throw new Error(`no image in ${JSON.stringify(gen).slice(0, 200)}`);
    if (floor) return Buffer.from(await (await fetch(url)).arrayBuffer());
    const cut = await fal(key, FAL_REMBG, { image_url: url, output_format: 'png' });
    const cutUrl = cut.image?.url ?? cut.images?.[0]?.url;
    if (!cutUrl) throw new Error(`no image from ${FAL_REMBG}: ${JSON.stringify(cut).slice(0, 200)}`);
    return Buffer.from(await (await fetch(cutUrl)).arrayBuffer());
  }
  throw new Error(`unknown ART_PROVIDER ${provider}`);
}

/** One synchronous fal.ai call; the sync endpoint waits for the result itself. */
async function fal(key, model, input) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

mkdirSync(OUT, { recursive: true });
let done = 0;
let skipped = 0;
for (const a of assets) {
  if (only && !only.has(a.frame)) continue;
  const path = join(OUT, `${a.frame}.png`);
  if (existsSync(path) && !force) {
    skipped++;
    continue;
  }
  if (dry) {
    console.log(`\n## ${a.frame} (${a.zh}, ${a.size}px)\n${fullPrompt(a)}`);
    continue;
  }
  try {
    const png = await generate(a);
    writeFileSync(path, png);
    done++;
    console.log(`${a.frame.padEnd(22)} ${png.length} bytes`);
  } catch (error) {
    console.error(`${a.frame}: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(dry ? `\n${assets.length} prompts` : `generated ${done}, already present ${skipped}`);
