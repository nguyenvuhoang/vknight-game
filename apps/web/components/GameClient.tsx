"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { HEROES, getHero, isHeroId } from "@/lib/heroes";
import { loadChapter } from "@/lib/catalog";
import { completed, getGuestId, saveLocal, syncProgress } from "@/lib/progress";
import type { Chapter, HeroId, GameNotice } from "@/lib/types";
import CharacterProfileModal from "./character-profile/CharacterProfileModal";
const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });
export default function GameClient() {
  const [hero, setHero] = useState<HeroId>("sword");
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [stage, setStage] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<GameNotice | null>(null);
  const [max, setMax] = useState(0);
  const [error, setError] = useState("");
  const [profileHero, setProfileHero] = useState<HeroId | null>(null);
  // Deep link from the chapter map: /?hero=…&stage=…&play=1
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
    setNotice(null);
    if (p && p.hero === hero) {
      pending.current = null;
      // Same unlock rule as the stage buttons: never deep-link past max + 1.
      setStage(Math.min(Math.max(1, p.stage), done + 1));
      setPlaying(p.play);
    } else {
      setStage(1);
      setPlaying(false);
    }
  }, [hero]);
  const current = chapter?.levels.find((l) => l.number === stage);
  const onNotice = (event: GameNotice) => {
    setNotice(event);
    if (event.kind === "win") {
      saveLocal(hero, stage);
      setMax(completed(hero));
      syncProgress(getGuestId(), hero, stage);
    }
  };
  return (
    <div className={`shell ${playing ? "" : "shell-menu"}`}>
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
      {!playing && (
        <div className="menu-stage">
          <h2 className="section-label">1. Chọn nhân vật</h2>
          <div className="hero-grid">
            {HEROES.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`hero-card ${hero === h.id ? "selected" : ""}`}
                aria-haspopup="dialog"
                aria-pressed={hero === h.id}
                onClick={() => setProfileHero(h.id)}
              >
                <img src={h.asset} alt={h.name} />
                <strong>{h.name}</strong>
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
                onClick={() => {
                  setNotice(null);
                  setPlaying(true);
                }}
              >
                ▶ Chơi ải {stage}: {current?.title || "..."}
              </button>
              <Link className="map-button" href={`/chapter/1/map?hero=${hero}`}>
                🗺 Xem bản đồ phiêu lưu
              </Link>
              <span>⚔ {getHero(hero).ability}</span>
            </div>
          </section>
        </div>
      )}
      {playing && current && (
        <section className="panel">
          <div className="game-hud">
            <strong>
              Ải {stage}/10 — {current.title}
            </strong>
            <span>{getHero(hero).name}</span>
            <button className="secondary" onClick={() => setPlaying(false)}>
              ← Menu
            </button>
          </div>
          <PhaserGame
            key={`${hero}:${current.id}`}
            hero={hero}
            level={current}
            onNotice={onNotice}
          />
          <div className="dialog">
            {notice ? notice.text : current.story}
            {notice?.kind === "win" && (
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => {
                    if (stage < (chapter?.levels.length ?? 0)) {
                      setStage((v) => v + 1);
                      setNotice(null);
                    } else {
                      setPlaying(false);
                    }
                  }}
                >
                  {" "}
                  {stage < (chapter?.levels.length ?? 0)
                    ? "▶ Ải tiếp theo"
                    : "Hoàn tất Chapter 1"}{" "}
                </button>
              </div>
            )}
          </div>
          <p className="status">
            PC: A/D hoặc ←/→ để chạy; Space để nhảy; E để nói chuyện; F dùng
            chiêu. Mobile: nút cảm ứng ngay dưới game.
          </p>
        </section>
      )}
      <footer className="footer">vKnight@2026</footer>
    </div>
  );
}
