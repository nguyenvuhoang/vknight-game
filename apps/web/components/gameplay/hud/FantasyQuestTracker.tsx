import { evaluate } from "@/lib/gameplay/condition-evaluator";
import { objectiveProgress, objectiveStatus } from "@/lib/gameplay/objective-engine";
import type { Condition, GameplayItem, GameplayObjective, GameplayState } from "@/lib/gameplay/gameplay-types";
import { ScrollIcon, StatusBadge, SubCheck } from "./Ornaments";

type Props = {
  objectives: GameplayObjective[];
  items: GameplayItem[];
  state: GameplayState;
  open: boolean;
  onToggle: () => void;
  /** Item code -> its puzzle is solved on the server (only items guarded by a puzzle). */
  puzzleSteps?: Map<string, boolean>;
};

/** Item checklist for "collect all of these" objectives (ALL of ITEM_COLLECTED). */
function itemSteps(cond: Condition | null): Extract<Condition, { type: "ITEM_COLLECTED" }>[] {
  if (!cond) return [];
  if (cond.type === "ITEM_COLLECTED") return [cond];
  if (cond.type === "ALL" && cond.conditions.length > 1 && cond.conditions.every((c) => c.type === "ITEM_COLLECTED")) {
    return cond.conditions as Extract<Condition, { type: "ITEM_COLLECTED" }>[];
  }
  return [];
}

const STATUS_TEXT = { COMPLETED: "Đã xong", ACTIVE: "Đang làm", LOCKED: "Chưa mở" } as const;

export default function FantasyQuestTracker({ objectives, items, state, open, onToggle, puzzleSteps }: Props) {
  const done = objectives.filter((o) => objectiveStatus(o, state) === "COMPLETED").length;
  return (
    <aside id="gp-quest" className={`fh-quest ${open ? "is-open" : ""}`} aria-label="Nhiệm vụ">
      <button type="button" className="fh-frame fh-quest-head" onClick={onToggle} aria-expanded={open} aria-controls="fh-quest-list">
        <ScrollIcon size={22} />
        <strong>Nhiệm vụ</strong>
        <span className="fh-quest-count">
          {done}/{objectives.length}
        </span>
        <span className="fh-chevron" aria-hidden>
          ▲
        </span>
      </button>
      {open && (
        <ol id="fh-quest-list" className="fh-parch fh-quest-list">
          {objectives.map((o) => {
            const status = objectiveStatus(o, state);
            const p = objectiveProgress(o, state);
            const steps = status === "ACTIVE" ? itemSteps(o.completionCondition) : [];
            return (
              <li key={o.code} className={`fh-q is-${status}`}>
                <StatusBadge status={status} />
                <div className="fh-q-text">
                  <strong>
                    {o.title}
                    {status !== "LOCKED" && p.total > 1 && (
                      <span className="fh-q-count">
                        {" "}
                        ({p.done}/{p.total})
                      </span>
                    )}
                    {!o.required && <em> (phụ)</em>}
                  </strong>
                  {status === "ACTIVE" && o.description && steps.length === 0 && <small>{o.description}</small>}
                  {steps.length > 0 && (
                    <ul className="fh-q-steps">
                      {steps.map((c) => {
                        const ok = evaluate(c, state);
                        const solved = puzzleSteps?.get(c.item_code);
                        return (
                          <li key={c.item_code} className={ok ? "is-done" : ""}>
                            <SubCheck done={ok} />
                            {items.find((i) => i.code === c.item_code)?.name ?? c.item_code}
                            {!ok && solved !== undefined && (
                              <span className={`fh-q-puzzle ${solved ? "is-solved" : ""}`}>{solved ? "🧩 đã giải — nhặt" : "🧩 giải đố"}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <span className="sr-only">{STATUS_TEXT[status]}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
