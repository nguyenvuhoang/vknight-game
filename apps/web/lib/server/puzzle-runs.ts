// Server-only: the current stage run's puzzle attempts ("Mất Trí Nhớ Tạm Thời").
// WF_BO_SUBMIT_PUZZLE_ANSWER grades answers but only keeps a lifetime
// AttemptCount, so the per-run limit is kept here, keyed by the player
// (guest_id, character_id) and map: a reload or a changed client state does not
// reset it. Only answers the backend graded wrong count. After the limit the run
// is failed and every submit is refused until the player restarts the stage.
// PlayerPuzzleProgress is never touched and no reward is claimed here.
//
// Limits: kept in this server process's memory (lost on restart, not shared
// between instances) until the backend tracks stage runs itself.
import { randomUUID } from "node:crypto";
import type { PuzzleRunStatus } from "@/lib/gameplay/puzzle-types";
import type { PuzzlePlayer } from "./puzzle-player";

/** Maps that enforce the per-run limit: wrong answers allowed per puzzle per run. */
const RUN_RULES: Record<string, { maxWrong: number }> = {
  CHAP01_MAP04: { maxWrong: 3 },
};

const MAX_RUNS = 20_000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Run = { id: string; at: number; wrong: Record<string, number>; failedPuzzle: string | null };
const runs = new Map<string, Run>();
const inflight = new Set<string>();

export const runRule = (mapCode: string) => RUN_RULES[mapCode] ?? null;

const keyOf = (p: PuzzlePlayer, mapCode: string) => `${p.guest_id}:${p.character_id}:${mapCode}`;

function current(key: string): Run {
  const run = runs.get(key);
  if (run && Date.now() - run.at < TTL_MS) return run;
  const fresh: Run = { id: randomUUID(), at: Date.now(), wrong: {}, failedPuzzle: null };
  if (runs.size >= MAX_RUNS) runs.delete(runs.keys().next().value!);
  runs.set(key, fresh);
  return fresh;
}

function status(run: Run, maxWrong: number): PuzzleRunStatus {
  return { id: run.id, maxWrong, wrong: { ...run.wrong }, failed: run.failedPuzzle != null, failedPuzzle: run.failedPuzzle };
}

/** The player's current run on a run-limited map (null when the map has no limit). */
export function runStatus(p: PuzzlePlayer, mapCode: string): PuzzleRunStatus | null {
  const rule = runRule(mapCode);
  return rule ? status(current(keyOf(p, mapCode)), rule.maxWrong) : null;
}

/**
 * Reserve one submit for a puzzle: refused when the run has failed, and one at a
 * time per puzzle (parallel requests cannot slip extra graded attempts in).
 */
export function beginSubmit(p: PuzzlePlayer, mapCode: string, puzzleCode: string): "ok" | "failed" | "busy" {
  if (!runRule(mapCode)) return "ok";
  const key = keyOf(p, mapCode);
  if (current(key).failedPuzzle != null) return "failed";
  const lock = `${key}:${puzzleCode}`;
  if (inflight.has(lock)) return "busy";
  inflight.add(lock);
  return "ok";
}

export function endSubmit(p: PuzzlePlayer, mapCode: string, puzzleCode: string) {
  inflight.delete(`${keyOf(p, mapCode)}:${puzzleCode}`);
}

/** Count a backend-graded wrong answer; the limit fails the run. */
export function recordGraded(p: PuzzlePlayer, mapCode: string, puzzleCode: string, wrong: boolean): PuzzleRunStatus | null {
  const rule = runRule(mapCode);
  if (!rule) return null;
  const run = current(keyOf(p, mapCode));
  if (wrong) {
    const n = (run.wrong[puzzleCode] ?? 0) + 1;
    run.wrong[puzzleCode] = n;
    if (n >= rule.maxWrong) run.failedPuzzle = puzzleCode;
  }
  return status(run, rule.maxWrong);
}

/** Start a new run, only after the current one failed (the player clicked "Chơi lại từ đầu"). */
export function restartRun(p: PuzzlePlayer, mapCode: string): PuzzleRunStatus | "no_rule" | "not_failed" {
  const rule = runRule(mapCode);
  if (!rule) return "no_rule";
  const key = keyOf(p, mapCode);
  if (current(key).failedPuzzle == null) return "not_failed";
  runs.delete(key);
  return status(current(key), rule.maxWrong);
}
