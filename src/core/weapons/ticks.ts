import { FIXED_DT_MS } from '../../config';

/** Converts a per-enemy hit interval in ms into whole simulation ticks; never less than one. */
export function hitCooldownTicks(hitCooldownMs: number): number {
  return Math.max(1, Math.round(hitCooldownMs / FIXED_DT_MS));
}
