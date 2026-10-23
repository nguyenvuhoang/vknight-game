// GET /api/game/characters — BFF for the character list.
// Browser -> this route -> O24OpenAPI gateway (WF_BO_GET_LIST_CHARACTER).
// Takes no input from the request: the workflow, fields and headers are fixed
// here, and gateway credentials never leave the server.
import { NextResponse } from "next/server";
import { adaptCharacterList } from "@/lib/api/character-adapter";
import type { CharacterListError, CharacterListResponse } from "@/lib/api/character-types";
import { callWorkflow, GatewayError, WORKFLOWS } from "@/lib/server/o24-gateway";

export const dynamic = "force-dynamic";

// The list is public, read-only game content (no per-user data), so a short
// in-memory cache is safe and keeps backend traffic to ~1 call per 5 minutes.
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; body: CharacterListResponse } | null = null;
let inflight: Promise<CharacterListResponse> | null = null;

async function load(): Promise<CharacterListResponse> {
  const data = await callWorkflow<unknown>(WORKFLOWS.listCharacters, { include_inactive: false });
  const body = adaptCharacterList(data);
  if (body.skipped.length) {
    console.warn("[api/game/characters] skipped backend characters:", body.skipped);
  }
  return body;
}

const CACHE_HEADERS = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body, { headers: CACHE_HEADERS });
  }
  try {
    inflight ??= load().finally(() => (inflight = null));
    const body = await inflight;
    if (body.characters.length) cache = { at: Date.now(), body };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (e) {
    const err = e instanceof GatewayError ? e : new GatewayError(String(e), "network");
    // Details stay in the server log; the browser gets a friendly message only.
    console.error(`[api/game/characters] ${err.kind}: ${err.message}`);
    const status = err.kind === "config" ? 503 : err.kind === "timeout" ? 504 : 502;
    const msg =
      err.kind === "config"
        ? "Máy chủ chưa được cấu hình để tải hồ sơ nhân vật."
        : "Không tải được hồ sơ nhân vật từ máy chủ. Thử lại sau nhé!";
    return NextResponse.json<CharacterListError>({ error: msg }, { status, headers: { "cache-control": "no-store" } });
  }
}
