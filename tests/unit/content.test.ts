import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateContent } from '../../src/core/content/validate';
import { CONTENT, enemyDef, stageDef } from '../../src/core/content/registry';

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

  it('has five base weapons, five evolutions and five passives', () => {
    const weapons = Object.values(CONTENT.weapons);
    expect(weapons.filter((w) => !w.evolvedOnly)).toHaveLength(5);
    expect(weapons.filter((w) => w.evolvedOnly)).toHaveLength(5);
    expect(Object.keys(CONTENT.passives)).toHaveLength(5);
  });

  it('every weapon behavior is one of the five archetypes', () => {
    const known = new Set(['slash', 'aimed', 'stream', 'orbit', 'aura']);
    for (const w of CONTENT.weaponList) expect(known.has(w.behavior), `${w.id}: ${w.behavior}`).toBe(true);
  });
});

describe('the two boss fights', () => {
  const bossEvents = stageDef('station').events.filter((e) => e.kind === 'boss') as { at: number; hpMult: number }[];

  it('the later one is much the tougher of the two', () => {
    // These were inverted once and it was the loudest complaint the game got. The 5:00 fight met a
    // build worth about 17 damage per second and the 10:00 fight one worth about ten times that, so
    // a single health pool made the first a wall of 87 seconds and the second a formality. Whatever
    // these numbers become, the second boss has to be the bigger one by a wide margin.
    expect(bossEvents.length, 'the stage should schedule two boss fights').toBe(2);
    const [first, second] = bossEvents;
    expect(second.at).toBeGreaterThan(first.at);
    expect(second.hpMult, `first ${first.hpMult}, second ${second.hpMult}`).toBeGreaterThan(first.hpMult * 3);
  });

  it('the first one is a fight a five minute build can finish', () => {
    // 400 hp against a measured median of about 17 damage per second is roughly twenty seconds of
    // ideal output, and longer in practice because the mothership charges out of reach.
    const hp = enemyDef('mothership').hp * bossEvents[0].hpMult;
    expect(hp, `the 5:00 boss has ${hp} hp`).toBeLessThanOrEqual(600);
    expect(hp, 'and it still has to be a fight, not a speed bump').toBeGreaterThanOrEqual(250);
  });
});
