import Phaser from 'phaser';
import { registerButton } from './buttonRegistry';
import { minTouchUnits } from '../layout';
import { textStyle, COLORS } from './textStyles';
import { sfx } from '../audio/sfx';

export interface ButtonOpts {
  id: string;
  label: string;
  width?: number;
  height?: number;
  fontSize?: number;
  onPress: () => void;
  /** ui-atlas frame; defaults to button_rect */
  frame?: string;
  /** game-atlas frame drawn instead of a text label, for buttons that must not depend on a font */
  icon?: string;
}

/** Nine-sliced button with a Text label. Registers itself for the debug hook; deregisters on destroy. */
export class UiButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private enabled = true;
  /** id of the pointer that pressed this button, or -1 */
  private armedPointer = -1;
  private hitW = 0;
  private hitH = 0;
  private unregister: () => void;
  private onPress: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    const w = opts.width ?? 260;
    const h = opts.height ?? 56;
    this.onPress = opts.onPress;
    this.bg = scene.add.nineslice(0, 0, 'ui', opts.frame ?? 'button_rect', w, h, 12, 12, 12, 12);
    this.label = scene.add
      .text(0, 0, opts.icon ? '' : opts.label, textStyle(opts.fontSize ?? 22, { bold: true, color: '#0b1a2a' }))
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    if (opts.icon) this.add(scene.add.image(0, 0, 'game', opts.icon).setDisplaySize(Math.round(h * 0.55), Math.round(h * 0.55)));
    // The hit area is grown past the drawing so an off-centre thumb still lands: on a phone the
    // difference between "tapped it" and "nothing happened" is a few millimetres.
    const minUnits = minTouchUnits(scene);
    this.hitW = Math.max(w, minUnits);
    this.hitH = Math.max(h, minUnits);
    // Phaser normalises the hit test by displayOrigin, which setSize puts at the container's
    // centre, so the rectangle is authored from the top-left. A centred rectangle would sit half a
    // button up and to the left of where it is drawn — which is exactly what made taps on the lower
    // half of a button do nothing.
    this.setSize(this.hitW, this.hitH);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.hitW, this.hitH), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', () => this.setHighlight(true));
    this.on('pointerout', () => {
      this.setHighlight(false);
      this.armedPointer = -1;
    });
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.armedPointer = pointer.id;
      this.bg.setTint(0xbfd9ff);
    });
    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.setHighlight(true);
      // only the pointer that pressed this button may activate it. Overlays appear under a finger
      // that is already down, and acting on a bare release would choose for the player.
      if (this.armedPointer !== pointer.id) return;
      this.armedPointer = -1;
      this.press();
    });
    this.unregister = registerButton({
      id: opts.id,
      getPos: () => ({ x: this.x, y: this.y }),
      getHitSize: () => ({ w: this.hitW, h: this.hitH }),
      isEnabled: () => this.enabled && this.active && this.visible,
      press: () => this.press(),
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unregister());
    scene.add.existing(this);
  }

  setHighlight(on: boolean): void {
    if (!this.enabled) return;
    this.bg.setTint(on ? 0xdff3ff : 0xffffff);
    this.setScale(on ? 1.03 : 1);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.5);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  press(): void {
    if (!this.enabled || !this.active) return;
    sfx.play('click');
    this.onPress();
  }
}

export const BUTTON_TEXT_COLOR = COLORS.text;
