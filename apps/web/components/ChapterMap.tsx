"use client";
import ChapterGuide from "@/components/chapter-map/ChapterGuide";
import LevelScene from "@/components/chapter-map/LevelScene";
import {
  CHAPTER1_LEVELS,
  CHAPTER1_TITLE,
  STATUS_ICON,
  STATUS_TEXT,
  levelStatus,
  mapHref,
  playHref,
} from "@/lib/chapter1";
import { getHero } from "@/lib/heroes";
import { completed } from "@/lib/progress";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { HeroId } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const TOTAL = CHAPTER1_LEVELS.length;

export default function ChapterMap({
  hero,
  initialLevel,
}: {
  hero: HeroId;
  initialLevel?: number;
}) {
  const router = useRouter();
  const screen = useRef<HTMLDivElement>(null);
  useSceneEnter(screen);
  const hud = useRef<HTMLElement>(null);
  const dock = useRef<HTMLElement>(null);
  const chips = useRef<HTMLElement>(null);
  const chipsPlaced = useRef(false);
  const guideButton = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  // Progress lives in localStorage, so it is only known after mount.
  const [max, setMax] = useState<number | null>(null);
  const [level, setLevel] = useState(initialLevel ?? 1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");

  const done = Math.min(max ?? 0, TOTAL);
  const next = Math.min(done + 1, TOTAL);
  const current = CHAPTER1_LEVELS[level - 1];
  const status = levelStatus(level, done);
  const heroInfo = getHero(hero);

  useEffect(() => {
    const m = completed(hero);
    setMax(m);
    // Without an explicit ?level=, open on the next level to play.
    if (!initialLevel) setLevel(Math.min(m + 1, TOTAL));
  }, [hero, initialLevel]);

  // Fit the artwork between the floating HUD and dock, whose heights change
  // with screen size and text wrapping.
  useEffect(() => {
    const el = screen.current, h = hud.current, d = dock.current;
    if (!el || !h || !d) return;
    // Layout offsets, not getBoundingClientRect: the screen may be mid scene
    // transition (scaled), which must not leak into these measurements.
    const measure = () => {
      el.style.setProperty("--scene-top", `${h.offsetTop + h.offsetHeight + 10}px`);
      el.style.setProperty("--scene-bottom", `${el.clientHeight - d.offsetTop + 10}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    [el, h, d].forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, []);

  // Keep the current chip visible when the selector scrolls (mobile).
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !chip) return;
    row.scrollTo({
      left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
      behavior: chipsPlaced.current ? "smooth" : "instant",
    });
    if (max !== null) chipsPlaced.current = true;
  }, [level, max]);

  // Keep the URL in sync so refresh / share opens the same map.
  useEffect(() => {
    if (max === null) return;
    window.history.replaceState(null, "", mapHref(hero, level));
  }, [hero, level, max]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (n: number) => setLevel(Math.min(TOTAL, Math.max(1, n)));
  const step = (d: number) => setLevel((l) => Math.min(TOTAL, Math.max(1, l + d)));

  useEffect(() => {
    if (guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guideOpen]);

  const play = (n: number) => {
    if (levelStatus(n, done) === "LOCKED") {
      setToast(`🔒 Ải ${n} còn khóa — hoàn thành Ải ${next} trước đã!`);
      return;
    }
    // Camera flies into the stage world.
    goToScene(router, playHref(hero, n), "forward");
  };

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    guideButton.current?.focus();
  }, []);

  const ctaLabel =
    status === "LOCKED"
      ? `🔒 Ải ${level} chưa mở khóa`
      : `${status === "COMPLETED" ? "↻ Chơi lại" : "▶ Chơi"} ải ${level}: ${current.title}`;

  return (
    <div ref={screen} className="map-screen scene-screen">
      <div
        className="scene-stage"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {max !== null && <LevelScene key={level} level={current} />}
      </div>

      <header ref={hud} className="map-hud">
        <Link
          className="map-btn"
          href={`/?hero=${hero}`}
          aria-label="Về trang chủ"
          onClick={(e) => {
            e.preventDefault();
            goToScene(router, `/?hero=${hero}`, "back");
          }}
        >
          ← <span className="map-btn-label">Về trang chủ</span>
        </Link>
        <div className="map-progress">
          <strong>{CHAPTER1_TITLE}</strong>
          <span>
            {heroInfo.name} · {done}/{TOTAL} ải
          </span>
          <span className="map-progress-bar" aria-hidden>
            <span style={{ width: `${(done / TOTAL) * 100}%` }} />
          </span>
        </div>
        <button
          ref={guideButton}
          type="button"
          className="map-btn"
          onClick={() => setGuideOpen(true)}
          aria-haspopup="dialog"
          aria-label="Cốt truyện & Danh sách ải"
        >
          📜 <span className="map-btn-label">Cốt truyện & Danh sách ải</span>
        </button>
        <button type="button" className="primary map-continue" onClick={() => play(next)}>
          {done >= TOTAL ? "↻ " : "▶ "}
          <span className="map-btn-label">{done >= TOTAL ? "Chơi lại: " : "Chơi tiếp: "}</span>
          Ải {done >= TOTAL ? TOTAL : next}
        </button>
      </header>

      <section ref={dock} className="map-dock" aria-label="Chọn ải">
        <button
          type="button"
          className="map-arrow map-arrow-prev"
          onClick={() => step(-1)}
          disabled={level === 1}
          aria-label="Bản đồ ải trước"
        >
          ◀
        </button>
        <div className="dock-main">
          <div className="dock-info">
            <p className="dock-head">
              <span className="dock-count">
                Ải {level} / {TOTAL}
              </span>
              <span className={`status-pill is-${status}`}>
                {STATUS_ICON[status]} {STATUS_TEXT[status]}
              </span>
            </p>
            <h1 className="dock-title">{current.title}</h1>
            <p className="dock-desc">{current.description}</p>
          </div>
          <button
            type="button"
            className="primary dock-play"
            aria-disabled={status === "LOCKED"}
            onClick={() => play(level)}
          >
            {ctaLabel}
          </button>
          <nav ref={chips} className="level-chips" aria-label="Danh sách bản đồ">
            {CHAPTER1_LEVELS.map((l) => {
              const s = levelStatus(l.level, done);
              return (
                <button
                  key={l.level}
                  type="button"
                  className={`level-chip is-${s}`}
                  aria-current={l.level === level ? "true" : undefined}
                  aria-label={`Xem bản đồ Ải ${l.level}: ${l.title} — ${STATUS_TEXT[s]}`}
                  title={`Ải ${l.level}: ${l.title}`}
                  onClick={() => go(l.level)}
                >
                  {l.level}
                </button>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          className="map-arrow map-arrow-next"
          onClick={() => step(1)}
          disabled={level === TOTAL}
          aria-label="Bản đồ ải sau"
        >
          ▶
        </button>
      </section>

      {toast && (
        <p className="map-toast" role="status">
          {toast}
        </p>
      )}

      {guideOpen && (
        <ChapterGuide
          heroName={heroInfo.name}
          completedCount={done}
          currentLevel={level}
          onClose={closeGuide}
          onPreview={(n) => {
            go(n);
            closeGuide();
          }}
          onPlay={play}
        />
      )}
    </div>
  );
}
