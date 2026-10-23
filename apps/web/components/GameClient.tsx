"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HEROES, getHero, isHeroId } from "@/lib/heroes";
import { mapHref, playHref } from "@/lib/chapter1";
import { loadChapter } from "@/lib/catalog";
import { completed } from "@/lib/progress";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { Chapter, HeroId } from "@/lib/types";
import CharacterProfileModal from "./character-profile/CharacterProfileModal";
import { useCharacters } from "@/lib/api/characters";
// Home screen: hero + stage selection. Stages play on their own full-screen
// route (/chapter/1/stage/[level]), entered with a scene transition.
export default function GameClient() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  useSceneEnter(root);
  const [hero, setHero] = useState<HeroId>("sword");
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [stage, setStage] = useState(1);
  const [max, setMax] = useState(0);
  const [error, setError] = useState("");
  const [profileHero, setProfileHero] = useState<HeroId | null>(null);
  // Profiles come from the BFF (/api/game/characters); HEROES stays the
  // gameplay registry, so cards and play still work if the API is down.
  const characters = useCharacters();
  const cardHeroes =
    characters.status === "ready"
      ? [
          ...characters.order.flatMap((id) => HEROES.filter((h) => h.id === id)),
          ...HEROES.filter((h) => !characters.profiles.has(h.id)),
        ]
      : HEROES;
  // ?hero=… keeps the selected hero when returning; old ?stage=…&play=1
  // links are forwarded to the stage route.
  const pending = useRef<{ hero: HeroId; stage: number; play: boolean } | null>(
    null,
  );
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = q.get("hero");
    if (!isHeroId(h)) return;
    pending.current = {
      hero: h,
      stage: Number(q.get("stage")) || 1,
      play: q.get("play") === "1",
    };
    window.history.replaceState(null, "", "/");
    setHero(h);
  }, []);
  useEffect(() => {
    loadChapter()
      .then(setChapter)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    const done = completed(hero);
    const p = pending.current;
    setMax(done);
    if (p && p.hero === hero) {
      pending.current = null;
      // Same unlock rule as the stage buttons: never deep-link past max + 1.
      const n = Math.min(Math.max(1, p.stage), done + 1);
      setStage(n);
      if (p.play) router.replace(playHref(hero, n));
    } else {
      setStage(1);
    }
  }, [hero, router]);
  const current = chapter?.levels.find((l) => l.number === stage);
  return (
    <>
      {/* Full-screen backdrop + signpost (position: fixed). Kept OUTSIDE the
          animated .scene-screen: a transform/filter on an ancestor would make
          it the containing block and shrink the backdrop to the content column. */}
      <div className="scene" aria-hidden>
        {/* Painted over the empty signpost in background.png. Decorative for
            now; can become an interactive chapter map later. */}
        <Image
          className="signpost"
          src="/assets/direct.png"
          alt=""
          width={1024}
          height={1536}
          sizes="300px"
        />
      </div>
      <div ref={root} className="shell shell-menu scene-screen">
        <h1 className="title">
          <Image
            src="/assets/banghieu.png"
            alt="vKnight Phiêu Lưu Ký — 5 thằng ngáo · 1 hành trình · Vô số tai nạn"
            width={2172}
            height={724}
            sizes="(max-width: 900px) 94vw, 850px"
            preload
          />
        </h1>
        {error && <p className="toast">{error}</p>}
        <div className="menu-stage">
          <h2 className="section-label">1. Chọn nhân vật</h2>
          {characters.status === "error" && (
            <p className="chars-notice" role="alert">
              😵 Chưa tải được hồ sơ nhân vật.{" "}
              <button type="button" onClick={characters.retry}>
                ↻ Thử lại
              </button>
            </p>
          )}
          <div className="hero-grid">
            {cardHeroes.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`hero-card ${hero === h.id ? "selected" : ""}`}
                aria-haspopup="dialog"
                aria-pressed={hero === h.id}
                onClick={() => setProfileHero(h.id)}
              >
                <img src={h.asset} alt={h.name} />
                <strong>{characters.profiles?.get(h.id)?.name ?? h.name}</strong>
                <small>{h.tagline}</small>
                <span className="hero-card-hint">🔍 Xem hồ sơ</span>
              </button>
            ))}
          </div>
          <CharacterProfileModal
            heroId={profileHero}
            selectedHeroId={hero}
            isOpen={profileHero !== null}
            onClose={() => setProfileHero(null)}
            profile={profileHero ? (characters.profiles?.get(profileHero) ?? null) : null}
            loadState={
              characters.status === "ready" && profileHero && !characters.profiles.has(profileHero)
                ? "error"
                : characters.status
            }
            loadError={
              characters.status === "ready" ? "Máy chủ chưa có hồ sơ cho nhân vật này." : characters.error
            }
            onRetry={characters.retry}
            onSelect={(id) => {
              setHero(id as HeroId);
              setProfileHero(null);
            }}
          />
          <section className="panel chapter-panel">
            <h2>2. Chapter 1: Làng Ngáo</h2>
            <p>
              Vua Vịt tuyên bố mất công chúa. Năm thằng chưa kịp ăn sáng đã nhận
              nhiệm vụ giải cứu.
            </p>
            <p className="status">
              {getHero(hero).name} — Đã hoàn thành: {max}/
              {chapter?.levels.length || 10} ải
            </p>
            <div className="stage-buttons">
              {chapter?.levels.map((l) => (
                <button
                  className={stage === l.number ? "active" : ""}
                  key={l.id}
                  disabled={l.number > max + 1}
                  onClick={() => setStage(l.number)}
                  title={l.title}
                >
                  {l.number}
                </button>
              ))}
            </div>
            <div className="actions">
              <button
                className="primary"
                disabled={!chapter}
                onClick={() => goToScene(router, playHref(hero, stage), "forward")}
              >
                ▶ Chơi ải {stage}: {current?.title || "..."}
              </button>
              <a
                className="map-button"
                href={mapHref(hero, stage)}
                onClick={(e) => {
                  e.preventDefault();
                  goToScene(router, mapHref(hero, stage), "forward");
                }}
              >
                🗺 Xem bản đồ phiêu lưu
              </a>
              <span>⚔ {getHero(hero).ability}</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
