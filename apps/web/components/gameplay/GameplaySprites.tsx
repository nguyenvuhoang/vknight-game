// Visuals for backend NPCs/items. The backend image is used when it exists in
// /public (checked by the BFF); otherwise a local fallback drawn in the game's
// cartoon style, keyed by sprite_key. Unknown keys get a labelled placeholder —
// never a broken <img>.
import { Dog } from "@/components/adventure/Sprites";

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

/** Aspect ratio (w/h) of each fallback so the box hugs the drawing. */
const FALLBACK: Record<string, { aspect: number; render: (state: string) => React.ReactNode }> = {
  npc_dog_teaser: { aspect: 120 / 80, render: (state) => <Dog awake bone={state === "FED"} /> },
  item_dog_bone: { aspect: 80 / 36, render: () => <Bone /> },
  item_sandal_left: { aspect: 60 / 40, render: () => <Sandal /> },
  item_sandal_right: { aspect: 60 / 40, render: () => <Sandal right /> },
};

type Props = {
  name: string;
  imageUrl: string | null;
  imageAvailable: boolean;
  spriteKey: string | null;
  /** Runtime state for fallbacks that change (e.g. the dog after being fed). */
  state?: string;
};

export function spriteAspect(p: Pick<Props, "imageAvailable" | "spriteKey">) {
  if (p.imageAvailable) return undefined; // the <img> keeps its own ratio
  return (p.spriteKey && FALLBACK[p.spriteKey]?.aspect) || 1;
}

export default function GameplaySprite({ name, imageUrl, imageAvailable, spriteKey, state = "IDLE" }: Props) {
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
