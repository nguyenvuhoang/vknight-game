"use client";
// Shared walking / camera / grounding loop for full-screen stage scenes.
// Positions are % of the world (x of width, y of height); characters are
// anchored by their feet. Writes to the DOM each frame (no re-render per frame).
import { useCallback, useEffect, useRef, useState } from "react";

export type Point = { x: number; y: number };
export type WalkRect = { x0: number; x1: number; y0: number; y1: number };
/** active: keys + click-to-walk · paused: frozen (dialogue open) · scripted: only scripted walks, no input. */
export type WalkerMode = "active" | "paused" | "scripted";

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
};

type Options = {
  aspect: number;
  walk: WalkRect[];
  spawn: Point;
  /** Read every frame. */
  mode: () => WalkerMode;
  /** Things the hero can be "near" (read every frame). */
  targets: () => { id: string; at: Point }[];
  nearRadius?: number;
  /** % of scene width per second. */
  speed?: number;
};

export function useSceneWalker({ aspect, walk, spawn, mode, targets, nearRadius = 7, speed = 24 }: Options) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const pos = useRef<Point>({ ...spawn });
  const target = useRef<Point | null>(null);
  const arrive = useRef<(() => void) | null>(null);
  const keys = useRef(new Set<string>());
  const facing = useRef(1);
  const cam = useRef<{ x: number; y: number } | null>(null);
  const opts = useRef({ mode, targets });
  opts.current = { mode, targets };
  const [near, setNear] = useState<string | null>(null);

  const yMin = Math.min(...walk.map((r) => r.y0));
  const yMax = Math.max(...walk.map((r) => r.y1));
  // One depth scale for everyone standing on the ground: further up = further away.
  const depthAt = useCallback(
    (y: number) => 0.7 + (0.35 * (Math.min(Math.max(y, yMin), yMax) - yMin)) / (yMax - yMin || 1),
    [yMin, yMax],
  );

  const clampWalk = useCallback(
    (p: Point): Point => {
      let best = p, bestD = Infinity;
      for (const r of walk) {
        const q = { x: Math.min(r.x1, Math.max(r.x0, p.x)), y: Math.min(r.y1, Math.max(r.y0, p.y)) };
        const d = Math.hypot(q.x - p.x, (q.y - p.y) / aspect);
        if (d < bestD) [best, bestD] = [q, d];
      }
      return best;
    },
    [walk, aspect],
  );

  /** Visual distance (in % of width) from the hero to a point. */
  const distanceTo = useCallback(
    (p: Point) => Math.hypot(p.x - pos.current.x, (p.y - pos.current.y) / aspect),
    [aspect],
  );

  /** Walk to a point (clamped to the ground unless clamp=false), then call onArrive. */
  const walkTo = useCallback(
    (p: Point, onArrive?: () => void, { clamp = true }: { clamp?: boolean } = {}) => {
      const dest = clamp ? clampWalk(p) : { ...p };
      if (Math.hypot(dest.x - pos.current.x, (dest.y - pos.current.y) / aspect) < 2) {
        target.current = null;
        arrive.current = null;
        onArrive?.();
        return;
      }
      target.current = dest;
      arrive.current = onArrive ?? null;
    },
    [aspect, clampWalk],
  );

  const cancelWalk = useCallback(() => {
    target.current = null;
    arrive.current = null;
  }, []);

  /** Click on the world: walk there (no action on arrival). */
  const onWorldClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (opts.current.mode() !== "active") return;
      const r = e.currentTarget.getBoundingClientRect();
      walkTo({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    },
    [walkTo],
  );

  /** Pointer handlers for on-screen d-pad buttons. */
  const hold = useCallback(
    (key: string) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        keys.current.add(key);
      },
      onPointerUp: () => keys.current.delete(key),
      onPointerCancel: () => keys.current.delete(key),
      onLostPointerCapture: () => keys.current.delete(key),
    }),
    [],
  );

  // Movement keys (other shortcuts belong to the scene component).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (!KEY_DIRS[e.key]) return;
      if (e.key.startsWith("Arrow")) e.preventDefault();
      keys.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastNear: string | null = null;
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const m = opts.current.mode();
      const p = pos.current;
      let moving = false;
      if (m !== "paused") {
        let dx = 0, dy = 0;
        if (m === "active") {
          keys.current.forEach((k) => {
            const d = KEY_DIRS[k];
            if (d) [dx, dy] = [dx + d[0], dy + d[1]];
          });
        }
        if (dx || dy) {
          cancelWalk();
          const n = Math.hypot(dx, dy);
          const next = clampWalk({ x: p.x + (dx / n) * speed * dt, y: p.y + (dy / n) * speed * aspect * dt });
          moving = next.x !== p.x || next.y !== p.y;
          if (dx) facing.current = Math.sign(dx);
          pos.current = next;
        } else if (target.current) {
          const tg = target.current;
          const vx = tg.x - p.x, vy = (tg.y - p.y) / aspect;
          const dist = Math.hypot(vx, vy), step = speed * dt;
          if (Math.abs(vx) > 0.2) facing.current = Math.sign(vx);
          if (dist <= step) {
            pos.current = { ...tg };
            target.current = null;
            const cb = arrive.current;
            arrive.current = null;
            cb?.();
          } else {
            pos.current = { x: p.x + (vx / dist) * step, y: p.y + (vy / dist) * step * aspect };
            moving = true;
          }
        }
      }

      const q = pos.current;
      const el = playerRef.current;
      if (el) {
        el.style.left = `${q.x}%`;
        el.style.top = `${q.y}%`;
        el.style.zIndex = String(Math.round(q.y * 10));
        el.style.setProperty("--depth", depthAt(q.y).toFixed(3));
        el.style.setProperty("--face", String(facing.current));
        el.classList.toggle("is-walking", moving);
      }
      // Camera: keep the hero near the middle, never showing past the world edges.
      const sc = sceneRef.current, w = worldRef.current;
      if (sc && w) {
        const sw = sc.clientWidth, sh = sc.clientHeight, ww = w.offsetWidth, wh = w.offsetHeight;
        const tx = Math.min(0, Math.max(sw - ww, sw / 2 - (q.x / 100) * ww));
        let ty = Math.min(0, Math.max(sh - wh, sh * 0.55 - (Math.min(q.y, yMax) / 100) * wh));
        // Narrow screens size the world to the gap between HUD and dock: centre it there.
        if (wh < sh && hudRef.current && dockRef.current) {
          const box = sc.getBoundingClientRect();
          const top = hudRef.current.getBoundingClientRect().bottom - box.top;
          const bottom = box.bottom - dockRef.current.getBoundingClientRect().top;
          ty = Math.min(sh - wh, Math.max(0, top + (sh - top - bottom - wh) / 2));
        }
        const c = cam.current ?? { x: tx, y: ty };
        const k = 1 - Math.exp(-dt * 5);
        c.x += (tx - c.x) * k;
        c.y += (ty - c.y) * k;
        cam.current = c;
        w.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
        sc.style.setProperty("--cam-x", `${c.x.toFixed(1)}px`);
      }

      let nearest: string | null = null, nd = nearRadius;
      if (m !== "scripted") {
        for (const tg of opts.current.targets()) {
          const d = Math.hypot(tg.at.x - q.x, (tg.at.y - q.y) / aspect);
          if (d < nd) [nearest, nd] = [tg.id, d];
        }
      }
      if (nearest !== lastNear) {
        lastNear = nearest;
        setNear(nearest);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [aspect, cancelWalk, clampWalk, depthAt, nearRadius, speed, yMax]);

  return {
    sceneRef, worldRef, playerRef, hudRef, dockRef,
    near, depthAt, clampWalk, distanceTo, walkTo, cancelWalk, onWorldClick, hold,
  };
}
