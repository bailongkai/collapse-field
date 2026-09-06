import type { PlayerStats, WeaponDef, WeaponParams } from '../../data/types';

export interface EffectiveWeapon {
  damage: number;
  cooldownMs: number;
  amount: number;
  area: number;
  speed: number;
  durationMs: number;
  pierce: number;
  knockback: number;
  intervalMs: number;
  hitCooldownMs: number;
}

const PARAM_KEYS: (keyof WeaponParams)[] = [
  'damage', 'cooldown', 'amount', 'area', 'speed', 'duration', 'pierce', 'knockback', 'interval', 'hitCooldown',
];

/** Base plus every per-level delta up to `level`. */
export function weaponParams(def: WeaponDef, level: number): WeaponParams {
  const out = { ...def.base };
  const lv = Math.max(1, Math.min(level, def.maxLevel));
  for (let i = 0; i < lv - 1; i++) {
    const d = def.levels[i];
    if (!d) continue;
    for (const k of PARAM_KEYS) {
      const v = d[k];
      if (v !== undefined) out[k] += v;
    }
  }
  return out;
}

/** Applies player stats to weapon params. Infinity cooldown (aura) stays Infinity. */
export function effectiveWeapon(p: WeaponParams, s: PlayerStats): EffectiveWeapon {
  return {
    damage: p.damage * s.might,
    cooldownMs: p.cooldown === Infinity ? Infinity : Math.max(50, p.cooldown * s.cooldown),
    amount: p.amount + s.amount,
    area: p.area * s.area,
    speed: p.speed * s.projectileSpeed,
    durationMs: p.duration * s.duration,
    pierce: p.pierce,
    knockback: p.knockback,
    intervalMs: p.interval,
    hitCooldownMs: p.hitCooldown,
  };
}
