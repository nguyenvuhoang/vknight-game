"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import type { HudArt, StageScene } from "@/lib/gameplay/stage-scenes";
import type { Point } from "@/lib/scene/use-scene-walker";

export type MiniMarker = {
  id: string;
  kind: "npc" | "item" | "exit-locked" | "exit-open";
  x: number;
  y: number;
  label: string;
  /** An active objective waits on this NPC. */
  quest?: boolean;
};

type Props = {
  title: string;
  scene: StageScene;
  /** Live hero position in world % (read each frame, never written). */
  posRef: RefObject<Point>;
  markers: MiniMarker[];
  /** Optional marker art; positions and states still come from `markers`. */
  icons?: HudArt["markers"];
};

const iconFor = (m: MiniMarker, icons: HudArt["markers"]) =>
  m.kind === "npc" ? (m.quest ? icons.quest : icons.talk) : m.kind === "item" ? icons.item : icons.exit;

const ZOOMS = [1, 1.6, 2.4];

/**
 * The stage world in miniature, in the same % coordinates as the scene.
 * Zoom follows the hero; markers come from the current gameplay state.
 */
export default function MiniMap({ title, scene, posRef, markers, icons }: Props) {
  const [zi, setZi] = useState(0);
  const viewRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLSpanElement>(null);
  const zoom = ZOOMS[zi];
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = posRef.current, view = viewRef.current, inner = innerRef.current, hero = heroRef.current;
      if (p && view && inner && hero) {
        const z = zoomRef.current, vw = view.clientWidth, vh = view.clientHeight;
        hero.style.left = `${p.x}%`;
        hero.style.top = `${p.y}%`;
        const tx = Math.min(0, Math.max(vw - vw * z, vw / 2 - (p.x / 100) * vw * z));
        const ty = Math.min(0, Math.max(vh - vh * z, vh / 2 - (p.y / 100) * vh * z));
        inner.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${z})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posRef]);

  return (
    <section className="fh-frame fh-minimap" aria-label="Bản đồ nhỏ">
      <header className="fh-minimap-head">
        <span aria-hidden>🗺</span>
        <strong>{title}</strong>
      </header>
      <div className="fh-minimap-body">
        <div ref={viewRef} className="fh-minimap-view" style={{ aspectRatio: `${scene.crop.w} / ${scene.crop.h}` }}>
          <div ref={innerRef} className="fh-minimap-inner" style={{ "--z": zoom } as React.CSSProperties}>
            <Image
              src={scene.src}
              alt=""
              width={scene.width}
              height={scene.height}
              sizes="240px"
              draggable={false}
              style={{
                left: `${(-scene.crop.x / scene.crop.w) * 100}%`,
                top: `${(-scene.crop.y / scene.crop.h) * 100}%`,
                width: `${(scene.width / scene.crop.w) * 100}%`,
              }}
            />
            {markers.map((m) => (
              <span key={m.id} className={`fh-mark is-${m.kind} ${icons ? "has-icon" : ""}`} style={{ left: `${m.x}%`, top: `${m.y}%` }} title={m.label}>
                {icons && <img src={iconFor(m, icons)} alt="" draggable={false} />}
              </span>
            ))}
            <span ref={heroRef} className="fh-mark is-hero" title="Bạn" />
          </div>
        </div>
        <div className="fh-minimap-zoom">
          <button type="button" onClick={() => setZi((i) => Math.min(ZOOMS.length - 1, i + 1))} disabled={zi === ZOOMS.length - 1} aria-label="Phóng to bản đồ nhỏ">
            +
          </button>
          <button type="button" onClick={() => setZi((i) => Math.max(0, i - 1))} disabled={zi === 0} aria-label="Thu nhỏ bản đồ nhỏ">
            −
          </button>
        </div>
      </div>
      <ul className="sr-only">
        {markers.map((m) => (
          <li key={m.id}>{m.label}</li>
        ))}
      </ul>
    </section>
  );
}
