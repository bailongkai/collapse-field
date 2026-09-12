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
    const params = weaponParams(def, inst.level);
    // limit break sits between the levels and the player's stats, so it stacks with both
    const l = inst.limit;
    if (l.damage || l.area || l.cooldown || l.speed) {
      params.damage *= 1 + l.damage;
      params.area *= 1 + l.area;
      params.speed *= 1 + l.speed;
      if (params.cooldown !== Infinity) params.cooldown *= Math.max(0.2, 1 - l.cooldown);
    }
    const eff: EffectiveWeapon = effectiveWeapon(params, ctx.stats);
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
      // One event per volley, not per shot: the view voices it, and a six-round burst is one sound.
      // A behaviour that found nothing to shoot at queues no volley and holds no cooldown, and it
      // must not be voiced either — otherwise a weapon that is not firing is the loudest thing on
      // the field, six times a second, for as long as the player is walking between crowds.
      if (inst.volleyLeft > 0 || result === 'hold') ctx.events.push('shot', ctx.player.x, ctx.player.y, inst.slot, inst.defId);
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
