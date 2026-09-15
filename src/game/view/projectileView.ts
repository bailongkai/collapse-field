import Phaser from 'phaser';
import { PROJECTILE_CAP } from '../../config';
import { GAME_FRAME_SCALE } from '../atlas';
import { weaponDef } from '../../core/content/registry';
import type { World } from '../../core/sim/world';

const CULL_MARGIN = 128;

/**
 * Pooled projectile images. Bolts live in the projectile layer (normal blend) and additive effects
 * such as the blade sweep live in the fx layer, so neither batch is broken up by a blend switch.
 */
export class ProjectileView {
  private bolts: Phaser.GameObjects.Image[] = [];
  private fx: Phaser.GameObjects.Image[] = [];
  private frames: string[] = new Array<string>(PROJECTILE_CAP).fill('');
  /** tint tracked separately: every evolution reuses its base weapon's atlas frame */
  private tints = new Int32Array(PROJECTILE_CAP).fill(-1);

  constructor(scene: Phaser.Scene, boltLayer: Phaser.GameObjects.Layer, fxLayer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < PROJECTILE_CAP; i++) {
      const bolt = scene.add.image(0, 0, 'game', 'bolt_laser').setVisible(false);
      boltLayer.add(bolt);
      this.bolts.push(bolt);
      const fx = scene.add.image(0, 0, 'game', 'fx_slash').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
      fxLayer.add(fx);
      this.fx.push(fx);
    }
  }

  sync(world: World, weaponIdBySlot: string[], camX: number, camY: number, viewW: number, viewH: number): void {
    const minX = camX - viewW / 2 - CULL_MARGIN;
    const maxX = camX + viewW / 2 + CULL_MARGIN;
    const minY = camY - viewH / 2 - CULL_MARGIN;
    const maxY = camY + viewH / 2 + CULL_MARGIN;

    for (let i = 0; i < PROJECTILE_CAP; i++) {
      if (world.projectiles.items[i].active) continue;
      if (this.bolts[i].visible) this.bolts[i].setVisible(false);
      if (this.fx[i].visible) this.fx[i].setVisible(false);
    }

    const alive = world.projectiles.aliveList();
    for (let i = 0; i < world.projectiles.count; i++) {
      const p = world.projectiles.items[alive[i]];
      const additive = p.kind === 'slash';
      const img = additive ? this.fx[p.id] : this.bolts[p.id];
      const other = additive ? this.bolts[p.id] : this.fx[p.id];
      if (other.visible) other.setVisible(false);

      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
        if (img.visible) img.setVisible(false);
        continue;
      }

      const weaponId = p.hostile ? null : weaponIdBySlot[p.weaponSlot];
      const visual = weaponId ? weaponDef(weaponId).visual : null;
      const frame = p.hostile ? 'bolt_acid' : (visual?.frame ?? (additive ? 'fx_slash' : 'bolt_laser'));
      if (this.frames[p.id] !== frame) {
        this.frames[p.id] = frame;
        img.setFrame(frame);
      }
      const wantTint = p.hostile ? 0x9dff5a : (visual?.tint ?? 0xffffff);
      if (this.tints[p.id] !== wantTint) {
        this.tints[p.id] = wantTint;
        img.setTint(wantTint);
      }
      img.setVisible(true);
      img.setPosition(p.x, p.y);
      if (additive) {
        // the sweep is drawn ahead of the player, along the swing direction
        const mid = p.rectLen * 0.5;
        img.setPosition(p.x + Math.cos(p.angle) * mid, p.y + Math.sin(p.angle) * mid);
        img.setRotation(p.angle - Math.PI / 2);
        // a beam frame is authored upright at one fixed length and stretched along the shot to the
        // hit rect, so the same picture is a lance from the body or an arc between two links; the
        // length is a ratio of the frame's own height, so it holds at any atlas density
        if (visual?.beam) img.setScale(p.scale * GAME_FRAME_SCALE, p.rectLen / img.frame.height);
        else img.setScale(p.scale * GAME_FRAME_SCALE);
        img.setAlpha(Math.max(0, Math.min(1, p.ttlMs / 150)));
      } else {
        img.setRotation(p.angle + Math.PI / 2);
        img.setScale(p.scale * GAME_FRAME_SCALE);
        img.setAlpha(1);
      }
    }
  }

  destroy(): void {
    for (const b of this.bolts) b.destroy();
    for (const f of this.fx) f.destroy();
    this.bolts.length = 0;
    this.fx.length = 0;
  }
}
