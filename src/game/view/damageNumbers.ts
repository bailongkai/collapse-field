import type Phaser from 'phaser';
import { DMG_NUMBER_POOL, DMG_NUMBERS_PER_STEP } from '../../config';
import { DIGIT_FONT_KEY } from '../fonts/retroDigits';

interface Slot {
  text: Phaser.GameObjects.BitmapText;
  ttl: number;
  life: number;
  x: number;
  y: number;
  vy: number;
}

/**
 * Floating damage numbers as pooled BitmapText, animated by a manual lerp in the sync pass rather
 * than a Tween per hit: at aura hit rates a tween per number would churn the tween manager and the
 * garbage collector. Spawns are capped per step, largest values first.
 */
export class DamageNumbers {
  private slots: Slot[] = [];
  private cursor = 0;
  private spawnedThisStep = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    for (let i = 0; i < DMG_NUMBER_POOL; i++) {
      const text = scene.add.bitmapText(0, 0, DIGIT_FONT_KEY, '0', 18).setOrigin(0.5).setVisible(false);
      layer.add(text);
      this.slots.push({ text, ttl: 0, life: 0, x: 0, y: 0, vy: 0 });
    }
  }

  beginStep(): void {
    this.spawnedThisStep = 0;
  }

  spawn(x: number, y: number, value: number, big: boolean): void {
    if (this.spawnedThisStep >= DMG_NUMBERS_PER_STEP) return;
    this.spawnedThisStep++;
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.slots.length;
    slot.x = x;
    slot.y = y;
    slot.vy = -46;
    slot.life = big ? 900 : 650;
    slot.ttl = slot.life;
    slot.text.setText(String(Math.round(value)));
    slot.text.setFontSize(big ? 26 : 18);
    slot.text.setTint(big ? 0xffd166 : 0xffffff);
    slot.text.setPosition(x, y);
    slot.text.setVisible(true);
    slot.text.setAlpha(1);
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const slot of this.slots) {
      if (slot.ttl <= 0) continue;
      slot.ttl -= deltaMs;
      if (slot.ttl <= 0) {
        slot.text.setVisible(false);
        continue;
      }
      slot.y += slot.vy * dt;
      slot.vy += 60 * dt; // ease the rise to a stop
      slot.text.setPosition(slot.x, slot.y);
      slot.text.setAlpha(Math.min(1, slot.ttl / (slot.life * 0.4)));
    }
  }

  get activeCount(): number {
    return this.slots.reduce((n, s) => n + (s.ttl > 0 ? 1 : 0), 0);
  }

  destroy(): void {
    for (const s of this.slots) s.text.destroy();
    this.slots.length = 0;
  }
}
