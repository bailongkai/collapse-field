import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateContent } from '../../src/core/content/validate';
import { LOCKED_BY_DEFAULT } from '../../src/data/achievements';
import { CONTENT, enemyDef, stageDef } from '../../src/core/content/registry';
import { GAME_ATLAS_DENSITY } from '../../src/game/atlas';

function atlasFrames(name: string): string[] {
  const json = JSON.parse(readFileSync(`public/assets/atlas/${name}.json`, 'utf8')) as {
    textures?: { frames: { filename: string }[] }[];
    frames?: Record<string, unknown> | { filename: string }[];
  };
  if (json.textures) return json.textures.flatMap((t) => t.frames.map((f) => f.filename));
  if (Array.isArray(json.frames)) return json.frames.map((f) => f.filename);
  return Object.keys(json.frames ?? {});
}

/** each frame's untrimmed size in atlas pixels */
function atlasFrameSizes(name: string): Map<string, { w: number; h: number }> {
  const json = JSON.parse(readFileSync(`public/assets/atlas/${name}.json`, 'utf8')) as {
    textures?: { frames: { filename: string; sourceSize: { w: number; h: number } }[] }[];
    frames?: Record<string, { sourceSize: { w: number; h: number } }> | { filename: string; sourceSize: { w: number; h: number } }[];
  };
  const out = new Map<string, { w: number; h: number }>();
  const list = json.textures ? json.textures.flatMap((t) => t.frames) : Array.isArray(json.frames) ? json.frames : Object.entries(json.frames ?? {}).map(([filename, f]) => ({ filename, ...f }));
  for (const f of list) out.set(f.filename, f.sourceSize);
  return out;
}

describe('content', () => {
  const frames = new Set([...atlasFrames('game'), ...atlasFrames('ui')]);

  it('atlases contain the procedural frames', () => {
    for (const f of ['fx_slash', 'icon_plasmaBlade', 'bar_bg', 'bar_fill', 'px']) expect(frames.has(f), f).toBe(true);
  });

  it('validates with every referenced frame present', () => {
    expect(validateContent(frames)).toEqual([]);
  });

  it('packs every game frame at the declared density, so a frame authored at size N is N x density pixels', () => {
    const manifest = JSON.parse(readFileSync('scripts/asset-manifest.json', 'utf8')) as {
      density: number;
      entries: { frame: string; size?: number; atlas: 'game' | 'ui' }[];
    };
    expect(manifest.density).toBe(GAME_ATLAS_DENSITY);
    const sizes = atlasFrameSizes('game');
    for (const e of manifest.entries) {
      if (e.atlas !== 'game') continue;
      const f = sizes.get(e.frame);
      expect(f, e.frame).toBeDefined();
      expect(Math.max(f!.w, f!.h), e.frame).toBe(e.size! * GAME_ATLAS_DENSITY);
    }
    // the procedural frames the views size themselves against
    expect(sizes.get('bar_bg')).toEqual({ w: 40 * GAME_ATLAS_DENSITY, h: 5 * GAME_ATLAS_DENSITY });
    expect(sizes.get('px')).toEqual({ w: 4 * GAME_ATLAS_DENSITY, h: 4 * GAME_ATLAS_DENSITY });
    expect(sizes.get('shadow_s')!.w).toBe(28 * GAME_ATLAS_DENSITY);
  });

  it('every base weapon has exactly one evolution, and there is one character per base weapon', () => {
    const weapons = Object.values(CONTENT.weapons);
    const base = weapons.filter((w) => !w.evolvedOnly);
    const evolved = weapons.filter((w) => w.evolvedOnly);
    expect(evolved).toHaveLength(base.length);
    expect(Object.keys(CONTENT.characters)).toHaveLength(base.length);
    // one starting weapon each, and every base weapon is somebody's
    const starts = Object.values(CONTENT.characters).map((c) => c.startingWeapon);
    expect(new Set(starts).size).toBe(starts.length);
    expect(new Set(starts)).toEqual(new Set(base.map((w) => w.id)));
  });

  it('every weapon behavior is a registered archetype', () => {
    const known = new Set(['slash', 'aimed', 'stream', 'orbit', 'aura', 'pylon', 'chain', 'pivot']);
    for (const w of CONTENT.weaponList) expect(known.has(w.behavior), `${w.id}: ${w.behavior}`).toBe(true);
  });

  it('every evolution is paired with a passive the player can actually be offered', () => {
    // a pair that is locked behind an achievement puts the evolution out of reach of the player
    // who just bought the character, which is five levels of content nobody can see
    for (const w of CONTENT.weaponList) {
      if (!w.evolution) continue;
      expect(CONTENT.passives[w.evolution.requires], `${w.id} pairs with an unknown passive`).toBeTruthy();
      expect(LOCKED_BY_DEFAULT.includes(w.evolution.requires), `${w.id} pairs with the locked ${w.evolution.requires}`).toBe(false);
    }
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
