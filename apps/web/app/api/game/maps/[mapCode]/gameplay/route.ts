// GET /api/game/maps/[mapCode]/gameplay — BFF for a map's gameplay config.
// Browser -> this route -> O24OpenAPI gateway (WF_BO_GET_MAP_GAMEPLAY), plus the
// map's exits from ChapterMap.gameplay_config (WF_BO_GET_CHAPTER_MAP, shared cache).
// Only the map code comes from the request (validated); workflow, fields and
// headers are fixed server-side; credentials never leave the server.
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { adaptGameplay, parseMapConfig, unresolvedInteractTargets } from "@/lib/gameplay/gameplay-adapter";
import type { MapGameplayError, MapGameplayResponse } from "@/lib/gameplay/gameplay-types";
import { chapterNumberOf, loadChapter } from "@/lib/server/chapter-source";
import { callWorkflow, GatewayError, WORKFLOWS } from "@/lib/server/o24-gateway";

export const dynamic = "force-dynamic";

const MAP_CODE = /^[A-Z][A-Z0-9_]{2,39}$/;
const TTL_MS = 5 * 60 * 1000;
const MAX_CACHE = 50;
const cache = new Map<string, { at: number; body: MapGameplayResponse }>();
const inflight = new Map<string, Promise<unknown>>();
const OK_HEADERS = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };

const PUBLIC_DIR = path.join(process.cwd(), "public");
/** Does a backend asset path exist under /public? Only plain /chapters/... paths are checked. */
function assetExists(url: string): boolean {
  if (!/^\/chapters\/[\w\-/.]+$/.test(url) || url.includes("..")) return false;
  return existsSync(path.join(PUBLIC_DIR, url));
}

function fail(status: number, code: MapGameplayError["code"], error: string) {
  return NextResponse.json<MapGameplayError>({ error, code }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ mapCode: string }> }) {
  const { mapCode } = await params;
  if (!MAP_CODE.test(mapCode)) return fail(400, "bad_request", "Mã bản đồ không hợp lệ.");

  const hit = cache.get(mapCode);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: OK_HEADERS });

  // Exits live in the chapter's map config; load it in parallel (shared cache).
  const chapterNo = chapterNumberOf(mapCode);
  const chapterLoad = chapterNo ? loadChapter(chapterNo) : Promise.resolve(null);

  let data: unknown;
  try {
    let p = inflight.get(mapCode);
    if (!p) {
      p = callWorkflow<unknown>(WORKFLOWS.mapGameplay, { map_code: mapCode }).finally(() => inflight.delete(mapCode));
      inflight.set(mapCode, p);
    }
    data = await p;
  } catch (e) {
    const err = e instanceof GatewayError ? e : new GatewayError(String(e), "network");
    console.error(`[api/game/maps/${mapCode}/gameplay] ${err.kind}: ${err.message}`);
    if (err.kind === "config") return fail(503, "config", "Máy chủ chưa được cấu hình để tải màn chơi.");
    if (err.kind === "timeout") return fail(504, "timeout", "Máy chủ phản hồi quá lâu. Thử lại sau chút nhé!");
    return fail(502, "unavailable", "Không tải được dữ liệu màn chơi từ máy chủ. Thử lại sau nhé!");
  }

  const chapter = await chapterLoad;
  const configWarnings: string[] = [];
  const config = chapter?.ok
    ? parseMapConfig(chapter.mapConfigs[mapCode] ?? null, (m) => configWarnings.push(m), `${mapCode}.gameplay_config`)
    : { exits: [] };

  const result = adaptGameplay(data, mapCode, assetExists, config);
  if (!result.ok) {
    console.warn(`[api/game/maps/${mapCode}/gameplay] ${result.code}: ${result.reason}`);
    if (result.code === "not_found") return fail(404, "not_found", "Màn chơi này chưa có dữ liệu.");
    return fail(502, "unavailable", "Dữ liệu màn chơi từ máy chủ không hợp lệ.");
  }
  // Map config unavailable but an objective needs an exit: fail (retryable, not cached)
  // rather than serve a stage that can never be completed.
  const unresolved = unresolvedInteractTargets(result.gameplay);
  if (!chapter?.ok && unresolved.length) {
    console.error(`[api/game/maps/${mapCode}/gameplay] map config unavailable; unresolved INTERACT targets:`, unresolved);
    return fail(502, "unavailable", "Không tải được cấu hình lối ra của màn chơi. Thử lại sau nhé!");
  }
  const warnings = [...configWarnings, ...result.warnings];
  if (warnings.length) console.warn(`[api/game/maps/${mapCode}/gameplay] warnings:`, warnings);
  const body: MapGameplayResponse = { gameplay: result.gameplay, warnings };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(mapCode, { at: Date.now(), body });
  return NextResponse.json(body, { headers: OK_HEADERS });
}
