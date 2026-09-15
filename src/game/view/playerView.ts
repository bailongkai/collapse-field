import type Phaser from 'phaser';
import type { CharacterDef } from '../../data/types';
import { GAME_FRAME_SCALE } from '../atlas';
import type { Player } from '../../core/sim/entities/player';
import { advancePhase, idlePose, recoil, squash, walkPose, type Pose, type RecoilKind } from './anim';

const BAR_W = 40;
const BAR_H = 5;
const BAR_OFFSET_Y = 30;

/**
 * The player sprite plus its world-space health bar. The soldier art is drawn facing right, so
 * horizontal movement mirrors the sprite (Vampire Survivors style) rather than rotating it.
 */
export class PlayerView {
  private sprite: Phaser.GameObjects.Image;
  private barBg: Phaser.GameObjects.Image;
  private barFill: Phaser.GameObjects.Image;
  private hurtFlashMs = 0;
  private popMs = 0;
  private phase = 0;
  private moving = 0;
  private idleT = 0;
  private lastX = 0;
  private lastY = 0;
  private recoilMs = 0;
  private recoilKind: RecoilKind = 'pulse';
  private hurtMs = 0;
  private pose: Pose = { dy: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  /** half the sprite's height in units, so a squash keeps the feet on the floor */
  private halfH = 22;

  constructor(scene: Phaser.Scene, ch: CharacterDef, layer: Phaser.GameObjects.Layer) {
    this.sprite = scene.add.image(0, 0, 'game', ch.frame);
    this.barBg = scene.add.image(0, 0, 'game', 'bar_bg').setDisplaySize(BAR_W, BAR_H);
    this.barFill = scene.add.image(0, 0, 'game', 'bar_fill').setOrigin(0, 0.5);
    layer.add([this.barBg, this.barFill, this.sprite]);
    this.halfH = (this.sprite.height * GAME_FRAME_SCALE) / 2;
  }

  get gameObject(): Phaser.GameObjects.Image {
    return this.sprite;
  }

  flashHurt(): void {
    this.hurtFlashMs = 120;
    this.hurtMs = 220;
  }

  /** The body reacts to its own shot: a lunge, a kick or a pulse, over about a sixth of a second. */
  recoil(kind: RecoilKind): void {
    this.recoilKind = kind;
    this.recoilMs = 160;
  }

  /** A quick scale bounce on level-up; animated by hand in update, no tween. */
  pop(): void {
    this.popMs = 320;
  }

  update(player: Player, hp: number, maxHp: number, deltaMs: number): void {
    if (player.inputX !== 0) this.sprite.setFlipX(player.inputX < 0);
    const dir = this.sprite.flipX ? -1 : 1;

    // the walk is driven by ground covered, so speed buffs quicken the step on their own
    const dist = Math.hypot(player.x - this.lastX, player.y - this.lastY);
    this.lastX = player.x;
    this.lastY = player.y;
    const isMoving = player.inputX !== 0 || player.inputY !== 0;
    const blend = Math.min(1, deltaMs / 90);
    this.moving += ((isMoving ? 1 : 0) - this.moving) * blend;
    if (isMoving) this.phase = advancePhase(this.phase, Math.min(dist, 40));
    this.idleT += deltaMs / 1000;
    const pose = this.moving > 0.02 ? walkPose(this.phase, this.moving, this.pose) : idlePose(this.idleT, this.pose);

    let dx = 0;
    let sx = pose.scaleX;
    let sy = pose.scaleY;
    if (this.recoilMs > 0) {
      this.recoilMs = Math.max(0, this.recoilMs - deltaMs);
      const r = recoil(this.recoilKind, this.recoilMs / 160, dir);
      dx += r.dx;
      sx *= r.scaleX;
      sy *= r.scaleY;
    }
    if (this.hurtMs > 0) {
      this.hurtMs = Math.max(0, this.hurtMs - deltaMs);
      const q = squash(this.hurtMs / 220);
      sx *= q.scaleX;
      sy *= q.scaleY;
    }
    if (this.popMs > 0) {
      this.popMs = Math.max(0, this.popMs - deltaMs);
      const t = this.popMs / 320; // 1 -> 0
      const k = 1 + Math.sin(t * Math.PI) * 0.45;
      sx *= k;
      sy *= k;
    }
    // squash and stretch about the feet, not the centre, or the body sinks into the floor
    const footLift = (sy - 1) * this.halfH;
    this.sprite.setPosition(player.x + dx, player.y + pose.dy - footLift);
    this.sprite.setScale(sx * GAME_FRAME_SCALE, sy * GAME_FRAME_SCALE);
    this.sprite.setRotation(pose.rotation * dir);

    if (this.hurtFlashMs > 0) {
      this.hurtFlashMs -= deltaMs;
      this.sprite.setTint(0xff5555);
      this.sprite.setTintMode(1 /* FILL */);
      if (this.hurtFlashMs <= 0) {
        this.sprite.setTint(0xffffff);
        this.sprite.setTintMode(0 /* MULTIPLY */);
      }
    }

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const y = player.y + BAR_OFFSET_Y;
    this.barBg.setPosition(player.x, y);
    this.barFill.setPosition(player.x - BAR_W / 2, y);
    this.barFill.setDisplaySize(BAR_W * ratio, BAR_H);
    this.barFill.setTint(ratio > 0.5 ? 0x5ee06a : ratio > 0.25 ? 0xffd166 : 0xff5555);
    const show = ratio < 1;
    this.barBg.setVisible(show);
    this.barFill.setVisible(show && ratio > 0);
  }

  destroy(): void {
    this.sprite.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
  }
}
