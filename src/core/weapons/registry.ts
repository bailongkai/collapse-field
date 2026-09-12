import type { WeaponBehaviorId } from '../../data/types';
import type { BehaviorMap, WeaponBehavior } from './types';
import { slash } from './behaviors/slash';
import { aimed } from './behaviors/aimed';
import { stream } from './behaviors/stream';
import { orbit } from './behaviors/orbit';
import { aura } from './behaviors/aura';
import { pylon } from './behaviors/pylon';
import { chain } from './behaviors/chain';
import { pivot } from './behaviors/pivot';

export const BEHAVIORS: BehaviorMap = {
  slash,
  aimed,
  stream,
  orbit,
  aura,
  pylon,
  chain,
  pivot,
};

export function behaviorFor(id: WeaponBehaviorId): WeaponBehavior {
  return BEHAVIORS[id];
}

export function isRegistered(id: WeaponBehaviorId): boolean {
  return BEHAVIORS[id] !== undefined;
}
