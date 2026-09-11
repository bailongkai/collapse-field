import type { SaveData, SaveStorage } from '../core/save/saveData';
import { loadSave } from '../core/save/saveData';
import { MemoryStorage } from '../core/save/memoryStorage';
import { LocalStorageAdapter } from './save/localStorageAdapter';
import { isLocale, setLocale } from '../i18n';
import { TouchDetector } from './input/touchControls';
import { initPlatform } from '../platform';

/** Process-wide context: query flags, storage and the loaded save. Created once in main.ts. */
export interface AppContext {
  testMode: boolean;
  debug: boolean;
  seed: number | undefined;
  storage: SaveStorage;
  save: SaveData;
  /** whether this session is being played by touch; flips on the first real touch */
  touch: TouchDetector;
}

let ctx: AppContext | null = null;

/** `nativeStorage` is the device store opened before boot; the web passes nothing and uses localStorage. */
export function initApp(search: string = typeof location !== 'undefined' ? location.search : '', nativeStorage: SaveStorage | null = null): AppContext {
  const q = new URLSearchParams(search);
  const testMode = q.get('test') === '1';
  const storage: SaveStorage = testMode ? new MemoryStorage() : nativeStorage ?? new LocalStorageAdapter();
  const save = loadSave(storage);
  // tests drive the game through the hook and must not be met by the walkthrough: ?tutorial=1 opts a
  // test in, and ?tutorial=0 opts a real-storage session out
  if ((testMode && q.get('tutorial') !== '1') || q.get('tutorial') === '0') save.tutorialDone = true;
  const seedParam = q.get('seed');
  const seed = seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam)) ? Number(seedParam) >>> 0 : undefined;
  const lang = q.get('lang');
  setLocale(isLocale(lang) ? lang : save.settings.locale);
  initPlatform({ testMode, debug: testMode || q.get('debug') === '1' || import.meta.env.DEV, fakeAds: q.get('ads') === '1' });
  ctx = {
    testMode,
    debug: testMode || q.get('debug') === '1' || import.meta.env.DEV,
    seed,
    storage,
    save,
    touch: new TouchDetector(search),
  };
  return ctx;
}

export function app(): AppContext {
  if (!ctx) throw new Error('initApp() has not been called');
  return ctx;
}
