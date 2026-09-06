import { PASSIVE_SLOTS, WEAPON_SLOTS } from '../../config';
import type { ContentRegistry } from '../content/registry';
import type { Rng } from '../rng';
import type { LevelUpChoice, OwnedItem } from '../sim/runState';

export interface RollInput {
  weapons: readonly OwnedItem[];
  passives: readonly OwnedItem[];
  luck: number;
  rng: Rng;
  reg: ContentRegistry;
  /** ids that must not be offered (already offered this level, or disabled) */
  excluded?: ReadonlySet<string>;
}

interface Candidate {
  choice: LevelUpChoice;
  weight: number;
}

/**
 * Builds the level-up offer: owned items that can still level plus new ones while a slot is free,
 * sampled without replacement by rarity weight. Luck above 1 gives a proportional chance of a
 * fourth card. When nothing can be offered the player still gets a useful consolation pick.
 */
export function rollLevelUp(input: RollInput): LevelUpChoice[] {
  const { weapons, passives, rng, reg } = input;
  const excluded = input.excluded ?? new Set<string>();
  const candidates: Candidate[] = [];

  const collect = (
    kind: 'weapon' | 'passive',
    defs: Readonly<Record<string, { id: string; rarity: number; maxLevel: number; evolvedOnly?: boolean; evolution?: { into: string } }>>,
    owned: readonly OwnedItem[],
    slots: number,
  ): void => {
    const byId = new Map(owned.map((o) => [o.id, o.level]));
    const freeSlots = slots - owned.length;
    for (const def of Object.values(defs)) {
      if (excluded.has(def.id)) continue;
      if (def.evolvedOnly) continue;
      if (def.evolution && byId.has(def.evolution.into)) continue;
      const level = byId.get(def.id);
      if (level !== undefined) {
        if (level < def.maxLevel) candidates.push({ choice: { kind, id: def.id, toLevel: level + 1 }, weight: def.rarity });
      } else if (freeSlots > 0) {
        candidates.push({ choice: { kind, id: def.id, toLevel: 1 }, weight: def.rarity });
      }
    }
  };

  collect('weapon', reg.weapons, weapons, WEAPON_SLOTS);
  collect('passive', reg.passives, passives, PASSIVE_SLOTS);

  const wantFourth = rng.next() < clamp01(input.luck - 1);
  const count = 3 + (wantFourth ? 1 : 0);
  const picked = sampleWithoutReplacement(candidates, count, rng);

  if (picked.length === 0) return [{ kind: 'gold', amount: 25 }, { kind: 'heal', amount: 30 }];
  return picked;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sampleWithoutReplacement(candidates: Candidate[], count: number, rng: Rng): LevelUpChoice[] {
  const pool = candidates.slice();
  const out: LevelUpChoice[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    let total = 0;
    for (const c of pool) total += c.weight;
    if (total <= 0) break;
    let r = rng.next() * total;
    let index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r < 0) {
        index = j;
        break;
      }
    }
    out.push(pool[index].choice);
    pool.splice(index, 1);
  }
  return out;
}

/**
 * Human-readable summary of what a weapon level adds, generated from the data so a new weapon
 * needs no hand-written upgrade copy.
 */
export function describeDeltas(delta: Record<string, number | undefined>): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const [param, raw] of Object.entries(delta)) {
    if (raw === undefined || raw === 0) continue;
    const isPercent = param === 'area' || param === 'speed';
    const sign = raw > 0 ? '+' : '';
    const value = isPercent ? `${sign}${Math.round(raw * 100)}%` : `${sign}${raw}`;
    out.push({ key: `delta.${param}`, value });
  }
  return out;
}
