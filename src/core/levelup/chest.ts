import type { ContentRegistry } from '../content/registry';
import type { Rng } from '../rng';
import type { LevelUpChoice, OwnedItem } from '../sim/runState';

export type ChestGrade = 'standard' | 'boss';

export interface ChestRollInput {
  weapons: readonly OwnedItem[];
  passives: readonly OwnedItem[];
  grade: ChestGrade;
  luck: number;
  rng: Rng;
  reg: ContentRegistry;
}

/**
 * How many rewards a chest pays out. One, three or five, the way the genre does it, because the
 * count is the whole drama of opening one: the player learns to read the third thud.
 *
 * A boss chest never rolls one. Half a minute of scripted fight paying a single weapon level reads
 * as a punishment for winning.
 */
export function rollChestCount(grade: ChestGrade, luck: number, rng: Rng): 1 | 3 | 5 {
  let p3 = grade === 'boss' ? 0.75 : 0.32;
  let p5 = grade === 'boss' ? 0.25 : 0.08;
  // luck buys its way out of the one-item bucket rather than making rewards individually better
  const extra = clampAtLeast0(luck - 1);
  p3 += 0.15 * extra;
  p5 += 0.1 * extra;
  const total = p3 + p5;
  if (total > 1) {
    p3 /= total;
    p5 /= total;
  }
  const r = rng.next();
  if (r < p5) return 5;
  if (r < p5 + p3) return 3;
  return 1;
}

/**
 * What a chest pays out: levels for things the player already chose.
 *
 * A chest never hands out a brand-new weapon or passive. The level-up screen is where the build is
 * decided, and a chest that could hand over a sixth weapon would quietly take that decision away.
 * What it does instead is push the build the player is already committed to further along, biased
 * towards whatever is closest to maxing — which is what makes an evolution reachable at all.
 *
 * The pool is rebuilt after every pick so a chest cannot award the same level twice.
 */
export function rollChestRewards(input: ChestRollInput): LevelUpChoice[] {
  const { rng, reg } = input;
  const count = rollChestCount(input.grade, input.luck, rng);
  const weapons = input.weapons.map((w) => ({ ...w }));
  const passives = input.passives.map((p) => ({ ...p }));
  const out: LevelUpChoice[] = [];

  for (let i = 0; i < count; i++) {
    const pool: { choice: LevelUpChoice; weight: number; apply: () => void }[] = [];

    for (const owned of weapons) {
      const def = reg.weapons[owned.id];
      if (!def || owned.level >= def.maxLevel) continue;
      // The nearer a weapon is to max, the far harder the chest pushes it. This is the whole point
      // of a chest and the reason it is not just another level-up: the level-up screen offers three
      // cards out of ten items, so the weapon a player is trying to finish appears about a third of
      // the time and a whole run ends with nothing at level eight and no evolution ever seen. A
      // chest concentrates instead of scattering, and a five-reward chest can finish a weapon.
      let weight = 20 * Math.pow(1.9, owned.level);
      // and it actively hunts an evolution that is one level away from being possible
      const evo = def.evolution;
      if (evo && owned.level === def.maxLevel - 1 && passives.some((p) => p.id === evo.requires)) weight *= 3;
      pool.push({ choice: { kind: 'weapon', id: owned.id, toLevel: owned.level + 1 }, weight, apply: () => { owned.level++; } });
    }

    for (const owned of passives) {
      const def = reg.passives[owned.id];
      if (!def || owned.level >= def.maxLevel) continue;
      // flat and low: the level-up screen already floods the player with passives, and a chest
      // spent on armour is a chest that did not finish a weapon
      pool.push({ choice: { kind: 'passive', id: owned.id, toLevel: owned.level + 1 }, weight: 24, apply: () => { owned.level++; } });
    }

    if (pool.length === 0) break;

    let total = 0;
    for (const c of pool) total += c.weight;
    let r = rng.next() * total;
    let picked = pool[pool.length - 1];
    for (const c of pool) {
      r -= c.weight;
      if (r < 0) {
        picked = c;
        break;
      }
    }
    out.push(picked.choice);
    picked.apply();
  }

  return out;
}

function clampAtLeast0(v: number): number {
  return v > 0 ? v : 0;
}
