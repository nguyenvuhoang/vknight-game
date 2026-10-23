"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AdventureStage from "@/components/adventure/AdventureStage";
import { getAdventureStage } from "@/lib/adventure/stages";
import { loadChapter } from "@/lib/catalog";
import { mapHref, playHref } from "@/lib/chapter1";
import { getHero } from "@/lib/heroes";
import { completed, getGuestId, saveLocal, syncProgress } from "@/lib/progress";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { Chapter, GameNotice, HeroId } from "@/lib/types";

const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

// Full-screen stage: adventure-puzzle scene when the level has one, otherwise
// the existing Phaser side-view game. Same progress source and unlock rule as
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
