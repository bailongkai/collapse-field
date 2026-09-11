// Generates the custom art listed in art/prompts.json with an image model and drops the results in
// art/generated/, where build-atlas.mjs and build-floor.mjs prefer them over the Kenney frames.
//
//   OPENAI_API_KEY=... node scripts/gen-art.mjs              # everything not generated yet
//   node scripts/gen-art.mjs --only player,enemy_mothership   # a subset
//   node scripts/gen-art.mjs --force                          # regenerate even if present
//   node scripts/gen-art.mjs --dry                            # print the prompts, call nothing
//
// Provider: OpenAI Images (gpt-image-1) with a transparent background. To use another model, add a
// case to `generate()` that returns PNG bytes; everything else is provider-agnostic.
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
const provider = process.env.ART_PROVIDER ?? 'openai';

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
  throw new Error(`unknown ART_PROVIDER ${provider}`);
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
