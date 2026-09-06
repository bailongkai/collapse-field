export type GemVisualTier = 'blue' | 'green' | 'red' | 'merged';

export interface Gem {
  id: number;
  active: boolean;
  x: number;
  y: number;
  value: number;
  tier: GemVisualTier;
  attracted: boolean;
  /** seconds since attraction started, drives the magnet acceleration curve */
  t: number;
  bornTick: number;
}

export function createGem(id: number): Gem {
  return { id, active: false, x: 0, y: 0, value: 0, tier: 'blue', attracted: false, t: 0, bornTick: 0 };
}
