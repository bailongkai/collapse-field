import type { WeaponBehaviorId } from '../../data/types';
import type { BehaviorMap, WeaponBehavior } from './types';
import { slash } from './behaviors/slash';
import { aimed } from './behaviors/aimed';

/** Placeholder used until a behavior lands; keeps content validation honest from day one. */
const stub: WeaponBehavior = {
  onFire() {
    return 'cooldown';
  },
};

export const BEHAVIORS: BehaviorMap = {
  slash,
  aimed,
  stream: stub,
  orbit: stub,
  aura: stub,
};

export function behaviorFor(id: WeaponBehaviorId): WeaponBehavior {
  return BEHAVIORS[id];
}

export function isStub(id: WeaponBehaviorId): boolean {
  return BEHAVIORS[id] === stub;
}
