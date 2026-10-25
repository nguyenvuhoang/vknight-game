"use client";
import ChapterGuide from "@/components/chapter-map/ChapterGuide";
import LevelMeta from "@/components/chapter-map/LevelMeta";
import LevelScene from "@/components/chapter-map/LevelScene";
import { useChapterMaps } from "@/lib/api/chapters";
import { STATUS_ICON, STATUS_TEXT, levelStatus, mapHref, playHref } from "@/lib/chapter1";
import { getHero } from "@/lib/heroes";
import { completed } from "@/lib/progress";
import { goToScene, useSceneEnter } from "@/lib/transition";
import type { HeroId } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Map data comes from the BFF (/api/game/chapters/[n]/maps). Progress is local
// (localStorage) and keeps the existing rule: levelStatus(level, completedCount).
const CHAPTER = 1;

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
  const data = useChapterMaps(CHAPTER);
  const chapter = data.chapter;
  const maps = chapter?.maps ?? [];
  const levels = maps.map((m) => m.level);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  // Progress lives in localStorage, so it is only known after mount.
  const [max, setMax] = useState<number | null>(null);
  const [level, setLevel] = useState(initialLevel ?? 1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");

  const done = max ?? 0;
  const statusOf = (n: number) => levelStatus(n, done);
  const doneCount = maps.filter((m) => statusOf(m.level) === "COMPLETED").length;
  const allDone = maps.length > 0 && doneCount === maps.length;
  const lastLevel = levels[levels.length - 1] ?? 0;
  const nextMap = maps.find((m) => m.level === done + 1);
  const current = maps.find((m) => m.level === level) ?? maps[0];
  const status = current ? statusOf(current.level) : "LOCKED";
  const heroInfo = getHero(hero);

  useEffect(() => {
    setMax(completed(hero));
  }, [hero]);

  // Once maps + progress are known, land on an existing level: the requested
  // one if present, otherwise the next level to play, otherwise the first map.
  const landed = useRef(false);
  useEffect(() => {
    if (max === null || !maps.length) return;
    setLevel((l) => {
      const has = (n: number) => maps.some((m) => m.level === n);
      // A later data refresh (e.g. retry after the fallback) keeps the player's spot.
      if (landed.current && has(l)) return l;
      landed.current = true;
      const want = initialLevel ?? max + 1;
      if (has(want)) return want;
      if (want > maps[maps.length - 1].level) return maps[maps.length - 1].level;
      return maps.find((m) => m.level > want)?.level ?? maps[0].level;
    });
    // maps identity changes per render; the chapter object is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, max, initialLevel]);

  // Fit the artwork between the floating HUD and dock, whose heights change
  // with screen size and text wrapping.
  const hasDock = !!current;
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
  }, [hasDock]);

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
  }, [level, max, hasDock]);

  // Keep the URL in sync so refresh / share opens the same map.
  useEffect(() => {
    if (max === null || !current) return;
    window.history.replaceState(null, "", mapHref(hero, current.level));
  }, [hero, current, max]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (n: number) => levels.includes(n) && setLevel(n);
  // Step through the maps that exist (levels may have gaps).
  const step = useCallback((d: number) => {
    setLevel((l) => {
      const ls = levelsRef.current;
      const i = ls.indexOf(l);
      if (i < 0) return ls[0] ?? l;
      return ls[Math.min(ls.length - 1, Math.max(0, i + d))];
    });
  }, []);

  useEffect(() => {
    if (guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guideOpen, step]);

  const play = (n: number) => {
    if (statusOf(n) === "LOCKED") {
      setToast(`🔒 Ải ${n} còn khóa — hoàn thành Ải ${done + 1} trước đã!`);
      return;
    }
    // Camera flies into the stage world.
    goToScene(router, playHref(hero, n), "forward");
  };

  const continueLevel = allDone ? lastLevel : nextMap?.level;
  const continueGame = () =>
    continueLevel ? play(continueLevel) : setToast(`Ải ${done + 1} chưa có dữ liệu bản đồ. Đợi cập nhật nhé!`);

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    guideButton.current?.focus();
  }, []);

  const ctaLabel = !current
    ? ""
    : status === "LOCKED"
      ? `🔒 Ải ${current.level} chưa mở khóa`
      : `${status === "COMPLETED" ? "↻ Chơi lại" : "▶ Chơi"} ải ${current.level}: ${current.title}`;

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
        {max !== null && current && <LevelScene key={current.level} level={current} />}
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
          <strong>{chapter?.title ?? `Chapter ${CHAPTER}`}</strong>
          <span>
            {heroInfo.name} · {doneCount}/{maps.length || "?"} ải
          </span>
          <span className="map-progress-bar" aria-hidden>
            <span style={{ width: `${maps.length ? (doneCount / maps.length) * 100 : 0}%` }} />
          </span>
        </div>
        <button
          ref={guideButton}
          type="button"
          className="map-btn"
          onClick={() => setGuideOpen(true)}
          disabled={!chapter}
          aria-haspopup="dialog"
          aria-label="Cốt truyện & Danh sách ải"
        >
          📜 <span className="map-btn-label">Cốt truyện & Danh sách ải</span>
        </button>
        <button
          type="button"
          className="primary map-continue"
          onClick={continueGame}
          disabled={!chapter}
          aria-disabled={!continueLevel}
        >
          {allDone ? "↻ " : "▶ "}
          <span className="map-btn-label">{allDone ? "Chơi lại: " : "Chơi tiếp: "}</span>
          Ải {allDone ? lastLevel : done + 1}
        </button>
      </header>

      {data.status === "fallback" && (
        <p className="map-notice" role="status">
          ⚠ {data.error} Đang dùng dữ liệu dự phòng của Chương 1.{" "}
          <button type="button" onClick={data.retry}>
            ↻ Thử lại
          </button>
        </p>
      )}

      {!chapter && (
        <div className="map-state" role={data.status === "error" ? "alert" : "status"}>
          {data.status === "error" ? (
            <>
              <span aria-hidden>{data.code === "not_found" || data.code === "empty" ? "🚧" : "😵"}</span>
              <strong>{data.error}</strong>
              {data.code !== "not_found" && data.code !== "empty" && (
                <button type="button" className="secondary" onClick={data.retry}>
                  ↻ Thử lại
                </button>
              )}
            </>
          ) : (
            <>
              <span className="scene-spinner" aria-hidden />
              <strong>Đang trải bản đồ chương…</strong>
            </>
          )}
        </div>
      )}

      {current && (
        <section ref={dock} className="map-dock" aria-label="Chọn ải">
          <button
            type="button"
            className="map-arrow map-arrow-prev"
            onClick={() => step(-1)}
            disabled={current.level === levels[0]}
            aria-label="Bản đồ ải trước"
          >
            ◀
          </button>
          <div className="dock-main">
            <div className="dock-info">
              <p className="dock-head">
                <span className="dock-count">
                  Ải {current.level} / {lastLevel}
                </span>
                <span className={`status-pill is-${status}`}>
                  {STATUS_ICON[status]} {STATUS_TEXT[status]}
                </span>
              </p>
              <h1 className="dock-title">
                {current.isBoss && <span aria-hidden>👑 </span>}
                {current.title}
              </h1>
              <p className="dock-desc">{current.description}</p>
              <LevelMeta map={current} compact />
            </div>
            <button
              type="button"
              className="primary dock-play"
              aria-disabled={status === "LOCKED"}
              onClick={() => play(current.level)}
            >
              {ctaLabel}
            </button>
            <nav ref={chips} className="level-chips" aria-label="Danh sách bản đồ">
              {maps.map((m) => {
                const s = statusOf(m.level);
                return (
                  <button
                    key={m.level}
                    type="button"
                    className={`level-chip is-${s} ${m.isBoss ? "is-boss" : ""}`}
                    aria-current={m.level === current.level ? "true" : undefined}
                    aria-label={`Xem bản đồ Ải ${m.level}: ${m.title}${m.isBoss ? " (Trùm)" : ""} — ${STATUS_TEXT[s]}`}
                    title={`Ải ${m.level}: ${m.title}`}
                    onClick={() => go(m.level)}
                  >
                    {m.level}
                  </button>
                );
              })}
            </nav>
          </div>
          <button
            type="button"
            className="map-arrow map-arrow-next"
            onClick={() => step(1)}
            disabled={current.level === lastLevel}
            aria-label="Bản đồ ải sau"
          >
            ▶
          </button>
        </section>
      )}

      {toast && (
        <p className="map-toast" role="status">
          {toast}
        </p>
      )}

      {guideOpen && chapter && (
        <ChapterGuide
          chapter={chapter}
          heroName={heroInfo.name}
          completedCount={done}
          currentLevel={current?.level ?? 0}
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
