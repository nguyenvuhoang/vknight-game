"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { check, interact, runEffects, type Outcome, type PuzzleState } from "@/lib/adventure/engine";
import type { AdventureStageConfig, Choice, Hotspot, Line, Point, Verb } from "@/lib/adventure/types";
import { getHero } from "@/lib/heroes";
import type { HeroId, Level } from "@/lib/types";
import { Bushes, Dog, Granny } from "./Sprites";

type Props = {
  config: AdventureStageConfig;
  hero: HeroId;
  level: Level;
  total: number;
  onWin: (text: string) => void;
  onNext: () => void;
  onMap: () => void;
};

type Dialog = { lines: Line[]; i: number; choice?: Choice };
type Pending = { spot: string; verb: Verb; item: string | null };

const SPEED = 24; // % of scene width per second
const NEAR = 7; // proximity radius, in % of scene width
const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
};

// Full-screen adventure scene. The world (a crop of the Chapter 1 painting)
// covers the viewport and a camera follows the hero; UI floats on top.
export default function AdventureStage({ config, hero, level, total, onWin, onNext, onMap }: Props) {
  const heroInfo = getHero(hero);
  const { crop } = config.scene;
  const aspect = crop.w / crop.h;
  const yMin = Math.min(...config.walk.map((r) => r.y0));
  const yMax = Math.max(...config.walk.map((r) => r.y1));
  // One depth scale for everyone standing on the ground: further up = further away.
  const depthAt = (y: number) => 0.7 + (0.35 * (Math.min(Math.max(y, yMin), yMax) - yMin)) / (yMax - yMin || 1);
  const spots = useMemo(() => new Map(config.hotspots.map((h) => [h.id, h])), [config]);

  const [puzzle, setPuzzle] = useState<PuzzleState>({ flags: [], inv: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>({ lines: config.intro, i: 0 });
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [hint, setHint] = useState<{ group: number; i: number } | null>(null);
  const [wonText, setWonText] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [questOpen, setQuestOpen] = useState(true);

  // Phones start with the quest card folded so the scene stays visible.
  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setQuestOpen(false);
  }, []);

  const sceneEl = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const playerEl = useRef<HTMLDivElement>(null);
  const hudEl = useRef<HTMLElement>(null);
  const dockEl = useRef<HTMLDivElement>(null);
  const pos = useRef<Point>({ ...config.spawn });
  const target = useRef<Point | null>(null);
  const pending = useRef<Pending | null>(null);
  const keys = useRef(new Set<string>());
  const facing = useRef(1);
  const cam = useRef<{ x: number; y: number } | null>(null);
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const pausedRef = useRef(true);
  pausedRef.current = !!dialog || showWin;
  const exitingRef = useRef(false);
  exitingRef.current = exiting;
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const fill = (text: string) =>
    text.replaceAll("{heroLine}", level.npc.lines[hero] ?? "").replaceAll("{hero}", heroInfo.name);

  const flash = (text: string) => setToast({ id: Date.now(), text });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- walking ----------
  const clampWalk = useCallback(
    (p: Point): Point => {
      let best = p, bestD = Infinity;
      for (const r of config.walk) {
        const q = { x: Math.min(r.x1, Math.max(r.x0, p.x)), y: Math.min(r.y1, Math.max(r.y0, p.y)) };
        const d = Math.hypot(q.x - p.x, (q.y - p.y) / aspect);
        if (d < bestD) [best, bestD] = [q, d];
      }
      return best;
    },
    [config.walk, aspect],
  );

  const apply = useCallback(
    (out: Outcome, spotId?: string) => {
      setPuzzle(out.state);
      setSelected((sel) => (sel && out.state.inv.includes(sel) ? sel : null));
      if (spotId) setSeen((s) => (s.includes(spotId) ? s : [...s, spotId]));
      if (out.gained.length) {
        flash(`Nhận được: ${out.gained.map((g) => `${config.items[g]?.icon} ${config.items[g]?.name}`).join(", ")}`);
      }
      if (out.won) {
        setWonText(out.won);
        onWinRef.current(out.won); // saves progress once, at the moment of clearing
      }
      if (out.lines.length || out.choice) setDialog({ lines: out.lines, i: 0, choice: out.choice });
      setHint(null);
    },
    [config.items],
  );

  const perform = useCallback(
    (p: Pending) => {
      const spot = spots.get(p.spot);
      if (!spot) return;
      apply(interact(config, spot, p.verb, p.item, puzzleRef.current, config.skill[hero]), spot.id);
    },
    [apply, config, hero, spots],
  );

  const walkTo = useCallback(
    (spot: Hotspot, verb: Verb, item: string | null) => {
      if (pausedRef.current || exitingRef.current) return;
      const p = pos.current;
      pending.current = { spot: spot.id, verb, item };
      if (Math.hypot(spot.stand.x - p.x, (spot.stand.y - p.y) / aspect) < 2) {
        target.current = null;
        pending.current = null;
        perform({ spot: spot.id, verb, item });
      } else {
        target.current = { ...spot.stand };
      }
    },
    [aspect, perform],
  );

  // Movement loop: writes positions straight to the DOM (no re-render per frame).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastNear: string | null = null;
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const p = pos.current;
      let moving = false;
      if (!pausedRef.current || exitingRef.current) {
        let dx = 0, dy = 0;
        if (!exitingRef.current) keys.current.forEach((k) => {
          const d = KEY_DIRS[k];
          if (d) [dx, dy] = [dx + d[0], dy + d[1]];
        });
        if (dx || dy) {
          target.current = null;
          pending.current = null;
          const n = Math.hypot(dx, dy);
          const next = clampWalk({ x: p.x + (dx / n) * SPEED * dt, y: p.y + (dy / n) * SPEED * aspect * dt });
          moving = next.x !== p.x || next.y !== p.y;
          if (dx) facing.current = Math.sign(dx);
          pos.current = next;
        } else if (target.current) {
          const tg = target.current;
          const vx = tg.x - p.x, vy = (tg.y - p.y) / aspect;
          const dist = Math.hypot(vx, vy), step = SPEED * dt;
          if (Math.abs(vx) > 0.2) facing.current = Math.sign(vx);
          if (dist <= step) {
            pos.current = { ...tg };
            target.current = null;
            if (exitingRef.current) setShowWin(true);
            else if (pending.current) {
              const pd = pending.current;
              pending.current = null;
              perform(pd);
            }
          } else {
            pos.current = { x: p.x + (vx / dist) * step, y: p.y + (vy / dist) * step * aspect };
            moving = true;
          }
        }
      }

      const q = pos.current;
      const el = playerEl.current;
      if (el) {
        el.style.left = `${q.x}%`;
        el.style.top = `${q.y}%`;
        el.style.zIndex = String(Math.round(q.y * 10));
        el.style.setProperty("--depth", depthAt(q.y).toFixed(3));
        el.style.setProperty("--face", String(facing.current));
        el.classList.toggle("is-walking", moving);
      }
      // Camera: keep the hero near the middle, never showing past the world edges.
      const sc = sceneEl.current, w = worldEl.current;
      if (sc && w) {
        const sw = sc.clientWidth, sh = sc.clientHeight, ww = w.offsetWidth, wh = w.offsetHeight;
        const tx = Math.min(0, Math.max(sw - ww, sw / 2 - (q.x / 100) * ww));
        let ty = Math.min(0, Math.max(sh - wh, sh * 0.55 - (Math.min(q.y, yMax) / 100) * wh));
        // Narrow screens size the world to the gap between HUD and dock: centre it there.
        if (wh < sh && hudEl.current && dockEl.current) {
          const box = sc.getBoundingClientRect();
          const top = hudEl.current.getBoundingClientRect().bottom - box.top;
          const bottom = box.bottom - dockEl.current.getBoundingClientRect().top;
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

      let nearest: string | null = null, nd = NEAR;
      if (!exitingRef.current) {
        for (const h of config.hotspots) {
          const d = Math.hypot(h.stand.x - q.x, (h.stand.y - q.y) / aspect);
          if (d < nd) [nearest, nd] = [h.id, d];
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
  }, [aspect, clampWalk, config.hotspots, perform, yMax, yMin]);

  // ---------- dialogue ----------
  const closeDialog = () => {
    setDialog(null);
    if (wonText && !exiting) {
      setExiting(true);
      target.current = { x: 44, y: 106 }; // walk out through the gate
    }
  };

  const advance = () => {
    if (!dialog) return;
    if (dialog.i < dialog.lines.length - 1) setDialog({ ...dialog, i: dialog.i + 1 });
    else if (!dialog.choice) closeDialog();
  };

  const choose = (idx: number) => {
    const opt = dialog?.choice?.options[idx];
    if (!opt) return;
    setDialog(null);
    apply(runEffects(opt.effects, puzzleRef.current));
  };

  // ---------- input ----------
  const act = (verb: Verb) => {
    const spot = near ? spots.get(near) : undefined;
    if (!spot) return flash("Hãy lại gần ai đó hoặc thứ gì đó trước đã.");
    if (verb === "use" && !selected) return flash("Chọn một món trong túi đồ trước đã.");
    walkTo(spot, verb, verb === "use" ? selected : null);
  };

  const autoVerb = (spot: Hotspot): Verb => (selected ? "use" : spot.kind === "npc" ? "talk" : "inspect");

  const hintGroup = config.hints.findIndex((h) => check(h.when, puzzle));
  const hintList = config.hints[hintGroup]?.hints ?? [];
  const showHint = () =>
    setHint((h) => ({ group: hintGroup, i: h && h.group === hintGroup ? (h.i + 1) % hintList.length : 0 }));
  const hintText = hint && hint.group === hintGroup ? hintList[hint.i] : null;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (KEY_DIRS[e.key]) {
        if (e.key.startsWith("Arrow")) e.preventDefault();
        keys.current.add(e.key);
      } else if (!pausedRef.current && (e.key === "e" || e.key === "E")) {
        const spot = near ? spots.get(near) : undefined;
        if (spot) walkTo(spot, autoVerb(spot), selected);
      } else if (!pausedRef.current && (e.key === "f" || e.key === "F")) act("skill");
      else if (e.key === "h" || e.key === "H") showHint();
      else if (e.key === "Escape") setSelected(null);
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
  });

  const onWorldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pausedRef.current || exitingRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    pending.current = null;
    target.current = clampWalk({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const hold = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      keys.current.add(key);
    },
    onPointerUp: () => keys.current.delete(key),
    onPointerCancel: () => keys.current.delete(key),
    onLostPointerCapture: () => keys.current.delete(key),
  });

  // ---------- derived UI ----------
  const objective = config.objectives.find((o) => check(o.when, puzzle));
  const objectiveText = objective
    ? objective.count
      ? `${objective.text} (${objective.count.flags.filter((f) => puzzle.flags.includes(f)).length}/${objective.count.flags.length})`
      : objective.text
    : "";
  const nearSpot = near ? spots.get(near) : undefined;
  const line = dialog ? dialog.lines[dialog.i] : undefined;
  const atChoice = !!dialog?.choice && (!line || dialog.i >= dialog.lines.length - 1);
  const speaker = line && line.who !== "hero" && line.who !== "narrator" ? spots.get(line.who) : undefined;
  const sel = selected ? config.items[selected] : undefined;

  const portrait = (who: string) => {
    if (who === "hero") return <img src={heroInfo.asset} alt="" />;
    const s = spots.get(who)?.sprite;
    if (s?.kind === "granny") return <Granny />;
    if (s?.kind === "dog") return <Dog awake={puzzle.flags.includes("dog_fed")} />;
    return <span aria-hidden>📜</span>;
  };

  const spriteHeight = (base: number, y: number) => `${base * depthAt(y)}%`;

  return (
    <div className="adv">
      {/* ---------- the world ---------- */}
      <div ref={sceneEl} className={`adv-scene ${selected ? "is-using" : ""}`}>
        <div
          ref={worldEl}
          className="adv-world"
          style={{
            aspectRatio: `${crop.w} / ${crop.h}`,
            // Cover the screen, minus the UI band on phones (--ui-space).
            width: `max(100cqw, ${aspect} * (100cqh - var(--ui-space, 0px)))`,
          }}
          onClick={onWorldClick}
        >
          <Image
            className="adv-backdrop"
            src={config.scene.src}
            alt={`Làng Ngáo — cảnh Ải ${config.level}`}
            width={config.scene.width}
            height={config.scene.height}
            sizes="(max-width: 900px) 400vw, 200vw"
            preload
            draggable={false}
            style={{
              left: `${(-crop.x / crop.w) * 100}%`,
              top: `${(-crop.y / crop.h) * 100}%`,
              width: `${(config.scene.width / crop.w) * 100}%`,
            }}
          />
          <div className="adv-light" aria-hidden />

          {config.hotspots.map((h) =>
            h.sprite ? (
              <div
                key={`sprite-${h.id}`}
                className={`adv-sprite sprite-${h.sprite.kind}`}
                style={{
                  left: `${h.sprite.feet.x}%`,
                  top: `${h.sprite.feet.y}%`,
                  height: spriteHeight(h.sprite.height, h.sprite.feet.y),
                  zIndex: Math.round(h.sprite.feet.y * 10),
                }}
              >
                <span className="adv-shadow" aria-hidden />
                {h.sprite.kind === "granny" ? <Granny /> : <Dog awake={puzzle.flags.includes("dog_fed")} />}
              </div>
            ) : null,
          )}

          <div
            ref={playerEl}
            className={`adv-player ${exiting ? "is-exiting" : ""}`}
            style={{ "--foot": `${heroInfo.footPad ?? 0}%` } as React.CSSProperties}
          >
            <span className="adv-shadow" aria-hidden />
            <img src={heroInfo.asset} alt={heroInfo.name} draggable={false} />
          </div>

          {config.hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`adv-spot is-${h.kind} ${near === h.id ? "is-near" : ""} ${h.box.x < 12 ? "label-start" : h.box.x + h.box.w > 88 ? "label-end" : ""}`}
              style={{ left: `${h.box.x}%`, top: `${h.box.y}%`, width: `${h.box.w}%`, height: `${h.box.h}%` }}
              aria-label={`${h.name}${selected ? ` — dùng ${config.items[selected]?.name}` : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                walkTo(h, autoVerb(h), selected);
              }}
            >
              <span className="adv-spot-label" aria-hidden>
                {h.kind === "npc" ? "💬" : h.kind === "exit" ? "🚪" : "🔍"} {h.name}
              </span>
              {!seen.includes(h.id) && <span className="adv-spot-sparkle" aria-hidden>✦</span>}
            </button>
          ))}
        </div>

        <div className="adv-fg" aria-hidden>
          <Bushes />
          <Bushes flip />
        </div>
        <div className="adv-vignette" aria-hidden />
      </div>

      {/* ---------- floating UI ---------- */}
      <header ref={hudEl} className="adv-top">
        <button type="button" className="map-btn" onClick={onMap}>
          ← <span className="map-btn-label">Bản đồ</span>
        </button>
        <div className="adv-top-title">
          <strong>
            Ải {config.level}/{total} — {level.title}
          </strong>
          <span className="adv-top-objective">🎯 {objectiveText}</span>
        </div>
        <button
          type="button"
          className="map-btn"
          onClick={() => setQuestOpen((o) => !o)}
          aria-expanded={questOpen}
          aria-controls="adv-quest"
        >
          📜 <span className="map-btn-label">Nhiệm vụ</span>
        </button>
        <span className="adv-hero-chip">
          <img src={heroInfo.asset} alt="" />
          <span className="adv-hero-name">{heroInfo.name}</span>
        </span>
      </header>

      {questOpen && (
        <aside id="adv-quest" className="adv-quest">
          <h3>🎯 Nhiệm vụ</h3>
          <p className="adv-objective">{objectiveText}</p>
          <ul className="adv-notes">
            {config.notes.map((n) => (
              <li key={n.label} className={check(n.done, puzzle) ? "is-done" : ""}>
                {n.label}
              </li>
            ))}
          </ul>
          <div className="adv-hint" aria-live="polite">
            <strong>💡 Gợi ý</strong>
            <p>{hintText ?? "Bí quá? Bấm \"Gợi ý\" (phím H)."}</p>
          </div>
        </aside>
      )}

      {toast && (
        <p key={toast.id} className="adv-toast" role="status">
          {toast.text}
        </p>
      )}

      <div className="adv-bottom">
        {line || atChoice ? (
          <div className={`adv-dialog ${line?.who === "narrator" ? "is-narrator" : ""}`} aria-live="polite">
            {line && (
              <>
                <span className="adv-dialog-portrait">{portrait(line.who)}</span>
                <div className="adv-dialog-body">
                  <strong>
                    {line.who === "hero" ? heroInfo.name : line.who === "narrator" ? "Kể chuyện" : speaker?.name}
                  </strong>
                  <p>{fill(line.text)}</p>
                </div>
              </>
            )}
            {atChoice ? (
              <div className="adv-choices">
                {dialog!.choice!.options.map((o, i) => (
                  <button key={o.label} type="button" className="secondary" onClick={() => choose(i)} autoFocus={i === 0}>
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="primary adv-next" onClick={advance} autoFocus>
                {dialog && dialog.i < dialog.lines.length - 1 ? "▶ Tiếp" : "✔ OK"}
              </button>
            )}
          </div>
        ) : null}

        {showWin && wonText && (
          <div className="adv-win" role="status" aria-labelledby="adv-win-title">
            <p className="adv-win-stars" aria-hidden>⭐⭐⭐</p>
            <h2 id="adv-win-title">Qua Ải {config.level}!</h2>
            <p>{wonText}</p>
            <div className="adv-win-actions">
              <button type="button" className="primary" onClick={onNext} autoFocus>
                {config.level < total ? "▶ Ải tiếp theo" : "🏁 Hoàn tất Chapter 1"}
              </button>
              <button type="button" className="secondary" onClick={onMap}>
                🗺 Về bản đồ
              </button>
            </div>
          </div>
        )}

        <div ref={dockEl} className="adv-dock" role="toolbar" aria-label="Hành động">
          <span className="adv-target">
            {nearSpot ? (
              <>
                Gần: <strong>{nearSpot.name}</strong>
              </>
            ) : (
              "Bấm vào mặt đất để di chuyển"
            )}
          </span>
          <div className="adv-acts">
            <button type="button" className="adv-act" onClick={() => act("talk")} disabled={!nearSpot}>
              💬 <span>Nói chuyện</span>
            </button>
            <button type="button" className="adv-act" onClick={() => act("inspect")} disabled={!nearSpot}>
              🔍 <span>Quan sát</span>
            </button>
            <button type="button" className="adv-act" onClick={() => act("use")} disabled={!nearSpot || !selected}>
              🎒 <span>Dùng đồ</span>
            </button>
            <button type="button" className="adv-act" onClick={() => act("skill")} disabled={!nearSpot}>
              ⚔ <span>{heroInfo.ability}</span>
            </button>
            <button type="button" className="adv-act adv-act-hint" onClick={showHint}>
              💡 <span>Gợi ý</span>
            </button>
          </div>
          <div className="adv-inventory" aria-label="Túi đồ">
            {Array.from({ length: Math.max(4, puzzle.inv.length) }, (_, i) => {
              const id = puzzle.inv[i];
              const it = id ? config.items[id] : undefined;
              return it ? (
                <button
                  key={id}
                  type="button"
                  className={`adv-slot ${selected === id ? "is-selected" : ""}`}
                  aria-pressed={selected === id}
                  aria-label={`${it.name}: ${it.description}`}
                  title={`${it.name} — ${it.description}`}
                  onClick={() => setSelected((s) => (s === id ? null : id))}
                >
                  <span className="adv-slot-icon" aria-hidden>
                    {it.icon}
                  </span>
                  <span className="adv-slot-name">{it.name}</span>
                </button>
              ) : (
                <span key={`empty-${i}`} className="adv-slot is-empty" aria-hidden />
              );
            })}
          </div>
          <div className="adv-dpad" aria-label="Di chuyển">
            <button type="button" aria-label="Lên" {...hold("ArrowUp")}>▲</button>
            <button type="button" aria-label="Trái" {...hold("ArrowLeft")}>◀</button>
            <button type="button" aria-label="Xuống" {...hold("ArrowDown")}>▼</button>
            <button type="button" aria-label="Phải" {...hold("ArrowRight")}>▶</button>
          </div>
          {sel && (
            <p className="adv-holding">
              Đang cầm <strong>{sel.icon} {sel.name}</strong> — bấm vào người/vật để dùng. (Esc để bỏ)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
