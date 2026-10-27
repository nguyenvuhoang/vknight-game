import type { CharacterAbility } from "@/lib/api/character-types";
import { LockGlyph } from "./Ornaments";

type Props = {
  /** The real context action (talk / pick up / use gate), bound to E and 1. */
  interactLabel: string | null;
  onInteract: () => void;
  /** The hero's abilities from the Character Profile (display only here). */
  abilities: CharacterAbility[];
  onLockedSkill: (ability: CharacterAbility) => void;
  slots?: number;
};

const ABILITY_ICON: Record<string, string> = {
  SLASH: "⚔️",
  ANALYZE: "🔍",
  NEGOTIATE: "🤝",
  SMASH: "👊",
  TRICK: "🎭",
};

/**
 * Slot 1 is the working interact action. Hero abilities are shown with their
 * real stats but locked: puzzle stages have no ability system yet, so nothing
 * here pretends to cast. Remaining slots are empty and locked.
 */
export default function FantasySkillBar({ interactLabel, onInteract, abilities, onLockedSkill, slots = 6 }: Props) {
  const filler = Math.max(0, slots - 1 - abilities.length);
  return (
    <div className="fh-frame fh-skills" role="toolbar" aria-label="Thanh kỹ năng">
      <button
        type="button"
        className={`fh-skill is-interact ${interactLabel ? "is-ready" : ""}`}
        onClick={onInteract}
        disabled={!interactLabel}
        title={interactLabel ? `${interactLabel} (E / 1)` : "Tương tác (E / 1) — lại gần người hoặc đồ vật"}
        aria-label={interactLabel ? `Tương tác: ${interactLabel}` : "Tương tác (chưa có gì ở gần)"}
      >
        <span className="fh-skill-icon" aria-hidden>
          🖐
        </span>
        <kbd className="fh-skill-key">1</kbd>
      </button>
      {abilities.map((a, i) => (
        <button
          key={a.code}
          type="button"
          className="fh-skill is-locked"
          aria-disabled="true"
          onClick={() => onLockedSkill(a)}
          title={`${a.name}${a.cooldown ? ` · hồi chiêu ${a.cooldown}s` : ""}${a.energyCost ? ` · ${a.energyCost} năng lượng` : ""} — chưa dùng được trong ải giải đố`}
          aria-label={`${a.name} (chưa dùng được trong ải này)`}
        >
          <span className="fh-skill-icon" aria-hidden>
            {ABILITY_ICON[a.code] ?? "✨"}
          </span>
          <span className="fh-skill-lock" aria-hidden>
            <LockGlyph />
          </span>
          <kbd className="fh-skill-key">{i + 2}</kbd>
        </button>
      ))}
      {Array.from({ length: filler }, (_, i) => (
        <span key={i} className="fh-skill is-empty" aria-hidden>
          <span className="fh-skill-lock">
            <LockGlyph />
          </span>
          <kbd className="fh-skill-key">{abilities.length + i + 2}</kbd>
        </span>
      ))}
    </div>
  );
}
