// INTERACT events: exits from the map's gameplay_config, NPC talks and scene targets.
import { describeMissing, evaluate } from "./condition-evaluator";
import { objectiveStatus, settleObjectives } from "./objective-engine";
import type { EngineResult, GameplayExit, GameplayState, MapGameplay } from "./gameplay-types";

export type ExitStatus = "LOCKED" | "OPEN" | "USED";

export function exitStatus(exit: GameplayExit, s: GameplayState): ExitStatus {
  if ((s.interacted ?? []).includes(exit.spawnCode)) return "USED";
  return evaluate(exit.unlockCondition, s) ? "OPEN" : "LOCKED";
}

/** Record an interaction target once (idempotent). */
export function recordInteraction(s: GameplayState, code: string): GameplayState {
  const list = s.interacted ?? [];
  return list.includes(code) ? s : { ...s, interacted: [...list, code] };
}

/** Why a locked exit can't be used yet (objective titles resolved from the map). */
export function exitLockReason(g: MapGameplay, exit: GameplayExit, s: GameplayState): string | null {
  return describeMissing(
    exit.unlockCondition,
    s,
    (code) => g.items.find((i) => i.code === code)?.name ?? code,
    (code) => g.objectives.find((o) => o.code === code)?.title ?? null,
  );
}

/**
 * Use an exit: only when its unlock condition holds; records the INTERACT
 * event once and settles objectives (e.g. OPEN_THE_WAY).
 */
export function enterExit(g: MapGameplay, s: GameplayState, spawnCode: string): EngineResult {
  const exit = g.exits.find((e) => e.spawnCode === spawnCode);
  if (!exit) return { ok: false, state: s, error: "Lối ra này không tồn tại." };
  if (!evaluate(exit.unlockCondition, s)) {
    return { ok: false, state: s, error: `Cổng còn đóng. ${exitLockReason(g, exit, s) ?? ""}`.trim() };
  }
  return { ok: true, state: settleObjectives(g.objectives, recordInteraction(s, spawnCode)).state };
}

/**
 * Use a scene target that an INTERACT objective waits on (e.g. repairing a
 * bridge): only while such an objective is unlocked, so its prerequisites
 * (materials collected) are the backend's, never the scene's. Fails closed when
 * no objective targets it. Records the INTERACT once and settles objectives.
 */
export function interactWithTarget(g: MapGameplay, s: GameplayState, code: string): EngineResult {
  const goals = g.objectives.filter((o) => o.type === "INTERACT" && o.targetCode === code);
  if (!goals.length) return { ok: false, state: s, error: "Chưa thể dùng chỗ này." };
  if ((s.interacted ?? []).includes(code)) return { ok: true, state: s };
  if (!goals.some((o) => objectiveStatus(o, s) !== "LOCKED")) {
    return { ok: false, state: s, error: targetLockReason(g, s, code) ?? "Chưa đủ điều kiện." };
  }
  return { ok: true, state: settleObjectives(g.objectives, recordInteraction(s, code)).state };
}

/** What is still missing before a target can be used: the unlocking objective's own missing parts first (e.g. "Cần Cuộn Dây Thừng"). */
export function targetLockReason(g: MapGameplay, s: GameplayState, code: string): string | null {
  const goal = g.objectives.find((o) => o.type === "INTERACT" && o.targetCode === code && objectiveStatus(o, s) === "LOCKED");
  if (!goal) return null;
  const itemName = (c: string) => g.items.find((i) => i.code === c)?.name ?? c;
  const title = (c: string) => g.objectives.find((o) => o.code === c)?.title ?? null;
  const cond = goal.unlockCondition;
  const before = cond?.type === "OBJECTIVE_COMPLETED" ? g.objectives.find((o) => o.code === cond.objective_code) : undefined;
  return (before && describeMissing(before.completionCondition, s, itemName, title)) ?? describeMissing(cond, s, itemName, title);
}

/** Talking to an NPC counts as interacting with its code and spawn code. */
export function interactWithNpc(g: MapGameplay, s: GameplayState, npcCode: string): GameplayState {
  const npc = g.npcs.find((n) => n.code === npcCode);
  if (!npc) return s;
  return settleObjectives(g.objectives, recordInteraction(recordInteraction(s, npc.code), npc.spawnCode)).state;
}
