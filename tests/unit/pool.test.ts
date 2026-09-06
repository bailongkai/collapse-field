import { describe, it, expect } from 'vitest';
import { Pool } from '../../src/core/pool';

interface Item {
  id: number;
  active: boolean;
  v: number;
}
const make = (cap: number) => new Pool<Item>(cap, (id) => ({ id, active: false, v: 0 }));

describe('Pool', () => {
  it('spawns unique items and reports counts', () => {
    const p = make(4);
    const ids = new Set<number>();
    for (let i = 0; i < 4; i++) ids.add(p.spawn()!.id);
    expect(ids.size).toBe(4);
    expect(p.count).toBe(4);
    expect(p.isFull).toBe(true);
    expect(p.spawn()).toBeNull();
  });
  it('reuses freed slots', () => {
    const p = make(2);
    const a = p.spawn()!;
    p.spawn();
    p.free(a);
    expect(p.count).toBe(1);
    const c = p.spawn()!;
    expect(c.id).toBe(a.id);
  });
  it('iterates every active item', () => {
    const p = make(8);
    for (let i = 0; i < 5; i++) p.spawn()!.v = i;
    const seen: number[] = [];
    p.forEach((it) => seen.push(it.v));
    expect(seen.sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('supports freeing the current item during iteration', () => {
    const p = make(8);
    for (let i = 0; i < 6; i++) p.spawn()!.v = i;
    p.forEach((it) => {
      if (it.v % 2 === 0) p.free(it);
    });
    const left: number[] = [];
    p.forEach((it) => left.push(it.v));
    expect(left.sort()).toEqual([1, 3, 5]);
    expect(p.count).toBe(3);
  });
  it('clear() empties the pool and restores capacity', () => {
    const p = make(3);
    p.spawn();
    p.spawn();
    p.clear();
    expect(p.count).toBe(0);
    expect(p.spawn()).not.toBeNull();
  });
});
