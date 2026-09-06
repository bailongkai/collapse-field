import Phaser from 'phaser';

/**
 * Scenes that lay themselves out once in create() rebuild on a canvas resize. The logical width
 * follows the display's aspect ratio, so a rotated phone or a resized window would otherwise leave
 * their layout stale until the next scene change.
 */
export function restartOnResize(scene: Phaser.Scene, data?: object): void {
  const onResize = (): void => {
    if (scene.scene.isActive()) scene.scene.restart(data);
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
}
