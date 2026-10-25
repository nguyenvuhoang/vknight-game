"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { FrontendChapterMap, FrontendGameChapter } from "@/lib/api/chapter-types";
import { STATUS_ICON, STATUS_TEXT, levelStatus } from "@/lib/chapter1";
import LevelMeta from "./LevelMeta";

type Props = {
  chapter: FrontendGameChapter;
  heroName: string;
  completedCount: number;
  currentLevel: number;
  onClose: () => void;
  onPreview: (level: number) => void;
  onPlay: (level: number) => void;
};

function Thumb({ level }: { level: FrontendChapterMap }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="guide-thumb">
      {failed ? (
        <span className="guide-thumb-missing" aria-hidden>
          🗺️
        </span>
      ) : (
        <Image src={level.image} alt="" fill sizes="96px" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

// "📜 Cốt truyện & Danh sách ải": chapter intro + every level of the chapter.
export default function ChapterGuide({
  chapter,
  heroName,
  completedCount,
  currentLevel,
  onClose,
  onPreview,
  onPlay,
}: Props) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const currentCard = useRef<HTMLLIElement>(null);

  // On open: focus the close button and bring the level being viewed into view.
  // (Scrolls only the list's own scroller - scrollIntoView would also shift
  // the dialog itself.)
  useEffect(() => {
    closeBtn.current?.focus();
    const card = currentCard.current;
    const list = card?.parentElement;
    if (!card || !list) return;
    const scroller =
      getComputedStyle(list).overflowY === "auto" ? list : list.closest<HTMLElement>(".guide-modal");
    if (!scroller) return;
    const c = card.getBoundingClientRect(), s = scroller.getBoundingClientRect();
    scroller.scrollTop += c.top - s.top - (scroller.clientHeight - c.height) / 2;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <section
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeBtn} type="button" className="cp-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="guide-intro">
          <p className="guide-kicker">📜 Cốt truyện</p>
          <h2 id="guide-title">{chapter.title}</h2>
          {chapter.subtitle && <p className="guide-subtitle">{chapter.subtitle}</p>}
          {/* Backend story; Chapter 1 falls back to the bundled story while the backend returns []. */}
          {(chapter.story.length ? chapter.story : chapter.description ? [chapter.description] : []).map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="guide-hero">
            <strong>{heroName}</strong>
            <span>
              Đã hoàn thành {chapter.maps.filter((m) => levelStatus(m.level, completedCount) === "COMPLETED").length}/
              {chapter.maps.length} ải
            </span>
          </p>
        </div>

        <div className="guide-levels">
          <h3>Danh sách ải</h3>
          <ol>
            {chapter.maps.map((l) => {
              const s = levelStatus(l.level, completedCount);
              const isCurrent = l.level === currentLevel;
              return (
                <li
                  key={l.level}
                  ref={isCurrent ? currentCard : undefined}
                  className={`guide-card is-${s} ${isCurrent ? "is-current" : ""} ${l.isBoss ? "is-boss" : ""}`}
                >
                  <Thumb level={l} />
                  <div className="guide-card-body">
                    <p className="guide-card-head">
                      <span className="guide-num">Ải {l.level}</span>
                      <span className={`status-pill is-${s}`}>
                        {STATUS_ICON[s]} {STATUS_TEXT[s]}
                      </span>
                      {isCurrent && <span className="guide-viewing">Đang xem</span>}
                    </p>
                    <h4>
                      {l.isBoss && <span aria-hidden>👑 </span>}
                      {l.title}
                    </h4>
                    <p className="guide-card-desc">{l.description}</p>
                    <LevelMeta map={l} />
                    {l.guideText && <p className="guide-card-note">🧭 {l.guideText}</p>}
                    {s === "COMPLETED" && l.completionText && (
                      <p className="guide-card-note is-done">🏁 {l.completionText}</p>
                    )}
                    {s !== "LOCKED" && l.hintText && (
                      <details className="guide-hint">
                        <summary>💡 Xem gợi ý</summary>
                        <p>{l.hintText}</p>
                      </details>
                    )}
                    <div className="guide-card-actions">
                      <button type="button" className="secondary" onClick={() => onPreview(l.level)}>
                        🗺 Xem bản đồ
                      </button>
                      {s !== "LOCKED" && (
                        <button type="button" className="primary" onClick={() => onPlay(l.level)}>
                          {s === "COMPLETED" ? "↻ Chơi lại" : "▶ Chơi ngay"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
