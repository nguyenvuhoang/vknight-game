"use client";
// Backend-driven stage (WF_BO_GET_MAP_GAMEPLAY): NPCs/items at backend spawn
// positions, dialogue graph, inventory and objectives run by lib/gameplay.
// Scene movement/camera/grounding is the shared useSceneWalker. Progress is
// local only (no server-authoritative gameplay workflow yet). Items guarded by a
// backend map puzzle open the puzzle panel first: completion comes from the
// puzzle workflows, picking the item up stays local inventory.
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Bushes } from "@/components/adventure/Sprites";
import DialoguePanel from "./DialoguePanel";
import GameplaySprite, { GateArt, PaintedGateOpen, spriteAspect } from "./GameplaySprites";
import InteractionPrompt from "./InteractionPrompt";
import InventoryPanel from "./InventoryPanel";
import ObjectiveTracker from "./ObjectiveTracker";
import FantasyHudShell from "./hud/FantasyHudShell";
import PuzzlePanel from "./puzzles/PuzzlePanel";
import type { ActivityEvent, ActivityKind } from "./hud/types";
import { choose, reachNode, startNode, viewChoices } from "@/lib/gameplay/dialogue-engine";
import { emptyGameplayState, type DialogueNode, type GameplayExit, type GameplayItem, type GameplayNpc, type GameplayState, type MapGameplay } from "@/lib/gameplay/gameplay-types";
import { exitLockReason, exitStatus, interactWithNpc, interactWithTarget, enterExit, targetLockReason } from "@/lib/gameplay/interaction-engine";
import { isItemVisible, pickUp } from "@/lib/gameplay/inventory-engine";
import { isStageComplete, objectiveProgress, objectiveStatus, settleObjectives } from "@/lib/gameplay/objective-engine";
import type { MapPuzzle } from "@/lib/gameplay/puzzle-types";
import { anchoredPlacement, applySceneFixes, backdropSrc, type RepairPhase, type SpriteArt, type StageScene, type WorldObject } from "@/lib/gameplay/stage-scenes";
import { useMapPuzzles } from "@/lib/gameplay/use-map-puzzles";
import { useSceneWalker } from "@/lib/scene/use-scene-walker";
import { getHero } from "@/lib/heroes";
import type { HeroId } from "@/lib/types";

type Props = {
  gameplay: MapGameplay;
  warnings: string[];
  scene: StageScene;
  hero: HeroId;
  level: number;
  total: number;
  title: string;
  completionText: string | null;
  /** Official map guide / hint (Chapter Map), shown by the fantasy HUD helper. */
  guideText?: string | null;
  hintText?: string | null;
  onWin: (text: string) => void;
  onNext: () => void;
  onMap: () => void;
};

type Talk = { node: DialogueNode; npc: GameplayNpc };
type Entity =
  | { kind: "npc"; id: string; npc: GameplayNpc }
  | { kind: "item"; id: string; item: GameplayItem }
  | { kind: "exit"; id: string; exit: GameplayExit }
  | { kind: "repair"; id: string; object: Repairable };
type Repairable = WorldObject & { repair: NonNullable<WorldObject["repair"]> };

const DEFAULT_FAIL_TEXT = "Não bạn vừa tự khởi động lại! Mọi ký ức về ải này đã bay mất…";

/**
 * One stage run. "Chơi lại từ đầu" after a failed run mounts a new one: every
 * run-local state (NPC talks, objectives, inventory, bridge repair, hero
 * position) starts over, while chapter progress and backend puzzle progress stay.
 */
export default function GameplayStage(props: Props) {
  const [run, setRun] = useState(0);
  return <GameplayRun key={run} {...props} onRestart={() => setRun((n) => n + 1)} />;
}

function GameplayRun({ gameplay: rawGameplay, warnings, scene, hero, level, total, title, completionText, guideText = null, hintText = null, onWin, onNext, onMap, onRestart }: Props & { onRestart: () => void }) {
  // One coordinate system for drawing, minimap and interaction: backend spawns
  // with the scene's (self-retiring) spawn fixes applied.
  const g = useMemo(() => applySceneFixes(rawGameplay, scene), [rawGameplay, scene]);
  const heroInfo = getHero(hero);
  const fantasy = scene.hud === "fantasy";
  const aspect = scene.crop.w / scene.crop.h;
  const [state, setState] = useState<GameplayState>(emptyGameplayState);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [won, setWon] = useState(false);
  const [questOpen, setQuestOpen] = useState(true);
  const [exiting, setExiting] = useState(false);
  /** World object whose repair is playing out (shown PARTIAL, input frozen). */
  const [repairing, setRepairing] = useState<string | null>(null);
  const repairTimers = useRef<number[]>([]);
  useEffect(() => () => repairTimers.current.forEach(clearTimeout), []);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  // Backend map puzzles (fantasy-HUD stages, where the puzzle panel lives).
  const puzzles = useMapPuzzles(g.mapCode, hero, fantasy);
  const [solving, setSolving] = useState<{ puzzle: MapPuzzle; item: GameplayItem } | null>(null);
  const puzzleFallbackLogged = useRef(false);
  // "Mất Trí Nhớ Tạm Thời": the server failed this run (too many wrong answers on one puzzle).
  const runFailed = puzzles.run?.failed === true;
  const [failOpen, setFailOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const flash = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };

  /** Append to the activity log (what really happened, with local time). */
  const log = (kind: ActivityKind, text: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setEvents((list) => [...list.slice(-49), { id: now.getTime() + Math.random(), time, kind, text }]);
  };

  /** Commit a new state and announce newly completed / unlocked objectives. */
  const commit = (next: GameplayState) => {
    const prev = stateRef.current;
    for (const code of next.completed.filter((c) => !prev.completed.includes(c))) {
      const o = g.objectives.find((x) => x.code === code);
      if (o) {
        flash(`✔ Hoàn thành: ${o.title}`);
        log("quest", `Hoàn thành nhiệm vụ: ${o.title}`);
      }
    }
    for (const o of g.objectives) {
      if (objectiveStatus(o, prev) === "LOCKED" && objectiveStatus(o, next) === "ACTIVE") log("quest", `Nhận nhiệm vụ: ${o.title}`);
    }
    for (const e of g.exits) {
      if (exitStatus(e, prev) === "LOCKED" && exitStatus(e, next) === "OPEN") {
        flash("🚪 Cổng đã mở! Lại gần để đi qua.");
        log("gate", "Cổng đã mở khóa!");
      }
    }
    stateRef.current = next;
    setState(next);
  };

  // Repair phase: REPAIRED is the recorded backend INTERACT, so a new run starts BROKEN.
  const phaseOf = (o: WorldObject): RepairPhase =>
    !o.repair || (state.interacted ?? []).includes(o.repair.target) ? "REPAIRED" : repairing === o.id ? "PARTIAL" : "BROKEN";
  const objects = scene.worldObjects ?? [];
  const repairables = objects.filter((o): o is Repairable => !!o.repair);

  // Entities the hero can interact with right now.
  const entities: Entity[] = [
    ...g.npcs.filter((n) => n.visible && n.interactable).map((npc) => ({ kind: "npc" as const, id: `npc:${npc.code}`, npc })),
    ...g.items.filter((it) => isItemVisible(it, state)).map((item) => ({ kind: "item" as const, id: `item:${item.spawnCode}`, item })),
    ...g.exits.filter((e) => exitStatus(e, state) !== "USED").map((exit) => ({ kind: "exit" as const, id: `exit:${exit.spawnCode}`, exit })),
    ...repairables.filter((o) => phaseOf(o) !== "REPAIRED").map((object) => ({ kind: "repair" as const, id: `repair:${object.id}`, object })),
  ];
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const showWin = won && !talk && !exiting;
  const busyUi = !!talk || !!solving || !!repairing || runFailed;

  // World objects: bridge decks add ground (a repairable deck only once REPAIRED),
  // solid objects block it, traps slow the hero.
  const repairedKey = repairables.filter((o) => phaseOf(o) === "REPAIRED").map((o) => o.id).join(",");
  const ground = useMemo(() => {
    const list = scene.worldObjects ?? [];
    const repaired = new Set(repairedKey.split(","));
    return {
      walk: [...scene.walk, ...list.flatMap((o) => (!o.repair || repaired.has(o.id) ? o.walk ?? [] : []))],
      blocked: list.flatMap((o) => o.block ?? []),
      zones: list.flatMap((o) => (o.trap ? [{ id: o.id, rect: o.trap.rect, speed: o.trap.speed }] : [])),
    };
  }, [scene, repairedKey]);
  const trapSeen = useRef(new Map<string, number>());
  const onZone = (id: string | null) => {
    const trap = id ? objects.find((o) => o.id === id)?.trap : null;
    if (!id || !trap) return;
    // Skimming a pit's edge re-enters it; tell the player once per few seconds.
    const now = Date.now();
    if (now - (trapSeen.current.get(id) ?? 0) < 5000) return;
    trapSeen.current.set(id, now);
    flash(`🟤 ${trap.message}`);
    log("system", trap.message);
  };

  const walker = useSceneWalker({
    aspect,
    walk: ground.walk,
    spawn: scene.spawn,
    mode: () => (exiting || repairing ? "scripted" : talk || solving || showWin || runFailed ? "paused" : "active"),
    targets: () => entitiesRef.current.map((e) => ({ id: e.id, at: e.kind === "npc" ? e.npc : e.kind === "item" ? e.item : e.kind === "repair" ? e.object.repair.at : e.exit })),
    nearRadius: scene.interactRadius,
    blocked: ground.blocked,
    pathfind: scene.pathfind,
    zones: ground.zones,
    onZone,
    rightPad: scene.ambient ? scene.cameraRightPad : 0,
  });

  const entered = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setQuestOpen(false);
    // Dev StrictMode re-runs mount effects; announce the arrival only once.
    if (entered.current) return;
    entered.current = true;
    const first = g.objectives.find((o) => objectiveStatus(o, emptyGameplayState()) === "ACTIVE");
    if (first) flash(`🎯 ${first.title}`);
    log("system", `Bạn đã vào khu vực: ${title}.`);
    if (first) log("quest", `Nhận nhiệm vụ: ${first.title}`);
    // once per stage run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A failed run: let the third wrong answer show for a moment, then the failure screen.
  useEffect(() => {
    if (!runFailed) return;
    log("system", "Mất trí nhớ tạm thời! Phải chơi lại ải từ đầu.");
    const t = setTimeout(() => {
      setSolving(null);
      setFailOpen(true);
    }, solving ? 1600 : 0);
    return () => clearTimeout(t);
    // once when the run fails
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFailed]);

  const restartStage = async () => {
    setRestarting(true);
    setRestartError(null);
    const r = await puzzles.restartRun();
    if (r.ok) return onRestart();
    setRestarting(false);
    setRestartError(r.error);
  };

  // Stage clear: only when every required objective is complete (checked by the engine).
  useEffect(() => {
    if (won || !isStageComplete(g.objectives, state)) return;
    setWon(true);
    log("system", `Qua Ải ${level}!`);
    onWinRef.current(completionText ?? "Hoàn thành tất cả nhiệm vụ của ải!");
  }, [state, won, g.objectives, completionText]);

  const tooFar = (at: { x: number; y: number }) => walker.distanceTo(at) > scene.interactRadius;

  const startTalk = (npc: GameplayNpc) => {
    if (tooFar(npc)) return flash(`Lại gần ${npc.name} hơn chút nữa.`);
    // Talking is also an INTERACT event (npc code / spawn code).
    const s = interactWithNpc(g, stateRef.current, npc.code);
    const node = startNode(g, s, npc.code);
    if (!node) {
      commit(s);
      return flash(`${npc.name} đang bận, chưa muốn nói chuyện.`);
    }
    const r = reachNode(g, s, node.code);
    commit(r.state);
    if (r.error) flash(r.error);
    if (r.node) {
      log("npc", `Đã nói chuyện với ${npc.name}.`);
      setTalk({ node: r.node, npc });
    }
  };

  const pick = (item: GameplayItem) => {
    if (tooFar(item)) return flash(`Không với tới ${item.name}.`);
    const r = pickUp(item, stateRef.current);
    if (!r.ok) return flash(r.error);
    flash(`Nhặt được: ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`);
    const settled = settleObjectives(g.objectives, r.state).state;
    // "(n/total)" from the objective that counts this item, if any.
    const counter = g.objectives.find((o) => JSON.stringify(o.completionCondition ?? null).includes(`"${item.code}"`));
    const p = counter ? objectiveProgress(counter, settled) : null;
    log("item", `Đã nhặt: ${item.name}${p && p.total > 1 ? ` (${p.done}/${p.total})` : ""}`);
    commit(settled);
  };

  /** The backend puzzle guarding an item: explicit link, else the spawn-code convention. */
  const puzzleFor = (item: GameplayItem) => puzzles.puzzles?.find((p) => p.spawnCode === item.spawnCode || p.itemCode === item.code) ?? null;
  const puzzlePending = (item: GameplayItem) => {
    const p = puzzleFor(item);
    return p != null && !puzzles.isSolved(p.code);
  };

  /** Items with an unsolved puzzle open it; solved (server progress) or plain items are picked up. */
  const openItem = (item: GameplayItem) => {
    if (tooFar(item)) return flash(`Không với tới ${item.name}.`);
    if (fantasy && puzzles.status === "loading") return flash("Đang tải câu đố từ máy chủ…");
    if (runFailed) return setFailOpen(true);
    const p = puzzleFor(item);
    if (!p && scene.puzzlesFailClosed && fantasy && (puzzles.puzzles === null || puzzles.error)) {
      // Fail closed: a clue may be puzzle-protected, and the definitions are not here.
      if (!puzzleFallbackLogged.current) {
        puzzleFallbackLogged.current = true;
        console.warn(`[puzzles] ${g.mapCode}: ${puzzles.error ?? "no definitions"} — clues stay locked.`);
        log("system", "Câu đố chưa tải được từ máy chủ — manh mối tạm khóa.");
      }
      return flash(`🔒 ${puzzles.error ?? "Câu đố chưa tải được."} Thử tải lại sau nhé!`);
    }
    if (!p) {
      if (fantasy && puzzles.error && !puzzleFallbackLogged.current) {
        // Definitions unavailable: keep the stage playable, and say so.
        puzzleFallbackLogged.current = true;
        console.warn(`[puzzles] ${g.mapCode}: ${puzzles.error} Items are collected without puzzles.`);
        log("system", "Câu đố chưa tải được từ máy chủ — nhặt manh mối trực tiếp.");
      }
      return pick(item);
    }
    if (puzzles.isSolved(p.code)) return pick(item);
    log("quest", `Mở câu đố: ${p.title}`);
    setSolving({ puzzle: p, item });
  };

  const submitPuzzle = async (answer: string) => {
    if (!solving) return { ok: false as const, error: "Không có câu đố nào đang mở." };
    const { puzzle } = solving;
    const out = await puzzles.submit(puzzle.code, answer);
    if (out.ok) {
      const r = out.result;
      if (r.correct || r.alreadyCompleted) {
        flash(`🧩 Giải được: ${puzzle.title}`);
        log("quest", `Giải được câu đố: ${puzzle.title}`);
      } else {
        log("quest", `Trả lời sai: ${r.message ?? puzzle.title}`);
      }
    }
    return out;
  };

  const passExit = (exit: GameplayExit) => {
    if (tooFar(exit)) return flash("Lại gần cổng hơn chút nữa.");
    const r = enterExit(g, stateRef.current, exit.spawnCode);
    if (!r.ok) return flash(r.error);
    // Walk through the gate, then record the INTERACT (completes the objective).
    setExiting(true);
    walker.walkTo(
      { x: Math.min(100, exit.x + 7), y: exit.y },
      () => {
        commit(r.state);
        setExiting(false);
      },
      { clamp: false },
    );
  };

  /**
   * Repair a world object: the engine allows it only while the backend objective
   * waiting on its target is unlocked (all materials collected). Plays PARTIAL,
   * then records the INTERACT, which makes it REPAIRED (and its deck walkable).
   */
  const startRepair = (o: Repairable) => {
    if (tooFar(o.repair.at)) return flash(`Lại gần ${o.name ?? "chỗ cần sửa"} hơn chút nữa.`);
    const r = interactWithTarget(g, stateRef.current, o.repair.target);
    if (!r.ok) return flash(`🔒 ${r.error}`);
    setRepairing(o.id);
    log("quest", `${o.repair.action}: bắt đầu…`);
    flash("🔨 Lát ván mới…");
    const later = (ms: number, fn: () => void) => repairTimers.current.push(window.setTimeout(fn, ms));
    later(1300, () => flash("🪢 Căng dây, siết nút…"));
    later(2600, () => {
      commit(r.state);
      setRepairing(null);
      log("gate", `${o.name ?? "Công trình"} đã được sửa xong!`);
      const npc = o.repair.done.npc ? g.npcs.find((n) => n.code === o.repair.done.npc) : undefined;
      if (!npc) return flash(o.repair.done.text);
      setTalk({ npc, node: { code: `repair:${o.id}`, speaker: "NPC", text: o.repair.done.text, choices: [], next: null, trigger: null, actions: [], ending: true } });
    });
  };

  const interact = (id: string | null) => {
    if (!id || talk || solving || showWin || exiting || repairing) return;
    const e = entitiesRef.current.find((x) => x.id === id);
    if (!e) return;
    if (e.kind === "repair") {
      const why = targetLockReason(g, stateRef.current, e.object.repair.target);
      if (why) return flash(`🔒 ${e.object.name ?? "Chỗ này"} chưa sửa được. ${why}`);
      walker.walkTo(e.object.repair.at, () => startRepair(e.object));
    } else if (e.kind === "npc") {
      // Stand beside the NPC (ground-clamped), then talk.
      walker.walkTo({ x: e.npc.x - 6, y: e.npc.y }, () => startTalk(e.npc));
    } else if (e.kind === "item") {
      walker.walkTo({ x: e.item.x, y: e.item.y }, () => openItem(e.item));
    } else if (exitStatus(e.exit, stateRef.current) === "LOCKED") {
      flash(`🔒 Cổng còn khóa. ${exitLockReason(g, e.exit, stateRef.current) ?? ""}`.trim());
    } else {
      walker.walkTo({ x: e.exit.x - 5, y: e.exit.y }, () => passExit(e.exit));
    }
  };

  const goTo = (code: string | null, npc: GameplayNpc, from: GameplayState) => {
    if (!code) return setTalk(null);
    const r = reachNode(g, from, code);
    commit(r.state);
    if (r.error) flash(r.error);
    setTalk(r.node ? { node: r.node, npc } : null);
  };

  const onChoose = (choiceId: string) => {
    if (!talk) return;
    const r = choose(g, stateRef.current, talk.node.code, choiceId);
    if (!r.ok) return flash(r.error);
    const picked = talk.node.choices.find((c) => c.id === choiceId);
    if (picked) log("npc", `Bạn trả lời: “${picked.text}”`);
    commit(r.state);
    goTo(r.next, talk.npc, r.state);
  };

  const onContinue = () => {
    if (!talk) return;
    if (talk.node.next && !talk.node.ending) goTo(talk.node.next, talk.npc, stateRef.current);
    else setTalk(null);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if ((e.key === "e" || e.key === "E" || (fantasy && e.key === "1")) && !busyUi) interact(walker.near);
      else if (e.key === "Escape" && talk) setTalk(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const nearEntity = entities.find((e) => e.id === walker.near);
  // Quest checklist marks for clue items guarded by a puzzle (item code -> solved on the server?).
  const puzzleSteps = new Map(g.items.flatMap((it) => {
    const p = puzzleFor(it);
    return p ? [[it.code, puzzles.isSolved(p.code)] as const] : [];
  }));
  const promptLabel = !nearEntity
    ? null
    : nearEntity.kind === "repair"
      ? targetLockReason(g, state, nearEntity.object.repair.target)
        ? `${nearEntity.object.repair.action} (thiếu vật liệu)`
        : nearEntity.object.repair.action
    : nearEntity.kind === "npc"
      ? `Nói chuyện với ${nearEntity.npc.name}`
      : nearEntity.kind === "item"
        ? puzzlePending(nearEntity.item)
          ? `Giải đố: ${nearEntity.item.name}`
          : `Nhặt ${nearEntity.item.name}`
        : exitStatus(nearEntity.exit, state) === "OPEN"
          ? "Đi qua cổng"
          : "Cổng đang khóa";
  const promptIcon = nearEntity?.kind === "repair" ? "🔨" : nearEntity?.kind === "npc" ? "💬" : nearEntity?.kind === "exit" ? "🚪" : nearEntity?.kind === "item" && puzzlePending(nearEntity.item) ? "🧩" : "🖐";
  const activeObjective = g.objectives.find((o) => objectiveStatus(o, state) === "ACTIVE");
  const activeProgress = activeObjective ? objectiveProgress(activeObjective, state) : null;
  const npcState = (npc: GameplayNpc) =>
    g.objectives.some((o) => o.type === "GIVE_ITEM" && o.targetCode === npc.code && state.completed.includes(o.code)) ? "FED" : npc.state ?? "IDLE";
  const sizeAt = (base: number, scale: number, y: number) => `${base * scale * walker.depthAt(y)}%`;
  const artFor = (key: string | null) => (key ? scene.sprites?.[key] : undefined);
  /**
   * World convention: an entity's (x, y) is its anchor point in % of the world
   * (feet / base for ground sprites). The box is shifted so its pivot sits on
   * that point — this inline transform replaces the CSS default, never adds to it.
   */
  const placement = (art: SpriteArt | undefined, fallback: SpriteArt["anchor"]) => {
    const anchor = art?.anchor ?? fallback ?? "floating";
    const [px, py] = anchor === "wall" ? [50, 50] : anchor === "hanging" ? [(art?.hook?.x ?? 0.5) * 100, (art?.hook?.y ?? 0) * 100] : [50, 100];
    return { anchor, transform: `translate(-${px}%, -${py}%)`, shadow: anchor === "ground" || anchor === "floating" };
  };
  const markers = scene.hudArt?.markers;
  // "!" over an NPC that an active objective is waiting on (talk / answer).
  const questFor = (code: string) => g.objectives.some((o) => o.targetCode === code && objectiveStatus(o, state) === "ACTIVE");
  const missingAssets = warnings.filter((w) => w.includes("does not exist"));
  const [debugWalk, setDebugWalk] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") setDebugWalk(new URLSearchParams(window.location.search).get("debug") === "walk");
  }, []);

  const failModal = (
    <div className="pz-overlay gp-amnesia" role="presentation">
      <div className="pz-panel fh-frame" role="alertdialog" aria-modal="true" aria-labelledby="gp-amnesia-title" aria-describedby="gp-amnesia-text">
        <header className="pz-head">
          <div>
            <small className="pz-kind">Ải {level} — {title}</small>
            <h2 id="gp-amnesia-title">🧠 MẤT TRÍ NHỚ TẠM THỜI!</h2>
          </div>
        </header>
        <div className="pz-body fh-parch">
          <p id="gp-amnesia-text" className="pz-question">
            {scene.failText ?? DEFAULT_FAIL_TEXT}
          </p>
          <p className="pz-instruction">Bạn đã trả lời sai {puzzles.run?.maxWrong ?? 3} lần ở cùng một câu đố. Ải sẽ bắt đầu lại từ đầu — tiến trình chương và phần thưởng đã có vẫn được giữ nguyên.</p>
          {restartError && (
            <div className="pz-feedback is-error" role="alert">
              {restartError}
            </div>
          )}
        </div>
        <footer className="pz-foot">
          <button type="button" className="pz-btn is-gold" onClick={restartStage} disabled={restarting} aria-busy={restarting} autoFocus>
            {restarting ? "Đang khởi động lại…" : "Chơi lại từ đầu"}
          </button>
        </footer>
      </div>
    </div>
  );

  return (
    <div className={`adv gp ${fantasy ? "gp-fantasy" : ""}`}>
      <div ref={walker.sceneRef} className="adv-scene">
        {scene.ambient && (
          <div
            className="gp-ambient"
            aria-hidden
            style={{
              backgroundImage: `url(${backdropSrc(scene)})`,
              // The crop band fills the height; the rest of the source is off-screen.
              backgroundSize: `auto ${(scene.height / scene.crop.h) * 100}%`,
              backgroundPosition: `center ${scene.height === scene.crop.h ? 50 : (scene.crop.y / (scene.height - scene.crop.h)) * 100}%`,
            }}
          />
        )}
        <div
          ref={walker.worldRef}
          className="adv-world"
          style={{
            aspectRatio: `${scene.crop.w} / ${scene.crop.h}`,
            width: scene.nativeScale
              ? `max(100cqw, min(${aspect} * (100cqh - var(--ui-space, 0px)), ${scene.crop.w * scene.nativeScale}px))`
              : `max(100cqw, ${aspect} * (100cqh - var(--ui-space, 0px)) * var(--portrait-zoom, 1))`,
            ...(scene.portraitZoom && { "--scene-portrait-zoom": scene.portraitZoom }),
          } as React.CSSProperties}
          onClick={walker.onWorldClick}
        >
          <Image
            className="adv-backdrop"
            src={backdropSrc(scene)}
            unoptimized={!!scene.srcVersion}
            alt={`Cảnh Ải ${level}: ${title}`}
            width={scene.width}
            height={scene.height}
            sizes="(max-width: 900px) 300vw, 150vw"
            preload
            draggable={false}
            style={{
              left: `${(-scene.crop.x / scene.crop.w) * 100}%`,
              top: `${(-scene.crop.y / scene.crop.h) * 100}%`,
              width: `${(scene.width / scene.crop.w) * 100}%`,
              ...(scene.ambient && { maskImage: bandMask(scene), WebkitMaskImage: bandMask(scene) }),
            }}
          />
          <div className="adv-light" aria-hidden />

          {/* Physical world objects (bridges, gates, traps, props), anchored by their base. */}
          {objects.filter((o) => o.src || o.repair).map((o) => (
            <WorldObjectSprite
              key={o.id}
              object={o}
              phase={phaseOf(o)}
              near={walker.near === `repair:${o.id}`}
              onActivate={o.repair && phaseOf(o) === "BROKEN" ? () => interact(`repair:${o.id}`) : undefined}
              world={{ w: scene.crop.w, h: scene.crop.h }}
              debug={debugWalk}
            />
          ))}
          {debugWalk && <WalkDebug walk={ground.walk} blocked={ground.blocked} objects={objects} />}

          {/* Backend NPCs and items, anchored by their feet at (position_x, position_y). */}
          {g.npcs.filter((n) => n.visible).map((npc) => {
            const painted = !npc.imageAvailable ? scene.paintedNpcs?.[npc.code] : undefined;
            if (painted) {
              // The figure is part of the backdrop: hotspot only, never a second copy.
              const b = painted.box;
              return (
                <button
                  key={npc.spawnCode}
                  type="button"
                  className={`adv-spot gp-painted-npc ${walker.near === `npc:${npc.code}` ? "is-near" : ""}`}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    interact(`npc:${npc.code}`);
                  }}
                  disabled={!npc.interactable}
                  aria-label={`Nói chuyện với ${npc.name}`}
                >
                  <span className="adv-spot-label" aria-hidden>
                    💬 {npc.name}
                  </span>
                </button>
              );
            }
            const art = artFor(npc.spriteKey);
            const talking = talk?.npc.code === npc.code;
            const at = placement(art, "ground");
            return (
            <button
              key={npc.spawnCode}
              type="button"
              className={`gp-entity gp-npc is-${at.anchor} ${art?.flip ? "is-flipped" : ""} ${walker.near === `npc:${npc.code}` ? "is-near" : ""}`}
              style={{
                left: `${npc.x}%`,
                top: `${npc.y}%`,
                height: sizeAt(art?.height ?? scene.npcHeight, npc.scale, npc.y),
                aspectRatio: spriteAspect({ ...npc, frame: art?.frame }),
                transform: at.transform,
                zIndex: Math.round(npc.y * 10),
              }}
              onClick={(e) => {
                e.stopPropagation();
                interact(`npc:${npc.code}`);
              }}
              disabled={!npc.interactable}
              aria-label={`Nói chuyện với ${npc.name}`}
            >
              {at.shadow && <span className="adv-shadow" aria-hidden />}
              <GameplaySprite
                name={npc.name}
                imageUrl={talking && art?.talkSrc ? art.talkSrc : npc.imageUrl}
                imageAvailable={npc.imageAvailable}
                spriteKey={npc.spriteKey}
                state={npcState(npc)}
                frame={art?.frame}
              />
              {markers && !talking && questFor(npc.code) && <img className="gp-world-marker" src={markers.quest} alt="" draggable={false} />}
              <span className="adv-spot-label" aria-hidden>
                💬 {npc.name}
              </span>
            </button>
            );
          })}
          {g.items.filter((it) => isItemVisible(it, state)).map((item) => {
            const paintedItem = scene.paintedItems?.[item.spawnCode];
            if (paintedItem) {
              // The object is part of the backdrop: hotspot only, never a second copy.
              const b = paintedItem.box;
              return (
                <button
                  key={item.spawnCode}
                  type="button"
                  className={`adv-spot gp-painted-item ${walker.near === `item:${item.spawnCode}` ? "is-near" : ""}`}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    interact(`item:${item.spawnCode}`);
                  }}
                  aria-label={`Nhặt ${item.name}`}
                >
                  {markers ? (
                    <img className="adv-spot-sparkle gp-sparkle-img" src={markers.item} alt="" draggable={false} />
                  ) : (
                    <span className="adv-spot-sparkle" aria-hidden>
                      ✦
                    </span>
                  )}
                  <span className="adv-spot-label" aria-hidden>
                    🖐 {item.name}
                  </span>
                </button>
              );
            }
            const art = artFor(item.spriteKey);
            const at = placement(art, "floating");
            const sprite = <GameplaySprite name={item.name} imageUrl={item.imageUrl} imageAvailable={item.imageAvailable} spriteKey={item.spriteKey} frame={art?.frame} />;
            return (
            <button
              key={item.spawnCode}
              type="button"
              className={`gp-entity gp-item is-${at.anchor} ${art?.lying ? "is-lying" : ""} ${walker.near === `item:${item.spawnCode}` ? "is-near" : ""}`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                height: sizeAt(art?.height ?? scene.itemHeight, item.scale, item.y),
                aspectRatio: spriteAspect({ ...item, frame: art?.frame }),
                transform: at.transform,
                zIndex: Math.round(item.y * 10),
              }}
              onClick={(e) => {
                e.stopPropagation();
                interact(`item:${item.spawnCode}`);
              }}
              aria-label={`Nhặt ${item.name}`}
            >
              {at.shadow && <span className="adv-shadow" aria-hidden />}
              {at.anchor === "floating" ? <span className="gp-item-bob">{sprite}</span> : sprite}
              {markers ? (
                <img className="adv-spot-sparkle gp-sparkle-img" src={markers.item} alt="" draggable={false} />
              ) : (
                <span className="adv-spot-sparkle" aria-hidden>
                  ✦
                </span>
              )}
              <span className="adv-spot-label" aria-hidden>
                🖐 {item.name}
              </span>
            </button>
            );
          })}

          {g.exits.map((exit) => {
            const st = exitStatus(exit, state);
            const painted = scene.paintedExits?.[exit.spawnCode];
            if (painted) {
              // The closed gate is the painting; the hotspot wraps it. Once open the
              // doorway is masked and open leaves drawn, never both gates at once.
              const b = painted.box;
              return (
                <button
                  key={exit.spawnCode}
                  type="button"
                  className={`adv-spot gp-painted-exit is-${st} ${walker.near === `exit:${exit.spawnCode}` ? "is-near" : ""}`}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    interact(`exit:${exit.spawnCode}`);
                  }}
                  aria-label={st === "LOCKED" ? "Cổng đang khóa" : "Đi qua cổng"}
                >
                  {st !== "LOCKED" && <PaintedGateOpen art={painted.open} />}
                  {st === "OPEN" && markers && <img className="gp-world-marker is-exit" src={markers.exit} alt="" draggable={false} />}
                  <span className="adv-spot-label" aria-hidden>
                    {st === "LOCKED" ? "🔒 Cổng đầu ngõ" : "🚪 Đi qua cổng"}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={exit.spawnCode}
                type="button"
                className={`gp-entity gp-exit is-${st} ${walker.near === `exit:${exit.spawnCode}` ? "is-near" : ""}`}
                style={{
                  left: `${exit.x}%`,
                  top: `${exit.y}%`,
                  height: scene.exitArt ? `${scene.exitArt.height}%` : sizeAt(scene.exitHeight ?? 20, 1, exit.y),
                  aspectRatio: scene.exitArt?.frame ? `${scene.exitArt.frame.crop.w} / ${scene.exitArt.frame.crop.h}` : "100 / 110",
                  ...(scene.exitArt && { transform: "translate(-50%, -100%)" }),
                  zIndex: Math.round(exit.y * 10),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  interact(`exit:${exit.spawnCode}`);
                }}
                aria-label={st === "LOCKED" ? "Cổng đang khóa" : "Đi qua cổng"}
              >
                {scene.exitArt ? (
                  <GameplaySprite name="Lối ra" imageUrl={scene.exitArt.src} imageAvailable spriteKey={null} frame={scene.exitArt.frame} />
                ) : (
                  <>
                    <span className="adv-shadow" aria-hidden />
                    <GateArt open={st !== "LOCKED"} />
                  </>
                )}
                <span className="adv-spot-label" aria-hidden>
                  {st === "LOCKED" ? (scene.exitArt ? "🔒 Lối ra (chưa mở)" : "🔒 Cổng đầu ngõ") : `🚪 ${scene.exitArt?.label ?? "Đi qua cổng"}`}
                </span>
              </button>
            );
          })}

          <div
            ref={walker.playerRef}
            className={`adv-player ${exiting ? "is-exiting" : ""}`}
            style={{ "--foot": `${heroInfo.footPad ?? 0}%`, height: `${scene.heroHeight}%` } as React.CSSProperties}
          >
            <span className="adv-shadow" aria-hidden />
            <img src={heroInfo.asset} alt={heroInfo.name} draggable={false} />
          </div>
        </div>
        <div className="adv-fg" aria-hidden>
          <Bushes />
          <Bushes flip />
        </div>
        <div className="adv-vignette" aria-hidden />
      </div>

      {fantasy ? (
        <FantasyHudShell
          hero={heroInfo}
          gameplay={g}
          state={state}
          scene={scene}
          title={title}
          bannerTitle={`Ải ${level}/${total} — ${title}`}
          subtitle={won ? "Đã qua ải!" : activeObjective ? `${activeObjective.title}${activeProgress && activeProgress.total > 1 ? ` (${activeProgress.done}/${activeProgress.total})` : ""}` : "…"}
          posRef={walker.posRef}
          hudRef={walker.hudRef}
          dockRef={walker.dockRef}
          events={events}
          questOpen={questOpen}
          onToggleQuest={() => setQuestOpen((o) => !o)}
          interactLabel={busyUi || showWin || exiting ? null : promptLabel}
          onInteract={() => interact(walker.near)}
          prompt={<InteractionPrompt label={busyUi || showWin || exiting ? null : promptLabel} icon={promptIcon} onActivate={() => interact(walker.near)} />}
          dpad={
            <div className="adv-dpad" aria-label="Di chuyển">
              <button type="button" aria-label="Lên" {...walker.hold("ArrowUp")}>▲</button>
              <button type="button" aria-label="Trái" {...walker.hold("ArrowLeft")}>◀</button>
              <button type="button" aria-label="Xuống" {...walker.hold("ArrowDown")}>▼</button>
              <button type="button" aria-label="Phải" {...walker.hold("ArrowRight")}>▶</button>
            </div>
          }
          guideText={guideText}
          hintText={hintText}
          onMap={onMap}
          onNotice={flash}
          suspended={busyUi || showWin}
          puzzleSteps={puzzleSteps}
          overlay={
            failOpen ? failModal : solving && (
              <PuzzlePanel
                key={solving.puzzle.code}
                puzzle={solving.puzzle}
                itemName={solving.item.name}
                itemImage={solving.item.imageAvailable ? solving.item.imageUrl : null}
                solved={puzzles.isSolved(solving.puzzle.code)}
                attempts={puzzles.progress?.puzzles[solving.puzzle.code]?.attempts ?? 0}
                runLimit={puzzles.run ? { wrong: puzzles.run.wrong[solving.puzzle.code] ?? 0, max: puzzles.run.maxWrong } : null}
                onSubmit={submitPuzzle}
                onCollect={() => {
                  const item = solving.item;
                  setSolving(null);
                  pick(item);
                }}
                onClose={() => setSolving(null)}
              />
            )
          }
        />
      ) : (
      <>
      <header ref={walker.hudRef} className="adv-top">
        <button type="button" className="map-btn" onClick={onMap}>
          ← <span className="map-btn-label">Bản đồ</span>
        </button>
        <div className="adv-top-title">
          <strong>
            Ải {level}/{total} — {title}
          </strong>
          <span className="adv-top-objective">
            🎯 {won ? "Đã qua ải!" : activeObjective?.title ?? "…"}
            {!won && activeProgress && activeProgress.total > 1 && ` (${activeProgress.done}/${activeProgress.total})`}
          </span>
        </div>
        <button type="button" className="map-btn" onClick={() => setQuestOpen((o) => !o)} aria-expanded={questOpen} aria-controls="gp-quest">
          📜 <span className="map-btn-label">Nhiệm vụ</span>
        </button>
        <span className="adv-hero-chip">
          <img src={heroInfo.asset} alt="" />
          <span className="adv-hero-name">{heroInfo.name}</span>
        </span>
      </header>

      {questOpen && (
        <aside id="gp-quest" className="adv-quest">
          <h3>🎯 Nhiệm vụ</h3>
          <ObjectiveTracker objectives={g.objectives} state={state} />
          {process.env.NODE_ENV !== "production" && missingAssets.length > 0 && (
            <p className="gp-dev-warning" title={missingAssets.join("\n")}>
              ⚠ Thiếu {missingAssets.length} ảnh gameplay — đang dùng hình dự phòng.
            </p>
          )}
        </aside>
      )}
      </>
      )}

      <div className="gp-toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className="adv-toast gp-toast">
            {t.text}
          </p>
        ))}
      </div>

      <div className="adv-bottom">
        {talk && (
          <DialoguePanel
            speaker={talk.node.speaker === "HERO" ? heroInfo.name : talk.node.speaker === "NARRATOR" ? "Kể chuyện" : talk.npc.name}
            portrait={
              talk.node.speaker === "HERO" ? (
                <img src={heroInfo.asset} alt="" />
              ) : (
                <GameplaySprite
                  name={talk.npc.name}
                  imageUrl={artFor(talk.npc.spriteKey)?.talkSrc ?? talk.npc.imageUrl}
                  imageAvailable={talk.npc.imageAvailable}
                  spriteKey={talk.npc.spriteKey}
                  state={npcState(talk.npc)}
                  frame={artFor(talk.npc.spriteKey)?.frame}
                />
              )
            }
            text={talk.node.text}
            choices={viewChoices(g, state, talk.node)}
            hasNext={!!talk.node.next && !talk.node.ending}
            onChoose={onChoose}
            onContinue={onContinue}
          />
        )}

        {showWin && (
          <div className="adv-win" role="status" aria-labelledby="gp-win-title">
            <p className="adv-win-stars" aria-hidden>
              ⭐⭐⭐
            </p>
            <h2 id="gp-win-title">Qua Ải {level}!</h2>
            <p>{completionText ?? "Hoàn thành tất cả nhiệm vụ của ải!"}</p>
            <div className="adv-win-actions">
              <button type="button" className="primary" onClick={onNext} autoFocus>
                {level < total ? "▶ Ải tiếp theo" : "🏁 Hoàn tất Chapter 1"}
              </button>
              <button type="button" className="secondary" onClick={onMap}>
                🗺 Về bản đồ
              </button>
            </div>
          </div>
        )}

        {!fantasy && (
        <div ref={walker.dockRef} className="adv-dock gp-dock" role="toolbar" aria-label="Hành động">
          <InteractionPrompt
            label={talk || showWin || exiting ? null : promptLabel}
            icon={promptIcon}
            onActivate={() => interact(walker.near)}
          />
          <InventoryPanel items={g.items} state={state} />
          <div className="adv-dpad" aria-label="Di chuyển">
            <button type="button" aria-label="Lên" {...walker.hold("ArrowUp")}>▲</button>
            <button type="button" aria-label="Trái" {...walker.hold("ArrowLeft")}>◀</button>
            <button type="button" aria-label="Xuống" {...walker.hold("ArrowDown")}>▼</button>
            <button type="button" aria-label="Phải" {...walker.hold("ArrowRight")}>▶</button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/** Shows only the crop band of the backdrop image, its top and bottom edges fading into the ambient fill. */
function bandMask(scene: StageScene) {
  const top = (scene.crop.y / scene.height) * 100;
  const bottom = ((scene.crop.y + scene.crop.h) / scene.height) * 100;
  const fade = (scene.crop.h / scene.height) * 5;
  return `linear-gradient(to bottom, transparent ${top}%, #000 ${top + fade}%, #000 ${bottom - fade}%, transparent ${bottom}%)`;
}

/**
 * A physical world object's sprite: base-centre at (x, y), flat ones under the
 * actors. A repairable object shows its phase's sprite and, while broken, is a
 * button (click to repair); the sprite itself never decides where the hero walks.
 */
function WorldObjectSprite({ object: o, phase, near, onActivate, world, debug = false }: { object: WorldObject; phase: RepairPhase; near: boolean; onActivate?: () => void; world: { w: number; h: number }; debug?: boolean }) {
  const art = o.repair ? o.repair.phases[phase] : { src: o.src ?? null, frame: o.frame, height: o.height ?? 8 };
  const c = art.frame?.crop;
  // Two-point placement (bridge ends on the bank anchors) replaces the base-centred box.
  const anchored = o.repair?.anchors && "ends" in art && art.ends ? anchoredPlacement(art, o.repair.anchors, world) : null;
  const zIndex = o.flat ? 1 : Math.round(o.y * 10);
  const style: React.CSSProperties = anchored
    ? { left: anchored.left, top: anchored.top, width: anchored.width, height: anchored.height, transform: anchored.transform, transformOrigin: anchored.transformOrigin, zIndex }
    : { left: `${o.x}%`, top: `${o.y}%`, height: `${art.height ?? 8}%`, aspectRatio: c ? `${c.w} / ${c.h}` : undefined, zIndex };
  const className = `gp-object is-${o.kind} ${o.flat ? "is-flat" : ""} ${o.flip ? "is-flipped" : ""} ${o.repair ? `is-repair is-${phase}` : ""} ${near ? "is-near" : ""}`;
  const sprite = (
    <>
      <GameplaySprite key={phase} name={o.name ?? o.id} imageUrl={art.src ?? null} imageAvailable spriteKey={null} frame={art.frame} />
      {debug &&
        anchored?.ends.map((e, i) => (
          <span key={i} className="gp-debug-end" data-end={i === 0 ? "left" : "right"} style={{ left: `${e.x}%`, top: `${e.y}%` }} />
        ))}
    </>
  );
  if (!onActivate) {
    return (
      <span className={className} style={style} title={o.name} aria-hidden>
        {sprite}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${className} is-clickable`}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      aria-label={`${o.repair?.action ?? "Dùng"}: ${o.name ?? o.id}`}
    >
      {sprite}
      <span className="adv-spot-label" aria-hidden>
        🔨 {o.name}
      </span>
    </button>
  );
}

/** Dev only (?debug=walk): walkable ground, solid footprints and trap zones. */
function WalkDebug({ walk, blocked, objects }: { walk: { x0: number; x1: number; y0: number; y1: number }[]; blocked: typeof walk; objects: WorldObject[] }) {
  const box = (r: (typeof walk)[number], color: string, key: string) => (
    <span
      key={key}
      style={{ position: "absolute", left: `${r.x0}%`, top: `${r.y0}%`, width: `${r.x1 - r.x0}%`, height: `${r.y1 - r.y0}%`, background: color, outline: "1px solid rgba(0,0,0,.4)", zIndex: 9000, pointerEvents: "none" }}
    />
  );
  return (
    <>
      {walk.map((r, i) => box(r, "rgba(0,200,255,.28)", `w${i}`))}
      {blocked.map((r, i) => box(r, "rgba(255,0,0,.35)", `b${i}`))}
      {objects.flatMap((o) => (o.trap ? [box(o.trap.rect, "rgba(140,70,0,.45)", `t${o.id}`)] : []))}
      {objects.flatMap((o) =>
        (o.repair?.anchors ?? []).map((a, i) => (
          <span key={`a${o.id}${i}`} className="gp-debug-anchor" data-anchor={i === 0 ? "left" : "right"} style={{ left: `${a.x}%`, top: `${a.y}%` }} />
        )),
      )}
    </>
  );
}
