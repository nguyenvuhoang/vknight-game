// POST /api/game/maps/[mapCode]/run/restart — start a new stage run after the
// current one failed (the player clicked "Chơi lại từ đầu"). Body: { guest, hero }.
// Only clears the run's attempt counter kept by this server (lib/server/puzzle-runs);
// backend PlayerPuzzleProgress, chapter progress and rewards are untouched.
import { NextResponse } from "next/server";
import type { PuzzleApiError, PuzzleRunResponse } from "@/lib/gameplay/puzzle-types";
import { MAP_CODE, puzzlePlayer, readJson } from "@/lib/server/puzzle-player";
import { restartRun } from "@/lib/server/puzzle-runs";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function fail(status: number, code: PuzzleApiError["code"], error: string) {
  return NextResponse.json<PuzzleApiError>({ error, code }, { status, headers: NO_STORE });
}

export async function POST(req: Request, { params }: { params: Promise<{ mapCode: string }> }) {
  const { mapCode } = await params;
  if (!MAP_CODE.test(mapCode)) return fail(400, "bad_request", "Mã bản đồ không hợp lệ.");
  let player;
  try {
    player = await puzzlePlayer(await readJson(req));
  } catch (e) {
    console.error(`[api/game/maps/${mapCode}/run/restart] character lookup failed:`, e instanceof Error ? e.message : e);
    return fail(502, "unavailable", "Không xác định được nhân vật trên máy chủ. Thử lại sau nhé!");
  }
  if (player === "bad") return fail(400, "bad_request", "Thiếu thông tin người chơi.");
  if (player === "unknown_hero") return fail(404, "not_found", "Máy chủ chưa có nhân vật này.");
  const run = restartRun(player, mapCode);
  if (run === "no_rule") return fail(404, "not_found", "Ải này không giới hạn lượt trả lời.");
  if (run === "not_failed") return fail(409, "not_failed", "Lượt chơi hiện tại vẫn đang tiếp tục.");
  return NextResponse.json<PuzzleRunResponse>({ run }, { headers: NO_STORE });
}
