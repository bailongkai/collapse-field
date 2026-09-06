import { CONTENT } from './registry';
import { hasKey } from '../../i18n';

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
    check(CONTENT.weapons[d.startingWeapon], `character ${key}: unknown starting weapon "${d.startingWeapon}"`);
    frameOk(d.frame, `character ${key}`);
  }
  for (const [key, s] of Object.entries(CONTENT.stages)) {
    check(s.id === key, `stage ${key}: id mismatch`);
    check(hasKey(s.nameKey), `stage ${key}: missing i18n ${s.nameKey}`);
    const minutes = Math.ceil(s.durationSec / 60);
    check(s.waves.length >= minutes, `stage ${key}: ${s.waves.length} wave rows for ${minutes} minutes`);
    s.waves.forEach((w, i) => {
      check(w.minute === i, `stage ${key}: wave row ${i} has minute ${w.minute}`);
      check(w.mix.length > 0, `stage ${key}: wave ${i} has an empty mix`);
      for (const m of w.mix) check(CONTENT.enemies[m.enemy], `stage ${key}: wave ${i} references unknown enemy "${m.enemy}"`);
      check(w.hpMult <= 2.5 + 1e-9, `stage ${key}: wave ${i} hpMult ${w.hpMult} exceeds the 2.5 cap`);
      check(w.dmgMult <= 1.3 + 1e-9, `stage ${key}: wave ${i} dmgMult ${w.dmgMult} exceeds the 1.3 cap`);
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
  return errors;
}
