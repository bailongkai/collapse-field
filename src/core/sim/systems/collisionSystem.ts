import { IFRAME_MS } from '../../../config';
import type { PlayerStats } from '../../../data/types';
import type { World } from '../world';

export interface ContactResult {
  /** damage actually dealt to the player this step */
  damage: number;
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
export function stepContact(world: World, stats: PlayerStats, god: boolean, dt: number): ContactResult {
  const p = world.player;
  const out: ContactResult = { damage: 0, fatal: false };
  const reach = 96;
  const n = world.grid.queryInto(p.x - reach, p.y - reach, p.x + reach, p.y + reach, world.queryBuf);
  const playerRadius = 16;

  let hitEnemyIndex = -1;
  let reaperHit = false;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active || !e.def) continue;
    const rr = e.radius + playerRadius + CONTACT_SLACK;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (e.behavior === 'reaper') {
      reaperHit = true;
      break;
    }
    if (hitEnemyIndex < 0) hitEnemyIndex = e.id;
  }

  if (reaperHit) {
    p.hp = 0;
    out.damage = 9999;
    out.fatal = true;
    world.events.push('hurt', p.x, p.y, 9999, 'annihilator', true);
    return out;
  }

  if (p.iframesMs > 0 || hitEnemyIndex < 0) return out;
  if (god) return out;

  const e = world.enemies.items[hitEnemyIndex];
  const raw = e.def!.damage * e.dmgMult;
  const dmg = Math.max(1, Math.round(raw - stats.armor));
  p.hp -= dmg;
  p.iframesMs = IFRAME_MS;
  out.damage = dmg;
  world.events.push('hurt', p.x, p.y, dmg, e.defId, dmg >= stats.maxHealth * 0.2);
  void dt;
  return out;
}
