export type SimEventType =
  | 'hit' | 'death' | 'spawn' | 'gem' | 'levelUp' | 'levelUpOpen' | 'bossSpawned' | 'bossKilled'
  | 'pickup' | 'hurt' | 'reaper' | 'died' | 'survived' | 'rush' | 'chest' | 'heal' | 'nuke' | 'vacuum' | 'revive'
  | 'evolve' | 'telegraph' | 'enemyShot';

export interface SimEvent {
  type: SimEventType;
  x: number;
  y: number;
  /** damage, level, amount — meaning depends on the type */
  n: number;
  /** enemy/pickup/weapon id where relevant */
  id: string;
  big: boolean;
}

/**
 * Fixed-capacity ring of simulation events drained once per rendered frame by the views, plus a
 * parallel string log the debug hook exposes to Playwright.
 */
export class EventBuffer {
  private items: SimEvent[];
  private len = 0;
  private readonly cap: number;

  constructor(cap = 4096) {
    this.cap = cap;
    this.items = new Array<SimEvent>(cap);
    for (let i = 0; i < cap; i++) this.items[i] = { type: 'hit', x: 0, y: 0, n: 0, id: '', big: false };
  }

  /**
   * Records an event. The capacity is sized for the worst tick the game can produce — a screen
   * clear at the late-game enemy count emits two events per kill — because dropping the tail would
   * silently swallow the very event that caused it, along with its flash and sound.
   */
  push(type: SimEventType, x = 0, y = 0, n = 0, id = '', big = false): void {
    if (this.len >= this.cap) return; // drop rather than grow; drained every frame
    const e = this.items[this.len++];
    e.type = type;
    e.x = x;
    e.y = y;
    e.n = n;
    e.id = id;
    e.big = big;
  }

  get length(): number {
    return this.len;
  }

  at(i: number): SimEvent {
    return this.items[i];
  }

  clear(): void {
    this.len = 0;
  }
}
