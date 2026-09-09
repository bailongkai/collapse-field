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
}

export function createSignature(def: SignatureDef): SignatureState {
  return { activeMs: 0, cooldownMs: 0, counter: 0, shieldReady: def.kind === 'shield', fired: 0 };
}

/** The stat bonus currently in effect, or null. */
export function signatureBonus(st: SignatureState, def: SignatureDef): StatBlock | null {
  if (st.activeMs <= 0) return null;
  if (def.kind === 'killStreak' || def.kind === 'chestSurge' || def.kind === 'onHurt') return def.bonus;
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
