// Walkable-ground grid for scenes whose ground is split by water, bridges and
// solid objects: point tests, nearest walkable point and A* paths, all in %
// of the world (x of width, y of height). Distances are visual: y is divided
// by the world aspect so a step up costs the same as a step sideways on screen.
import type { Point, WalkRect } from "./use-scene-walker";

const STEP = 0.5; // grid cell, % of the world

/** Binary min-heap of (priority, value). */
class MinHeap {
  private p: number[] = [];
  private v: number[] = [];
  get size() {
    return this.v.length;
  }
  push(pri: number, val: number) {
    let i = this.v.length;
    this.p.push(pri);
    this.v.push(val);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.p[up] <= this.p[i]) break;
      [this.p[up], this.p[i]] = [this.p[i], this.p[up]];
      [this.v[up], this.v[i]] = [this.v[i], this.v[up]];
      i = up;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lp = this.p.pop()!, lv = this.v.pop()!;
    if (this.v.length) {
      this.p[0] = lp;
      this.v[0] = lv;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.v.length && this.p[l] < this.p[m]) m = l;
        if (r < this.v.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        [this.p[m], this.p[i]] = [this.p[i], this.p[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
}

const inRect = (r: WalkRect, p: Point) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

export type WalkGrid = {
  walkable: (p: Point) => boolean;
  nearest: (p: Point) => Point | null;
  /** Waypoints from `from` to (as close as reachable to) `to`, excluding `from`. */
  path: (from: Point, to: Point) => Point[];
};

export function buildWalkGrid(walk: WalkRect[], blocked: WalkRect[], aspect: number): WalkGrid {
  const walkable = (p: Point) => walk.some((r) => inRect(r, p)) && !blocked.some((r) => inRect(r, p));
  const cols = Math.round(100 / STEP) + 1, rows = cols;
  const ok = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ok[j * cols + i] = walkable({ x: i * STEP, y: j * STEP }) ? 1 : 0;
  const cellOf = (p: Point) => [Math.round(p.x / STEP), Math.round(p.y / STEP)] as const;
  const at = (i: number, j: number) => ({ x: i * STEP, y: j * STEP });
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < cols && j < rows && ok[j * cols + i] === 1;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) / aspect);

  const nearest = (p: Point): Point | null => {
    if (walkable(p)) return p;
    let best: Point | null = null, bd = Infinity;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (!ok[j * cols + i]) continue;
        const q = at(i, j), d = dist(p, q);
        if (d < bd) [best, bd] = [q, d];
      }
    return best;
  };

  /** Straight segment stays on walkable ground (sampled finely). */
  const clear = (a: Point, b: Point) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (STEP / 2));
    for (let k = 1; k < n; k++) if (!walkable({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })) return false;
    return true;
  };

  const path = (from: Point, to: Point): Point[] => {
    const goal = nearest(to);
    if (!goal) return [];
    if (walkable(from) && clear(from, goal)) return [goal];
    const startP = walkable(from) ? from : nearest(from);
    if (!startP) return [];
    const [si, sj] = cellOf(startP), [gi, gj] = cellOf(goal);
    const key = (i: number, j: number) => j * cols + i;
    const g = new Map<number, number>([[key(si, sj), 0]]);
    const came = new Map<number, number>();
    const h = (i: number, j: number) => Math.hypot(i - gi, (j - gj) / aspect);
    const open = new MinHeap();
    open.push(h(si, sj), key(si, sj));
    const closed = new Set<number>();
    let bestK = key(si, sj), bestH = h(si, sj);
    while (open.size) {
      const k = open.pop();
      if (closed.has(k)) continue;
      closed.add(k);
      const i = k % cols, j = (k - i) / cols;
      const hk = h(i, j);
      if (hk < bestH) [bestK, bestH] = [k, hk];
      if (i === gi && j === gj) break;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if ((!di && !dj) || !free(i + di, j + dj)) continue;
          // No corner cutting through blocked cells.
          if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
          const nk = key(i + di, j + dj);
          const ng = (g.get(k) ?? 0) + Math.hypot(di, dj / aspect);
          if (ng < (g.get(nk) ?? Infinity)) {
            g.set(nk, ng);
            came.set(nk, k);
            open.push(ng + h(i + di, j + dj), nk);
          }
        }
    }
    // Walk back from the goal (or the closest reachable cell), then pull the string.
    const cells: Point[] = [];
    for (let k: number | undefined = bestK; k !== undefined; k = came.get(k)) cells.unshift(at(k % cols, Math.floor(k / cols)));
    if (bestK === key(gi, gj)) cells[cells.length - 1] = goal;
    const out: Point[] = [];
    let anchor = startP;
    for (let n = 1; n < cells.length; n++) {
      if (!clear(anchor, cells[n])) {
        out.push(cells[n - 1]);
        anchor = cells[n - 1];
      }
    }
    if (cells.length > 1 || startP !== from) out.push(cells[cells.length - 1]);
    return out;
  };

  return { walkable, nearest, path };
}
