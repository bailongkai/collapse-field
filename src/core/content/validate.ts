import { CONTENT } from './registry';
import { hasKey } from '../../i18n';
import { UPGRADES, type UpgradeDef } from '../../data/upgrades';
import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
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
    check(d.behavior !== 'prop' || d.damage === 0, `enemy ${key}: scenery must not bite`);
    check(d.behavior !== 'mortar' || !!d.mortar, `enemy ${key}: mortar behavior needs a mortar config`);
    check(d.behavior !== 'bulwark' || !!d.bulwark, `enemy ${key}: bulwark behavior needs a bulwark config`);
    check(d.behavior !== 'scavenger' || !!d.scavenge, `enemy ${key}: scavenger behavior needs a scavenge config`);
    check(d.behavior !== 'tether' || !!d.tether, `enemy ${key}: tether behavior needs a tether config`);
    check(d.behavior !== 'mire' || !!d.mire, `enemy ${key}: mire behavior needs a mire config`);
    check(d.behavior !== 'flanker' || !!d.flank, `enemy ${key}: flanker behavior needs a flank config`);
    check(d.behavior !== 'suppressor' || !!d.suppress, `enemy ${key}: suppressor behavior needs a suppress config`);
    // a pool that bites would burn the player's i-frames without ever being a threat they can read
    check(d.behavior !== 'mire' || d.damage === 0, `enemy ${key}: a mire must deal no contact damage`);
    // the shield reads off the sprite's rotation, which only a non-faceTarget body has
    check(d.behavior !== 'bulwark' || d.faceTarget === false, `enemy ${key}: a bulwark must not be faceTarget, its front has to be visible`);
    if (d.mortar) check(CONTENT.enemies[d.mortar.shell]?.behavior === 'bomber', `enemy ${key}: mortar must lob a bomber, got "${d.mortar.shell}"`);
    if (d.nest) check(CONTENT.enemies[d.nest.summon], `enemy ${key}: nest hatches unknown enemy "${d.nest.summon}"`);
    if (d.layer) check(CONTENT.enemies[d.layer.mine]?.behavior === 'bomber', `enemy ${key}: layer must lay a bomber, got "${d.layer.mine}"`);
    if (d.split) check(CONTENT.enemies[d.split.enemy] && !CONTENT.enemies[d.split.enemy]?.split, `enemy ${key}: split spawns "${d.split.enemy}", which must exist and not itself split`);
    if (d.boss) check(CONTENT.enemies[d.boss.summon], `enemy ${key}: boss summons unknown enemy "${d.boss.summon}"`);
    if (d.boss?.mine) check(CONTENT.enemies[d.boss.mine.enemy]?.behavior === 'bomber', `enemy ${key}: boss must lay a bomber, got "${d.boss.mine.enemy}"`);
    if (d.boss?.final) check(d.bossBar === true && d.behavior === 'boss', `enemy ${key}: a final boss must be a boss with a bar`);
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
      check(w.hpMult <= 3.2 + 1e-9, `stage ${key}: wave ${i} hpMult ${w.hpMult} exceeds the 3.2 cap`);
      check(w.dmgMult <= 1.45 + 1e-9, `stage ${key}: wave ${i} dmgMult ${w.dmgMult} exceeds the 1.45 cap`);
      check((w.speedMult ?? 1) <= 1.5 + 1e-9, `stage ${key}: wave ${i} speedMult ${w.speedMult} exceeds the 1.5 cap`);
      check(w.minCount > 0 && w.interval > 0 && w.batch > 0, `stage ${key}: wave ${i} has a non-positive count/interval/batch`);
    });
    let prev = -1;
    s.events.forEach((e, i) => {
      check(e.at >= prev, `stage ${key}: events are not sorted at index ${i}`);
      prev = e.at;
      check(CONTENT.enemies[e.enemy], `stage ${key}: event ${i} references unknown enemy "${e.enemy}"`);
    });
    const finals = s.events.filter((e) => e.kind === 'final');
    check(finals.length === 1, `stage ${key}: expected exactly one final boss event, got ${finals.length}`);
    for (const f of finals) check(!!CONTENT.enemies[f.enemy]?.boss?.final, `stage ${key}: final boss "${f.enemy}" has no final config`);
    // three different bosses at 5:00, 10:00 and 15:00, on every stage
    const bossIds = s.events.filter((e) => e.kind === 'boss' || e.kind === 'final').map((e) => e.enemy);
    check(new Set(bossIds).size === bossIds.length, `stage ${key}: a boss appears twice (${bossIds.join(', ')})`);
    check(bossIds.length >= 3, `stage ${key}: fewer than three bosses`);
    if (s.props) check(CONTENT.enemies[s.props.enemy]?.behavior === 'prop', `stage ${key}: props must be a prop enemy, got "${s.props.enemy}"`);
    for (const o of s.obstacles ?? []) {
      check(o.w > 0 && o.h > 0, `stage ${key}: obstacle with a non-positive size`);
      check(!(0 > o.x - 40 && 0 < o.x + o.w + 40 && 0 > o.y - 40 && 0 < o.y + o.h + 40), `stage ${key}: an obstacle covers the start`);
      frameOk(o.frame, `stage ${key} obstacle`);
    }
    for (const r of s.relics ?? []) {
      check(CONTENT.pickups[r.pickup]?.persistent && !CONTENT.pickups[r.pickup]?.magnetic, `stage ${key}: relic "${r.pickup}" must be a persistent, non-magnetic pickup`);
      check(Math.hypot(r.x, r.y) >= 900, `stage ${key}: relic "${r.pickup}" is too close to the start to be a detour`);
    }
    for (const f of s.decorFrames) frameOk(f, `stage ${key} decor`);
  }
  for (const [key, a] of Object.entries(ACHIEVEMENTS as Record<string, AchievementDef>)) {
    check(a.id === key, `achievement ${key}: id mismatch`);
    check(hasKey(a.nameKey), `achievement ${key}: missing i18n ${a.nameKey}`);
    check(hasKey(a.descKey), `achievement ${key}: missing i18n ${a.descKey}`);
    frameOk(a.icon, `achievement ${key} icon`);
    if (a.unlocks?.passive) check(CONTENT.passives[a.unlocks.passive], `achievement ${key}: unlocks unknown passive "${a.unlocks.passive}"`);
    if (a.unlocks?.weapon) check(CONTENT.weapons[a.unlocks.weapon], `achievement ${key}: unlocks unknown weapon "${a.unlocks.weapon}"`);
    const c = a.condition;
    if (c.kind === 'survive' && c.stageId) check(CONTENT.stages[c.stageId], `achievement ${key}: unknown stage "${c.stageId}"`);
    if (c.kind === 'survive' && c.characterId) check(CONTENT.characters[c.characterId], `achievement ${key}: unknown character "${c.characterId}"`);
    if (c.kind === 'itemLevel') check(CONTENT.weapons[c.id] || CONTENT.passives[c.id], `achievement ${key}: unknown item "${c.id}"`);
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
