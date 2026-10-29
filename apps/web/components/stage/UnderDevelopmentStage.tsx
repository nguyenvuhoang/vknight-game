"use client";
// Shown for an unlocked stage whose content is not READY (lib/stage-availability).
// No gameplay, no controls and no progress: the stage is never marked complete here.
import { Baloo_2 } from "next/font/google";
import "./under-development.css";

const font = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "700", "800"], variable: "--udev-font", display: "swap" });

type Props = {
  level: number;
  total: number;
  /** Official title from the Chapter Map metadata. */
  title: string | null;
  description: string | null;
  image: string | null;
  note: string;
  onMap: () => void;
  onHome: () => void;
};

export default function UnderDevelopmentStage({ level, total, title, description, image, note, onMap, onHome }: Props) {
  return (
    <section className={`udev ${font.variable}`} aria-labelledby="udev-title" data-stage-status="IN_DEVELOPMENT">
      {image && <div className="udev-backdrop" style={{ backgroundImage: `url("${image}")` }} aria-hidden />}
      <div className="udev-card">
        <div className="udev-banner" aria-hidden>
          🚧 Công trường Làng Ngáo
        </div>
        <div className="udev-art" aria-hidden>
          {image && <img src={image} alt="" />}
          <span className="udev-sign">
            ĐANG
            <br />
            THI CÔNG
          </span>
          <span className="udev-prop udev-prop-l">🌾</span>
          <span className="udev-prop udev-prop-m">🔨</span>
          <span className="udev-prop udev-prop-r">🌾</span>
        </div>
        <div className="udev-parch">
          <h1 id="udev-title">Ải đang được nhào nặn!</h1>
          <p className="udev-stage">
            Ải {level}
            {title ? ` — ${title}` : ""}
            <span className="udev-count">
              {" "}
              · {level}/{total}
            </span>
          </p>
          {description && <p className="udev-desc">“{description}”</p>}
          <p className="udev-note">{note}</p>
        </div>
        <div className="udev-actions">
          <button type="button" className="udev-btn is-gold" onClick={onMap} autoFocus>
            🗺 Về bản đồ chương
          </button>
          <button type="button" className="udev-btn" onClick={onHome}>
            🏠 Về trang chủ
          </button>
        </div>
      </div>
    </section>
  );
}
