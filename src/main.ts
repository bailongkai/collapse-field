import Phaser from 'phaser';
import { commitRenderScale, installRenderScale, planCanvas } from './game/render';
import { initApp } from './game/app';
import { installHook } from './debug/hook';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { LevelUpScene } from './game/scenes/LevelUpScene';
import { ChestScene } from './game/scenes/ChestScene';
import { LaunchScene } from './game/scenes/LaunchScene';
import { AchievementsScene } from './game/scenes/AchievementsScene';
import { BestiaryScene } from './game/scenes/BestiaryScene';
import { PauseScene } from './game/scenes/PauseScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { ShopScene } from './game/scenes/ShopScene';
import { ResultsScene } from './game/scenes/ResultsScene';
import { ReviveScene } from './game/scenes/ReviveScene';
import { TutorialScene } from './game/scenes/TutorialScene';
import { contentSummary } from './data';
import { openNativeStorage } from './platform/storage';
import { bindAppEvents } from './platform/appEvents';
import { Capacitor } from '@capacitor/core';

// on a device the save is read from native storage before anything else happens
const nativeStorage = await openNativeStorage(Capacitor.isNativePlatform());
initApp(undefined, nativeStorage);
void bindAppEvents();

const initial = planCanvas(window.innerWidth, window.innerHeight);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'app',
  width: initial.width,
  height: initial.height,
  backgroundColor: '#05070c',
  // FIT with a width that already matches the display's aspect: the canvas fills the screen and
  // only the clamped extremes leave a small border. The size is the logical view times the render
  // scale, so on a dense display the canvas has a pixel for every pixel the screen shows.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'app', width: initial.width, height: initial.height },
  // the first scene can be created inside the constructor, so the scale has to be on the registry
  // before boot rather than after
  callbacks: { preBoot: (g) => commitRenderScale(g, initial) },
  // three simultaneous pointers: a thumb on the virtual stick, a second finger for a button, spare
  input: { gamepad: true, activePointers: 3 },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HudScene, LevelUpScene,
    ChestScene, ReviveScene, TutorialScene, LaunchScene, AchievementsScene, BestiaryScene, PauseScene, SettingsScene, ShopScene, ResultsScene],
};

const game = new Phaser.Game(config);
installRenderScale(game);
installHook(game, contentSummary);

/** Keeps the logical width in step with the window, so rotating a phone re-lays out the game. */
function applyWindowSize(): void {
  const next = planCanvas(window.innerWidth, window.innerHeight);
  if (Math.abs(next.width - game.scale.width) < 1 && Math.abs(next.height - game.scale.height) < 1) return;
  commitRenderScale(game, next);
  game.scale.setGameSize(next.width, next.height);
}

window.addEventListener('resize', applyWindowSize);
window.addEventListener('orientationchange', applyWindowSize);
