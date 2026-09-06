import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateContent } from '../../src/core/content/validate';
import { CONTENT } from '../../src/core/content/registry';

function atlasFrames(name: string): string[] {
  const json = JSON.parse(readFileSync(`public/assets/atlas/${name}.json`, 'utf8')) as {
    textures?: { frames: { filename: string }[] }[];
    frames?: Record<string, unknown> | { filename: string }[];
  };
  if (json.textures) return json.textures.flatMap((t) => t.frames.map((f) => f.filename));
  if (Array.isArray(json.frames)) return json.frames.map((f) => f.filename);
  return Object.keys(json.frames ?? {});
}

describe('content', () => {
  const frames = new Set([...atlasFrames('game'), ...atlasFrames('ui')]);

  it('atlases contain the procedural frames', () => {
    for (const f of ['fx_slash', 'icon_plasmaBlade', 'bar_bg', 'bar_fill', 'px']) expect(frames.has(f), f).toBe(true);
  });

  it('validates with every referenced frame present', () => {
    expect(validateContent(frames)).toEqual([]);
  });

  it('has the five prototype weapons and passives', () => {
    expect(Object.keys(CONTENT.weapons)).toHaveLength(5);
    expect(Object.keys(CONTENT.passives)).toHaveLength(5);
  });

  it('every weapon behavior is one of the five archetypes', () => {
    const known = new Set(['slash', 'aimed', 'stream', 'orbit', 'aura']);
    for (const w of CONTENT.weaponList) expect(known.has(w.behavior), `${w.id}: ${w.behavior}`).toBe(true);
  });
});
