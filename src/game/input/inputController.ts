import type Phaser from 'phaser';

/** Keyboard, gamepad and the debug-hook override collapsed into one direction vector. */
export class InputController {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private override: { x: number; y: number } | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    }
  }

  /** Sets a fixed direction that replaces real input until (0, 0) is passed. */
  setOverride(dx: number, dy: number): void {
    this.override = dx === 0 && dy === 0 ? null : { x: dx, y: dy };
  }

  hasOverride(): boolean {
    return this.override !== null;
  }

  read(): { x: number; y: number } {
    if (this.override) return this.override;
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.A?.isDown || k.LEFT?.isDown) x -= 1;
    if (k.D?.isDown || k.RIGHT?.isDown) x += 1;
    if (k.W?.isDown || k.UP?.isDown) y -= 1;
    if (k.S?.isDown || k.DOWN?.isDown) y += 1;
    const pad = this.scene.input.gamepad?.getPad(0);
    if (pad && x === 0 && y === 0) {
      const ax = pad.leftStick.x;
      const ay = pad.leftStick.y;
      if (Math.abs(ax) > 0.2) x = ax;
      if (Math.abs(ay) > 0.2) y = ay;
    }
    return { x, y };
  }

  reset(): void {
    this.scene.input.keyboard?.resetKeys();
  }
}
