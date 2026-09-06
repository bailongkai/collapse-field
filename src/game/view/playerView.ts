import type Phaser from 'phaser';
import type { CharacterDef } from '../../data/types';
import type { Player } from '../../core/sim/entities/player';

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

  constructor(scene: Phaser.Scene, ch: CharacterDef, layer: Phaser.GameObjects.Layer) {
    this.sprite = scene.add.image(0, 0, 'game', ch.frame);
    this.barBg = scene.add.image(0, 0, 'game', 'bar_bg');
    this.barFill = scene.add.image(0, 0, 'game', 'bar_fill').setOrigin(0, 0.5);
    layer.add([this.barBg, this.barFill, this.sprite]);
  }

  get gameObject(): Phaser.GameObjects.Image {
    return this.sprite;
  }

  flashHurt(): void {
    this.hurtFlashMs = 120;
  }

  update(player: Player, hp: number, maxHp: number, deltaMs: number): void {
    this.sprite.setPosition(player.x, player.y);
    if (player.inputX !== 0) this.sprite.setFlipX(player.inputX < 0);

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
