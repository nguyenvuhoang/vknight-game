// GET /api/game/chapters/[chapterNumber]/maps — BFF for a chapter's map list.
// Browser -> this route -> O24OpenAPI gateway (WF_BO_GET_CHAPTER_MAP).
// The only input is the chapter number (validated); workflow, fields and
// headers are fixed server-side and credentials never leave the server.
import { NextResponse } from "next/server";
import { adaptChapter } from "@/lib/api/chapter-adapter";
import type { ChapterMapsError, ChapterMapsResponse } from "@/lib/api/chapter-types";
import { callWorkflow, GatewayError, WORKFLOWS } from "@/lib/server/o24-gateway";

export const dynamic = "force-dynamic";

const MAX_CHAPTER = 99;
// Static, public game configuration (no per-user data): short in-memory cache,
// successes only, bounded to MAX_CHAPTER entries.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { at: number; body: ChapterMapsResponse }>();
const inflight = new Map<number, Promise<unknown>>();

const OK_HEADERS = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };

function fail(status: number, code: ChapterMapsError["code"], error: string) {
  return NextResponse.json<ChapterMapsError>({ error, code }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ chapterNumber: string }> }) {
  const { chapterNumber: raw } = await params;
  // Digits only (no signs, decimals, exponents or padding), 1..MAX_CHAPTER.
  if (!/^[1-9]\d{0,2}$/.test(raw) || Number(raw) > MAX_CHAPTER) {
    return fail(400, "bad_request", "Số chương không hợp lệ.");
  }
  const n = Number(raw);

  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: OK_HEADERS });

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
    // Details stay in the server log; the browser only gets a friendly message.
    console.error(`[api/game/chapters/${n}/maps] ${err.kind}: ${err.message}`);
    if (err.kind === "config") return fail(503, "config", "Máy chủ chưa được cấu hình để tải bản đồ.");
    if (err.kind === "timeout") return fail(504, "timeout", "Máy chủ phản hồi quá lâu. Thử lại sau chút nhé!");
    return fail(502, "unavailable", "Không tải được bản đồ chương từ máy chủ. Thử lại sau nhé!");
  }

  const result = adaptChapter(data, n);
  if (!result.ok) {
    console.warn(`[api/game/chapters/${n}/maps] ${result.code}: ${result.reason}`);
    if (result.code === "not_found") return fail(404, "not_found", `Chương ${n} chưa mở. Đợi cập nhật nhé!`);
    if (result.code === "empty") return fail(404, "empty", `Chương ${n} chưa có bản đồ nào.`);
    return fail(502, "unavailable", "Dữ liệu bản đồ từ máy chủ không hợp lệ.");
  }
  if (result.body.skipped.length) {
    console.warn(`[api/game/chapters/${n}/maps] skipped maps:`, result.body.skipped);
  }
  cache.set(n, { at: Date.now(), body: result.body });
  return NextResponse.json(result.body, { headers: OK_HEADERS });
}
