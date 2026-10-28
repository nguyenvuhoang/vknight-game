"use client";
// Fantasy MMORPG HUD (Stage 2 skin, enabled per scene via StageScene.hud).
// Pure presentation over GameplayStage's state: it never moves the hero,
// changes interaction distance or completes objectives by itself.
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Baloo_2 } from "next/font/google";
import CharacterProfileModal from "@/components/character-profile/CharacterProfileModal";
import { useCharacters } from "@/lib/api/characters";
import type { CharacterAbility } from "@/lib/api/character-types";
import { exitStatus } from "@/lib/gameplay/interaction-engine";
import { isItemVisible } from "@/lib/gameplay/inventory-engine";
import { objectiveStatus } from "@/lib/gameplay/objective-engine";
import type { GameplayState, MapGameplay } from "@/lib/gameplay/gameplay-types";
import type { StageScene } from "@/lib/gameplay/stage-scenes";
import type { Point } from "@/lib/scene/use-scene-walker";
import type { Hero } from "@/lib/types";
import CharacterHUD from "./CharacterHUD";
import FantasyGameMenu from "./FantasyGameMenu";
import FantasyQuestTracker from "./FantasyQuestTracker";
import FantasySkillBar from "./FantasySkillBar";
import GameActivityLog from "./GameActivityLog";
import MiniMap, { type MiniMarker } from "./MiniMap";
import StageBanner from "./StageBanner";
import type { ActivityEvent } from "./types";
import "./fantasy-hud.css";

const hudFont = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"], variable: "--fh-font", display: "swap" });

type Props = {
  hero: Hero;
  gameplay: MapGameplay;
  state: GameplayState;
  scene: StageScene;
  title: string;
  bannerTitle: string;
  subtitle: string;
  posRef: RefObject<Point>;
  hudRef: RefObject<HTMLElement | null>;
  dockRef: RefObject<HTMLDivElement | null>;
  events: ActivityEvent[];
  questOpen: boolean;
  onToggleQuest: () => void;
  interactLabel: string | null;
  onInteract: () => void;
  /** The context prompt (InteractionPrompt) and touch d-pad from the stage. */
  prompt: ReactNode;
  dpad: ReactNode;
  guideText: string | null;
  hintText: string | null;
  onMap: () => void;
  onNotice: (text: string) => void;
  suspended: boolean;
  /** Clue items guarded by a backend puzzle: item code -> solved on the server. */
  puzzleSteps?: Map<string, boolean>;
  /** Stage modal drawn inside the HUD layer (e.g. the puzzle panel), so it shares the HUD font and art. */
  overlay?: ReactNode;
};

export default function FantasyHudShell(p: Props) {
  const characters = useCharacters();
  const profile = characters.status === "ready" ? characters.profiles.get(p.hero.id) ?? null : null;
  const abilities = profile?.abilities ?? [];
  const [profileOpen, setProfileOpen] = useState(false);
  const g = p.gameplay;

  const art = p.scene.hudArt;
  // Stage art frames as CSS variables; the CSS falls back to drawn surfaces without them.
  const artVars = art
    ? ({
        "--fh-art-panel": `url(${art.panel})`,
        "--fh-art-dark": `url(${art.panelDark})`,
        "--fh-art-banner": `url(${art.banner})`,
        "--fh-art-button": `url(${art.button})`,
        "--fh-art-leaves": `url(${art.leaves})`,
      } as React.CSSProperties)
    : undefined;

  const lockedSkill = (a: CharacterAbility) => p.onNotice(`${a.name}: chưa dùng được trong ải giải đố này.`);

  // Number keys 2+ map to the locked ability slots (1 = interact, handled by the stage).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (p.suspended || (e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) return;
      const a = abilities[Number(e.key) - 2];
      if (a) lockedSkill(a);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const markers: MiniMarker[] = [
    ...g.npcs.filter((n) => n.visible).map((n) => ({
      id: `npc:${n.code}`,
      kind: "npc" as const,
      x: n.x,
      y: n.y,
      label: n.name,
      quest: g.objectives.some((o) => o.targetCode === n.code && objectiveStatus(o, p.state) === "ACTIVE"),
    })),
    ...g.items.filter((i) => isItemVisible(i, p.state)).map((i) => ({ id: `item:${i.spawnCode}`, kind: "item" as const, x: i.x, y: i.y, label: i.name })),
    ...g.exits
      .filter((e) => exitStatus(e, p.state) !== "USED")
      .map((e) => {
        const open = exitStatus(e, p.state) === "OPEN";
        return { id: `exit:${e.spawnCode}`, kind: open ? ("exit-open" as const) : ("exit-locked" as const), x: e.x, y: e.y, label: open ? "Cổng (đã mở)" : "Cổng (đang khóa)" };
      }),
  ];

  return (
    <div className={`fh ${hudFont.variable} ${art ? "has-art" : ""}`} style={artVars}>
      <header ref={p.hudRef} className="fh-top">
        <CharacterHUD hero={p.hero} profile={profile} npcs={g.npcs.filter((n) => n.visible)} state={p.state} sprites={p.scene.sprites} />
        <StageBanner title={p.bannerTitle} subtitle={p.subtitle} />
        <MiniMap title={p.title} scene={p.scene} posRef={p.posRef} markers={markers} icons={art?.markers} />
      </header>

      <FantasyQuestTracker objectives={g.objectives} items={g.items} state={p.state} open={p.questOpen} onToggle={p.onToggleQuest} puzzleSteps={p.puzzleSteps} />

      <div ref={p.dockRef} className="fh-bottom">
        <GameActivityLog events={p.events} />
        <div className="fh-center">
          <div className="fh-prompt">{p.prompt}</div>
          <FantasySkillBar interactLabel={p.interactLabel} onInteract={p.onInteract} abilities={abilities} onLockedSkill={lockedSkill} />
        </div>
        <FantasyGameMenu
          hero={p.hero}
          items={g.items}
          state={p.state}
          abilities={abilities}
          abilitiesState={characters.status}
          questOpen={p.questOpen}
          onToggleQuest={p.onToggleQuest}
          onOpenProfile={() => setProfileOpen(true)}
          guideText={p.guideText}
          hintText={p.hintText}
          onMap={p.onMap}
          suspended={p.suspended}
        />
        {p.dpad}
      </div>

      {p.overlay}

      {/* Portaled: a fixed modal must not live inside the HUD layer or the animated scene. */}
      {profileOpen &&
        createPortal(
          <CharacterProfileModal
            heroId={p.hero.id}
            selectedHeroId={p.hero.id}
            isOpen
            onClose={() => setProfileOpen(false)}
            onSelect={() => setProfileOpen(false)}
            profile={profile}
            loadState={characters.status}
            loadError={characters.status === "error" ? characters.error : null}
            onRetry={characters.retry}
          />,
          document.body,
        )}
    </div>
  );
}
