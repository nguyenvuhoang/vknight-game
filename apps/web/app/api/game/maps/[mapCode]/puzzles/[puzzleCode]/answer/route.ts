// POST /api/game/maps/[mapCode]/puzzles/[puzzleCode]/answer — submit an answer.
// Body: { guest, hero, answer }. Calls WF_BO_SUBMIT_PUZZLE_ANSWER with fixed
// fields; the backend decides correctness, retries and completion. Nothing is
// cached and no reward is claimed here (reward_item_code is only eligibility).
// On run-limited maps the current run's wrong answers are counted server-side
// (lib/server/puzzle-runs): a failed run gets no more submits until restarted.
import { NextResponse } from "next/server";
import { adaptSubmit } from "@/lib/gameplay/puzzle-adapter";
import type { PuzzleAnswerResponse, PuzzleApiError } from "@/lib/gameplay/puzzle-types";
import { callWorkflow, GatewayError, WORKFLOWS } from "@/lib/server/o24-gateway";
import { MAP_CODE, PUZZLE_CODE, puzzlePlayer, readJson } from "@/lib/server/puzzle-player";
import { beginSubmit, endSubmit, recordGraded, runStatus } from "@/lib/server/puzzle-runs";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const MAX_ANSWER = 500;

function fail(status: number, code: PuzzleApiError["code"], error: string, run?: PuzzleApiError["run"]) {
  return NextResponse.json<PuzzleApiError>({ error, code, ...(run !== undefined && { run }) }, { status, headers: NO_STORE });
}

export async function POST(req: Request, { params }: { params: Promise<{ mapCode: string; puzzleCode: string }> }) {
  const { mapCode, puzzleCode } = await params;
  const route = `api/game/maps/${mapCode}/puzzles/${puzzleCode}/answer`;
  if (!MAP_CODE.test(mapCode) || !PUZZLE_CODE.test(puzzleCode)) return fail(400, "bad_request", "Mã câu đố không hợp lệ.");
  const body = await readJson(req);
  const answer = typeof body === "object" && body !== null ? (body as Record<string, unknown>).answer : undefined;
  if (typeof answer !== "string" || !answer.trim() || answer.length > MAX_ANSWER) return fail(400, "bad_request", "Câu trả lời không hợp lệ.");

  let player;
  try {
    player = await puzzlePlayer(body);
  } catch (e) {
    console.error(`[${route}] character lookup failed:`, e instanceof Error ? e.message : e);
    return fail(502, "unavailable", "Không xác định được nhân vật trên máy chủ. Thử lại sau nhé!");
  }
  if (player === "bad") return fail(400, "bad_request", "Thiếu thông tin người chơi.");
  if (player === "unknown_hero") return fail(404, "not_found", "Máy chủ chưa có nhân vật này.");

  const slot = beginSubmit(player, mapCode, puzzleCode);
  if (slot === "failed") return fail(409, "stage_failed", "Bạn đã mất trí nhớ tạm thời! Hãy chơi lại ải từ đầu.", runStatus(player, mapCode));
  if (slot === "busy") return fail(429, "busy", "Đang chấm câu trả lời…");
  let data: unknown;
  try {
    data = await callWorkflow<unknown>(WORKFLOWS.submitPuzzleAnswer, { ...player, map_code: mapCode, map_puzzle_code: puzzleCode, answer });
  } catch (e) {
    const err = e instanceof GatewayError ? e : new GatewayError(String(e), "network");
    console.error(`[${route}] ${err.kind}: ${err.message}`);
    if (err.kind === "config") return fail(503, "config", "Máy chủ chưa được cấu hình để chấm câu đố.");
    if (err.kind === "timeout") return fail(504, "timeout", "Máy chủ phản hồi quá lâu. Thử lại sau chút nhé!");
    return fail(502, "unavailable", "Không gửi được câu trả lời. Thử lại sau nhé!");
  } finally {
    endSubmit(player, mapCode, puzzleCode);
  }
  const result = adaptSubmit(data, puzzleCode);
  if (!result) {
    console.error(`[${route}] unexpected submit response`);
    return fail(502, "unavailable", "Máy chủ trả kết quả câu đố không hợp lệ.");
  }
  // Only a wrong answer the backend actually graded counts (not an already-completed puzzle).
  const run = recordGraded(player, mapCode, puzzleCode, !result.correct && !result.alreadyCompleted);
  return NextResponse.json<PuzzleAnswerResponse>({ result, run }, { headers: NO_STORE });
}
