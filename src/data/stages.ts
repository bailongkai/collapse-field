import type { StageDef, WaveEntry, WaveEvent } from './types';

const mix = (...pairs: [string, number][]) => pairs.map(([enemy, weight]) => ({ enemy, weight }));

/** One row per minute; the spawner tops the field up to minCount in batches of `batch` every `interval` ms. */
const WAVES: readonly WaveEntry[] = [
  { minute: 0, mix: mix(['drone', 1]), minCount: 12, interval: 1500, batch: 2, hpMult: 1.0, dmgMult: 1.0 },
  { minute: 1, mix: mix(['drone', 0.7], ['infected', 0.3]), minCount: 25, interval: 800, batch: 3, hpMult: 1.1, dmgMult: 1.0 },
  { minute: 2, mix: mix(['drone', 0.5], ['infected', 0.5]), minCount: 35, interval: 700, batch: 4, hpMult: 1.2, dmgMult: 1.05 },
  { minute: 3, mix: mix(['drone', 0.35], ['infected', 0.35], ['robot', 0.15], ['spitter', 0.15]), minCount: 50, interval: 650, batch: 4, hpMult: 1.3, dmgMult: 1.05 },
  { minute: 4, mix: mix(['infected', 0.4], ['robot', 0.25], ['interceptor', 0.15], ['spitter', 0.2]), minCount: 60, interval: 600, batch: 5, hpMult: 1.4, dmgMult: 1.1 },
  { minute: 5, mix: mix(['infected', 0.35], ['robot', 0.25], ['interceptor', 0.1], ['spitter', 0.15], ['dasher', 0.15]), minCount: 70, interval: 600, batch: 5, hpMult: 1.5, dmgMult: 1.1 },
  { minute: 6, mix: mix(['infected', 0.3], ['robot', 0.3], ['mech', 0.15], ['spitter', 0.1], ['dasher', 0.15]), minCount: 85, interval: 550, batch: 5, hpMult: 1.65, dmgMult: 1.15 },
  { minute: 7, mix: mix(['drone', 0.2], ['robot', 0.3], ['mech', 0.25], ['spitter', 0.1], ['dasher', 0.15]), minCount: 100, interval: 500, batch: 6, hpMult: 1.8, dmgMult: 1.15 },
  { minute: 8, mix: mix(['infected', 0.25], ['robot', 0.3], ['mech', 0.2], ['spitter', 0.1], ['dasher', 0.15]), minCount: 115, interval: 500, batch: 6, hpMult: 1.95, dmgMult: 1.2 },
  { minute: 9, mix: mix(['robot', 0.3], ['interceptor', 0.2], ['mech', 0.25], ['spitter', 0.1], ['dasher', 0.15]), minCount: 130, interval: 450, batch: 6, hpMult: 2.1, dmgMult: 1.2 },
  { minute: 10, mix: mix(['robot', 0.3], ['mech', 0.3], ['interceptor', 0.1], ['spitter', 0.15], ['dasher', 0.15]), minCount: 150, interval: 450, batch: 7, hpMult: 2.25, dmgMult: 1.25 },
  { minute: 11, mix: mix(['infected', 0.2], ['robot', 0.25], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.15]), minCount: 170, interval: 400, batch: 7, hpMult: 2.4, dmgMult: 1.25 },
  { minute: 12, mix: mix(['drone', 0.2], ['robot', 0.25], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.15]), minCount: 190, interval: 400, batch: 8, hpMult: 2.5, dmgMult: 1.3 },
  { minute: 13, mix: mix(['robot', 0.25], ['interceptor', 0.2], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.15]), minCount: 220, interval: 350, batch: 8, hpMult: 2.5, dmgMult: 1.3 },
  { minute: 14, mix: mix(['robot', 0.2], ['mech', 0.4], ['interceptor', 0.1], ['spitter', 0.15], ['dasher', 0.15]), minCount: 250, interval: 300, batch: 10, hpMult: 2.5, dmgMult: 1.3 },
];

/**
 * Chest cadence across the run: 150 / 300 / 330 / 510 / 600 / 700 / 850 s — five sentinels and two
 * bosses, plus whatever falls out of the wreckage.
 *
 * Before this a run had exactly two chests, both from bosses. That is why builds measured as never
 * finishing: evolving a weapon needs seven levels on that one weapon, the level-up screen offers
 * three cards out of ten items so the weapon a player is trying to finish appears about a third of
 * the time, and with two chests there was no other way to concentrate. Not one run in sixteen ever
 * saw an evolution, which is five weapons of content nobody had played.
 *
 * The sentinel multipliers track measured player output rather than the wave table's own curve:
 * a hands-off run is at roughly 30 damage per second at 3:00 and 180 by 14:00, and each of these
 * is meant to be a five-to-ten second detour at the time it appears.
 */
const EVENTS: readonly WaveEvent[] = [
  { at: 90, kind: 'swarm', enemy: 'interceptor', count: 25, pattern: 'hLine' },
  { at: 150, kind: 'elite', enemy: 'sentinel', hpMult: 1 },
  { at: 210, kind: 'swarm', enemy: 'drone', count: 40, pattern: 'vLine' },
  { at: 300, kind: 'boss', enemy: 'mothership', hpMult: 1 }, // 400 hp: about 23 s of ideal output
  { at: 330, kind: 'elite', enemy: 'sentinel', hpMult: 2 },
  { at: 390, kind: 'swarm', enemy: 'interceptor', count: 35, pattern: 'diag' },
  { at: 510, kind: 'elite', enemy: 'sentinel', hpMult: 3.2 },
  { at: 540, kind: 'swarm', enemy: 'interceptor', count: 40, pattern: 'hLine' },
  { at: 600, kind: 'boss', enemy: 'mothership', hpMult: 5.5 }, // 2200 hp: about 13 s, on a build ten times stronger
  { at: 690, kind: 'ring', enemy: 'robot', count: 40, radius: 520 },
  { at: 700, kind: 'elite', enemy: 'sentinel', hpMult: 4.5 },
  { at: 810, kind: 'swarm', enemy: 'interceptor', count: 50, pattern: 'hLine', speedMult: 1.2 },
  { at: 850, kind: 'elite', enemy: 'sentinel', hpMult: 5.5 },
  { at: 900, kind: 'reaper', enemy: 'annihilator' },
];

export const STAGES = {
  station: {
    id: 'station',
    nameKey: 'stage.station.name',
    durationSec: 900,
    floorTexture: 'floor',
    floorTint: 0xc8d4e6,
    decorFrames: ['decor_0', 'decor_1', 'decor_2', 'decor_3', 'decor_4', 'decor_5', 'decor_6', 'decor_7'],
    waves: WAVES,
    events: EVENTS,
    gemCap: 300,
    spawnMargin: 96,
    despawnFactor: 1.6,
  },
} as const satisfies Record<string, StageDef>;

export type StageId = keyof typeof STAGES;
export const STAGE_LIST: readonly StageDef[] = Object.values(STAGES);
export const DEFAULT_STAGE_ID = 'station';
