"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getHero } from "@/lib/heroes";
import { loadChapter } from "@/lib/catalog";
import { completed } from "@/lib/progress";
import {
  CHAPTER1_SPOTS,
  MAP_H,
  MAP_SRC,
  MAP_W,
  playHref,
  stageStatus,
  type MapSpot,
  type StageStatus,
} from "@/lib/chapter1-map";
import type { Chapter, HeroId } from "@/lib/types";

const STATUS_LABEL: Record<StageStatus, string> = {
  done: "✔ Đã hoàn thành · chơi lại được",
  open: "⚔ Đang mở",
  locked: "🔒 Chưa mở khóa",
};
const ZOOMS = [1, 1.35, 1.75, 2.25];
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function ChapterMap({ hero }: { hero: HeroId }) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null);
  const keepCenter = useRef<{ fx: number; fy: number } | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [max, setMax] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [sheet, setSheet] = useState<MapSpot | null>(null);
  const [toast, setToast] = useState("");

  const total = chapter?.levels.length ?? CHAPTER1_SPOTS.length;
  const next = Math.min(max + 1, total);
  const heroInfo = getHero(hero);

  useEffect(() => {
    setMax(completed(hero));
    loadChapter().then(setChapter).catch(() => setChapter(null));
  }, [hero]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scrollToSpot = useCallback((n: number, behavior: ScrollBehavior) => {
    const sc = scroller.current, st = stage.current;
    const spot = CHAPTER1_SPOTS[n - 1];
    if (!sc || !st || !spot) return;
    const [x0, y0, x1, y1] = spot.box;
    const x = (((x0 + x1) / 2) / MAP_W) * st.offsetWidth;
    const y = (((y0 + y1) / 2) / MAP_H) * st.offsetHeight;
    sc.scrollTo({ left: x - sc.clientWidth / 2, top: y - sc.clientHeight / 2, behavior });
  }, []);

  // Open focused on Stage 1 (bottom-left of the artwork).
  useLayoutEffect(() => scrollToSpot(1, "instant"), [scrollToSpot]);

  // Zoom around the current view centre.
  useLayoutEffect(() => {
    const sc = scroller.current, st = stage.current, c = keepCenter.current;
    if (!sc || !st || !c) return;
    sc.scrollLeft = c.fx * st.offsetWidth - sc.clientWidth / 2;
    sc.scrollTop = c.fy * st.offsetHeight - sc.clientHeight / 2;
    keepCenter.current = null;
  }, [zoom]);

  const changeZoom = (d: number) => {
    const sc = scroller.current, st = stage.current;
    if (sc && st) {
      keepCenter.current = {
        fx: (sc.scrollLeft + sc.clientWidth / 2) / st.offsetWidth,
        fy: (sc.scrollTop + sc.clientHeight / 2) / st.offsetHeight,
      };
    }
    setZoom((z) => Math.min(ZOOMS.length - 1, Math.max(0, z + d)));
  };

  const play = (n: number) => router.push(playHref(hero, n));

  const activate = (spot: MapSpot) => {
    const status = stageStatus(spot.number, max);
    const precise = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Touch: open the info sheet first. Mouse/keyboard: act directly.
    if (!precise) return setSheet(spot);
    if (status === "locked") {
      setToast(`🔒 Ải ${spot.number} còn khóa — qua Ải ${max + 1} trước đã!`);
    } else {
      play(spot.number);
    }
  };

  // Mouse drag-to-pan; touch already pans natively.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !scroller.current) return;
    const sc = scroller.current;
    drag.current = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, sc = scroller.current;
    if (!d || !sc) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    sc.classList.add("dragging");
    sc.scrollLeft = d.l - dx;
    sc.scrollTop = d.t - dy;
  };
  const endDrag = () => {
    scroller.current?.classList.remove("dragging");
    // Leave `moved` readable for the click that follows this pointerup.
    setTimeout(() => (drag.current = null));
  };

  // Show the tooltip below the marker when it would slide under the top HUD.
  const flipTip = (e: React.SyntheticEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.classList.toggle("tip-below", el.getBoundingClientRect().top < 170);
  };

  const sheetStatus = sheet && stageStatus(sheet.number, max);
  const levelTitle = (n: number) => chapter?.levels.find((l) => l.number === n)?.title;

  return (
    <div className="map-screen">
      <div
        ref={scroller}
        className="map-scroller"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div
          ref={stage}
          className="map-stage"
          style={{ "--zoom": ZOOMS[zoom] } as React.CSSProperties}
        >
          <Image
            src={MAP_SRC}
            alt="Bản đồ Chapter 1: Làng Ngáo với 10 ải từ cổng làng tới lâu đài"
            width={MAP_W}
            height={MAP_H}
            sizes="(max-width: 900px) 200vw, 100vw"
            draggable={false}
            preload
          />
          {CHAPTER1_SPOTS.map((spot) => {
            const status = stageStatus(spot.number, max);
            const [x0, y0, x1, y1] = spot.box;
            return (
              <button
                key={spot.number}
                type="button"
                className={`map-spot is-${status}`}
                onMouseEnter={flipTip}
                onFocus={flipTip}
                style={{
                  left: pct(x0, MAP_W),
                  top: pct(y0, MAP_H),
                  width: pct(x1 - x0, MAP_W),
                  height: pct(y1 - y0, MAP_H),
                }}
                aria-label={`Ải ${spot.number}: ${spot.name} — ${STATUS_LABEL[status]}`}
                aria-haspopup="dialog"
                onClick={() => activate(spot)}
              >
                <span className="map-tip" aria-hidden>
                  <strong>
                    Ải {spot.number} · {spot.name}
                  </strong>
                  {levelTitle(spot.number) && <em>Màn chơi: {levelTitle(spot.number)}</em>}
                  <span>{STATUS_LABEL[status]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <header className="map-hud">
        <Link className="secondary map-home" href={`/?hero=${hero}`}>
          ← Về trang chủ
        </Link>
        <div className="map-progress">
          <strong>Chapter 1: Làng Ngáo</strong>
          <span>
            {heroInfo.name} · Đã hoàn thành {Math.min(max, total)}/{total} ải
          </span>
          <span className="map-progress-bar" aria-hidden>
            <span style={{ width: pct(Math.min(max, total), total) }} />
          </span>
        </div>
        <button type="button" className="primary" onClick={() => play(next)}>
          {max >= total ? `↻ Chơi lại Ải ${total}` : `▶ Chơi tiếp: Ải ${next}`}
        </button>
      </header>

      <div className="map-controls" role="group" aria-label="Điều khiển bản đồ">
        <button type="button" className="secondary" onClick={() => changeZoom(1)} disabled={zoom === ZOOMS.length - 1} aria-label="Phóng to">
          +
        </button>
        <button type="button" className="secondary" onClick={() => changeZoom(-1)} disabled={zoom === 0} aria-label="Thu nhỏ">
          −
        </button>
        <button type="button" className="secondary" onClick={() => scrollToSpot(1, "smooth")}>
          📍 Ải 1
        </button>
      </div>

      {toast && (
        <p className="map-toast" role="status">
          {toast}
        </p>
      )}

      {sheet && sheetStatus && (
        <div className="map-sheet-backdrop" onClick={() => setSheet(null)}>
          <section
            className="map-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Ải ${sheet.number}: ${sheet.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="cp-close" onClick={() => setSheet(null)} aria-label="Đóng">
              ✕
            </button>
            <h2>
              Ải {sheet.number} · {sheet.name}
            </h2>
            {levelTitle(sheet.number) && <p className="map-sheet-sub">Màn chơi: {levelTitle(sheet.number)}</p>}
            <p className={`map-sheet-status is-${sheetStatus}`}>{STATUS_LABEL[sheetStatus]}</p>
            {sheetStatus === "locked" ? (
              <p>Hoàn thành Ải {max + 1} để mở khóa ải này.</p>
            ) : (
              <button type="button" className="primary" autoFocus onClick={() => play(sheet.number)}>
                {sheetStatus === "done" ? "↻ Chơi lại" : "▶ Bắt đầu"}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
