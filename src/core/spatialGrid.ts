/**
 * Uniform grid broadphase built from Int32Array head/next linked lists, anchored on a moving origin
 * (the player) so the covered window follows the action. Rebuilt from scratch every step in O(n);
 * queries and pair iteration allocate nothing.
 */
export class SpatialGrid {
  readonly cell: number;
  readonly size: number;
  private head: Int32Array;
  private next: Int32Array;
  private cellOf: Int32Array;
  private xs: Float64Array;
  private ys: Float64Array;
  private originX = 0;
  private originY = 0;
  private count = 0;

  constructor(cell: number, size: number, capacity: number) {
    this.cell = cell;
    this.size = size;
    this.head = new Int32Array(size * size).fill(-1);
    this.next = new Int32Array(capacity).fill(-1);
    this.cellOf = new Int32Array(capacity).fill(-1);
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
  }

  /** Half-width of the covered window in px. */
  get halfSpan(): number {
    return (this.cell * this.size) / 2;
  }

  /** Clears the grid and centres the window on (cx, cy). */
  begin(cx: number, cy: number): void {
    this.head.fill(-1);
    this.originX = cx - this.halfSpan;
    this.originY = cy - this.halfSpan;
    this.count = 0;
  }

  private cellIndex(x: number, y: number): number {
    const gx = Math.floor((x - this.originX) / this.cell);
    const gy = Math.floor((y - this.originY) / this.cell);
    if (gx < 0 || gy < 0 || gx >= this.size || gy >= this.size) return -1;
    return gy * this.size + gx;
  }

  /** Inserts an entity id at (x, y). Ids outside the window are ignored (queries skip them). */
  insert(id: number, x: number, y: number): void {
    const ci = this.cellIndex(x, y);
    this.cellOf[id] = ci;
    this.xs[id] = x;
    this.ys[id] = y;
    if (ci < 0) {
      this.next[id] = -1;
      return;
    }
    this.next[id] = this.head[ci];
    this.head[ci] = id;
    this.count++;
  }

  get inserted(): number {
    return this.count;
  }

  /**
   * Writes the ids whose stored position lies inside the AABB into `out` and returns how many.
   * Never allocates; stops when `out` is full.
   */
  queryInto(x0: number, y0: number, x1: number, y1: number, out: Int32Array): number {
    let n = 0;
    const gx0 = Math.max(0, Math.floor((x0 - this.originX) / this.cell));
    const gy0 = Math.max(0, Math.floor((y0 - this.originY) / this.cell));
    const gx1 = Math.min(this.size - 1, Math.floor((x1 - this.originX) / this.cell));
    const gy1 = Math.min(this.size - 1, Math.floor((y1 - this.originY) / this.cell));
    for (let gy = gy0; gy <= gy1; gy++) {
      const row = gy * this.size;
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let id = this.head[row + gx]; id !== -1; id = this.next[id]) {
          const x = this.xs[id];
          const y = this.ys[id];
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          if (n >= out.length) return n;
          out[n++] = id;
        }
      }
    }
    return n;
  }

  /**
   * Visits every pair of inserted ids that share a cell or sit in one of the four forward
   * neighbours, exactly once per pair.
   */
  forEachPair(fn: (a: number, b: number) => void): void {
    const size = this.size;
    // forward neighbours: right, down-left, down, down-right
    for (let gy = 0; gy < size; gy++) {
      for (let gx = 0; gx < size; gx++) {
        const ci = gy * size + gx;
        const first = this.head[ci];
        if (first === -1) continue;
        for (let a = first; a !== -1; a = this.next[a]) {
          for (let b = this.next[a]; b !== -1; b = this.next[b]) fn(a, b);
        }
        for (let k = 0; k < 4; k++) {
          const nx = gx + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? 0 : 1);
          const ny = gy + (k === 0 ? 0 : 1);
          if (nx < 0 || nx >= size || ny >= size) continue;
          for (let a = first; a !== -1; a = this.next[a]) {
            for (let b = this.head[ny * size + nx]; b !== -1; b = this.next[b]) fn(a, b);
          }
        }
      }
    }
  }
}
