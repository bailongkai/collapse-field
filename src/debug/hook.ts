import type Phaser from 'phaser';
import type { LevelUpChoice, OwnedItem, RunEnd, RunPhase } from '../core/sim/runState';
import type { EnemyBehaviorId, PlayerStats, StatKey } from '../data/types';
import type { SaveData } from '../core/save/saveData';
import type { Locale } from '../i18n';
import { getLocale, setLocale, tDynamic } from '../i18n';
import { listButtons, pressButton } from '../game/ui/buttonRegistry';
import { sfx } from '../game/audio/sfx';
import { app } from '../game/app';
import { loadSave } from '../core/save/saveData';
import { VERSION } from '../config';

export type SceneName = 'boot' | 'preload' | 'menu' | 'game' | 'levelup' | 'pause' | 'results';

export interface FrameStats {
  frames: number;
  avgMs: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  longFrames: number;
  histogram: Record<'<4' | '4-8' | '8-12' | '12-16.7' | '16.7-33' | '>33', number>;
  simMs: number;
  syncMs: number;
  renderMs: number;
  heapMB?: number;
  renderer: string;
}

export interface HookRunState {
  scene: string;
  phase: RunPhase;
  seed: number;
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  gold: number;
  player: { x: number; y: number; facing: number };
  counts: { enemies: number; projectiles: number; gems: number; pickups: number; dmgNumbers: number };
  pickups: { id: number; defId: string; x: number; y: number }[];
  enemies: { alive: number; byBehavior: Record<EnemyBehaviorId, number> };
  weapons: OwnedItem[];
  passives: OwnedItem[];
  stats: PlayerStats;
  choices: LevelUpChoice[] | null;
  god: boolean;
  reaperSpawned: boolean;
  ended?: RunEnd;
}

/** Everything that only exists while a run (GameScene) is alive. Bound by GameScene, detached on shutdown. */
export interface RunHandlers {
  pause(): void;
  resume(): void;
  setTimeScale(n: number): void;
  step(ticks: number): number;
  fastForward(sec: number, o?: { budgetMs?: number; levelUpPolicy?: 'first' | 'random' | 'none' }): Promise<void>;
  setTime(sec: number): void;
  setInput(dx: number, dy: number): void;
  /** Hands the player to the built-in kiting policy, used by the balance harness. */
  setAutopilot(on: boolean): void;
  /** The world area the run is being played on, which wave density is derived from. */
  getViewSize(): { width: number; height: number };
  setPlayerPos(x: number, y: number): void;
  spawn(enemyId: string, n: number, o?: { ring?: boolean; radius?: number | 'offscreen'; x?: number; y?: number }): number;
  spawnBoss(): void;
  spawnReaper(): void;
  despawnReaper(): void;
  killAll(): void;
  clearEnemies(): void;
  triggerEvent(index: number): void;
  spawnGems(n: number, tier?: 'blue' | 'green' | 'red', o?: { x?: number; y?: number }): void;
  spawnPickup(id: string, x?: number, y?: number): void;
  collectPickup(id: number): void;
  giveWeapon(id: string, level?: number): void;
  givePassive(id: string, level?: number): void;
  setLevel(n: number): void;
  addXp(n: number): void;
  triggerLevelUp(): void;
  getChoices(): LevelUpChoice[] | null;
  pickChoice(i: number): void;
  godMode(on: boolean): void;
  setStat(k: StatKey, v: number): void;
  heal(): void;
  kill(): void;
  endRun(cause: RunEnd): void;
  setSeed(seed: number): void;
  getState(): HookRunState;
  profileStart(): void;
  profileStop(): FrameStats;
  getPerf(): { fps: number; stepMs: number; syncMs: number; renderMs: number; renderer: string; activeSounds: number };
  toggleOverlay(): void;
}

export interface GameDebugApi extends Omit<RunHandlers, 'profileStart' | 'profileStop'> {
  version: string;
  ready: boolean;
  phaser: Phaser.Game;
  scene(): SceneName;
  activeScenes(): string[];
  goto(scene: 'menu' | 'game' | 'results', data?: unknown): void;
  startRun(o?: { seed?: number; characterId?: string; stageId?: string }): Promise<void>;
  getEvents(): string[];
  ui: { buttons(): { id: string; x: number; y: number; enabled: boolean }[]; press(id: string): boolean };
  profile: { start(): void; stop(): FrameStats };
  screenshot(): Promise<string>;
  content(): { weapons: string[]; passives: string[]; enemies: string[]; pickups: string[] };
  i18n: { setLocale(l: Locale): void; getLocale(): Locale; t(k: string): string };
  save: { get(): SaveData; reset(): void };
  mute(on: boolean): void;
  detach(): void;
  /** internal: used by scenes */
  pushEvent(e: string): void;
  bindRun(h: RunHandlers): void;
  hasRun(): boolean;
}

declare global {
  interface Window {
    __game: GameDebugApi;
  }
}

const EVENT_RING = 500;

export function installHook(game: Phaser.Game, contentProvider: () => GameDebugApi['content'] extends () => infer R ? R : never): GameDebugApi {
  const events: string[] = [];
  let run: RunHandlers | null = null;
  const requireRun = (): RunHandlers => {
    if (!run) throw new Error('no active run: call startRun() first');
    return run;
  };
  const sceneKeyToName = (k: string): SceneName => k.toLowerCase() as SceneName;

  const api: GameDebugApi = {
    version: VERSION,
    ready: false,
    phaser: game,
    scene() {
      const active = game.scene.getScenes(true).map((s) => s.scene.key);
      for (const k of ['LevelUp', 'Pause', 'Results', 'Game', 'Menu', 'Preload', 'Boot']) {
        if (active.includes(k)) return sceneKeyToName(k);
      }
      return 'boot';
    },
    activeScenes() {
      return game.scene.getScenes(true).map((s) => s.scene.key);
    },
    goto(scene, data) {
      const key = scene === 'menu' ? 'Menu' : scene === 'game' ? 'Game' : 'Results';
      const current = game.scene.getScenes(true);
      for (const s of current) s.scene.stop();
      game.scene.start(key, data as object | undefined);
    },
    async startRun(o = {}) {
      const seed = o.seed ?? app().seed ?? (Date.now() >>> 0);
      // Phaser processes scene starts and stops on frame boundaries, so tearing the old run down
      // and starting the new one in the same tick can leave the scene stack half-dismantled.
      for (const s of game.scene.getScenes(true)) {
        if (s.scene.key !== 'Boot' && s.scene.key !== 'Preload') s.scene.stop();
      }
      await nextFrame(game);
      game.scene.start('Game', { seed, characterId: o.characterId, stageId: o.stageId });
      await waitFor(() => run !== null && api.scene() === 'game');
      await nextFrame(game); // let GameScene.create finish launching the HUD
    },
    getEvents() {
      return events.slice();
    },
    ui: {
      buttons: () => listButtons(),
      press: (id: string) => pressButton(id),
    },
    profile: {
      start: () => requireRun().profileStart(),
      stop: () => requireRun().profileStop(),
    },
    screenshot() {
      return new Promise<string>((resolveShot, reject) => {
        try {
          game.renderer.snapshot((img) => {
            if (img instanceof HTMLImageElement) resolveShot(img.src);
            else reject(new Error('snapshot returned a Color, not an image'));
          });
        } catch (e) {
          reject(e as Error);
        }
      });
    },
    content: () => contentProvider(),
    i18n: {
      setLocale: (l) => setLocale(l),
      getLocale: () => getLocale(),
      t: (k) => tDynamic(k),
    },
    save: {
      get: () => loadSave(app().storage),
      reset: () => app().storage.clear(),
    },
    mute(on) {
      sfx.setMuted(on);
    },
    detach() {
      run = null;
    },
    pushEvent(e) {
      events.push(e);
      if (events.length > EVENT_RING) events.splice(0, events.length - EVENT_RING);
    },
    bindRun(h) {
      run = h;
    },
    hasRun() {
      return run !== null;
    },
    // --- run-scoped delegates -------------------------------------------------
    pause: () => requireRun().pause(),
    resume: () => requireRun().resume(),
    setTimeScale: (n) => requireRun().setTimeScale(n),
    step: (n) => requireRun().step(n),
    fastForward: (sec, o) => requireRun().fastForward(sec, o),
    setTime: (sec) => requireRun().setTime(sec),
    setInput: (dx, dy) => requireRun().setInput(dx, dy),
    setAutopilot: (on) => requireRun().setAutopilot(on),
    getViewSize: () => requireRun().getViewSize(),
    setPlayerPos: (x, y) => requireRun().setPlayerPos(x, y),
    spawn: (id, n, o) => requireRun().spawn(id, n, o),
    spawnBoss: () => requireRun().spawnBoss(),
    spawnReaper: () => requireRun().spawnReaper(),
    despawnReaper: () => requireRun().despawnReaper(),
    killAll: () => requireRun().killAll(),
    clearEnemies: () => requireRun().clearEnemies(),
    triggerEvent: (i) => requireRun().triggerEvent(i),
    spawnGems: (n, tier, o) => requireRun().spawnGems(n, tier, o),
    spawnPickup: (id, x, y) => requireRun().spawnPickup(id, x, y),
    collectPickup: (id) => requireRun().collectPickup(id),
    giveWeapon: (id, lv) => requireRun().giveWeapon(id, lv),
    givePassive: (id, lv) => requireRun().givePassive(id, lv),
    setLevel: (n) => requireRun().setLevel(n),
    addXp: (n) => requireRun().addXp(n),
    triggerLevelUp: () => requireRun().triggerLevelUp(),
    getChoices: () => requireRun().getChoices(),
    pickChoice: (i) => requireRun().pickChoice(i),
    godMode: (on) => requireRun().godMode(on),
    setStat: (k, v) => requireRun().setStat(k, v),
    heal: () => requireRun().heal(),
    kill: () => requireRun().kill(),
    endRun: (cause) => requireRun().endRun(cause),
    setSeed: (seed) => requireRun().setSeed(seed),
    getState: () => requireRun().getState(),
    getPerf: () => {
      if (run) return run.getPerf();
      return { fps: game.loop.actualFps, stepMs: 0, syncMs: 0, renderMs: 0, renderer: rendererString(game), activeSounds: sfx.activeCount() };
    },
    toggleOverlay: () => requireRun().toggleOverlay(),
  };
  window.__game = api;
  return api;
}

/** Resolves after the next game step, once Phaser has drained its scene queue. */
function nextFrame(game: Phaser.Game): Promise<void> {
  return new Promise<void>((resolve) => {
    game.events.once('poststep', () => resolve());
  });
}

function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const check = (): void => {
      if (predicate()) resolve();
      else if (Date.now() - started > timeoutMs) reject(new Error('timed out waiting for the run to start'));
      else setTimeout(check, 16);
    };
    check();
  });
}

export function rendererString(game: Phaser.Game): string {
  const r = game.renderer as unknown as { gl?: WebGLRenderingContext };
  const gl = r.gl;
  if (!gl) return 'canvas';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  return String(gl.getParameter(gl.RENDERER));
}
