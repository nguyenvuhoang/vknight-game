import type { ReactNode } from "react";
import type { ChoiceView } from "@/lib/gameplay/dialogue-engine";

type Props = {
  speaker: string;
  portrait: ReactNode;
  text: string;
  choices: ChoiceView[];
  /** Shown when there are no choices: "▶ Tiếp" (has next) or "✔ Xong" (ending). */
  hasNext: boolean;
  onChoose: (choiceId: string) => void;
  onContinue: () => void;
};

/** Parchment speech panel; conditional choices stay visible but disabled with their reason. */
export default function DialoguePanel({ speaker, portrait, text, choices, hasNext, onChoose, onContinue }: Props) {
  const firstEnabled = choices.findIndex((c) => c.enabled);
  return (
    <div className="adv-dialog gp-dialog" role="dialog" aria-label={`Hội thoại với ${speaker}`} aria-live="polite">
      <span className="adv-dialog-portrait">{portrait}</span>
      <div className="adv-dialog-body">
        <strong>{speaker}</strong>
        <p>{text}</p>
      </div>
      {choices.length ? (
        <div className="adv-choices gp-choices">
          {choices.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="secondary gp-choice"
              disabled={!c.enabled}
              onClick={() => onChoose(c.id)}
              autoFocus={i === firstEnabled}
              title={c.reason ?? undefined}
            >
              {c.text}
              {c.reason && <small className="gp-choice-lock">🔒 {c.reason}</small>}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="primary adv-next" onClick={onContinue} autoFocus>
          {hasNext ? "▶ Tiếp" : "✔ Xong"}
        </button>
      )}
    </div>
  );
}
