"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AdventureStage from "@/components/adventure/AdventureStage";
import GameplayStage from "@/components/gameplay/GameplayStage";
import { useChapterMaps } from "@/lib/api/chapters";
import { useMapGameplay } from "@/lib/api/gameplay";
import { getStageScene, mapCodeFor, type StageScene } from "@/lib/gameplay/stage-scenes";
import { getAdventureStage } from "@/lib/adventure/stages";
import { loadChapter } from "@/lib/catalog";
import { mapHref, playHref } from "@/lib/chapter1";
import { getHero } from "@/lib/heroes";
import { completed, getGuestId, saveLocal, syncProgress } from "@/lib/progress";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { Chapter, GameNotice, HeroId } from "@/lib/types";

const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

// Full-screen stage: backend-driven gameplay (WF_BO_GET_MAP_GAMEPLAY) when the
// map has a registered scene, else the local adventure-puzzle scene when the
// level has one, otherwise the existing Phaser side-view game. Same progress source and unlock rule as
// the home screen and chapter map.
export default function StageScreen({ hero, level }: { hero: HeroId; level: number }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [notice, setNotice] = useState<GameNotice | null>(null);
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

  const current = chapter?.levels.find((l) => l.number === level);
  const total = chapter?.levels.length ?? 10;
  const adventure = getAdventureStage(level);
  const mapCode = mapCodeFor("CHAP01", level);
  const scene = getStageScene(mapCode);
  const [offline, setOffline] = useState(false);
  const heroInfo = getHero(hero);

  const onNotice = (event: GameNotice) => {
    setNotice(event);
    if (event.kind === "win") {
      saveLocal(hero, level);
      syncProgress(getGuestId(), hero, level);
    }
  };
  const toMap = () => goToScene(router, mapHref(hero, level), "back");
  const toNext = () =>
    level < total ? goToScene(router, playHref(hero, level + 1), "forward") : toMap();

  return (
    <div ref={root} className="stage-screen scene-screen">
      {error && <p className="toast">{error}</p>}
      {!allowed || !current ? (
        <p className="stage-loading" role="status">
          <span className="scene-spinner" aria-hidden /> Đang vào Ải {level}…
        </p>
      ) : scene && !offline ? (
        <BackendStage
          mapCode={mapCode}
          scene={scene}
          hero={hero}
          level={level}
          total={total}
          fallbackTitle={current.title}
          canPlayOffline={!!adventure}
          onOffline={() => setOffline(true)}
          onWin={(text) => onNotice({ kind: "win", text })}
          onNext={toNext}
          onMap={toMap}
        />
      ) : adventure ? (
        <AdventureStage
          config={adventure}
          hero={hero}
          level={current}
          total={total}
          onWin={(text) => onNotice({ kind: "win", text })}
          onNext={toNext}
          onMap={toMap}
        />
      ) : (
        <div className="stage-classic">
          <header className="adv-top">
            <button type="button" className="map-btn" onClick={toMap}>
              ← <span className="map-btn-label">Bản đồ</span>
            </button>
            <div className="adv-top-title">
              <strong>
                Ải {level}/{total} — {current.title}
              </strong>
              <span className="adv-top-objective">🎯 Tới được lối ra cuối màn</span>
            </div>
            <span className="adv-hero-chip">
              <img src={heroInfo.asset} alt="" />
              {heroInfo.name}
            </span>
          </header>
          <PhaserGame key={`${hero}:${current.id}`} hero={hero} level={current} onNotice={onNotice} />
          <div className="dialog">
            {notice ? notice.text : current.story}
            {notice?.kind === "win" && (
              <div className="actions">
                <button type="button" className="primary" onClick={toNext}>
                  {level < total ? "▶ Ải tiếp theo" : "🏁 Hoàn tất Chapter 1"}
                </button>
              </div>
            )}
          </div>
          <p className="stage-keys">
            PC: A/D hoặc ←/→ để chạy; Space để nhảy; E để nói chuyện; F dùng chiêu. Mobile: nút cảm ứng ngay dưới game.
          </p>
        </div>
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
      onWin={onWin}
      onNext={onNext}
      onMap={onMap}
    />
  );
}
