"use client";
// Browser client for map gameplay. Talks only to our BFF route
// (/api/game/maps/[mapCode]/gameplay) — never to the O24OpenAPI gateway.
import { useCallback, useEffect, useState } from "react";
import type { MapGameplayError, MapGameplayResponse } from "@/lib/gameplay/gameplay-types";

// One request per map per page session; failures are dropped so a manual
// retry can try again (no automatic retries).
const pending = new Map<string, Promise<MapGameplayResponse>>();

export function getMapGameplay(mapCode: string): Promise<MapGameplayResponse> {
  let p = pending.get(mapCode);
  if (!p) {
    p = (async () => {
      let res: Response;
      try {
        res = await fetch(`/api/game/maps/${encodeURIComponent(mapCode)}/gameplay`, { headers: { accept: "application/json" } });
      } catch {
        throw new Error("Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé!");
      }
      const body = (await res.json().catch(() => null)) as MapGameplayResponse | MapGameplayError | null;
      if (!res.ok || !body || !("gameplay" in body)) {
        throw new Error((body && "error" in body && body.error) || "Không tải được dữ liệu màn chơi.");
      }
      return body;
    })().catch((e) => {
      pending.delete(mapCode);
      throw e;
    });
    pending.set(mapCode, p);
  }
  return p;
}

export type MapGameplayState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: MapGameplayResponse; error: null }
  | { status: "error"; data: null; error: string };

export function useMapGameplay(mapCode: string): MapGameplayState & { retry: () => void } {
  const [state, setState] = useState<MapGameplayState>({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    getMapGameplay(mapCode)
      .then((data) => {
        if (!alive) return;
        if (data.warnings.length) console.warn(`[gameplay ${mapCode}] data warnings:`, data.warnings);
        setState({ status: "ready", data, error: null });
      })
      .catch((e: unknown) => alive && setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [mapCode, attempt]);
  const retry = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    setAttempt((a) => a + 1);
  }, []);
  return { ...state, retry };
}
