"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdventureStage from "@/components/adventure/AdventureStage";
import GameplayStage from "@/components/gameplay/GameplayStage";
import UnderDevelopmentStage from "@/components/stage/UnderDevelopmentStage";
import { useChapterMaps } from "@/lib/api/chapters";
import { useMapGameplay } from "@/lib/api/gameplay";
import { getStageScene, mapCodeFor, type StageScene } from "@/lib/gameplay/stage-scenes";
import { getAdventureStage } from "@/lib/adventure/stages";
import { loadChapter } from "@/lib/catalog";
import { mapHref, playHref } from "@/lib/chapter1";
import { completed, getGuestId, saveLocal, syncProgress } from "@/lib/progress";
import { DEFAULT_DEV_NOTE, stageContent } from "@/lib/stage-availability";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { Chapter, HeroId } from "@/lib/types";

const CHAPTER = 1;

// Full-screen stage. Progress decides access (same unlock rule as the home
// screen and chapter map); content readiness (lib/stage-availability) decides
// what an unlocked stage shows: READY → backend-driven gameplay
// (WF_BO_GET_MAP_GAMEPLAY + puzzles), with Stage 1's local adventure as an
// opt-in offline copy; IN_DEVELOPMENT → the under-development screen. The old
// Phaser side-view game (PhaserGame) is no longer routed to.
export default function StageScreen({ hero, level }: { hero: HeroId; level: number }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);
  useSceneEnter(root);

  useEffect(() => {
    // Never play past the next unlocked level; send the player to the map instead.
    const done = completed(hero);
    if (level > done + 1) {
      router.replace(mapHref(hero, done + 1));
      return;
    }
    setAllowed(true);
    loadChapter()
      .then(setChapter)
      .catch((e) => setError(String(e)));
  }, [hero, level, router]);

  // Titles come from the Chapter Map metadata (WF_BO_GET_CHAPTER_MAP), like the
  // home screen and the map; the bundled level config only supplies gameplay.
  // Wait for it so the level object handed to the games is built once.
  const chapterMaps = useChapterMaps(1);
  const mapTitle = chapterMaps.chapter?.maps.find((m) => m.level === level)?.title;
  const levelConfig = chapter?.levels.find((l) => l.number === level);
  const current = useMemo(
    () => (levelConfig && mapTitle ? { ...levelConfig, title: mapTitle } : levelConfig),
    [levelConfig, mapTitle],
  );
  const map = chapterMaps.chapter?.maps.find((m) => m.level === level);
  const titlesReady = chapterMaps.status !== "loading";
  const total = chapterMaps.chapter?.maps.length || chapter?.levels.length || 10;
  const adventure = getAdventureStage(level);
  const mapCode = mapCodeFor("CHAP01", level);
  const scene = getStageScene(mapCode);
  const [offline, setOffline] = useState(false);
  const content = stageContent(CHAPTER, level);
  // Dev only: ?preview=1 plays a scene that is still IN_DEVELOPMENT, without saving progress.
  const [devPreview, setDevPreview] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") setDevPreview(new URLSearchParams(window.location.search).get("preview") === "1");
  }, []);
  // READY needs a registered scene; never fall back to unrelated legacy content.
  const ready = (content.status === "READY" || devPreview) && !!scene;
  useEffect(() => {
    if (content.status === "READY" && !scene && process.env.NODE_ENV !== "production") {
      console.warn(`[stage] ${mapCode} is READY but has no scene in stage-scenes.ts — showing the under-development screen.`);
    }
  }, [content.status, scene, mapCode]);

  // Only READY renderers can report a win; the under-development screen never does,
  // and a dev preview of an unfinished stage never marks it complete.
  const onWin = () => {
    if (content.status !== "READY") {
      console.info(`[stage] ${mapCode} preview cleared — progress not saved (stage is ${content.status}).`);
      return;
    }
    saveLocal(hero, level);
    syncProgress(getGuestId(), hero, level);
  };
  // Which renderer this level uses; exposed on the root for debugging stale bundles.
  const mode = !ready ? "in-development" : offline && adventure ? "adventure" : "backend";
  const toMap = () => goToScene(router, mapHref(hero, level), "back");
  const toHome = () => goToScene(router, `/?hero=${hero}`, "back");
  const toNext = () =>
    level < total ? goToScene(router, playHref(hero, level + 1), "forward") : toMap();

  return (
    <div ref={root} className="stage-screen scene-screen" data-stage-mode={mode} data-map-code={mapCode}>
      {error && ready && <p className="toast">{error}</p>}
      {!allowed || !titlesReady || (ready && !current) ? (
        <p className="stage-loading" role="status">
          <span className="scene-spinner" aria-hidden /> Đang vào Ải {level}…
        </p>
      ) : mode === "in-development" || !current ? (
        <UnderDevelopmentStage
          level={level}
          total={total}
          title={map?.title ?? null}
          description={map?.description || null}
          image={map?.image ?? null}
          note={content.devNote ?? DEFAULT_DEV_NOTE}
          onMap={toMap}
          onHome={toHome}
        />
      ) : mode === "backend" && scene ? (
        <BackendStage
          mapCode={mapCode}
          scene={scene}
          hero={hero}
          level={level}
          total={total}
          fallbackTitle={current.title}
          canPlayOffline={!!adventure}
          onOffline={() => setOffline(true)}
          onWin={onWin}
          onNext={toNext}
          onMap={toMap}
        />
      ) : (
        // Offline copy of a READY stage's own content (Stage 1 only), chosen by the player.
        adventure && (
          <AdventureStage
            config={adventure}
            hero={hero}
            level={current}
            total={total}
            onWin={onWin}
            onNext={toNext}
            onMap={toMap}
          />
        )
      )}
    </div>
  );
}

type BackendStageProps = {
  mapCode: string;
  scene: StageScene;
  hero: HeroId;
  level: number;
  total: number;
  fallbackTitle: string;
  canPlayOffline: boolean;
  onOffline: () => void;
  onWin: (text: string) => void;
  onNext: () => void;
  onMap: () => void;
};

/** Loads the map's gameplay through the BFF; clear loading / error states, no silent fallback. */
function BackendStage({ mapCode, scene, hero, level, total, fallbackTitle, canPlayOffline, onOffline, onWin, onNext, onMap }: BackendStageProps) {
  const gameplay = useMapGameplay(mapCode);
  const chapter = useChapterMaps(1); // cached; gives the official title + completion text
  const map = chapter.chapter?.maps.find((m) => m.level === level);
  if (gameplay.status !== "ready") {
    return (
      <div className="map-state stage-state" role={gameplay.status === "error" ? "alert" : "status"}>
        {gameplay.status === "error" ? (
          <>
            <span aria-hidden>😵</span>
            <strong>{gameplay.error}</strong>
            <div className="stage-state-actions">
              <button type="button" className="primary" onClick={gameplay.retry}>
                ↻ Thử lại
              </button>
              {canPlayOffline && (
                <button type="button" className="secondary" onClick={onOffline}>
                  🎒 Chơi bản offline
                </button>
              )}
              <button type="button" className="secondary" onClick={onMap}>
                🗺 Về bản đồ
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="scene-spinner" aria-hidden />
            <strong>Đang dựng màn chơi…</strong>
          </>
        )}
      </div>
    );
  }
  return (
    <GameplayStage
      gameplay={gameplay.data.gameplay}
      warnings={gameplay.data.warnings}
      scene={scene}
      hero={hero}
      level={level}
      total={total}
      title={map?.title ?? fallbackTitle}
      completionText={map?.completionText ?? null}
      guideText={map?.guideText ?? null}
      hintText={map?.hintText ?? null}
      onWin={onWin}
      onNext={onNext}
      onMap={onMap}
    />
  );
}
