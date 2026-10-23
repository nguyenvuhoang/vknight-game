"use client";
// Browser client for character profiles. Talks only to our own BFF route
// (/api/game/characters) — never to the O24OpenAPI gateway directly.
import { useCallback, useEffect, useState } from "react";
import type { HeroId } from "@/lib/types";
import type { CharacterListError, CharacterListResponse, CharacterProfile } from "./character-types";

export class CharacterLoadError extends Error {}

// One request per page session, shared by every caller; cleared on failure so
// a manual retry can try again (no automatic retry loop).
let pending: Promise<CharacterProfile[]> | null = null;

export function getCharacters(): Promise<CharacterProfile[]> {
  pending ??= (async () => {
    let res: Response;
    try {
      res = await fetch("/api/game/characters", { headers: { accept: "application/json" } });
    } catch {
      throw new CharacterLoadError("Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé!");
    }
    const body = (await res.json().catch(() => null)) as CharacterListResponse | CharacterListError | null;
    if (!res.ok || !body || !("characters" in body)) {
      throw new CharacterLoadError(
        (body && "error" in body && body.error) || "Không tải được hồ sơ nhân vật. Thử lại sau nhé!",
      );
    }
    return body.characters;
  })().catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}

export type CharactersState =
  | { status: "loading"; profiles: null; error: null }
  | { status: "ready"; profiles: Map<HeroId, CharacterProfile>; order: HeroId[]; error: null }
  | { status: "error"; profiles: null; error: string };

/** Load profiles once; `retry` re-requests after a failure. */
export function useCharacters(): CharactersState & { retry: () => void } {
  const [state, setState] = useState<CharactersState>({ status: "loading", profiles: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getCharacters()
      .then((list) => {
        if (!alive) return;
        setState({
          status: "ready",
          profiles: new Map(list.map((p) => [p.heroId, p])),
          order: list.map((p) => p.heroId),
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setState({
          status: "error",
          profiles: null,
          error: e instanceof Error ? e.message : "Không tải được hồ sơ nhân vật.",
        });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading", profiles: null, error: null });
    setAttempt((a) => a + 1);
  }, []);

  return { ...state, retry };
}
