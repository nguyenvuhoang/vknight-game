"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSceneWalker } from "@/lib/scene/use-scene-walker";
import Image from "next/image";
import { check, interact, runEffects, type Outcome, type PuzzleState } from "@/lib/adventure/engine";
import type { AdventureStageConfig, Choice, Hotspot, Line, Verb } from "@/lib/adventure/types";
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

// Full-screen adventure scene. The world (a crop of the Chapter 1 painting)
// covers the viewport and a camera follows the hero; UI floats on top.
export default function AdventureStage({ config, hero, level, total, onWin, onNext, onMap }: Props) {
  const heroInfo = getHero(hero);
  const { crop } = config.scene;
  const aspect = crop.w / crop.h;
  const spots = useMemo(() => new Map(config.hotspots.map((h) => [h.id, h])), [config]);

  const [puzzle, setPuzzle] = useState<PuzzleState>({ flags: [], inv: [] });
  const [selected, setSelected] = useState<string | null>(null);
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

  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const walker = useSceneWalker({
    aspect,
    walk: config.walk,
    spawn: config.spawn,
    mode: () => (exiting ? "scripted" : dialog || showWin ? "paused" : "active"),
    targets: () => config.hotspots.map((h) => ({ id: h.id, at: h.stand })),
  });
  const { near, depthAt } = walker;
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
      walker.walkTo(spot.stand, () => perform({ spot: spot.id, verb, item }));
    },
    [perform, walker],
  );

  // ---------- dialogue ----------
  const closeDialog = () => {
    setDialog(null);
    if (wonText && !exiting) {
      setExiting(true);
      // walk out through the gate, then show the win banner
      walker.walkTo({ x: 44, y: 106 }, () => setShowWin(true), { clamp: false });
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
      if (!pausedRef.current && (e.key === "e" || e.key === "E")) {
        const spot = near ? spots.get(near) : undefined;
        if (spot) walkTo(spot, autoVerb(spot), selected);
      } else if (!pausedRef.current && (e.key === "f" || e.key === "F")) act("skill");
      else if (e.key === "h" || e.key === "H") showHint();
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const { onWorldClick, hold } = walker;

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
      <div ref={walker.sceneRef} className={`adv-scene ${selected ? "is-using" : ""}`}>
        <div
          ref={walker.worldRef}
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
            ref={walker.playerRef}
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
      <header ref={walker.hudRef} className="adv-top">
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

        <div ref={walker.dockRef} className="adv-dock" role="toolbar" aria-label="Hành động">
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
