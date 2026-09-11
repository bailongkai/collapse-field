import { describe, it, expect } from 'vitest';
import { NativeStorage, type KeyValueStore } from '../../src/platform/storage';
import { loadSave, writeSave } from '../../src/core/save/saveData';

/** An in-memory Preferences with the same asynchronous shape, plus a fault switch. */
class FakeStore implements KeyValueStore {
  data = new Map<string, string>();
  fail = false;
  writes: string[] = [];
  async get(o: { key: string }): Promise<{ value: string | null }> {
    if (this.fail) throw new Error('store down');
    return { value: this.data.get(o.key) ?? null };
  }
  async set(o: { key: string; value: string }): Promise<void> {
    if (this.fail) throw new Error('store down');
    this.writes.push(o.value);
    this.data.set(o.key, o.value);
  }
  async remove(o: { key: string }): Promise<void> {
    this.data.delete(o.key);
  }
}

describe('native storage', () => {
  it('reads what was there before boot and writes through', async () => {
    const store = new FakeStore();
    const first = await NativeStorage.open(store);
    expect(loadSave(first).gold).toBe(0);
    writeSave(first, { ...loadSave(first), gold: 77 });
    // the cache answers at once; the store catches up
    expect(loadSave(first).gold).toBe(77);
    await first.flush();
    const again = await NativeStorage.open(store);
    expect(loadSave(again).gold).toBe(77);
  });

  it('keeps writes in order so an older save can never overwrite a newer one', async () => {
    const store = new FakeStore();
    const st = await NativeStorage.open(store);
    for (let i = 1; i <= 5; i++) st.write(String(i));
    await st.flush();
    expect(store.writes).toEqual(['1', '2', '3', '4', '5']);
    expect(store.data.values().next().value).toBe('5');
  });

  it('a broken store still boots the game with a fresh save and keeps the session alive', async () => {
    const store = new FakeStore();
    store.fail = true;
    const st = await NativeStorage.open(store);
    expect(st.read()).toBeNull();
    st.write('x');
    await st.flush();
    expect(st.read()).toBe('x');
  });

  it('clear empties both the cache and the store', async () => {
    const store = new FakeStore();
    const st = await NativeStorage.open(store);
    st.write('x');
    st.clear();
    await st.flush();
    expect(st.read()).toBeNull();
    expect(store.data.size).toBe(0);
  });
});
