// Visuals for backend NPCs/items. The backend image is used when it exists in
// /public (checked by the BFF); otherwise a local fallback drawn in the game's
// cartoon style, keyed by sprite_key. Unknown keys get a labelled placeholder —
// never a broken <img>.
import { Dog } from "@/components/adventure/Sprites";
import type { GateLeavesArt, SpriteFrame } from "@/lib/gameplay/stage-scenes";

const INK = "#222";

function Bone() {
  return (
    <svg viewBox="0 0 80 36" className="sprite-svg" aria-hidden>
      <g fill="#fff4d6" stroke={INK} strokeWidth="3">
        <rect x="12" y="12" width="56" height="12" rx="6" />
        <circle cx="12" cy="11" r="8" />
        <circle cx="12" cy="25" r="8" />
        <circle cx="68" cy="11" r="8" />
        <circle cx="68" cy="25" r="8" />
      </g>
      <rect x="14" y="14" width="52" height="5" rx="2.5" fill="#fff" opacity=".7" />
    </svg>
  );
}

function Sandal({ right }: { right?: boolean }) {
  return (
    <svg viewBox="0 0 60 40" className="sprite-svg" style={right ? { transform: "scaleX(-1)" } : undefined} aria-hidden>
      <path d="M6 30 Q4 14 18 10 L44 8 Q58 9 56 22 Q55 32 40 33 L14 35 Q7 35 6 30 Z" fill="#c45a2b" stroke={INK} strokeWidth="3" />
      <path d="M10 28 Q9 17 20 14 L43 13 Q51 14 50 22 Q49 28 39 29 L16 30 Q11 30 10 28 Z" fill="#e8925e" />
      <path d="M24 13 Q30 28 40 12" fill="none" stroke="#3f7d34" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function WoodSign() {
  return (
    <svg viewBox="0 0 60 60" className="sprite-svg" aria-hidden>
      <path d="M28 30 V58" stroke="#6d4c2f" strokeWidth="6" strokeLinecap="round" />
      <path d="M28 30 V58" stroke={INK} strokeWidth="2" fill="none" opacity=".35" />
      <rect x="6" y="6" width="48" height="28" rx="4" fill="#b0763c" stroke={INK} strokeWidth="3" transform="rotate(-6 30 20)" />
      <path d="M13 15 H44 M13 22 H38 M13 28 H42" stroke="#fff4d6" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-6 30 20)" />
    </svg>
  );
}

function TornNote() {
  return (
    <svg viewBox="0 0 56 44" className="sprite-svg" aria-hidden>
      <path d="M6 8 L48 4 L50 20 L44 24 L51 30 L48 40 L10 42 L12 32 L5 26 L9 18 Z" fill="#fff4d6" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 14 H40 M14 21 H34 M16 28 H40 M16 35 H30" stroke="#8b8170" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function OldBell() {
  return (
    <svg viewBox="0 0 50 56" className="sprite-svg" aria-hidden>
      <path d="M25 3 V10" stroke={INK} strokeWidth="3" />
      <circle cx="25" cy="5" r="3.5" fill="#c89a3c" stroke={INK} strokeWidth="2" />
      <path d="M10 42 Q11 14 25 11 Q39 14 40 42 Q45 44 45 47 H5 Q5 44 10 42 Z" fill="#d9a441" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 36 Q17 20 25 17" stroke="#ffe3a3" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30 24 L34 30 M14 30 L19 33" stroke="#7a4a1f" strokeWidth="1.6" opacity=".7" />
      <circle cx="25" cy="51" r="4.5" fill="#7a4a1f" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** Exit gate (from ChapterMap.gameplay_config — no backend image). Doors swing open when unlocked. */
export function GateArt({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 100 110" className={`sprite-svg gp-gate-svg ${open ? "is-open" : ""}`} aria-hidden>
      <rect x="4" y="14" width="12" height="94" rx="3" fill="#7a4a1f" stroke={INK} strokeWidth="3" />
      <rect x="84" y="14" width="12" height="94" rx="3" fill="#7a4a1f" stroke={INK} strokeWidth="3" />
      <path d="M0 16 Q50 -4 100 16 L100 24 Q50 6 0 24 Z" fill="#b0763c" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g className="gp-gate-door gp-gate-left">
        <rect x="16" y="34" width="34" height="70" fill="#c48a4a" stroke={INK} strokeWidth="3" />
        <path d="M26 34 V104 M38 34 V104 M16 52 H50 M16 86 H50" stroke="#8a5a2b" strokeWidth="2.5" />
      </g>
      <g className="gp-gate-door gp-gate-right">
        <rect x="50" y="34" width="34" height="70" fill="#c48a4a" stroke={INK} strokeWidth="3" />
        <path d="M62 34 V104 M74 34 V104 M50 52 H84 M50 86 H84" stroke="#8a5a2b" strokeWidth="2.5" />
      </g>
      {!open && (
        <g>
          <rect x="40" y="62" width="20" height="16" rx="3" fill="#d9a441" stroke={INK} strokeWidth="2.5" />
          <path d="M44 62 V56 Q50 48 56 56 V62" fill="none" stroke={INK} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}

/**
 * Open door leaves over a gate painted into the backdrop. The doorway behind
 * them is masked so the painted closed doors never show through the gap.
 */
export function PaintedGateOpen({ art }: { art: GateLeavesArt }) {
  const leaf = (b: GateLeavesArt["left"]): React.CSSProperties => ({
    height: `${art.height}%`,
    aspectRatio: `${b.w} / ${b.h}`,
    backgroundImage: `url(${art.src})`,
    backgroundSize: `${(art.size.w / b.w) * 100}% auto`,
    backgroundPosition: `${(b.x / (art.size.w - b.w)) * 100}% ${(b.y / (art.size.h - b.h)) * 100}%`,
  });
  return (
    <span className="gp-doorway" aria-hidden>
      <span className="gp-doorway-light" />
      <span className="gp-doorway-leaf is-left" style={leaf(art.left)} />
      <span className="gp-doorway-leaf is-right" style={leaf(art.right)} />
    </span>
  );
}

/** Aspect ratio (w/h) of each fallback so the box hugs the drawing. */
const FALLBACK: Record<string, { aspect: number; render: (state: string) => React.ReactNode }> = {
  npc_dog_teaser: { aspect: 120 / 80, render: (state) => <Dog awake bone={state === "FED"} /> },
  item_dog_bone: { aspect: 80 / 36, render: () => <Bone /> },
  item_sandal_left: { aspect: 60 / 40, render: () => <Sandal /> },
  item_sandal_right: { aspect: 60 / 40, render: () => <Sandal right /> },
  npc_stage02_gate_dog: { aspect: 120 / 80, render: () => <Dog awake bone={false} /> },
  item_stage02_wood_sign: { aspect: 1, render: () => <WoodSign /> },
  item_stage02_torn_note: { aspect: 56 / 44, render: () => <TornNote /> },
  item_stage02_old_bell: { aspect: 50 / 56, render: () => <OldBell /> },
};

type Props = {
  name: string;
  imageUrl: string | null;
  imageAvailable: boolean;
  spriteKey: string | null;
  /** Runtime state for fallbacks that change (e.g. the dog after being fed). */
  state?: string;
  /** Show only this part of the backend image (scene presentation). */
  frame?: SpriteFrame;
};

export function spriteAspect(p: Pick<Props, "imageAvailable" | "spriteKey" | "frame">) {
  if (p.imageAvailable) return p.frame ? `${p.frame.crop.w} / ${p.frame.crop.h}` : undefined; // else the <img> keeps its own ratio
  return (p.spriteKey && FALLBACK[p.spriteKey]?.aspect) || 1;
}

export default function GameplaySprite({ name, imageUrl, imageAvailable, spriteKey, state = "IDLE", frame }: Props) {
  if (imageAvailable && imageUrl && frame) {
    const c = frame.crop;
    return (
      <span className="gp-sprite-frame" style={{ aspectRatio: `${c.w} / ${c.h}` }}>
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{ width: `${(frame.w / c.w) * 100}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` }}
        />
      </span>
    );
  }
  if (imageAvailable && imageUrl) {
    // Plain <img>: backend sprites are small and already sized for the game.
    return <img className="gp-sprite-img" src={imageUrl} alt="" draggable={false} />;
  }
  const fb = spriteKey ? FALLBACK[spriteKey] : undefined;
  if (fb) return <>{fb.render(state)}</>;
  return (
    <span className="gp-sprite-missing" title={`Thiếu hình: ${imageUrl ?? spriteKey ?? name}`}>
      ❓<small>{name}</small>
    </span>
  );
}
