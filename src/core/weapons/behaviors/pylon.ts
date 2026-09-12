import { ENEMY_CAP, MAX_ENEMY_RADIUS } from '../../../config';
import type { World } from '../../sim/world';
import { hitCooldownTicks } from '../ticks';
import type { WeaponBehavior } from '../types';

/** How far from the player a stake is driven, and the golden angle that spaces them round her. */
const PLANT_OFFSET = 90;
const GOLDEN = 2.39996;
/** The room a stake can string an arc across. Deliberately not scaled by area: see below. */
const LINK_RANGE = 190;
const BEAM_HALF_WIDTH = 24;
const STAKE_RADIUS = 10;
/** ms a stake spends dark before it joins the lattice, divided by projectile speed */
const ARM_MS = 600;
/** what a lone armed stake does on its own, as a fraction of a full arc */
const LONE_SCALE = 0.4;

const scratch = new Int32Array(ENEMY_CAP);
const nodes: number[] = [];

/**
 * 锚桩: firing drives a stake into the ground beside you. A stake does nothing alone; an arc is
 * strung between every pair of stakes in range, and between every stake and you, and anything
 * crossing an arc burns.
 *
 * Every other weapon is carried, so running costs nothing and the game's strongest policy is to
 * keep walking. This one stays where it was put: the room is yours only while you are standing in
 * it, and the player node is the brightest arc on the field, so walking away visibly turns most of
 * the damage off. The reach is NOT scaled by area — a lattice that grows with fieldAmp would erase
 * its own identity by the time it mattered — so area buys the width of the arcs instead.
 */
export const pylon: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    const cap = Math.max(1, Math.round(eff.amount));
    let live = 0;
    let oldest: { p: { orbitIndex: number; ttlMs: number } } | null = null;
    ctx.forEachProjectile(inst.slot, (p) => {
      if (p.kind !== 'pylon' || p.ttlMs <= 0) return;
      live++;
      if (!oldest || p.orbitIndex < oldest.p.orbitIndex) oldest = { p };
    });
    // the cap is on stakes standing, not on a burst: the oldest goes when a new one lands
    if (live >= cap && oldest) (oldest as { p: { ttlMs: number } }).p.ttlMs = 0;

    const p = ctx.spawnProjectile();
    if (!p) return 'cooldown';
    const a = inst.plantSerial * GOLDEN;
    inst.plantSerial++;
    p.kind = 'pylon';
    p.hostile = false;
    p.weaponSlot = inst.slot;
    // planted beside her rather than underfoot, or a player who stands still — the one the whole
    // character is built around — stacks every stake on one point and has no lattice at all
    p.x = ctx.player.x + Math.cos(a) * PLANT_OFFSET;
    p.y = ctx.player.y + Math.sin(a) * PLANT_OFFSET;
    p.vx = 0;
    p.vy = 0;
    p.angle = -Math.PI / 2; // the art is drawn upright; the view rotates by angle
    p.damage = eff.damage;
    p.knockback = eff.knockback;
    p.pierce = Infinity;
    p.ttlMs = eff.durationMs;
    p.radius = STAKE_RADIUS * eff.area;
    p.scale = eff.area;
    p.charge = 0;
    p.orbitIndex = inst.plantSerial;
    p.orbitRadius = LINK_RANGE; // published for the view, which must not know the constants
    p.hitSerials.length = 0;
    return 'cooldown';
  },

  onTick(ctx, inst, eff, dt) {
    const half = BEAM_HALF_WIDTH * eff.area;
    const armMs = ARM_MS / Math.max(0.1, eff.speed);
    nodes.length = 0;
    ctx.forEachProjectile(inst.slot, (p) => {
      if (p.kind !== 'pylon') return;
      if (p.charge < 1) p.charge = Math.min(1, p.charge + (dt * 1000) / armMs);
      if (p.charge >= 1) nodes.push(p.x, p.y);
    });
    inst.activeCount = nodes.length / 2;
    if (nodes.length === 0) return;
    const stakes = nodes.length / 2;
    nodes.push(ctx.player.x, ctx.player.y); // she is a node, and she is the node that matters
    const n = nodes.length / 2;

    // one query for the whole lattice rather than one per beam: a full field is 28 pairs, and a
    // grid query each would be the most expensive weapon in the game by an order of magnitude
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, nodes[2 * i]);
      maxX = Math.max(maxX, nodes[2 * i]);
      minY = Math.min(minY, nodes[2 * i + 1]);
      maxY = Math.max(maxY, nodes[2 * i + 1]);
    }
    const pad = half + MAX_ENEMY_RADIUS;
    const count = ctx.queryEnemies(minX - pad, minY - pad, maxX + pad, maxY + pad, scratch);
    const cdTicks = hitCooldownTicks(eff.hitCooldownMs);

    for (let k = 0; k < count; k++) {
      const e = ctx.enemyById(scratch[k]);
      if (!e.active || !e.def) continue;
      if (ctx.tick - inst.lastHitTick[e.id] < cdTicks) continue;
      let overlaps = 0;
      let nx = 0;
      let ny = 0;
      let lone = false;
      for (let i = 0; i < n && overlaps < 4; i++) {
        const ax = nodes[2 * i];
        const ay = nodes[2 * i + 1];
        // a lone armed stake still burns what touches it, so a player who keeps moving loses most
        // of the weapon rather than all of it
        if (i < stakes) {
          const sx = e.x - ax;
          const sy = e.y - ay;
          const sr = half + e.radius;
          if (sx * sx + sy * sy <= sr * sr) lone = true;
        }
        for (let j = i + 1; j < n; j++) {
          const bx = nodes[2 * j];
          const by = nodes[2 * j + 1];
          const ddx = bx - ax;
          const ddy = by - ay;
          const l2 = ddx * ddx + ddy * ddy;
          if (l2 > LINK_RANGE * LINK_RANGE) continue;
          const t = Math.max(0, Math.min(1, ((e.x - ax) * ddx + (e.y - ay) * ddy) / (l2 || 1)));
          const rx = e.x - (ax + ddx * t);
          const ry = e.y - (ay + ddy * t);
          const rr = half + e.radius;
          if (rx * rx + ry * ry > rr * rr) continue;
          overlaps++;
          nx = rx;
          ny = ry;
          if (overlaps >= 4) break;
        }
      }
      if (overlaps === 0 && !lone) continue;
      inst.lastHitTick[e.id] = ctx.tick;
      // the cap is shared across every beam, so the lattice is not a blender; crossing more of it
      // than one arc is worth something, but a long way short of one hit per arc
      const scale = overlaps === 0 ? LONE_SCALE : Math.min(1.75, 1 + 0.25 * (overlaps - 1));
      const len = Math.hypot(nx, ny) || 1;
      const dirX = overlaps === 0 ? (e.x - ctx.player.x) / (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) || 1) : nx / len;
      const dirY = overlaps === 0 ? (e.y - ctx.player.y) / (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) || 1) : ny / len;
      // a negative knockback means the arc drags rather than shoves: that is the evolution's verb
      const kb = eff.knockback;
      ctx.hitEnemy(e, eff.damage * scale, kb < 0 ? -dirX : dirX, kb < 0 ? -dirY : dirY, Math.abs(kb), inst);
    }
  },
};

/** The live arcs, as pairs of endpoints, for the view. Read-only; the behaviour owns the geometry. */
export function pylonBeams(world: World, out: number[]): number[] {
  out.length = 0;
  const pts: number[] = [];
  let range = LINK_RANGE;
  for (const p of world.projectiles.items) {
    if (!p.active || p.kind !== 'pylon' || p.charge < 1) continue;
    pts.push(p.x, p.y);
    range = p.orbitRadius || LINK_RANGE;
  }
  if (pts.length === 0) return out;
  pts.push(world.player.x, world.player.y);
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pts[2 * j] - pts[2 * i];
      const dy = pts[2 * j + 1] - pts[2 * i + 1];
      if (dx * dx + dy * dy > range * range) continue;
      // the player is the last node; her arcs are flagged so the view can draw them brighter
      out.push(pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1], j === n - 1 ? 1 : 0);
    }
  }
  return out;
}
