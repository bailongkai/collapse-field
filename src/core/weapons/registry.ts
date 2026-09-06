import type { WeaponBehaviorId } from '../../data/types';
import type { BehaviorMap, WeaponBehavior } from './types';
import { slash } from './behaviors/slash';
import { aimed } from './behaviors/aimed';
import { stream } from './behaviors/stream';
import { orbit } from './behaviors/orbit';
import { aura } from './behaviors/aura';

export const BEHAVIORS: BehaviorMap = {
  slash,
  aimed,
  stream,
  orbit,
  aura,
};

export function behaviorFor(id: WeaponBehaviorId): WeaponBehavior {
  return BEHAVIORS[id];
}

export function isRegistered(id: WeaponBehaviorId): boolean {
  return BEHAVIORS[id] !== undefined;
}
