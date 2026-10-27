// Shared server-side loader for WF_BO_GET_CHAPTER_MAP, used by the chapter
// route and the gameplay route (which needs each map's gameplay_config).
// Public game configuration: short in-memory cache of successes only.
import { adaptChapter } from "@/lib/api/chapter-adapter";
import type { ChapterMapsError, ChapterMapsResponse } from "@/lib/api/chapter-types";
import { callWorkflow, GatewayError, WORKFLOWS } from "./o24-gateway";

if (typeof window !== "undefined") {
  throw new Error("chapter-source is server-only");
}

export type ChapterLoad =
  | {
      ok: true;
      body: ChapterMapsResponse;
      /** Raw ChapterMap.gameplay_config per map_code (JSON string or null). */
      mapConfigs: Record<string, unknown>;
    }
  | { ok: false; status: number; code: ChapterMapsError["code"]; error: string };

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { at: number; load: Extract<ChapterLoad, { ok: true }> }>();
const inflight = new Map<number, Promise<unknown>>();

export async function loadChapter(n: number): Promise<ChapterLoad> {
  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.load;

  let data: unknown;
  try {
    let p = inflight.get(n);
    if (!p) {
      p = callWorkflow<unknown>(WORKFLOWS.chapterMap, { chapter_number: n }).finally(() => inflight.delete(n));
      inflight.set(n, p);
    }
    data = await p;
  } catch (e) {
    const err = e instanceof GatewayError ? e : new GatewayError(String(e), "network");
    // Details stay in the server log; callers only expose friendly messages.
    console.error(`[chapter-source ${n}] ${err.kind}: ${err.message}`);
    if (err.kind === "config") return { ok: false, status: 503, code: "config", error: "Máy chủ chưa được cấu hình để tải bản đồ." };
    if (err.kind === "timeout") return { ok: false, status: 504, code: "timeout", error: "Máy chủ phản hồi quá lâu. Thử lại sau chút nhé!" };
    return { ok: false, status: 502, code: "unavailable", error: "Không tải được bản đồ chương từ máy chủ. Thử lại sau nhé!" };
  }

  const result = adaptChapter(data, n);
  if (!result.ok) {
    console.warn(`[chapter-source ${n}] ${result.code}: ${result.reason}`);
    if (result.code === "not_found") return { ok: false, status: 404, code: "not_found", error: `Chương ${n} chưa mở. Đợi cập nhật nhé!` };
    if (result.code === "empty") return { ok: false, status: 404, code: "empty", error: `Chương ${n} chưa có bản đồ nào.` };
    return { ok: false, status: 502, code: "unavailable", error: "Dữ liệu bản đồ từ máy chủ không hợp lệ." };
  }
  if (result.body.skipped.length) console.warn(`[chapter-source ${n}] skipped maps:`, result.body.skipped);

  const mapConfigs: Record<string, unknown> = {};
  const rawMaps = (data as { chapter?: { maps?: unknown[] } }).chapter?.maps ?? [];
  for (const m of rawMaps) {
    if (m && typeof m === "object" && typeof (m as { map_code?: unknown }).map_code === "string") {
      mapConfigs[(m as { map_code: string }).map_code] = (m as { gameplay_config?: unknown }).gameplay_config ?? null;
    }
  }
  const load = { ok: true as const, body: result.body, mapConfigs };
  cache.set(n, { at: Date.now(), load });
  return load;
}

/** "CHAP01_MAP02" -> 1 (backend map_code convention); null if it doesn't match. */
export function chapterNumberOf(mapCode: string): number | null {
  const m = /^CHAP(\d{1,2})_MAP\d{1,3}$/.exec(mapCode);
  return m ? Number(m[1]) || null : null;
}
