import { evaluate, progress } from "./condition-evaluator";
import type { EngineResult, GameplayObjective, GameplayState } from "./gameplay-types";

export type ObjectiveStatus = "COMPLETED" | "ACTIVE" | "LOCKED";

export function objectiveStatus(o: GameplayObjective, s: GameplayState): ObjectiveStatus {
  if (s.completed.includes(o.code)) return "COMPLETED";
  return evaluate(o.unlockCondition, s) ? "ACTIVE" : "LOCKED";
}

/** Progress toward completion; a completed objective reports its full total (e.g. 3/3). */
export function objectiveProgress(o: GameplayObjective, s: GameplayState) {
  const p = progress(o.completionCondition, s);
  return s.completed.includes(o.code) ? { done: p.total, total: p.total, complete: true } : { ...p, complete: false };
}

/**
 * Complete every objective whose unlock prerequisites and completion condition
 * hold, repeating until stable (one completion can unlock the next). Each
 * objective completes at most once; order follows display_order per pass.
 */
export function settleObjectives(objectives: GameplayObjective[], s: GameplayState): { state: GameplayState; newlyCompleted: string[] } {
  let state = s;
  const newly: string[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const o of objectives) {
      if (state.completed.includes(o.code) || !o.completionCondition) continue;
      if (evaluate(o.unlockCondition, state) && evaluate(o.completionCondition, state)) {
        state = { ...state, completed: [...state.completed, o.code] };
        newly.push(o.code);
        changed = true;
      }
    }
  }
  return { state, newlyCompleted: newly };
}

/** COMPLETE_OBJECTIVE action: must exist and be unlocked; idempotent if already done. */
export function completeObjective(objectives: GameplayObjective[], s: GameplayState, code: string): EngineResult {
  const o = objectives.find((x) => x.code === code);
  if (!o) return { ok: false, state: s, error: `Nhiệm vụ ${code} không tồn tại.` };
  if (s.completed.includes(code)) return { ok: true, state: s };
  if (!evaluate(o.unlockCondition, s)) return { ok: false, state: s, error: `Nhiệm vụ "${o.title}" chưa mở khóa.` };
  return { ok: true, state: { ...s, completed: [...s.completed, code] } };
}

/** Stage is clear only when every required objective is completed. */
export function isStageComplete(objectives: GameplayObjective[], s: GameplayState): boolean {
  const required = objectives.filter((o) => o.required);
  return required.length > 0 && required.every((o) => s.completed.includes(o.code));
}
