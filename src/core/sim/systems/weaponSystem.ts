import { FIXED_DT_MS } from '../../../config';
import { weaponDef } from '../../content/registry';
import { effectiveWeapon, weaponParams } from '../../stats/weaponParams';
import { behaviorFor } from '../../weapons/registry';
import type { EffectiveWeapon, WeaponContext, WeaponInstance } from '../../weapons/types';

/**
 * Ticks every owned weapon: counts the cooldown down, fires a volley through the behavior, and
 * spaces the volley's shots by `intervalMs`. Only behaviors that return 'cooldown' have their
 * cooldown armed here — orbit arms its own once its drones expire.
 */
export function stepWeapons(instances: WeaponInstance[], ctx: WeaponContext, dtMs: number): void {
  for (const inst of instances) {
    const def = weaponDef(inst.defId);
    const eff: EffectiveWeapon = effectiveWeapon(weaponParams(def, inst.level), ctx.stats);
    const behavior = behaviorFor(def.behavior);

    behavior.onTick?.(ctx, inst, eff, dtMs / 1000);

    if (inst.volleyLeft > 0) {
      inst.volleyTimer -= dtMs;
      while (inst.volleyLeft > 0 && inst.volleyTimer <= 0) {
        const index = Math.max(0, Math.round(eff.amount) - inst.volleyLeft);
        behavior.onVolleyShot?.(ctx, inst, eff, index);
        inst.volleyLeft--;
        inst.volleyTimer += Math.max(0, eff.intervalMs);
        if (eff.intervalMs <= 0) break;
      }
      if (inst.volleyLeft === 0) inst.volleyTimer = 0;
      continue;
    }

    if (eff.cooldownMs === Infinity) continue;
    inst.cooldownLeft -= dtMs;
    if (inst.cooldownLeft <= 0) {
      const result = behavior.onFire(ctx, inst, eff);
      if (result === 'cooldown') inst.cooldownLeft += eff.cooldownMs;
      else inst.cooldownLeft = Infinity;
      // fire the first shot of the volley on this very tick
      if (inst.volleyLeft > 0) {
        behavior.onVolleyShot?.(ctx, inst, eff, 0);
        inst.volleyLeft--;
        inst.volleyTimer = Math.max(0, eff.intervalMs);
      }
    }
  }
}

/** Converts a per-enemy hit interval in ms into whole simulation ticks. */
export function hitCooldownTicks(hitCooldownMs: number): number {
  return Math.max(1, Math.round(hitCooldownMs / FIXED_DT_MS));
}
