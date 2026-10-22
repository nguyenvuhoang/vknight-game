"use client";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { HEROES } from "@/lib/heroes";
import { getCharacterProfile } from "@/lib/character-profiles";
import CharacterPortrait from "./CharacterPortrait";
import CharacterStats from "./CharacterStats";
import CharacterAbility from "./CharacterAbility";

export interface CharacterProfileModalProps {
  heroId: string | null;
  selectedHeroId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (heroId: string) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CharacterProfileModal({
  heroId,
  selectedHeroId,
  isOpen,
  onClose,
  onSelect,
}: CharacterProfileModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const hero = HEROES.find((h) => h.id === heroId);
  const profile = getCharacterProfile(heroId);
  const visible = isOpen && !!hero && !!profile;

  // Scroll lock, Escape, focus trap and focus restoration.
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [visible]);

  if (!visible || !hero || !profile) return null;

  const isSelected = hero.id === selectedHeroId;
  const accent = { "--cp-accent": hero.tint } as CSSProperties;

  return (
    <div
      className="cp-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        style={accent}
      >
        <button
          ref={closeRef}
          type="button"
          className="cp-close"
          onClick={onClose}
          aria-label="Đóng hồ sơ nhân vật"
        >
          ✕
        </button>

        <div className="cp-body">
          <CharacterPortrait hero={hero} profile={profile} isSelected={isSelected} />

          <div className="cp-info">
            <dl className="cp-facts">
              <div>
                <dt>Tên</dt>
                <dd>{profile.name}</dd>
              </div>
              <div>
                <dt>Biệt danh</dt>
                <dd>{profile.nickname}</dd>
              </div>
              <div>
                <dt>Lớp nhân vật</dt>
                <dd>{profile.title}</dd>
              </div>
            </dl>

            <section className="cp-section">
              <h3>Tính cách</h3>
              <p>{profile.personality}</p>
            </section>

            <section className="cp-section">
              <h3>Tiểu sử</h3>
              <p>{profile.backstory}</p>
            </section>

            <section className="cp-section">
              <h3>Kỹ năng đặc biệt</h3>
              <CharacterAbility ability={profile.specialAbility} />
            </section>

            <div className="cp-columns">
              <section className="cp-section">
                <h3>Điểm mạnh</h3>
                <ul className="cp-list cp-good">
                  {profile.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
              <section className="cp-section">
                <h3>Điểm yếu</h3>
                <ul className="cp-list cp-bad">
                  {profile.weaknesses.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            </div>

            <blockquote className="cp-quote">“{profile.funnyQuote}”</blockquote>

            <section className="cp-section">
              <h3>Chỉ số</h3>
              <CharacterStats stats={profile.stats} />
            </section>
          </div>
        </div>

        <div className="cp-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onSelect(hero.id)}
          >
            {isSelected ? "✔ Vẫn chọn nhân vật này" : "Chọn nhân vật này"}
          </button>
        </div>
      </div>
    </div>
  );
}
