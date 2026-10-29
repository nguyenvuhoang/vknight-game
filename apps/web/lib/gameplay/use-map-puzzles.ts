"use client";
// Browser side of the puzzle BFF (/api/game/maps/[mapCode]/puzzles). Server
// progress is the source of truth for completion: it is loaded on mount and
// replaced by each submit response, so a reload shows what the backend saved.
// Local inventory (picking the item up) stays in the gameplay engines.
import { useCallback, useEffect, useRef, useState } from "react";
import { getGuestId } from "@/lib/progress";
import type { HeroId } from "@/lib/types";
import type { MapPuzzle, MapPuzzlesResponse, PuzzleAnswerResponse, PuzzleApiError, PuzzleProgress, PuzzleRunResponse, PuzzleRunStatus, PuzzleSubmitResult } from "./puzzle-types";

export type PuzzlesState = {
  status: "loading" | "ready" | "error";
  /** null when definitions could not be loaded (the stage then plays without puzzles). */
  puzzles: MapPuzzle[] | null;
  progress: PuzzleProgress | null;
  error: string | null;
  /** The server-side stage run on a run-limited map (attempt limit); null elsewhere. */
  run: PuzzleRunStatus | null;
};

export type SubmitOutcome = { ok: true; result: PuzzleSubmitResult } | { ok: false; error: string };

export function useMapPuzzles(mapCode: string, hero: HeroId, enabled = true) {
  const [state, setState] = useState<PuzzlesState>({ status: enabled ? "loading" : "ready", puzzles: null, progress: null, error: null, run: null });
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, status: "loading", error: null }));
    fetch(`/api/game/maps/${encodeURIComponent(mapCode)}/puzzles`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ guest: getGuestId(), hero }),
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as MapPuzzlesResponse | PuzzleApiError | null;
        if (!alive) return;
        if (!res.ok || !body || !("puzzles" in body)) {
          const error = (body && "error" in body && body.error) || "Không tải được câu đố. Thử lại sau nhé!";
          return setState({ status: "error", puzzles: null, progress: null, error, run: null });
        }
        if (body.warnings.length) console.warn("[puzzles] backend definitions:", body.warnings);
        setState({ status: "ready", puzzles: body.puzzles, progress: body.progress, error: body.puzzlesError ?? body.progressError, run: body.run ?? null });
      })
      .catch(() => alive && setState({ status: "error", puzzles: null, progress: null, error: "Mất kết nối mạng khi tải câu đố.", run: null }));
    return () => {
      alive = false;
    };
  }, [mapCode, hero, enabled, attempt]);

  /** Submit once at a time per puzzle; completed puzzles are never re-submitted. */
  const submit = useCallback(
    async (puzzleCode: string, answer: string): Promise<SubmitOutcome> => {
      if (busy.current.has(puzzleCode)) return { ok: false, error: "Đang chấm câu trả lời…" };
      busy.current.add(puzzleCode);
      try {
        const res = await fetch(`/api/game/maps/${encodeURIComponent(mapCode)}/puzzles/${encodeURIComponent(puzzleCode)}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ guest: getGuestId(), hero, answer }),
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as PuzzleAnswerResponse | PuzzleApiError | null;
        if (!res.ok || !body || !("result" in body)) {
          // A failed run is reported with its status, so the stage can show the failure screen.
          const failedRun = body && "run" in body ? body.run : undefined;
          if (failedRun) setState((s) => ({ ...s, run: failedRun }));
          return { ok: false, error: (body && "error" in body && body.error) || "Không gửi được câu trả lời. Thử lại sau nhé!" };
        }
        const r = body.result;
        const run = body.run;
        // Mirror exactly what the backend reported; never mark rewards claimed.
        setState((s) => {
          const base = s.progress ?? { mapCode, total: 0, completed: 0, puzzles: {} };
          const prev = base.puzzles[puzzleCode];
          const done = r.completed || r.alreadyCompleted || (prev?.completed ?? false);
          const puzzles = {
            ...base.puzzles,
            [puzzleCode]: { code: puzzleCode, completed: done, attempts: r.attempts, rewardClaimed: prev?.rewardClaimed ?? false, completedOn: prev?.completedOn ?? null },
          };
          return { ...s, run: run ?? s.run, progress: { ...base, puzzles, completed: Object.values(puzzles).filter((p) => p.completed).length } };
        });
        return { ok: true, result: r };
      } catch {
        return { ok: false, error: "Mất kết nối mạng. Câu trả lời chưa được gửi." };
      } finally {
        busy.current.delete(puzzleCode);
      }
    },
    [mapCode, hero],
  );

  const isSolved = useCallback((code: string) => state.progress?.puzzles[code]?.completed === true, [state.progress]);

  /** Start a new server-side run after a failed one; false (with the reason) if the server refused. */
  const restartRun = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`/api/game/maps/${encodeURIComponent(mapCode)}/run/restart`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ guest: getGuestId(), hero }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as PuzzleRunResponse | PuzzleApiError | null;
      if (!res.ok || !body || !("run" in body) || !body.run) return { ok: false, error: (body && "error" in body && body.error) || "Không khởi động lại được ải. Thử lại sau nhé!" };
      const run = body.run;
      setState((s) => ({ ...s, run }));
      return { ok: true };
    } catch {
      return { ok: false, error: "Mất kết nối mạng. Thử lại sau nhé!" };
    }
  }, [mapCode, hero]);

  return { ...state, submit, isSolved, restartRun, retry: () => setAttempt((n) => n + 1) };
}
