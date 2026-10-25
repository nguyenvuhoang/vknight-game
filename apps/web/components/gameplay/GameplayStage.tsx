"use client";
// Backend-driven stage (WF_BO_GET_MAP_GAMEPLAY): NPCs/items at backend spawn
// positions, dialogue graph, inventory and objectives run by lib/gameplay.
// Scene movement/camera/grounding is the shared useSceneWalker. Progress is
// local only (no server-authoritative gameplay workflow yet).
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bushes } from "@/components/adventure/Sprites";
import DialoguePanel from "./DialoguePanel";
import GameplaySprite, { spriteAspect } from "./GameplaySprites";
import InteractionPrompt from "./InteractionPrompt";
import InventoryPanel from "./InventoryPanel";
import ObjectiveTracker from "./ObjectiveTracker";
import { choose, reachNode, startNode, viewChoices } from "@/lib/gameplay/dialogue-engine";
import { emptyGameplayState, type DialogueNode, type GameplayItem, type GameplayNpc, type GameplayState, type MapGameplay } from "@/lib/gameplay/gameplay-types";
import { isItemVisible, pickUp } from "@/lib/gameplay/inventory-engine";
import { isStageComplete, objectiveStatus, settleObjectives } from "@/lib/gameplay/objective-engine";
import type { StageScene } from "@/lib/gameplay/stage-scenes";
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
  onWin: (text: string) => void;
  onNext: () => void;
  onMap: () => void;
};

type Talk = { node: DialogueNode; npc: GameplayNpc };
type Entity = { kind: "npc"; id: string; npc: GameplayNpc } | { kind: "item"; id: string; item: GameplayItem };

export default function GameplayStage({ gameplay: g, warnings, scene, hero, level, total, title, completionText, onWin, onNext, onMap }: Props) {
  const heroInfo = getHero(hero);
  const aspect = scene.crop.w / scene.crop.h;
  const [state, setState] = useState<GameplayState>(emptyGameplayState);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [won, setWon] = useState(false);
  const [questOpen, setQuestOpen] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const flash = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };

  /** Commit a new state and announce newly completed objectives. */
  const commit = (next: GameplayState) => {
    const before = stateRef.current.completed;
    for (const code of next.completed.filter((c) => !before.includes(c))) {
      const o = g.objectives.find((x) => x.code === code);
      if (o) flash(`✔ Hoàn thành: ${o.title}`);
    }
    stateRef.current = next;
    setState(next);
  };

  // Entities the hero can interact with right now.
  const entities: Entity[] = [
    ...g.npcs.filter((n) => n.visible && n.interactable).map((npc) => ({ kind: "npc" as const, id: `npc:${npc.code}`, npc })),
    ...g.items.filter((it) => isItemVisible(it, state)).map((item) => ({ kind: "item" as const, id: `item:${item.spawnCode}`, item })),
  ];
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const showWin = won && !talk;

  const walker = useSceneWalker({
    aspect,
    walk: scene.walk,
    spawn: scene.spawn,
    mode: () => (talk || showWin ? "paused" : "active"),
    targets: () => entitiesRef.current.map((e) => ({ id: e.id, at: e.kind === "npc" ? e.npc : e.item })),
    nearRadius: scene.interactRadius,
  });

  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setQuestOpen(false);
    const first = g.objectives.find((o) => objectiveStatus(o, emptyGameplayState()) === "ACTIVE");
    if (first) flash(`🎯 ${first.title}`);
    // once per stage run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage clear: only when every required objective is complete (checked by the engine).
  useEffect(() => {
    if (won || !isStageComplete(g.objectives, state)) return;
    setWon(true);
    onWinRef.current(completionText ?? "Hoàn thành tất cả nhiệm vụ của ải!");
  }, [state, won, g.objectives, completionText]);

  const tooFar = (at: { x: number; y: number }) => walker.distanceTo(at) > scene.interactRadius;

  const startTalk = (npc: GameplayNpc) => {
    if (tooFar(npc)) return flash(`Lại gần ${npc.name} hơn chút nữa.`);
    const s = stateRef.current;
    const node = startNode(g, s);
    if (!node) return flash(`${npc.name} đang bận, chưa muốn nói chuyện.`);
    const r = reachNode(g, s, node.code);
    commit(r.state);
    if (r.error) flash(r.error);
    if (r.node) setTalk({ node: r.node, npc });
  };

  const pick = (item: GameplayItem) => {
    if (tooFar(item)) return flash(`Không với tới ${item.name}.`);
    const r = pickUp(item, stateRef.current);
    if (!r.ok) return flash(r.error);
    flash(`Nhặt được: ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`);
    commit(settleObjectives(g.objectives, r.state).state);
  };

  const interact = (id: string | null) => {
    if (!id || talk || showWin) return;
    const e = entitiesRef.current.find((x) => x.id === id);
    if (!e) return;
    if (e.kind === "npc") {
      // Stand beside the NPC (ground-clamped), then talk.
      walker.walkTo({ x: e.npc.x - 6, y: e.npc.y }, () => startTalk(e.npc));
    } else {
      walker.walkTo({ x: e.item.x, y: e.item.y }, () => pick(e.item));
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
      if ((e.key === "e" || e.key === "E") && !talk) interact(walker.near);
      else if (e.key === "Escape" && talk) setTalk(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const nearEntity = entities.find((e) => e.id === walker.near);
  const promptLabel = nearEntity ? (nearEntity.kind === "npc" ? `Nói chuyện với ${nearEntity.npc.name}` : `Nhặt ${nearEntity.item.name}`) : null;
  const activeObjective = g.objectives.find((o) => objectiveStatus(o, state) === "ACTIVE");
  const npcState = (npc: GameplayNpc) =>
    g.objectives.some((o) => o.type === "GIVE_ITEM" && o.targetCode === npc.code && state.completed.includes(o.code)) ? "FED" : npc.state ?? "IDLE";
  const sizeAt = (base: number, scale: number, y: number) => `${base * scale * walker.depthAt(y)}%`;
  const missingAssets = warnings.filter((w) => w.includes("does not exist"));

  return (
    <div className="adv gp">
      <div ref={walker.sceneRef} className="adv-scene">
        <div
          ref={walker.worldRef}
          className="adv-world"
          style={{ aspectRatio: `${scene.crop.w} / ${scene.crop.h}`, width: `max(100cqw, ${aspect} * (100cqh - var(--ui-space, 0px)))` }}
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
          {g.npcs.filter((n) => n.visible).map((npc) => (
            <button
              key={npc.spawnCode}
              type="button"
              className={`gp-entity gp-npc ${walker.near === `npc:${npc.code}` ? "is-near" : ""}`}
              style={{
                left: `${npc.x}%`,
                top: `${npc.y}%`,
                height: sizeAt(scene.npcHeight, npc.scale, npc.y),
                aspectRatio: spriteAspect(npc),
                zIndex: Math.round(npc.y * 10),
              }}
              onClick={(e) => {
                e.stopPropagation();
                interact(`npc:${npc.code}`);
              }}
              disabled={!npc.interactable}
              aria-label={`Nói chuyện với ${npc.name}`}
            >
              <span className="adv-shadow" aria-hidden />
              <GameplaySprite name={npc.name} imageUrl={npc.imageUrl} imageAvailable={npc.imageAvailable} spriteKey={npc.spriteKey} state={npcState(npc)} />
              <span className="adv-spot-label" aria-hidden>
                💬 {npc.name}
              </span>
            </button>
          ))}
          {g.items.filter((it) => isItemVisible(it, state)).map((item) => (
            <button
              key={item.spawnCode}
              type="button"
              className={`gp-entity gp-item ${walker.near === `item:${item.spawnCode}` ? "is-near" : ""}`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                height: sizeAt(scene.itemHeight, item.scale, item.y),
                aspectRatio: spriteAspect(item),
                zIndex: Math.round(item.y * 10),
              }}
              onClick={(e) => {
                e.stopPropagation();
                interact(`item:${item.spawnCode}`);
              }}
              aria-label={`Nhặt ${item.name}`}
            >
              <span className="adv-shadow" aria-hidden />
              <span className="gp-item-bob">
                <GameplaySprite name={item.name} imageUrl={item.imageUrl} imageAvailable={item.imageAvailable} spriteKey={item.spriteKey} />
              </span>
              <span className="adv-spot-sparkle" aria-hidden>
                ✦
              </span>
              <span className="adv-spot-label" aria-hidden>
                🖐 {item.name}
              </span>
            </button>
          ))}

          <div
            ref={walker.playerRef}
            className="adv-player"
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

      <header ref={walker.hudRef} className="adv-top">
        <button type="button" className="map-btn" onClick={onMap}>
          ← <span className="map-btn-label">Bản đồ</span>
        </button>
        <div className="adv-top-title">
          <strong>
            Ải {level}/{total} — {title}
          </strong>
          <span className="adv-top-objective">🎯 {won ? "Đã qua ải!" : activeObjective?.title ?? "…"}</span>
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
                <GameplaySprite name={talk.npc.name} imageUrl={talk.npc.imageUrl} imageAvailable={talk.npc.imageAvailable} spriteKey={talk.npc.spriteKey} state={npcState(talk.npc)} />
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

        <div ref={walker.dockRef} className="adv-dock gp-dock" role="toolbar" aria-label="Hành động">
          <InteractionPrompt
            label={talk || showWin ? null : promptLabel}
            icon={nearEntity?.kind === "npc" ? "💬" : "🖐"}
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
      </div>
    </div>
  );
}
