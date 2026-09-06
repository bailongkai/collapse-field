/**
 * XP required to go from (level - 1) to `level`, following Vampire Survivors: +10 per level through
 * 20, +13 through 40, +16 after; the +600 / +2400 jumps attach only to reaching level 20 and 40 and
 * are never carried into later levels.
 */
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  if (level <= 20) return 5 + 10 * (level - 2) + (level === 20 ? 600 : 0);
  if (level <= 40) return 185 + 13 * (level - 20) + (level === 40 ? 2400 : 0);
  return 445 + 16 * (level - 40);
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpToReach(level: number): number {
  let sum = 0;
  for (let l = 2; l <= level; l++) sum += xpToReach(l);
  return sum;
}
