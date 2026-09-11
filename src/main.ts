import Phaser from 'phaser';
import { logicalSizeForWindow } from './game/layout';
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

initApp();

const initial = logicalSizeForWindow(window.innerWidth, window.innerHeight);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'app',
  width: initial.width,
  height: initial.height,
  backgroundColor: '#05070c',
  // FIT with a width that already matches the display's aspect: the canvas fills the screen and
  // only the clamped extremes leave a small border.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'app', width: initial.width, height: initial.height },
  // three simultaneous pointers: a thumb on the virtual stick, a second finger for a button, spare
  input: { gamepad: true, activePointers: 3 },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HudScene, LevelUpScene,
    ChestScene, ReviveScene, TutorialScene, LaunchScene, AchievementsScene, BestiaryScene, PauseScene, SettingsScene, ShopScene, ResultsScene],
};

const game = new Phaser.Game(config);
installHook(game, contentSummary);

/** Keeps the logical width in step with the window, so rotating a phone re-lays out the game. */
function applyWindowSize(): void {
  const size = logicalSizeForWindow(window.innerWidth, window.innerHeight);
  if (Math.abs(size.width - game.scale.width) < 1 && Math.abs(size.height - game.scale.height) < 1) return;
  game.scale.setGameSize(size.width, size.height);
}

window.addEventListener('resize', applyWindowSize);
window.addEventListener('orientationchange', applyWindowSize);
