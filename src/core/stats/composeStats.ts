import type { CharacterDef, PlayerStats, StatBlock, StatKey } from '../../data/types';
import { STAT_KEYS, STAT_KIND } from '../../data/types';
import type { OwnedItem } from '../sim/runState';
import type { ContentRegistry } from '../content/registry';

/**
 * Character base combined with passive bonuses: multiplicative stats scale by (1 + sum of
 * fractional bonuses), flat stats add. `cooldown` is clamped so it can never reach zero.
 */
export function composeStats(
  ch: CharacterDef,
  passives: readonly OwnedItem[],
  reg: ContentRegistry,
  level: number,
  extra?: StatBlock,
): PlayerStats {
  const sum = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) sum[k] = 0;

  for (const p of passives) {
    const def = reg.passives[p.id];
    if (!def) continue;
    for (const k of Object.keys(def.perLevel) as StatKey[]) sum[k] += (def.perLevel[k] ?? 0) * p.level;
  }
  for (const b of ch.levelBonuses ?? []) sum[b.stat] += b.amount * Math.floor(level / b.everyLevels);
  if (extra) for (const k of Object.keys(extra) as StatKey[]) sum[k] += extra[k] ?? 0;

  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) out[k] = STAT_KIND[k] === 'mult' ? ch.baseStats[k] * (1 + sum[k]) : ch.baseStats[k] + sum[k];
  out.cooldown = Math.max(0.1, out.cooldown);
  out.moveSpeed = Math.max(0, out.moveSpeed);
  out.maxHealth = Math.max(1, out.maxHealth);
  return out;
}
