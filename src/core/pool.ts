/**
 * Fixed-size pool of plain objects with stable shapes. Entities are never allocated or freed after
 * construction: `spawn()` reuses a free slot, `free()` returns it. Iteration goes over a dense
 * array of active indices so the hot loops never scan dead slots.
 */
export interface Poolable {
  id: number;
  active: boolean;
}

export class Pool<T extends Poolable> {
  readonly items: T[];
  readonly capacity: number;
  private freeIds: Int32Array;
  private freeCount: number;
  private aliveIds: Int32Array;
  private aliveCount = 0;
  /** position of an id inside aliveIds, or -1 */
  private aliveIndex: Int32Array;

  constructor(capacity: number, factory: (id: number) => T) {
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
    this.freeIds = new Int32Array(capacity);
    this.aliveIds = new Int32Array(capacity);
    this.aliveIndex = new Int32Array(capacity).fill(-1);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = factory(i);
      this.items[i].active = false;
      this.freeIds[i] = capacity - 1 - i; // pop from the end -> ids ascend
    }
    this.freeCount = capacity;
  }

  get count(): number {
    return this.aliveCount;
  }

  get isFull(): boolean {
    return this.freeCount === 0;
  }

  /** Returns a free item marked active, or null when the pool is exhausted. */
  spawn(): T | null {
    if (this.freeCount === 0) return null;
    const id = this.freeIds[--this.freeCount];
    const item = this.items[id];
    item.active = true;
    this.aliveIndex[id] = this.aliveCount;
    this.aliveIds[this.aliveCount++] = id;
    return item;
  }

  free(item: T): void {
    if (!item.active) return;
    item.active = false;
    const id = item.id;
    const pos = this.aliveIndex[id];
    const lastPos = --this.aliveCount;
    const movedId = this.aliveIds[lastPos];
    this.aliveIds[pos] = movedId;
    this.aliveIndex[movedId] = pos;
    this.aliveIndex[id] = -1;
    this.freeIds[this.freeCount++] = id;
  }

  clear(): void {
    while (this.aliveCount > 0) this.free(this.items[this.aliveIds[0]]);
  }

  /** Dense list of active ids. Do not mutate; valid until the next spawn/free. */
  aliveList(): Int32Array {
    return this.aliveIds;
  }

  /**
   * Iterate active items. Safe when the callback frees the item it was given: freeing swaps the
   * last alive item into the current slot, so we re-test the same index instead of advancing.
   * Freeing a *different* item from inside the callback is not supported.
   */
  forEach(fn: (item: T) => void): void {
    for (let i = 0; i < this.aliveCount; ) {
      const id = this.aliveIds[i];
      fn(this.items[id]);
      if (i < this.aliveCount && this.aliveIds[i] === id) i++;
    }
  }
}
