import Phaser from 'phaser';


const BASE_RADIUS = 68;
const KNOB_RADIUS = 30;
const DEAD_ZONE = 8;
/**
 * The stick only starts below the HUD strip. It has to clear the on-screen pause button's lower
 * edge, otherwise one touch would both press the button and grab the stick.
 */
const START_ZONE_TOP = 180;

/**
 * A floating virtual stick: it appears wherever the player first presses and follows the drag, so
 * there is no fixed spot to hunt for while the horde is closing in. It draws in screen space and
 * reports a normalised direction, which the input controller reads like any other source.
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private pointerId = -1;
  /** where the finger actually landed: the direction is measured from here */
  private originX = 0;
  private originY = 0;
  /** where the ring is drawn, clamped on screen so it is never half off the edge */
  private drawX = 0;
  private drawY = 0;
  private dirX = 0;
  private dirY = 0;
  private enabled = false;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    this.base = scene.add
      .circle(0, 0, BASE_RADIUS, 0x0d1420, 0.35)
      .setStrokeStyle(3, 0x4fe0ff, 0.55)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);
    this.knob = scene.add
      .circle(0, 0, KNOB_RADIUS, 0x4fe0ff, 0.55)
      .setStrokeStyle(2, 0xe8f1ff, 0.8)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    // a paused scene's input plugin is inactive and cannot deliver the release, so the stick has
    // to let go itself or the player resumes walking with no finger on the screen
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.release, this);
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.release, this);
  }

  /**
   * Drops the stick if the pointer holding it is no longer down. The scene-scoped release event is
   * not enough on its own: an overlay scene above this one consumes the release whenever the finger
   * happens to be over one of its buttons, and a paused scene never sees it at all.
   */
  poll(): void {
    if (this.pointerId === -1) return;
    const pointer = this.scene.input.manager.pointers[this.pointerId];
    if (!pointer || !pointer.isDown) this.release();
  }

  /** Turned on by the first touch, or by ?touch=1. Until then the stick never shows. */
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.release();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isActive(): boolean {
    return this.pointerId !== -1;
  }

  read(): { x: number; y: number } {
    return { x: this.dirX, y: this.dirY };
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || this.pointerId !== -1) return;
    if (pointer.y < START_ZONE_TOP) return; // leave the HUD strip free for the pause button
    this.pointerId = pointer.id;
    // thumbs rest near the edges: clamping the origin as well as the drawing would read that press
    // as an instant shove towards the middle of the screen
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.drawX = Phaser.Math.Clamp(pointer.x, BASE_RADIUS, this.scene.scale.width - BASE_RADIUS);
    this.drawY = Phaser.Math.Clamp(pointer.y, BASE_RADIUS, this.scene.scale.height - BASE_RADIUS);
    this.base.setPosition(this.drawX, this.drawY).setVisible(true);
    this.knob.setPosition(this.drawX, this.drawY).setVisible(true);
    this.update(pointer.x, pointer.y);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.update(pointer.x, pointer.y);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.release();
  }

  private update(x: number, y: number): void {
    const dx = x - this.originX;
    const dy = y - this.originY;
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) {
      this.dirX = 0;
      this.dirY = 0;
      this.knob.setPosition(this.drawX, this.drawY);
      return;
    }
    this.dirX = dx / len;
    this.dirY = dy / len;
    const knobDist = Math.min(len, BASE_RADIUS);
    this.knob.setPosition(this.drawX + this.dirX * knobDist, this.drawY + this.dirY * knobDist);
  }

  /** Lets go of the stick and hides it. Safe to call at any time. */
  release(): void {
    this.pointerId = -1;
    this.dirX = 0;
    this.dirY = 0;
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.release, this);
    this.scene.events.off(Phaser.Scenes.Events.SLEEP, this.release, this);
    this.base.destroy();
    this.knob.destroy();
  }
}

/**
 * Whether this session should show touch controls. Touch is detected from real touch input rather
 * than from the user agent, so a laptop with a touchscreen only gets the stick once someone
 * actually touches the screen. `?touch=1` forces it on for testing.
 */
export class TouchDetector {
  private touched = false;
  private forced: boolean;
  private listeners = new Set<(on: boolean) => void>();

  constructor(search: string) {
    const q = new URLSearchParams(search);
    this.forced = q.get('touch') === '1';
    if (this.forced) this.touched = true;
    if (typeof window !== 'undefined' && !this.forced) {
      const onTouch = (): void => {
        window.removeEventListener('touchstart', onTouch);
        this.touched = true;
        for (const l of this.listeners) l(true);
      };
      window.addEventListener('touchstart', onTouch, { passive: true });
    }
  }

  get active(): boolean {
    return this.touched;
  }

  onChange(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
