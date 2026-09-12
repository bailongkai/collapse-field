import type { StageDef, WaveEntry, WaveEvent } from './types';

const mix = (...pairs: [string, number][]) => pairs.map(([enemy, weight]) => ({ enemy, weight }));
/** Events are authored by theme and sorted here, so inserting one never depends on where it is typed. */
const byTime = (events: readonly WaveEvent[]): readonly WaveEvent[] => events.slice().sort((a, b) => a.at - b.at);

/** One row per minute; the spawner tops the field up to minCount in batches of `batch` every `interval` ms. */
const WAVES: readonly WaveEntry[] = [
  { minute: 0, mix: mix(['drone', 1]), minCount: 12, interval: 1500, batch: 2, hpMult: 1.0, dmgMult: 1.0 },
  { minute: 1, mix: mix(['drone', 0.7], ['infected', 0.3]), minCount: 25, interval: 800, batch: 3, hpMult: 1.1, dmgMult: 1.0 },
  { minute: 2, mix: mix(['drone', 0.45], ['infected', 0.45], ['bomber', 0.1]), minCount: 35, interval: 700, batch: 4, hpMult: 1.2, dmgMult: 1.05 },
  { minute: 3, mix: mix(['drone', 0.3], ['infected', 0.3], ['robot', 0.15], ['spitter', 0.15], ['bomber', 0.1]), minCount: 50, interval: 650, batch: 4, hpMult: 1.3, dmgMult: 1.05 },
  { minute: 4, mix: mix(['infected', 0.4], ['robot', 0.25], ['interceptor', 0.15], ['spitter', 0.2]), minCount: 60, interval: 600, batch: 5, hpMult: 1.4, dmgMult: 1.1 },
  { minute: 5, mix: mix(['infected', 0.3], ['robot', 0.25], ['interceptor', 0.1], ['spitter', 0.1], ['dasher', 0.15], ['medic', 0.05], ['bomber', 0.05]), minCount: 70, interval: 600, batch: 5, hpMult: 1.5, dmgMult: 1.1 },
  { minute: 6, mix: mix(['infected', 0.3], ['robot', 0.3], ['mech', 0.15], ['spitter', 0.1], ['dasher', 0.15]), minCount: 85, interval: 550, batch: 5, hpMult: 1.65, dmgMult: 1.15 },
  { minute: 7, mix: mix(['drone', 0.15], ['robot', 0.3], ['mech', 0.25], ['spitter', 0.1], ['dasher', 0.1], ['medic', 0.05], ['bomber', 0.05]), minCount: 100, interval: 500, batch: 6, hpMult: 1.8, dmgMult: 1.15 },
  { minute: 8, mix: mix(['infected', 0.25], ['robot', 0.3], ['mech', 0.2], ['spitter', 0.1], ['dasher', 0.15]), minCount: 115, interval: 500, batch: 6, hpMult: 1.95, dmgMult: 1.2 },
  { minute: 9, mix: mix(['robot', 0.3], ['interceptor', 0.15], ['mech', 0.25], ['spitter', 0.1], ['dasher', 0.08], ['hound', 0.12]), minCount: 130, interval: 450, batch: 6, hpMult: 2.1, dmgMult: 1.2 },
  { minute: 10, mix: mix(['robot', 0.22], ['mech', 0.3], ['interceptor', 0.05], ['spitter', 0.1], ['dasher', 0.08], ['medic', 0.07], ['bomber', 0.06], ['hound', 0.12]), minCount: 150, interval: 450, batch: 7, hpMult: 2.25, dmgMult: 1.25 },
  { minute: 11, mix: mix(['infected', 0.2], ['robot', 0.22], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.06], ['hound', 0.12]), minCount: 170, interval: 400, batch: 7, hpMult: 2.4, dmgMult: 1.25 },
  { minute: 12, mix: mix(['drone', 0.12], ['robot', 0.23], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.1], ['hound', 0.15]), minCount: 190, interval: 400, batch: 8, hpMult: 2.7, dmgMult: 1.35 },
  { minute: 13, mix: mix(['robot', 0.18], ['interceptor', 0.07], ['mech', 0.3], ['spitter', 0.1], ['dasher', 0.08], ['medic', 0.07], ['bomber', 0.05], ['hound', 0.15]), minCount: 220, interval: 350, batch: 8, hpMult: 2.95, dmgMult: 1.4 },
  { minute: 14, mix: mix(['robot', 0.2], ['mech', 0.4], ['interceptor', 0.05], ['spitter', 0.1], ['dasher', 0.1], ['hound', 0.15]), minCount: 250, interval: 300, batch: 10, hpMult: 3.2, dmgMult: 1.45 },
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
const EVENTS: readonly WaveEvent[] = byTime([
  { at: 90, kind: 'swarm', enemy: 'interceptor', count: 25, pattern: 'hLine' },
  { at: 150, kind: 'elite', enemy: 'sentinel', hpMult: 1 },
  { at: 210, kind: 'swarm', enemy: 'drone', count: 40, pattern: 'vLine' },
  { at: 300, kind: 'boss', enemy: 'mothership', hpMult: 1 }, // 400 hp: about 23 s of ideal output
  { at: 330, kind: 'elite', enemy: 'sentinel', hpMult: 2 },
  { at: 390, kind: 'swarm', enemy: 'interceptor', count: 35, pattern: 'diag' },
  { at: 510, kind: 'elite', enemy: 'sentinel', hpMult: 3.2 },
  { at: 540, kind: 'encircle', enemy: 'interceptor', count: 16, gapEvery: 5 },
  { at: 600, kind: 'boss', enemy: 'mothership', hpMult: 5.5 }, // 2200 hp: about 13 s, on a build ten times stronger
  { at: 690, kind: 'ring', enemy: 'robot', count: 40, radius: 520 },
  { at: 660, kind: 'encircle', enemy: 'robot', count: 16, gapEvery: 5 },
  { at: 700, kind: 'elite', enemy: 'sentinel', hpMult: 4.5 },
  { at: 750, kind: 'encircle', enemy: 'hound', count: 14, gapEvery: 4 },
  { at: 810, kind: 'swarm', enemy: 'interceptor', count: 50, pattern: 'hLine', speedMult: 1.2 },
  { at: 850, kind: 'elite', enemy: 'sentinel', hpMult: 5.5 },
  { at: 870, kind: 'encircle', enemy: 'hound', count: 18, gapEvery: 5 },
  { at: 900, kind: 'reaper', enemy: 'annihilator' },
]);

/** 货运甲板: fewer, harder bodies. The density is low so every hit lands on something that matters. */
const CARGO_WAVES: readonly WaveEntry[] = [
  { minute: 0, mix: mix(['drone', 0.8], ['robot', 0.2]), minCount: 14, interval: 1300, batch: 2, hpMult: 1.0, dmgMult: 1.0 },
  { minute: 1, mix: mix(['drone', 0.6], ['robot', 0.3], ['dasher', 0.1]), minCount: 22, interval: 900, batch: 3, hpMult: 1.05, dmgMult: 1.0 },
  { minute: 2, mix: mix(['drone', 0.45], ['robot', 0.35], ['dasher', 0.2]), minCount: 30, interval: 800, batch: 3, hpMult: 1.15, dmgMult: 1.05 },
  { minute: 3, mix: mix(['drone', 0.3], ['robot', 0.4], ['dasher', 0.2], ['mech', 0.1]), minCount: 36, interval: 750, batch: 3, hpMult: 1.3, dmgMult: 1.05 },
  { minute: 4, mix: mix(['drone', 0.2], ['robot', 0.35], ['dasher', 0.2], ['mech', 0.15], ['loader', 0.05], ['tractor', 0.05]), minCount: 42, interval: 700, batch: 4, hpMult: 1.45, dmgMult: 1.1 },
  { minute: 5, mix: mix(['robot', 0.45], ['dasher', 0.2], ['mech', 0.25], ['loader', 0.1]), minCount: 48, interval: 700, batch: 4, hpMult: 1.6, dmgMult: 1.1 },
  { minute: 6, mix: mix(['robot', 0.35], ['dasher', 0.15], ['mech', 0.25], ['loader', 0.12], ['tractor', 0.06], ['repairDrone', 0.07]), minCount: 54, interval: 650, batch: 4, hpMult: 1.75, dmgMult: 1.15 },
  { minute: 7, mix: mix(['robot', 0.35], ['dasher', 0.2], ['mech', 0.3], ['loader', 0.15]), minCount: 60, interval: 600, batch: 4, hpMult: 1.9, dmgMult: 1.15 },
  { minute: 8, mix: mix(['robot', 0.3], ['dasher', 0.2], ['mech', 0.3], ['loader', 0.2]), minCount: 66, interval: 600, batch: 5, hpMult: 2.05, dmgMult: 1.2 },
  { minute: 9, mix: mix(['robot', 0.22], ['dasher', 0.12], ['mech', 0.3], ['loader', 0.15], ['tractor', 0.07], ['repairDrone', 0.06], ['hound', 0.08]), minCount: 72, interval: 550, batch: 5, hpMult: 2.2, dmgMult: 1.2 },
  { minute: 10, mix: mix(['robot', 0.2], ['dasher', 0.15], ['mech', 0.3], ['loader', 0.23], ['hound', 0.12]), minCount: 86, interval: 550, batch: 5, hpMult: 2.3, dmgMult: 1.25 },
  { minute: 11, mix: mix(['robot', 0.15], ['dasher', 0.15], ['mech', 0.35], ['loader', 0.23], ['hound', 0.12]), minCount: 94, interval: 500, batch: 5, hpMult: 2.4, dmgMult: 1.25 },
  { minute: 12, mix: mix(['robot', 0.12], ['dasher', 0.12], ['mech', 0.3], ['loader', 0.25], ['tractor', 0.07], ['repairDrone', 0.06], ['hound', 0.08]), minCount: 92, interval: 500, batch: 6, hpMult: 2.7, dmgMult: 1.35 },
  { minute: 13, mix: mix(['dasher', 0.18], ['mech', 0.35], ['loader', 0.33], ['hound', 0.14]), minCount: 112, interval: 450, batch: 6, hpMult: 2.95, dmgMult: 1.4 },
  { minute: 14, mix: mix(['dasher', 0.15], ['mech', 0.35], ['loader', 0.35], ['hound', 0.15]), minCount: 124, interval: 450, batch: 6, hpMult: 3.2, dmgMult: 1.45 },
];
const CARGO_EVENTS: readonly WaveEvent[] = byTime([
  { at: 90, kind: 'swarm', enemy: 'drone', count: 30, pattern: 'hLine' },
  { at: 150, kind: 'elite', enemy: 'sentinel', hpMult: 1.4 },
  { at: 240, kind: 'swarm', enemy: 'dasher', count: 16, pattern: 'hLine' },
  { at: 300, kind: 'boss', enemy: 'hauler', hpMult: 1 },
  { at: 330, kind: 'elite', enemy: 'sentinel', hpMult: 2.4 },
  { at: 420, kind: 'ring', enemy: 'mech', count: 14, radius: 480 },
  { at: 510, kind: 'elite', enemy: 'sentinel', hpMult: 3.6 },
  { at: 540, kind: 'encircle', enemy: 'robot', count: 12, gapEvery: 4 },
  { at: 570, kind: 'swarm', enemy: 'dasher', count: 24, pattern: 'diag' },
  { at: 600, kind: 'boss', enemy: 'hauler', hpMult: 4.5 },
  { at: 660, kind: 'encircle', enemy: 'hound', count: 12, gapEvery: 4 },
  { at: 700, kind: 'elite', enemy: 'sentinel', hpMult: 5 },
  { at: 750, kind: 'ring', enemy: 'loader', count: 12, radius: 520 },
  { at: 780, kind: 'encircle', enemy: 'hound', count: 12, gapEvery: 4 },
  { at: 850, kind: 'elite', enemy: 'sentinel', hpMult: 6 },
  { at: 900, kind: 'reaper', enemy: 'annihilator' },
]);

/** 生物实验舱: numbers. Weak bodies in great quantity, with the swarm events doubled. */
const LAB_WAVES: readonly WaveEntry[] = [
  { minute: 0, mix: mix(['spore', 0.6], ['infected', 0.4]), minCount: 24, interval: 900, batch: 4, hpMult: 1.0, dmgMult: 1.0 },
  { minute: 1, mix: mix(['spore', 0.55], ['infected', 0.45]), minCount: 40, interval: 600, batch: 5, hpMult: 1.05, dmgMult: 1.0 },
  { minute: 2, mix: mix(['spore', 0.5], ['infected', 0.4], ['spitter', 0.1]), minCount: 60, interval: 500, batch: 6, hpMult: 1.1, dmgMult: 1.0 },
  { minute: 3, mix: mix(['spore', 0.4], ['infected', 0.35], ['spitter', 0.15], ['splitter', 0.1]), minCount: 80, interval: 450, batch: 7, hpMult: 1.2, dmgMult: 1.05 },
  { minute: 4, mix: mix(['spore', 0.45], ['infected', 0.35], ['spitter', 0.2]), minCount: 100, interval: 400, batch: 8, hpMult: 1.3, dmgMult: 1.05 },
  { minute: 5, mix: mix(['spore', 0.4], ['infected', 0.35], ['spitter', 0.2], ['dasher', 0.05]), minCount: 120, interval: 400, batch: 8, hpMult: 1.4, dmgMult: 1.1 },
  { minute: 6, mix: mix(['spore', 0.35], ['infected', 0.25], ['spitter', 0.2], ['dasher', 0.05], ['splitter', 0.15]), minCount: 140, interval: 350, batch: 9, hpMult: 1.5, dmgMult: 1.1 },
  { minute: 7, mix: mix(['spore', 0.35], ['infected', 0.35], ['spitter', 0.2], ['dasher', 0.1]), minCount: 160, interval: 350, batch: 10, hpMult: 1.6, dmgMult: 1.15 },
  { minute: 8, mix: mix(['spore', 0.35], ['infected', 0.3], ['spitter', 0.25], ['dasher', 0.1]), minCount: 180, interval: 300, batch: 10, hpMult: 1.75, dmgMult: 1.15 },
  { minute: 9, mix: mix(['spore', 0.3], ['infected', 0.22], ['spitter', 0.2], ['dasher', 0.08], ['splitter', 0.12], ['hound', 0.08]), minCount: 200, interval: 300, batch: 11, hpMult: 1.9, dmgMult: 1.2 },
  { minute: 10, mix: mix(['spore', 0.3], ['infected', 0.3], ['spitter', 0.25], ['dasher', 0.15]), minCount: 220, interval: 280, batch: 12, hpMult: 2.05, dmgMult: 1.2 },
  { minute: 11, mix: mix(['spore', 0.3], ['infected', 0.3], ['spitter', 0.25], ['dasher', 0.15]), minCount: 240, interval: 260, batch: 12, hpMult: 2.2, dmgMult: 1.25 },
  { minute: 12, mix: mix(['spore', 0.25], ['infected', 0.17], ['spitter', 0.25], ['dasher', 0.08], ['splitter', 0.17], ['hound', 0.08]), minCount: 260, interval: 250, batch: 13, hpMult: 2.6, dmgMult: 1.32 },
  { minute: 13, mix: mix(['spore', 0.25], ['infected', 0.3], ['spitter', 0.3], ['dasher', 0.15]), minCount: 280, interval: 240, batch: 14, hpMult: 2.85, dmgMult: 1.38 },
  { minute: 14, mix: mix(['spore', 0.2], ['infected', 0.3], ['spitter', 0.3], ['dasher', 0.2]), minCount: 300, interval: 220, batch: 15, hpMult: 3.1, dmgMult: 1.45 },
];
const LAB_EVENTS: readonly WaveEvent[] = byTime([
  { at: 60, kind: 'swarm', enemy: 'spore', count: 50, pattern: 'hLine' },
  { at: 150, kind: 'elite', enemy: 'sentinel', hpMult: 1 },
  { at: 180, kind: 'swarm', enemy: 'infected', count: 40, pattern: 'vLine' },
  { at: 240, kind: 'swarm', enemy: 'spore', count: 80, pattern: 'diag' },
  { at: 270, kind: 'ring', enemy: 'hatchery', count: 3, radius: 380 },
  { at: 300, kind: 'boss', enemy: 'broodmother', hpMult: 1 },
  { at: 330, kind: 'elite', enemy: 'sentinel', hpMult: 2 },
  { at: 390, kind: 'swarm', enemy: 'spore', count: 100, pattern: 'hLine' },
  { at: 450, kind: 'ring', enemy: 'infected', count: 60, radius: 500 },
  { at: 480, kind: 'ring', enemy: 'hatchery', count: 4, radius: 420 },
  { at: 560, kind: 'hatchAll', enemy: 'spore', count: 10 },
  { at: 510, kind: 'elite', enemy: 'sentinel', hpMult: 3.2 },
  { at: 540, kind: 'encircle', enemy: 'infected', count: 18, gapEvery: 6, speedMult: 1.1 },
  { at: 600, kind: 'boss', enemy: 'broodmother', hpMult: 4 },
  { at: 690, kind: 'swarm', enemy: 'infected', count: 70, pattern: 'diag' },
  { at: 700, kind: 'elite', enemy: 'sentinel', hpMult: 4.5 },
  { at: 720, kind: 'ring', enemy: 'hatchery', count: 5, radius: 440 },
  { at: 800, kind: 'hatchAll', enemy: 'spore', count: 14 },
  { at: 780, kind: 'ring', enemy: 'spitter', count: 40, radius: 520 },
  { at: 810, kind: 'encircle', enemy: 'hound', count: 12, gapEvery: 4 },
  { at: 850, kind: 'elite', enemy: 'sentinel', hpMult: 5.5 },
  { at: 900, kind: 'reaper', enemy: 'annihilator' },
]);

/**
 * 外层轨道: speed. Everything here moves faster than it does anywhere else, and from minute six
 * the ordinary spawns are quicker than the player, so a straight line stops being an answer.
 */
const ORBIT_WAVES: readonly WaveEntry[] = [
  { minute: 0, mix: mix(['drone', 1]), minCount: 12, interval: 1400, batch: 2, hpMult: 1.0, dmgMult: 1.0 },
  { minute: 1, mix: mix(['drone', 0.95], ['interceptor', 0.05]), minCount: 20, interval: 900, batch: 3, hpMult: 1.1, dmgMult: 1.0 },
  { minute: 2, mix: mix(['drone', 0.8], ['interceptor', 0.1], ['infected', 0.1]), minCount: 28, interval: 800, batch: 3, hpMult: 1.2, dmgMult: 1.05 },
  { minute: 3, mix: mix(['drone', 0.6], ['raider', 0.1], ['interceptor', 0.15], ['escort', 0.05], ['infected', 0.1]), minCount: 36, interval: 700, batch: 4, hpMult: 1.3, dmgMult: 1.05 },
  { minute: 4, mix: mix(['drone', 0.4], ['raider', 0.2], ['interceptor', 0.15], ['escort', 0.1], ['infected', 0.1], ['minelayer', 0.05]), minCount: 46, interval: 650, batch: 4, hpMult: 1.4, dmgMult: 1.1, speedMult: 1.05 },
  { minute: 5, mix: mix(['drone', 0.25], ['raider', 0.3], ['interceptor', 0.2], ['escort', 0.15], ['dasher', 0.1]), minCount: 60, interval: 600, batch: 5, hpMult: 1.5, dmgMult: 1.1, speedMult: 1.1 },
  { minute: 6, mix: mix(['raider', 0.3], ['interceptor', 0.25], ['escort', 0.2], ['dasher', 0.1], ['minelayer', 0.07], ['phaser', 0.08]), minCount: 72, interval: 550, batch: 5, hpMult: 1.65, dmgMult: 1.15, speedMult: 1.15 },
  { minute: 7, mix: mix(['raider', 0.35], ['interceptor', 0.3], ['escort', 0.2], ['mech', 0.15]), minCount: 85, interval: 500, batch: 6, hpMult: 1.8, dmgMult: 1.15, speedMult: 1.2 },
  { minute: 8, mix: mix(['raider', 0.3], ['interceptor', 0.3], ['escort', 0.25], ['mech', 0.15]), minCount: 100, interval: 500, batch: 6, hpMult: 1.95, dmgMult: 1.2, speedMult: 1.2 },
  { minute: 9, mix: mix(['raider', 0.3], ['interceptor', 0.25], ['escort', 0.2], ['dasher', 0.1], ['minelayer', 0.07], ['phaser', 0.08]), minCount: 115, interval: 450, batch: 6, hpMult: 2.1, dmgMult: 1.2, speedMult: 1.25 },
  { minute: 10, mix: mix(['raider', 0.3], ['interceptor', 0.3], ['escort', 0.2], ['mech', 0.2]), minCount: 135, interval: 450, batch: 7, hpMult: 2.25, dmgMult: 1.25, speedMult: 1.3 },
  { minute: 11, mix: mix(['raider', 0.3], ['interceptor', 0.3], ['escort', 0.25], ['dasher', 0.15]), minCount: 155, interval: 400, batch: 7, hpMult: 2.4, dmgMult: 1.25, speedMult: 1.3 },
  { minute: 12, mix: mix(['raider', 0.3], ['interceptor', 0.25], ['escort', 0.15], ['mech', 0.15], ['minelayer', 0.07], ['phaser', 0.08]), minCount: 175, interval: 400, batch: 8, hpMult: 2.5, dmgMult: 1.3, speedMult: 1.35 },
  { minute: 13, mix: mix(['raider', 0.3], ['interceptor', 0.3], ['escort', 0.25], ['dasher', 0.15]), minCount: 200, interval: 350, batch: 8, hpMult: 2.5, dmgMult: 1.3, speedMult: 1.4 },
  { minute: 14, mix: mix(['raider', 0.35], ['interceptor', 0.3], ['escort', 0.2], ['mech', 0.15]), minCount: 230, interval: 300, batch: 10, hpMult: 2.5, dmgMult: 1.3, speedMult: 1.45 },
];
const ORBIT_EVENTS: readonly WaveEvent[] = byTime([
  { at: 90, kind: 'swarm', enemy: 'drone', count: 25, pattern: 'hLine', speedMult: 1.2 },
  { at: 150, kind: 'elite', enemy: 'sentinel', hpMult: 1 },
  { at: 210, kind: 'swarm', enemy: 'interceptor', count: 40, pattern: 'vLine', speedMult: 1.2 },
  { at: 300, kind: 'boss', enemy: 'flagship', hpMult: 1 },
  { at: 330, kind: 'elite', enemy: 'sentinel', hpMult: 2 },
  { at: 390, kind: 'swarm', enemy: 'raider', count: 35, pattern: 'diag', speedMult: 1.3 },
  { at: 420, kind: 'swarm', enemy: 'asteroid', count: 22, pattern: 'hLine', speedMult: 1.6 },
  { at: 510, kind: 'elite', enemy: 'sentinel', hpMult: 3.2 },
  { at: 540, kind: 'ring', enemy: 'escort', count: 24, radius: 520 },
  { at: 600, kind: 'boss', enemy: 'flagship', hpMult: 4 },
  { at: 690, kind: 'ring', enemy: 'raider', count: 50, radius: 520 },
  { at: 740, kind: 'swarm', enemy: 'asteroid', count: 28, pattern: 'diag', speedMult: 1.8 },
  { at: 700, kind: 'elite', enemy: 'sentinel', hpMult: 4.5 },
  { at: 810, kind: 'swarm', enemy: 'interceptor', count: 60, pattern: 'hLine', speedMult: 1.4 },
  { at: 850, kind: 'elite', enemy: 'sentinel', hpMult: 5.5 },
  { at: 900, kind: 'reaper', enemy: 'annihilator' },
]);

export const STAGES = {
  station: {
    id: 'station',
    nameKey: 'stage.station.name',
    descKey: 'stage.station.desc',
    order: 0,
    durationSec: 900,
    floorTexture: 'floor_station',
    floorTint: 0xffffff,
    decorFrames: ['decor_0', 'decor_1', 'decor_2', 'decor_3', 'decor_4', 'decor_5', 'decor_6', 'decor_7'],
    waves: WAVES,
    events: EVENTS,
    props: { enemy: 'crate', everyMs: 9000, max: 6 },
    relics: [
      { pickup: 'relicVacuum', x: 1400, y: -900 },
      { pickup: 'relicNuke', x: -1600, y: 1100 },
      { pickup: 'relicChest', x: 300, y: 2200 },
    ],
    gemCap: 300,
    spawnMargin: 96,
    despawnFactor: 1.6,
  },
  cargo: {
    id: 'cargo',
    nameKey: 'stage.cargo.name',
    descKey: 'stage.cargo.desc',
    order: 1,
    durationSec: 900,
    floorTexture: 'floor_cargo',
    floorTint: 0xffffff,
    decorFrames: ['decor_cargo_0', 'decor_cargo_1', 'decor_cargo_2', 'decor_cargo_3', 'decor_cargo_4'],
    waves: CARGO_WAVES,
    events: CARGO_EVENTS,
    props: { enemy: 'crate', everyMs: 6000, max: 10 },
    // Stacked containers in two rings of lanes around the start. Wide enough to run between,
    // long enough that a crowd on the far side has to come round.
    obstacles: [
      // the inner yard is in view from the first frame: the lanes are the deck's first impression
      { x: -520, y: -330, w: 360, h: 70, frame: 'wall_orange' },
      { x: 160, y: -330, w: 360, h: 70, frame: 'wall_grey' },
      { x: -520, y: 260, w: 360, h: 70, frame: 'wall_grey' },
      { x: 160, y: 260, w: 360, h: 70, frame: 'wall_orange' },
      { x: -600, y: -150, w: 70, h: 300, frame: 'wall_orange' },
      { x: 530, y: -150, w: 70, h: 300, frame: 'wall_grey' },
      // and an outer ring a screen away, so there is always a wall to put between you and a crowd
      { x: -1500, y: -900, w: 520, h: 70, frame: 'wall_grey' },
      { x: 980, y: -900, w: 520, h: 70, frame: 'wall_orange' },
      { x: -1500, y: 830, w: 520, h: 70, frame: 'wall_orange' },
      { x: 980, y: 830, w: 520, h: 70, frame: 'wall_grey' },
      { x: -1700, y: -300, w: 70, h: 600, frame: 'wall_grey' },
      { x: 1630, y: -300, w: 70, h: 600, frame: 'wall_orange' },
    ],
    relics: [
      { pickup: 'relicNuke', x: -1500, y: -1200 },
      { pickup: 'relicVacuum', x: 1800, y: 600 },
      { pickup: 'relicChest', x: -400, y: 2300 },
    ],
    gemCap: 300,
    spawnMargin: 96,
    despawnFactor: 1.6,
  },
  lab: {
    id: 'lab',
    nameKey: 'stage.lab.name',
    descKey: 'stage.lab.desc',
    order: 2,
    durationSec: 900,
    floorTexture: 'floor_lab',
    floorTint: 0xffffff,
    decorFrames: ['decor_lab_0', 'decor_lab_1', 'decor_lab_2', 'decor_lab_3', 'decor_lab_4', 'decor_lab_5', 'decor_lab_6'],
    waves: LAB_WAVES,
    events: LAB_EVENTS,
    props: { enemy: 'canister', everyMs: 8000, max: 6 },
    relics: [
      { pickup: 'relicVacuum', x: -1300, y: -1300 },
      { pickup: 'relicNuke', x: 1700, y: 900 },
      { pickup: 'relicChest', x: 2200, y: -500 },
    ],
    // more bodies means more gems; the cap goes up so late experience is not folded away
    gemCap: 400,
    spawnMargin: 96,
    despawnFactor: 1.6,
  },
  orbit: {
    id: 'orbit',
    nameKey: 'stage.orbit.name',
    descKey: 'stage.orbit.desc',
    order: 3,
    durationSec: 900,
    floorTexture: 'floor_orbit',
    floorTint: 0xffffff,
    decorFrames: ['decor_orbit_0', 'decor_orbit_1', 'decor_orbit_2', 'decor_orbit_3', 'decor_orbit_4', 'decor_orbit_5'],
    waves: ORBIT_WAVES,
    events: ORBIT_EVENTS,
    props: { enemy: 'asteroid', everyMs: 7000, max: 8 },
    relics: [
      { pickup: 'relicNuke', x: 1600, y: -1400 },
      { pickup: 'relicVacuum', x: -1900, y: -300 },
      { pickup: 'relicChest', x: 200, y: 2400 },
    ],
    gemCap: 300,
    spawnMargin: 120,
    despawnFactor: 1.6,
  },
} as const satisfies Record<string, StageDef>;

/** Stages in campaign order. */
export const STAGE_ORDER: readonly StageDef[] = Object.values(STAGES).slice().sort((a, b) => a.order - b.order);

export type StageId = keyof typeof STAGES;
export const STAGE_LIST: readonly StageDef[] = Object.values(STAGES);
export const DEFAULT_STAGE_ID = 'station';
