import { IFRAME_MS } from '../../../config';
import type { PlayerStats } from '../../../data/types';
import type { World } from '../world';

export interface ContactResult {
  /** damage actually dealt to the player this step */
  damage: number;
  /** the enemy that made contact, hit or not; -1 when nothing touched */
  enemyId: number;
  /** true when the contact was the reaper, which ignores armor, i-frames and god mode */
  fatal: boolean;
}

/**
 * Slack added to the contact radius. Mutual separation settles a crowd into a ring a little wider
 * than the bodies themselves, so without this a small group would orbit just out of reach and never
 * land a hit. Matches the separation equilibrium rather than exempting nearby enemies from it.
 */
const CONTACT_SLACK = 14;

/**
 * Enemy-versus-player contact. One damage instance per step at most: the first overlapping enemy
 * lands the hit and starts the i-frame window. The reaper is exempt from every mitigation.
 */
/**
 * Applies one instance of damage to the player with armor, i-frames and god mode, and reports the
 * amount dealt. Shared by contact and enemy fire so the two can never drift apart.
 */
export function applyPlayerDamage(world: World, stats: PlayerStats, god: boolean, raw: number, sourceId: string): number {
  const p = world.player;
  if (p.iframesMs > 0 || god) return 0;
  // a signature shield eats the whole hit, i-frames included, so it is worth exactly one hit
  if (p.shieldCharges > 0) {
    p.shieldCharges--;
    p.iframesMs = IFRAME_MS;
    world.events.push('shield', p.x, p.y, 0, sourceId, true);
    return 0;
  }
  const dmg = Math.max(1, Math.round(raw - stats.armor));
  p.hp -= dmg;
  p.iframesMs = IFRAME_MS;
  world.events.push('hurt', p.x, p.y, dmg, sourceId, dmg >= stats.maxHealth * 0.2);
  return dmg;
}

export function stepContact(world: World, stats: PlayerStats, god: boolean): ContactResult {
  const p = world.player;
  const out: ContactResult = { damage: 0, enemyId: -1, fatal: false };
  const reach = 96;
  const n = world.grid.queryInto(p.x - reach, p.y - reach, p.x + reach, p.y + reach, world.queryBuf);
  const playerRadius = 16;

  let hitEnemyIndex = -1;
  let reaperHit = false;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active || !e.def || e.def.behavior === 'prop') continue; // scenery does not bite
    const rr = e.radius + playerRadius + CONTACT_SLACK;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (e.behavior === 'reaper') {
      reaperHit = true;
      break;
    }
    // a bomber that is touched takes priority over a body that merely bites: standing on a mine
    // while a drone chews on you is still standing on a mine
    if (hitEnemyIndex < 0 || (e.behavior === 'bomber' && world.enemies.items[hitEnemyIndex].behavior !== 'bomber')) hitEnemyIndex = e.id;
  }

  if (reaperHit) {
    p.hp = 0;
    out.damage = 9999;
    out.fatal = true;
    world.events.push('hurt', p.x, p.y, 9999, 'annihilator', true);
    return out;
  }

  if (hitEnemyIndex < 0) return out;
  const e = world.enemies.items[hitEnemyIndex];
  out.enemyId = e.id;
  // a bomber's touch is its detonation, not a bite: the behaviour handles it
  if (e.behavior === 'bomber') return out;
  out.damage = applyPlayerDamage(world, stats, god, e.def!.damage * e.dmgMult, e.defId);
  return out;
}
