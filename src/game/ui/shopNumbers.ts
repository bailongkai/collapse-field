import { t } from '../../i18n';
import { STAT_KIND } from '../../data/types';
import type { UpgradeDef } from '../../data/upgrades';
import { CONTENT } from '../../core/content/registry';
import { weaponParams } from '../../core/stats/weaponParams';

/** One level's worth of an upgrade's bonus, as the shop writes it: "+15%", "−6%", "+2". */
export function upgradeAmount(def: UpgradeDef, level: number): string {
  const v = def.perLevel * level;
  const flat = def.charge !== undefined || (def.stat !== undefined && STAT_KIND[def.stat] === 'flat');
  const n = flat ? Math.round(v * 100) / 100 : Math.round(v * 100);
  const sign = v < 0 ? '−' : '+';
  return `${sign}${Math.abs(n)}${flat ? '' : '%'}`;
}

/**
 * What an upgrade is worth: the bonus it gives now and after the next level, or only the bonus
 * once it is maxed. "Hull +10%" says what one level does; whether the next 350 gold is worth it
 * depends on what is already bought.
 */
export function upgradeValue(def: UpgradeDef, level: number): string {
  if (level >= def.maxLevel) return upgradeAmount(def, level);
  return t('shop.now_next', { a: level > 0 ? upgradeAmount(def, level) : '0', b: upgradeAmount(def, level + 1) });
}

/**
 * A character's starting weapon in numbers: damage, how often it hits (the cooldown, or for the
 * field, which never fires, how often a body inside it is hit) and how many at once. The same
 * weaponParams the level-up card and the pause screen read.
 */
export function weaponLine(weaponId: string, short = false): string {
  const def = CONTENT.weapons[weaponId];
  if (!def) return '';
  const p = weaponParams(def, 1);
  const every = p.cooldown === Infinity ? p.hitCooldown : p.cooldown;
  return t(short ? 'shop.weapon_short' : 'shop.weapon_line', {
    name: t(def.nameKey),
    d: Math.round(p.damage * 10) / 10,
    c: (every / 1000).toFixed(1),
    n: Math.max(1, p.amount),
  });
}
