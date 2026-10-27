import { objectiveProgress, objectiveStatus } from "@/lib/gameplay/objective-engine";
import type { GameplayObjective, GameplayState } from "@/lib/gameplay/gameplay-types";

const ICON = { COMPLETED: "✔", ACTIVE: "▶", LOCKED: "🔒" } as const;

/** Objectives in display order with status and progress (e.g. 1/2 sandals). */
export default function ObjectiveTracker({ objectives, state }: { objectives: GameplayObjective[]; state: GameplayState }) {
  return (
    <ol className="gp-objectives">
      {objectives.map((o) => {
        const status = objectiveStatus(o, state);
        const p = objectiveProgress(o, state);
        return (
          <li key={o.code} className={`gp-objective is-${status}`}>
            <span className="gp-objective-icon" aria-hidden>
              {ICON[status]}
            </span>
            <span className="gp-objective-text">
              <strong>
                {o.title}
                {status !== "LOCKED" && p.total > 1 && (
                  <span className="gp-objective-count">
                    {" "}
                    ({p.done}/{p.total})
                  </span>
                )}
                {!o.required && <em> (phụ)</em>}
              </strong>
              {status === "ACTIVE" && o.description && <small>{o.description}</small>}
            </span>
            <span className="sr-only">
              {status === "COMPLETED" ? "Đã xong" : status === "ACTIVE" ? "Đang làm" : "Chưa mở"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
