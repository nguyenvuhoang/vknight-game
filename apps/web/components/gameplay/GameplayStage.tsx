"use client";
// Backend-driven stage (WF_BO_GET_MAP_GAMEPLAY): NPCs/items at backend spawn
// positions, dialogue graph, inventory and objectives run by lib/gameplay.
// Scene movement/camera/grounding is the shared useSceneWalker. Progress is
// local only (no server-authoritative gameplay workflow yet).
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Bushes } from "@/components/adventure/Sprites";
import DialoguePanel from "./DialoguePanel";
import GameplaySprite, { GateArt, PaintedGateOpen, spriteAspect } from "./GameplaySprites";
import InteractionPrompt from "./InteractionPrompt";
import InventoryPanel from "./InventoryPanel";
import ObjectiveTracker from "./ObjectiveTracker";
import FantasyHudShell from "./hud/FantasyHudShell";
import type { ActivityEvent, ActivityKind } from "./hud/types";
import { choose, reachNode, startNode, viewChoices } from "@/lib/gameplay/dialogue-engine";
import { emptyGameplayState, type DialogueNode, type GameplayExit, type GameplayItem, type GameplayNpc, type GameplayState, type MapGameplay } from "@/lib/gameplay/gameplay-types";
import { exitLockReason, exitStatus, interactWithNpc, enterExit } from "@/lib/gameplay/interaction-engine";
import { isItemVisible, pickUp } from "@/lib/gameplay/inventory-engine";
import { isStageComplete, objectiveProgress, objectiveStatus, settleObjectives } from "@/lib/gameplay/objective-engine";
import { applySceneFixes, type SpriteArt, type StageScene } from "@/lib/gameplay/stage-scenes";
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
  | { kind: "exit"; id: string; exit: GameplayExit };

export default function GameplayStage({ gameplay: rawGameplay, warnings, scene, hero, level, total, title, completionText, guideText = null, hintText = null, onWin, onNext, onMap }: Props) {
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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
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

  // Entities the hero can interact with right now.
  const entities: Entity[] = [
    ...g.npcs.filter((n) => n.visible && n.interactable).map((npc) => ({ kind: "npc" as const, id: `npc:${npc.code}`, npc })),
    ...g.items.filter((it) => isItemVisible(it, state)).map((item) => ({ kind: "item" as const, id: `item:${item.spawnCode}`, item })),
    ...g.exits.filter((e) => exitStatus(e, state) !== "USED").map((exit) => ({ kind: "exit" as const, id: `exit:${exit.spawnCode}`, exit })),
  ];
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const showWin = won && !talk && !exiting;

  const walker = useSceneWalker({
    aspect,
    walk: scene.walk,
    spawn: scene.spawn,
    mode: () => (exiting ? "scripted" : talk || showWin ? "paused" : "active"),
    targets: () => entitiesRef.current.map((e) => ({ id: e.id, at: e.kind === "npc" ? e.npc : e.kind === "item" ? e.item : e.exit })),
    nearRadius: scene.interactRadius,
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
    const node = startNode(g, s);
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

  const interact = (id: string | null) => {
    if (!id || talk || showWin || exiting) return;
    const e = entitiesRef.current.find((x) => x.id === id);
    if (!e) return;
    if (e.kind === "npc") {
      // Stand beside the NPC (ground-clamped), then talk.
      walker.walkTo({ x: e.npc.x - 6, y: e.npc.y }, () => startTalk(e.npc));
    } else if (e.kind === "item") {
      walker.walkTo({ x: e.item.x, y: e.item.y }, () => pick(e.item));
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
      if ((e.key === "e" || e.key === "E" || (fantasy && e.key === "1")) && !talk) interact(walker.near);
      else if (e.key === "Escape" && talk) setTalk(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const nearEntity = entities.find((e) => e.id === walker.near);
  const promptLabel = !nearEntity
    ? null
    : nearEntity.kind === "npc"
      ? `Nói chuyện với ${nearEntity.npc.name}`
      : nearEntity.kind === "item"
        ? `Nhặt ${nearEntity.item.name}`
        : exitStatus(nearEntity.exit, state) === "OPEN"
          ? "Đi qua cổng"
          : "Cổng đang khóa";
  const promptIcon = nearEntity?.kind === "npc" ? "💬" : nearEntity?.kind === "exit" ? "🚪" : "🖐";
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

  return (
    <div className={`adv gp ${fantasy ? "gp-fantasy" : ""}`}>
      <div ref={walker.sceneRef} className="adv-scene">
        <div
          ref={walker.worldRef}
          className="adv-world"
          style={{
            aspectRatio: `${scene.crop.w} / ${scene.crop.h}`,
            width: `max(100cqw, ${aspect} * (100cqh - var(--ui-space, 0px)))`,
          }}
          onClick={walker.onWorldClick}
        >
          <Image
            className="adv-backdrop"
            src={scene.src}
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
            }}
          />
          <div className="adv-light" aria-hidden />

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
                  height: sizeAt(scene.exitHeight ?? 20, 1, exit.y),
                  aspectRatio: "100 / 110",
                  zIndex: Math.round(exit.y * 10),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  interact(`exit:${exit.spawnCode}`);
                }}
                aria-label={st === "LOCKED" ? "Cổng đang khóa" : "Đi qua cổng"}
              >
                <span className="adv-shadow" aria-hidden />
                <GateArt open={st !== "LOCKED"} />
                <span className="adv-spot-label" aria-hidden>
                  {st === "LOCKED" ? "🔒 Cổng đầu ngõ" : "🚪 Đi qua cổng"}
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
          interactLabel={talk || showWin || exiting ? null : promptLabel}
          onInteract={() => interact(walker.near)}
          prompt={<InteractionPrompt label={talk || showWin || exiting ? null : promptLabel} icon={promptIcon} onActivate={() => interact(walker.near)} />}
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
          suspended={!!talk || showWin}
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
