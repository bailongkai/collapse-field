import Phaser from 'phaser';
import { registerButton } from './buttonRegistry';
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
}

/** Nine-sliced button with a Text label. Registers itself for the debug hook; deregisters on destroy. */
export class UiButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private enabled = true;
  private unregister: () => void;
  private onPress: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    const w = opts.width ?? 260;
    const h = opts.height ?? 56;
    this.onPress = opts.onPress;
    this.bg = scene.add.nineslice(0, 0, 'ui', opts.frame ?? 'button_rect', w, h, 12, 12, 12, 12);
    this.label = scene.add.text(0, 0, opts.label, textStyle(opts.fontSize ?? 22, { bold: true, color: '#0b1a2a' })).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', () => this.setHighlight(true));
    this.on('pointerout', () => this.setHighlight(false));
    this.on('pointerdown', () => this.bg.setTint(0xbfd9ff));
    this.on('pointerup', () => {
      this.setHighlight(true);
      this.press();
    });
    this.unregister = registerButton({
      id: opts.id,
      getPos: () => ({ x: this.x, y: this.y }),
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
