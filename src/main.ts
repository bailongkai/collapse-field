import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { initApp } from './game/app';
import { installHook } from './debug/hook';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { LevelUpScene } from './game/scenes/LevelUpScene';
import { ResultsScene } from './game/scenes/ResultsScene';
import { contentSummary } from './data';

initApp();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'app',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#05070c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'app', width: GAME_W, height: GAME_H },
  input: { gamepad: true },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HudScene, LevelUpScene, ResultsScene],
};

const game = new Phaser.Game(config);
installHook(game, contentSummary);
