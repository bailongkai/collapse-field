import Phaser from 'phaser';
import { ENEMY_CAP } from '../../config';
import type { World } from '../../core/sim/world';
import { advancePhase, BOB_AMP, LEAN_AMP, dashStretch, squash } from './anim';

const CULL_MARGIN = 96;

/**
 * One pooled Image per enemy slot, pre-created and parented to a fixed layer: nothing is created or
 * destroyed at runtime, the display list never re-sorts, and every enemy draws from one atlas so
 * the horde costs a handful of draw calls.
 */
export class EnemyView {
  private images: Phaser.GameObjects.Image[] = [];
  private frames: string[] = new Array<string>(ENEMY_CAP).fill('');
  private flashing = new Uint8Array(ENEMY_CAP);
  /** the tint currently applied to each slot's Image; -1 means "unknown, set it" */
  private tints = new Int32Array(ENEMY_CAP).fill(-1);
  /** walk phase and last position per slot, so a body hops in step with the ground it covers */
  private phase = new Float32Array(ENEMY_CAP);
  private lastX = new Float32Array(ENEMY_CAP);
  private lastY = new Float32Array(ENEMY_CAP);
  private lastSerial = new Int32Array(ENEMY_CAP).fill(-1);
  /** ms left of the hit squash */
  private hitMs = new Float32Array(ENEMY_CAP);
  private lastFlash = new Uint8Array(ENEMY_CAP);

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < ENEMY_CAP; i++) {
      const img = scene.add.image(0, 0, 'game', 'enemy_drone').setVisible(false);
      layer.add(img);
      this.images.push(img);
    }
  }

  sync(world: World, camX: number, camY: number, viewW: number, viewH: number, deltaMs = 16.7): void {
    const dt = Math.max(1e-3, deltaMs / 1000);
    const minX = camX - viewW / 2 - CULL_MARGIN;
    const maxX = camX + viewW / 2 + CULL_MARGIN;
    const minY = camY - viewH / 2 - CULL_MARGIN;
    const maxY = camY + viewH / 2 + CULL_MARGIN;

    // hide slots that are no longer alive
    for (let i = 0; i < this.images.length; i++) {
      if (!world.enemies.items[i].active && this.images[i].visible) this.images[i].setVisible(false);
    }

    const alive = world.enemies.aliveList();
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[alive[i]];
      const img = this.images[e.id];
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      const def = e.def!;
      if (this.frames[e.id] !== def.frame) {
        this.frames[e.id] = def.frame;
        img.setFrame(def.frame);
      }
      img.setVisible(true);

      // a fresh body in a reused slot starts its walk from where it is, not from the last one's
      const id = e.id;
      if (this.lastSerial[id] !== e.serial) {
        this.lastSerial[id] = e.serial;
        this.lastX[id] = e.x;
        this.lastY[id] = e.y;
        this.phase[id] = (id % 7) * 0.9; // desynchronised, so a crowd does not hop in unison
        this.hitMs[id] = 0;
        this.lastFlash[id] = 0;
      }
      const ddx = e.x - this.lastX[id];
      const ddy = e.y - this.lastY[id];
      const dist = Math.hypot(ddx, ddy);
      this.lastX[id] = e.x;
      this.lastY[id] = e.y;
      // the first frame of a flash is the hit; the squash runs on its own clock after that
      const flashNow = e.flashMs > 0 ? 1 : 0;
      if (flashNow && !this.lastFlash[id]) this.hitMs[id] = 180;
      this.lastFlash[id] = flashNow;
      let sx = 1;
      let sy = 1;
      let dy = 0;
      let rot = 0;
      const heavy = def.bossBar === true;
      if (def.faceTarget) {
        // a walker: bob and lean with the stride, stretch into a dash
        if (!heavy && dist > 0.05) {
          this.phase[id] = advancePhase(this.phase[id], Math.min(dist, 40));
          const bob = Math.abs(Math.sin(this.phase[id])) * BOB_AMP;
          dy = -bob;
          rot = Math.sin(this.phase[id]) * LEAN_AMP * (Math.cos(e.facing) < 0 ? -1 : 1);
          sy = 1 + (bob / BOB_AMP) * 0.04;
          sx = 1 / sy;
        }
        const stretch = dashStretch(dist / dt / Math.max(1, def.speed * e.speedMult));
        if (stretch > 0) {
          sx *= 1 + stretch;
          sy *= 1 - stretch * 0.6;
        }
        img.setFlipX(Math.cos(e.facing) < 0);
      } else {
        // a ship or a body that rotates: no stride, but it still stretches when it dashes
        rot = e.facing + Math.PI / 2;
        const stretch = dashStretch(dist / dt / Math.max(1, def.speed * e.speedMult));
        if (stretch > 0) {
          sy *= 1 + stretch;
          sx *= 1 - stretch * 0.6;
        }
      }
      if (this.hitMs[id] > 0) {
        this.hitMs[id] = Math.max(0, this.hitMs[id] - deltaMs);
        const q = squash(this.hitMs[id] / 180, heavy ? 0.08 : 0.22);
        sx *= q.scaleX;
        sy *= q.scaleY;
      }
      const halfH = img.height / 2;
      img.setPosition(e.x, e.y + dy - (def.faceTarget ? (sy - 1) * halfH : 0));
      if (img.scaleX !== sx || img.scaleY !== sy) img.setScale(sx, sy);
      if (img.rotation !== rot) img.setRotation(rot);

      // The tint is tracked per slot rather than per definition: pool slots are reused immediately,
      // so an untinted mech taking a dead infected's slot would otherwise inherit its green.
      const wantFlash = e.flashMs > 0 ? 1 : 0;
      const wantTint = wantFlash ? 0xffffff : (def.tint ?? 0xffffff);
      if (this.flashing[e.id] !== wantFlash) {
        this.flashing[e.id] = wantFlash;
        img.setTintMode(wantFlash ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
        img.setTint(wantTint);
        this.tints[e.id] = wantTint;
      } else if (this.tints[e.id] !== wantTint) {
        img.setTint(wantTint);
        this.tints[e.id] = wantTint;
      }
    }
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images.length = 0;
  }
}
