import { CONTENT } from './registry';
import { hasKey } from '../../i18n';
import { UPGRADES, type UpgradeDef } from '../../data/upgrades';
import { STAT_KEYS } from '../../data/types';

/**
 * Cross-checks the content tables: ids match their keys, referenced ids exist, i18n keys exist,
 * wave rows cover every minute and multipliers stay inside the balance caps. Used by the unit
 * test and callable at runtime for a fail-fast in dev.
 */
export function validateContent(frames?: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const check = (cond: unknown, msg: string) => {
    if (!cond) errors.push(msg);
  };
  const frameOk = (frame: string, where: string) => {
    if (frames && !frames.has(frame)) errors.push(`${where}: missing atlas frame "${frame}"`);
  };

  for (const [key, d] of Object.entries(CONTENT.weapons)) {
    check(d.id === key, `weapon ${key}: id "${d.id}" does not match its key`);
    check(hasKey(d.nameKey), `weapon ${key}: missing i18n ${d.nameKey}`);
    check(hasKey(d.descKey), `weapon ${key}: missing i18n ${d.descKey}`);
    check(d.levels.length === d.maxLevel - 1, `weapon ${key}: expected ${d.maxLevel - 1} level deltas, got ${d.levels.length}`);
    frameOk(d.visual.frame, `weapon ${key}`);
    frameOk(d.icon, `weapon ${key} icon`);
    if (d.evolution) {
      check(CONTENT.passives[d.evolution.requires], `weapon ${key}: evolution requires unknown passive "${d.evolution.requires}"`);
      check(CONTENT.weapons[d.evolution.into], `weapon ${key}: evolves into unknown weapon "${d.evolution.into}"`);
      check(CONTENT.weapons[d.evolution.into]?.evolvedOnly, `weapon ${key}: evolution target "${d.evolution.into}" must be evolvedOnly`);
    }
    if (d.evolvedOnly) check(d.rarity === 0, `weapon ${key}: an evolution must have rarity 0`);
  }
  for (const [key, d] of Object.entries(CONTENT.passives)) {
    check(d.id === key, `passive ${key}: id mismatch`);
    check(hasKey(d.nameKey), `passive ${key}: missing i18n ${d.nameKey}`);
    check(hasKey(d.descKey), `passive ${key}: missing i18n ${d.descKey}`);
    check(Object.keys(d.perLevel).length > 0, `passive ${key}: perLevel is empty`);
    frameOk(d.icon, `passive ${key} icon`);
  }
  for (const [key, d] of Object.entries(CONTENT.enemies)) {
    check(d.id === key, `enemy ${key}: id mismatch`);
    check(hasKey(d.nameKey), `enemy ${key}: missing i18n ${d.nameKey}`);
    frameOk(d.frame, `enemy ${key}`);
    check(d.behavior !== 'ranged' || d.ranged, `enemy ${key}: ranged behavior needs a ranged config`);
    check(d.behavior !== 'dasher' || d.dash, `enemy ${key}: dasher behavior needs a dash config`);
    check(d.behavior !== 'bomber' || d.explode, `enemy ${key}: bomber behavior needs an explode config`);
    check(d.behavior !== 'healer' || d.heal, `enemy ${key}: healer behavior needs a heal config`);
    check(d.behavior !== 'tractor' || d.tractor, `enemy ${key}: tractor behavior needs a tractor config`);
    check(d.behavior !== 'nest' || d.nest, `enemy ${key}: nest behavior needs a nest config`);
    check(d.behavior !== 'blink' || d.blink, `enemy ${key}: blink behavior needs a blink config`);
    check(d.behavior !== 'layer' || d.layer, `enemy ${key}: layer behavior needs a layer config`);
    if (d.nest) check(CONTENT.enemies[d.nest.summon], `enemy ${key}: nest hatches unknown enemy "${d.nest.summon}"`);
    if (d.layer) check(CONTENT.enemies[d.layer.mine]?.behavior === 'bomber', `enemy ${key}: layer must lay a bomber, got "${d.layer.mine}"`);
    if (d.split) check(CONTENT.enemies[d.split.enemy] && !CONTENT.enemies[d.split.enemy]?.split, `enemy ${key}: split spawns "${d.split.enemy}", which must exist and not itself split`);
    if (d.boss) check(CONTENT.enemies[d.boss.summon], `enemy ${key}: boss summons unknown enemy "${d.boss.summon}"`);
    for (const drop of d.drops ?? []) check(CONTENT.pickups[drop.pickup], `enemy ${key}: unknown drop "${drop.pickup}"`);
  }
  for (const [key, d] of Object.entries(CONTENT.pickups)) {
    check(d.id === key, `pickup ${key}: id mismatch`);
    check(hasKey(d.nameKey), `pickup ${key}: missing i18n ${d.nameKey}`);
    frameOk(d.frame, `pickup ${key}`);
  }
  for (const [key, d] of Object.entries(CONTENT.characters)) {
    check(d.id === key, `character ${key}: id mismatch`);
    check(hasKey(d.nameKey), `character ${key}: missing i18n ${d.nameKey}`);
    check(hasKey(d.descKey), `character ${key}: missing i18n ${d.descKey}`);
    check(CONTENT.weapons[d.startingWeapon], `character ${key}: unknown starting weapon "${d.startingWeapon}"`);
    check(d.cost === undefined || d.cost > 0, `character ${key}: cost must be positive when present`);
    check(hasKey(d.signature.nameKey), `character ${key}: missing i18n ${d.signature.nameKey}`);
    check(hasKey(d.signature.descKey), `character ${key}: missing i18n ${d.signature.descKey}`);
    frameOk(d.frame, `character ${key}`);
  }
  const orders = Object.values(CONTENT.stages).map((s) => s.order).sort((a, b) => a - b);
  check(orders.every((o, i) => o === i), `stages: orders must be 0..n-1, got ${orders.join(',')}`);
  for (const [key, s] of Object.entries(CONTENT.stages)) {
    check(s.id === key, `stage ${key}: id mismatch`);
    check(hasKey(s.nameKey), `stage ${key}: missing i18n ${s.nameKey}`);
    check(hasKey(s.descKey), `stage ${key}: missing i18n ${s.descKey}`);
    const minutes = Math.ceil(s.durationSec / 60);
    check(s.waves.length >= minutes, `stage ${key}: ${s.waves.length} wave rows for ${minutes} minutes`);
    s.waves.forEach((w, i) => {
      check(w.minute === i, `stage ${key}: wave row ${i} has minute ${w.minute}`);
      check(w.mix.length > 0, `stage ${key}: wave ${i} has an empty mix`);
      for (const m of w.mix) check(CONTENT.enemies[m.enemy], `stage ${key}: wave ${i} references unknown enemy "${m.enemy}"`);
      check(w.hpMult <= 2.5 + 1e-9, `stage ${key}: wave ${i} hpMult ${w.hpMult} exceeds the 2.5 cap`);
      check(w.dmgMult <= 1.3 + 1e-9, `stage ${key}: wave ${i} dmgMult ${w.dmgMult} exceeds the 1.3 cap`);
      check((w.speedMult ?? 1) <= 1.5 + 1e-9, `stage ${key}: wave ${i} speedMult ${w.speedMult} exceeds the 1.5 cap`);
      check(w.minCount > 0 && w.interval > 0 && w.batch > 0, `stage ${key}: wave ${i} has a non-positive count/interval/batch`);
    });
    let prev = -1;
    s.events.forEach((e, i) => {
      check(e.at >= prev, `stage ${key}: events are not sorted at index ${i}`);
      prev = e.at;
      check(CONTENT.enemies[e.enemy], `stage ${key}: event ${i} references unknown enemy "${e.enemy}"`);
    });
    check(s.events.some((e) => e.kind === 'reaper'), `stage ${key}: no reaper event`);
    for (const f of s.decorFrames) frameOk(f, `stage ${key} decor`);
  }
  for (const [key, u] of Object.entries(UPGRADES) as [string, UpgradeDef][]) {
    check(u.id === key, `upgrade ${key}: id mismatch`);
    check(hasKey(u.nameKey), `upgrade ${key}: missing i18n ${u.nameKey}`);
    check(hasKey(u.descKey), `upgrade ${key}: missing i18n ${u.descKey}`);
    check((u.stat !== undefined) !== (u.charge !== undefined), `upgrade ${key}: exactly one of stat or charge`);
    check(u.stat === undefined || STAT_KEYS.includes(u.stat), `upgrade ${key}: unknown stat ${u.stat}`);
    check(u.costs.length === u.maxLevel, `upgrade ${key}: ${u.costs.length} costs for ${u.maxLevel} levels`);
    frameOk(u.icon, `upgrade ${key} icon`);
  }
  return errors;
}
