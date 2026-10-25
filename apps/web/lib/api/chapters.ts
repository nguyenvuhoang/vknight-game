"use client";
// Browser client for chapter maps. Talks only to our own BFF route
// (/api/game/chapters/[n]/maps) — never to the O24OpenAPI gateway.
import { useCallback, useEffect, useState } from "react";
import { localChapter1 } from "./chapter-adapter";
import type { ChapterMapsError, ChapterMapsResponse, FrontendGameChapter } from "./chapter-types";

export class ChapterLoadError extends Error {
  constructor(
    message: string,
    readonly code: ChapterMapsError["code"] | "network",
  ) {
    super(message);
  }
}

// One request per chapter per page session, shared by every caller; a failed
// request is dropped so a manual retry can try again (no automatic retries).
const pending = new Map<number, Promise<FrontendGameChapter>>();

export function getChapterMaps(n: number): Promise<FrontendGameChapter> {
  let p = pending.get(n);
  if (!p) {
    p = (async () => {
      let res: Response;
      try {
        res = await fetch(`/api/game/chapters/${n}/maps`, { headers: { accept: "application/json" } });
      } catch {
        throw new ChapterLoadError("Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé!", "network");
      }
      const body = (await res.json().catch(() => null)) as ChapterMapsResponse | ChapterMapsError | null;
      if (!res.ok || !body || !("chapter" in body)) {
        const e = body && "error" in body ? body : null;
        throw new ChapterLoadError(e?.error || "Không tải được bản đồ chương. Thử lại sau nhé!", e?.code ?? "unavailable");
      }
      return body.chapter;
    })().catch((e) => {
      pending.delete(n);
      throw e;
    });
    pending.set(n, p);
  }
  return p;
}

export type ChapterState =
  | { status: "loading"; chapter: null; error: null }
  | { status: "ready"; chapter: FrontendGameChapter; error: null }
  /** Chapter 1 only: backend failed, bundled level list in use. */
  | { status: "fallback"; chapter: FrontendGameChapter; error: string }
  | { status: "error"; chapter: null; error: string; code: ChapterLoadError["code"] };

export function useChapterMaps(n: number): ChapterState & { retry: () => void } {
  const [state, setState] = useState<ChapterState>({ status: "loading", chapter: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getChapterMaps(n)
      .then((chapter) => alive && setState({ status: "ready", chapter, error: null }))
      .catch((e: unknown) => {
        if (!alive) return;
        const err = e instanceof ChapterLoadError ? e : new ChapterLoadError("Không tải được bản đồ chương.", "unavailable");
        // Compatibility fallback is defined for Chapter 1 only; never fabricate other chapters.
        setState(
          n === 1
            ? { status: "fallback", chapter: localChapter1(), error: err.message }
            : { status: "error", chapter: null, error: err.message, code: err.code },
        );
      });
    return () => {
      alive = false;
    };
  }, [n, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
