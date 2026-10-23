"use client";
import { useState } from "react";
import Image from "next/image";
import type { Chapter1Level } from "@/lib/chapter1";

type LoadState = "loading" | "ready" | "error";

// One level's artwork, shown whole (object-fit: contain) over a blurred copy of
// itself so the margins never look empty. Keyed by level in the parent, so
// switching levels remounts it and replays the fade-in.
export default function LevelScene({ level }: { level: Chapter1Level }) {
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  const sizes = "100vw";

  return (
    <div className={`scene-view is-${state}`} aria-busy={state === "loading"}>
      {/* Full-screen blurred copy; same src/sizes as the art, so the browser
          reuses the download. */}
      {state !== "error" && (
        <Image
          key={`bg-${attempt}`}
          className="scene-backdrop"
          src={level.image}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
        />
      )}

      {/* The art box sits between the HUD and the dock (see .scene-frame). */}
      <div className="scene-frame">
        {state !== "error" && (
          <Image
            key={`fg-${attempt}`}
            className="scene-art"
            src={level.image}
            alt={`Bản đồ Ải ${level.level}: ${level.title}`}
            fill
            sizes={sizes}
            preload
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
          />
        )}

        {state === "loading" && (
          <p className="scene-status" role="status">
            <span className="scene-spinner" aria-hidden />
            Đang mở bản đồ Ải {level.level}…
          </p>
        )}

        {state === "error" && (
          <div className="scene-status scene-error" role="alert">
            <span aria-hidden>🗺️💨</span>
            <strong>Không tải được bản đồ Ải {level.level}</strong>
            <span>Tấm bản đồ này đã bị gió cuốn đi mất. Bạn vẫn có thể chơi ải nếu đã mở khóa.</span>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setState("loading");
                setAttempt((a) => a + 1);
              }}
            >
              ↻ Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
