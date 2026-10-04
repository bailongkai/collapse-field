import type { I18nKey } from '../i18n/types';
import type { WeaponBehaviorId } from './types';

/**
 * Limit-break verbs: one per weapon archetype, each a change to what the weapon does rather than
 * to how big its numbers are. A build that has maxed everything used to spend its last twenty
 * level-ups on +10% cards — confirmation, not choice — and the archetypes already differ in
 * shape, so the verb that fits each is the one that asks a new question of that shape.
 *
 * A weapon offers its verb card instead of its +% cards until the verb is at `maxStacks`; then the
 * +% cards come back, so a run that keeps going keeps growing. Every verb stacks the same way: one
 * more of the thing it does (a return, a ricochet, a split, a mark), or the same thing harder where
 * a count makes no sense (the drone's blast, the field's pulse, the echo).
 *
 * Shared by every weapon of the archetype, evolutions included: an evolved blade keeps its 回旋.
 */
export interface VerbDef {
  readonly behavior: WeaponBehaviorId;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly maxStacks: number;
}

export const VERB_MAX_STACKS = 3;

export const VERBS: Readonly<Record<WeaponBehaviorId, VerbDef>> = {
  slash: { behavior: 'slash', nameKey: 'verb.slash.name', descKey: 'verb.slash.desc', maxStacks: VERB_MAX_STACKS },
  stream: { behavior: 'stream', nameKey: 'verb.stream.name', descKey: 'verb.stream.desc', maxStacks: VERB_MAX_STACKS },
  aimed: { behavior: 'aimed', nameKey: 'verb.aimed.name', descKey: 'verb.aimed.desc', maxStacks: VERB_MAX_STACKS },
  orbit: { behavior: 'orbit', nameKey: 'verb.orbit.name', descKey: 'verb.orbit.desc', maxStacks: VERB_MAX_STACKS },
  aura: { behavior: 'aura', nameKey: 'verb.aura.name', descKey: 'verb.aura.desc', maxStacks: VERB_MAX_STACKS },
  pylon: { behavior: 'pylon', nameKey: 'verb.pylon.name', descKey: 'verb.pylon.desc', maxStacks: VERB_MAX_STACKS },
  chain: { behavior: 'chain', nameKey: 'verb.chain.name', descKey: 'verb.chain.desc', maxStacks: VERB_MAX_STACKS },
  pivot: { behavior: 'pivot', nameKey: 'verb.pivot.name', descKey: 'verb.pivot.desc', maxStacks: VERB_MAX_STACKS },
};

/** The card's icon is the weapon's own, in this colour, the way an evolution tints its base. */
export const VERB_TINT = 0x66ffcc;

/**
 * The numbers. `n` below is the stack count, 1 to `maxStacks`.
 *
 * - slash 回旋: n returns, each `delayMs` after the last, each at `scale` of the sweep.
 * - stream 跳弹: a round that has spent its pierce turns towards the nearest body within `reach`,
 *   n times.
 * - aimed 分裂: a bolt that kills splits into n + 1 bolts at `scale`; the splinters do not split.
 * - orbit 殉爆: a drone that expires detonates, radius `radius` + `radiusPerStack` (n - 1), at
 *   (`scale` + n - 1) times its damage.
 * - aura 脉冲: every `everyMs` - `everyPerStackMs` (n - 1) the field pulls everything within twice
 *   its radius `px` inward, crowd or no crowd.
 * - pylon 接地: each armed stake arcs into the n nearest bodies within `reach`.
 * - chain 残留: the last n links of every arc are marked for `markMs`; the next hit from anything
 *   bursts the mark for `scale` times the arc's damage on the body and everything within `radius`.
 * - pivot 回波: `delayMs` after the beam a beam fires the other way at `scale` + `scalePerStack` (n - 1).
 */
export const VERB_TUNING = {
  slash: { delayMs: 250, scale: 0.5 },
  stream: { reach: 120 },
  aimed: { scale: 0.5, spreadRad: 0.5 },
  orbit: { radius: 80, radiusPerStack: 20, scale: 2 },
  aura: { everyMs: 4000, everyPerStackMs: 1000, px: 60 },
  pylon: { reach: 120 },
  chain: { markMs: 2000, scale: 3, radius: 60 },
  pivot: { delayMs: 300, scale: 0.5, scalePerStack: 0.25 },
} as const;
