"use client";
import { useEffect, useRef, useState } from "react";
import InventoryPanel from "../InventoryPanel";
import type { CharacterAbility } from "@/lib/api/character-types";
import type { GameplayItem, GameplayState } from "@/lib/gameplay/gameplay-types";
import type { Hero } from "@/lib/types";

type Panel = "bag" | "skills" | "helper" | "menu";

type Props = {
  hero: Hero;
  items: GameplayItem[];
  state: GameplayState;
  abilities: CharacterAbility[];
  abilitiesState: "loading" | "ready" | "error";
  questOpen: boolean;
  onToggleQuest: () => void;
  onOpenProfile: () => void;
  guideText: string | null;
  hintText: string | null;
  onMap: () => void;
  /** Close any open panel when the game needs the screen (dialogue, win). */
  suspended: boolean;
};

/** Round menu buttons; each opens a real panel or toggles a real HUD part. */
export default function FantasyGameMenu(p: Props) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [showHint, setShowHint] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const owned = Object.values(p.state.inventory).filter((q) => q > 0).length;
  const toggle = (x: Panel) => setPanel((cur) => (cur === x ? null : x));
  const open = p.suspended ? null : panel;

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    const click = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", click);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", click);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fh-menu">
      {open && (
        <div className="fh-frame fh-pop" role="dialog" aria-label={POP_TITLE[open]}>
          <header className="fh-pop-head">
            <strong>{POP_TITLE[open]}</strong>
            <button type="button" className="fh-pop-close" onClick={() => setPanel(null)} aria-label="Đóng">
              ✕
            </button>
          </header>
          <div className="fh-parch fh-pop-body">
            {open === "bag" && (
              <>
                <InventoryPanel items={p.items} state={p.state} slots={6} />
                {owned === 0 && <p className="fh-pop-note">Túi đồ trống. Nhặt manh mối trong ải để cất vào đây.</p>}
              </>
            )}
            {open === "skills" && (
              <>
                {p.abilitiesState === "loading" && <p className="fh-pop-note">Đang tải kỹ năng…</p>}
                {p.abilitiesState === "error" && <p className="fh-pop-note">Không tải được hồ sơ kỹ năng.</p>}
                <ul className="fh-ability-list">
                  {p.abilities.map((a) => (
                    <li key={a.code}>
                      <strong>
                        {a.name} {a.isSpecial && <em>· tuyệt kỹ</em>}
                      </strong>
                      <p>{a.description}</p>
                      <small>
                        {[a.power != null && `Sức mạnh ${a.power}`, a.cooldown != null && `Hồi chiêu ${a.cooldown}s`, a.energyCost != null && `Tốn ${a.energyCost} năng lượng`]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </li>
                  ))}
                </ul>
                <p className="fh-pop-note">Ải giải đố này chưa dùng kỹ năng chiến đấu.</p>
              </>
            )}
            {open === "helper" && (
              <>
                <p className="fh-pop-note">🦉 Trợ lý AI chưa được kết nối. Dưới đây là hướng dẫn chính thức của ải:</p>
                {p.guideText ? <p className="fh-guide">{p.guideText}</p> : <p className="fh-pop-note">Ải này chưa có hướng dẫn.</p>}
                {p.hintText &&
                  (showHint ? (
                    <p className="fh-guide is-hint">💡 {p.hintText}</p>
                  ) : (
                    <button type="button" className="fh-btn" onClick={() => setShowHint(true)}>
                      💡 Xem gợi ý (lộ đáp án)
                    </button>
                  ))}
              </>
            )}
            {open === "menu" && (
              <>
                <button type="button" className="fh-btn" onClick={p.onMap}>
                  🗺 Về bản đồ
                </button>
                <dl className="fh-keys">
                  <dt>WASD / ← ↑ → ↓</dt>
                  <dd>Di chuyển (hoặc bấm vào mặt đất)</dd>
                  <dt>E hoặc 1</dt>
                  <dd>Tương tác</dd>
                  <dt>Esc</dt>
                  <dd>Đóng hội thoại / bảng</dd>
                </dl>
              </>
            )}
          </div>
        </div>
      )}

      <nav className="fh-menu-row" aria-label="Menu trò chơi">
        <button type="button" className="fh-orb" onClick={p.onOpenProfile}>
          <span className="fh-orb-face is-hero" aria-hidden>
            <img src={p.hero.asset} alt="" draggable={false} />
          </span>
          <span className="fh-orb-label">Nhân vật</span>
        </button>
        <button type="button" className={`fh-orb ${open === "bag" ? "is-on" : ""}`} onClick={() => toggle("bag")} aria-expanded={open === "bag"}>
          <span className="fh-orb-face" aria-hidden>
            🎒
          </span>
          {owned > 0 && <span className="fh-orb-badge">{owned}</span>}
          <span className="fh-orb-label">Túi đồ</span>
        </button>
        <button type="button" className={`fh-orb ${open === "skills" ? "is-on" : ""}`} onClick={() => toggle("skills")} aria-expanded={open === "skills"}>
          <span className="fh-orb-face" aria-hidden>
            📖
          </span>
          <span className="fh-orb-label">Kỹ năng</span>
        </button>
        <button type="button" className={`fh-orb ${p.questOpen ? "is-on" : ""}`} onClick={p.onToggleQuest} aria-expanded={p.questOpen} aria-controls="gp-quest">
          <span className="fh-orb-face" aria-hidden>
            📜
          </span>
          <span className="fh-orb-label">Nhiệm vụ</span>
        </button>
        <button type="button" className={`fh-orb ${open === "helper" ? "is-on" : ""}`} onClick={() => toggle("helper")} aria-expanded={open === "helper"}>
          <span className="fh-orb-face" aria-hidden>
            🦉
          </span>
          <span className="fh-orb-label">Trợ lý AI</span>
        </button>
        <button type="button" className={`fh-orb ${open === "menu" ? "is-on" : ""}`} onClick={() => toggle("menu")} aria-expanded={open === "menu"}>
          <span className="fh-orb-face" aria-hidden>
            ☰
          </span>
          <span className="fh-orb-label">Menu</span>
        </button>
      </nav>
    </div>
  );
}

const POP_TITLE: Record<Panel, string> = {
  bag: "Túi đồ",
  skills: "Kỹ năng",
  helper: "Trợ lý",
  menu: "Menu",
};
