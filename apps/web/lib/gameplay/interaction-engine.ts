// INTERACT events: exits from the map's gameplay_config, and NPC talks.
import { describeMissing, evaluate } from "./condition-evaluator";
import { settleObjectives } from "./objective-engine";
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

/** Talking to an NPC counts as interacting with its code and spawn code. */
export function interactWithNpc(g: MapGameplay, s: GameplayState, npcCode: string): GameplayState {
  const npc = g.npcs.find((n) => n.code === npcCode);
  if (!npc) return s;
  return settleObjectives(g.objectives, recordInteraction(recordInteraction(s, npc.code), npc.spawnCode)).state;
}
