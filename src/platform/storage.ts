import type { SaveStorage } from '../core/save/saveData';
import { SAVE_KEY } from '../config';

/**
 * The slice of Capacitor Preferences this needs, so the adapter can be tested with a fake and
 * the plugin is only ever loaded on a device.
 */
export interface KeyValueStore {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

/**
 * A save that lives in native app storage rather than the web view's localStorage, which iOS
 * treats as a cache and may purge under pressure. The store is asynchronous and the game's
 * SaveStorage is not, so the value is read once before the game boots and every write goes
 * through a cache first: reads are always current, and a write that is still in flight when
 * the app is killed loses at most that one write.
 */
export class NativeStorage implements SaveStorage {
  private cached: string | null;
  private pending: Promise<void> = Promise.resolve();

  private constructor(private readonly store: KeyValueStore, initial: string | null) {
    this.cached = initial;
  }

  static async open(store: KeyValueStore): Promise<NativeStorage> {
    let initial: string | null = null;
    try {
      initial = (await store.get({ key: SAVE_KEY })).value;
    } catch (error) {
      console.warn('native storage unreadable', error);
    }
    // a save written by the web version of this build, before native storage existed, is adopted once
    if (initial === null) {
      try {
        initial = localStorage.getItem(SAVE_KEY);
        if (initial !== null) await store.set({ key: SAVE_KEY, value: initial });
      } catch {
        /* no localStorage either */
      }
    }
    return new NativeStorage(store, initial);
  }

  read(): string | null {
    return this.cached;
  }

  write(s: string): void {
    this.cached = s;
    // writes are serialised so an older one can never land after a newer one
    this.pending = this.pending.then(() => this.store.set({ key: SAVE_KEY, value: s })).catch((error) => console.warn('native save failed', error));
  }

  clear(): void {
    this.cached = null;
    this.pending = this.pending.then(() => this.store.remove({ key: SAVE_KEY })).catch((error) => console.warn('native clear failed', error));
  }

  /** Resolves once every write so far has reached the store; for tests and for app pause. */
  flush(): Promise<void> {
    return this.pending;
  }
}

/** The device's store, or null on the web where localStorage is the right answer. */
export async function openNativeStorage(native: boolean): Promise<NativeStorage | null> {
  if (!native) return null;
  const { Preferences } = await import('@capacitor/preferences');
  return NativeStorage.open(Preferences);
}
