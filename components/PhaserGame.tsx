"use client";
import { useEffect, useRef, useState } from "react";
import type { Level, HeroId, GameNotice } from "@/lib/types";
import { createAdventure } from "@/lib/game/createAdventure";
type Props = { hero: HeroId; level: Level; onNotice: (v: GameNotice) => void };
export default function PhaserGame({ hero, level, onNotice }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<import("phaser").Game | null>(null);
  const actions = useRef<{
    left: boolean;
    right: boolean;
    jump: boolean;
    interact: boolean;
    ability: boolean;
  }>({
    left: false,
    right: false,
    jump: false,
    interact: false,
    ability: false,
  });
  const callback = useRef(onNotice);
  callback.current = onNotice;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const instance = await createAdventure({
        host: host.current!,
        hero,
        level,
        controls: actions.current,
        onNotice: (v) => callback.current(v),
      });
      if (cancelled) {
        instance.destroy(true);
        return;
      }
      game.current = instance;
      setReady(true);
    })().catch(console.error);
    return () => {
      cancelled = true;
      game.current?.destroy(true);
      game.current = null;
    };
  }, [hero, level]);
  const setAction = (a: keyof typeof actions.current, value: boolean) => {
    actions.current[a] = value;
  };
  const bind = (a: keyof typeof actions.current) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setAction(a, true);
    },
    onPointerUp: () => setAction(a, false),
    onPointerCancel: () => setAction(a, false),
    onLostPointerCapture: () => setAction(a, false),
  });
  return (
    <>
      <div className="game-wrap" ref={host}>
        {!ready && <span>Đang tải game...</span>}
      </div>
      <div className="controls">
        <div>
          <button className="secondary" {...bind("left")}>
            ◀
          </button>{" "}
          <button className="secondary" {...bind("right")}>
            ▶
          </button>
        </div>
        <div>
          <button className="secondary" {...bind("interact")}>
            Nói (E)
          </button>{" "}
          <button className="secondary" {...bind("ability")}>
            Chiêu (F)
          </button>{" "}
          <button className="primary" {...bind("jump")}>
            Nhảy ↑
          </button>
        </div>
      </div>
    </>
  );
}
