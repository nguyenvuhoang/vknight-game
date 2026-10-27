// GET /api/game/chapters/[chapterNumber]/maps — BFF for a chapter's map list.
// Browser -> this route -> O24OpenAPI gateway (WF_BO_GET_CHAPTER_MAP).
// The only input is the chapter number (validated); workflow, fields and
// headers are fixed server-side and credentials never leave the server.
import { NextResponse } from "next/server";
import type { ChapterMapsError } from "@/lib/api/chapter-types";
import { loadChapter } from "@/lib/server/chapter-source";

export const dynamic = "force-dynamic";

const MAX_CHAPTER = 99;
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
  const load = await loadChapter(Number(raw));
  if (!load.ok) return fail(load.status, load.code, load.error);
  return NextResponse.json(load.body, { headers: OK_HEADERS });
}
