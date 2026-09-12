import type { PlayerStats, SignatureDef, StatBlock } from '../../data/types';
import type { Player } from './entities/player';

/**
 * A signature ability is a rule with a clock. The state is small on purpose: what is active, what
 * is cooling down, and a counter for the kinds that count something. Every transition is driven by
 * the simulation's own hooks, so it is as deterministic as everything else.
 */
export interface SignatureState {
  /** ms the stat bonus stays on; 0 when it is off */
  activeMs: number;
  /** ms until the ability may trigger again; 0 when ready */
  cooldownMs: number;
  /** kills counted towards the next trigger, for the kinds that count */
  counter: number;
  /** whether the shield charge is up; mirrored onto the player as a charge */
  shieldReady: boolean;
  /** how many times it has fired this run, for the results screen and the tests */
  fired: number;
  /** stacks currently held, for the kinds that stack rather than fire */
  stacks: number;
  /** ms held towards the next stack */
  holdMs: number;
  /** where the anchor was planted, for the kinds that reward staying near a spot */
  anchorX: number;
  anchorY: number;
  anchored: boolean;
}

export function createSignature(def: SignatureDef): SignatureState {
  return { activeMs: 0, cooldownMs: 0, counter: 0, shieldReady: def.kind === 'shield', fired: 0, stacks: 0, holdMs: 0, anchorX: 0, anchorY: 0, anchored: false };
}

/** The stat bonus currently in effect, or null. */
export function signatureBonus(st: SignatureState, def: SignatureDef): StatBlock | null {
  // the stacking kinds are a state rather than a burst: they are on for exactly as long as the
  // player keeps paying for them, which is what makes them a decision and not a timer
  if (def.kind === 'dugIn' || def.kind === 'pressure') {
    if (st.stacks <= 0) return null;
    const per = def.kind === 'dugIn' ? def.perStack : def.perEnemy;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(per)) out[k] = (v ?? 0) * st.stacks;
    return out as StatBlock;
  }
  if (st.activeMs <= 0) return null;
  if (def.kind === 'killStreak' || def.kind === 'chestSurge' || def.kind === 'onHurt' || def.kind === 'reversal') return def.bonus;
  return null;
}

/** Ticks the clocks. Returns true when the stat bonus switched off, which needs a stats refresh. */
export function signatureStep(st: SignatureState, def: SignatureDef, player: Player, stats: PlayerStats, dtMs: number): boolean {
  let changed = false;
  if (st.cooldownMs > 0) {
    st.cooldownMs = Math.max(0, st.cooldownMs - dtMs);
    if (st.cooldownMs === 0 && def.kind === 'shield') {
      st.shieldReady = true;
      player.shieldCharges = 1;
    }
  }
  if (st.activeMs > 0) {
    st.activeMs = Math.max(0, st.activeMs - dtMs);
    if (st.activeMs === 0) changed = true;
  }
  // the shield charge lives on the player so the collision code can spend it; notice when it did
  if (def.kind === 'shield' && st.shieldReady && player.shieldCharges === 0) {
    st.shieldReady = false;
    st.cooldownMs = def.cooldownMs;
    st.fired++;
  }
  if (def.kind === 'dugIn') {
    // planting is free and automatic: standing still is the whole input
    const still = player.inputX === 0 && player.inputY === 0;
    if (!st.anchored && still) {
      st.anchored = true;
      st.anchorX = player.x;
      st.anchorY = player.y;
      st.holdMs = 0;
    }
    if (st.anchored) {
      const dx = player.x - st.anchorX;
      const dy = player.y - st.anchorY;
      if (dx * dx + dy * dy <= def.radius * def.radius) {
        st.holdMs += dtMs;
        while (st.holdMs >= def.rampMs && st.stacks < def.maxStacks) {
          st.holdMs -= def.rampMs;
          if (st.stacks === 0) st.fired++;
          st.stacks++;
          changed = true;
        }
      } else {
        st.holdMs += dtMs;
        while (st.holdMs >= def.decayMs && st.stacks > 0) {
          st.holdMs -= def.decayMs;
          st.stacks--;
          changed = true;
        }
        if (st.stacks === 0) {
          st.anchored = false;
          st.holdMs = 0;
        }
      }
    }
    // re-armed every tick rather than on a change, or a full meter would quietly expire
    st.activeMs = st.stacks > 0 ? def.rampMs : 0;
  }

  // second wind watches health rather than a hit, so a slow bleed from regen loss triggers it too
  if (def.kind === 'secondWind' && st.cooldownMs === 0 && player.hp > 0 && player.hp < stats.maxHealth * def.threshold) {
    player.hp = Math.min(stats.maxHealth, player.hp + Math.round(stats.maxHealth * def.healFraction));
    player.iframesMs = Math.max(player.iframesMs, def.invulnMs);
    st.cooldownMs = def.cooldownMs;
    st.fired++;
    st.activeMs = def.invulnMs; // purely so the HUD can show it as active
  }
  return changed;
}

/**
 * The crowd around the player, counted by the simulation and handed in: how many bodies are inside
 * the radius. Returns true when the stack count changed and the stats need rebuilding.
 */
export function onSignatureCrowd(st: SignatureState, def: SignatureDef, nearby: number): boolean {
  if (def.kind !== 'pressure') return false;
  const want = Math.max(0, Math.min(def.maxStacks, nearby - def.minEnemies + 1));
  if (want === st.stacks) return false;
  if (st.stacks === 0 && want > 0) st.fired++;
  st.stacks = want;
  st.activeMs = want > 0 ? 1000 : 0;
  return true;
}

/** The player turned. Returns true when the about-face found a crowd and the bonus switched on. */
export function onSignatureTurn(st: SignatureState, def: SignatureDef, enemiesInArc: number): boolean {
  if (def.kind !== 'reversal' || st.cooldownMs > 0) return false;
  if (enemiesInArc < def.count) return false;
  st.activeMs = def.durationMs;
  st.cooldownMs = def.cooldownMs;
  st.fired++;
  return true;
}

/** A kill landed. Returns true when a bonus switched on. */
export function onSignatureKill(st: SignatureState, def: SignatureDef, totalKills: number): boolean {
  if (def.kind !== 'killStreak') return false;
  void totalKills;
  st.counter++;
  if (st.counter < def.kills) return false;
  st.counter = 0;
  st.activeMs = def.durationMs;
  st.fired++;
  return true;
}

/** A chest was opened. Returns true when a bonus switched on. */
export function onSignatureChest(st: SignatureState, def: SignatureDef): boolean {
  if (def.kind !== 'chestSurge') return false;
  st.activeMs = def.durationMs;
  st.fired++;
  return true;
}

/** The player took damage. Returns true when a bonus switched on. */
export function onSignatureHurt(st: SignatureState, def: SignatureDef, player: Player, stats: PlayerStats): boolean {
  void player;
  void stats;
  if (def.kind !== 'onHurt' || st.cooldownMs > 0) return false;
  st.activeMs = def.durationMs;
  st.cooldownMs = def.cooldownMs;
  st.fired++;
  return true;
}
