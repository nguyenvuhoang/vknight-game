// POST /api/game/maps/[mapCode]/puzzles — BFF for a map's puzzles and this
// player's progress. Body: { guest, hero } (the local GuestId and HeroId; POST
// keeps the guest id out of URLs and logs). Calls WF_BO_GET_MAP_PUZZLES and
// WF_BO_GET_PLAYER_PUZZLE_PROGRESS with fixed fields; each half may fail on its
// own, so a stage can still show server progress when definitions are missing.
import { NextResponse } from "next/server";
import { adaptProgress, adaptPuzzles } from "@/lib/gameplay/puzzle-adapter";
import type { MapPuzzle, MapPuzzlesResponse, PuzzleApiError } from "@/lib/gameplay/puzzle-types";
import { callWorkflow, GatewayError, WORKFLOWS } from "@/lib/server/o24-gateway";
import { MAP_CODE, puzzlePlayer, readJson } from "@/lib/server/puzzle-player";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
// Definitions are map content (the same for every player): cache them briefly.
const TTL_MS = 5 * 60 * 1000;
const defs = new Map<string, { at: number; puzzles: MapPuzzle[]; warnings: string[] }>();

function fail(status: number, code: PuzzleApiError["code"], error: string) {
  return NextResponse.json<PuzzleApiError>({ error, code }, { status, headers: NO_STORE });
}

function reason(route: string, what: string, e: unknown): string {
  const err = e instanceof GatewayError ? e : new GatewayError(String(e), "network");
  console.error(`[${route}] ${what} ${err.kind}: ${err.message}`);
  if (err.backendCode === "invalid.session") return "Máy chủ chưa mở câu đố cho người chơi khách.";
  if (err.kind === "config") return "Máy chủ chưa được cấu hình để tải câu đố.";
  if (err.kind === "timeout") return "Máy chủ phản hồi quá lâu. Thử lại sau chút nhé!";
  return "Không tải được câu đố từ máy chủ. Thử lại sau nhé!";
}

export async function POST(req: Request, { params }: { params: Promise<{ mapCode: string }> }) {
  const { mapCode } = await params;
  const route = `api/game/maps/${mapCode}/puzzles`;
  if (!MAP_CODE.test(mapCode)) return fail(400, "bad_request", "Mã bản đồ không hợp lệ.");
  let player;
  try {
    player = await puzzlePlayer(await readJson(req));
  } catch (e) {
    console.error(`[${route}] character lookup failed:`, e instanceof Error ? e.message : e);
    return fail(502, "unavailable", "Không xác định được nhân vật trên máy chủ. Thử lại sau nhé!");
  }
  if (player === "bad") return fail(400, "bad_request", "Thiếu thông tin người chơi.");
  if (player === "unknown_hero") return fail(404, "not_found", "Máy chủ chưa có nhân vật này.");
  const fields = { ...player, map_code: mapCode };

  const hit = defs.get(mapCode);
  const [defsResult, progressResult] = await Promise.allSettled([
    hit && Date.now() - hit.at < TTL_MS
      ? Promise.resolve(hit)
      : callWorkflow<unknown>(WORKFLOWS.mapPuzzles, fields).then((data) => {
          const warnings: string[] = [];
          const entry = { at: Date.now(), puzzles: adaptPuzzles(data, (m) => warnings.push(m)), warnings };
          if (entry.puzzles.length) defs.set(mapCode, entry);
          return entry;
        }),
    callWorkflow<unknown>(WORKFLOWS.puzzleProgress, fields).then((data) => adaptProgress(data, mapCode)),
  ]);

  const body: MapPuzzlesResponse = {
    puzzles: defsResult.status === "fulfilled" ? defsResult.value.puzzles : null,
    puzzlesError: defsResult.status === "rejected" ? reason(route, "puzzles", defsResult.reason) : null,
    progress: progressResult.status === "fulfilled" ? progressResult.value : null,
    progressError: progressResult.status === "rejected" ? reason(route, "progress", progressResult.reason) : null,
    warnings: defsResult.status === "fulfilled" ? defsResult.value.warnings : [],
  };
  if (body.warnings.length) console.warn(`[${route}] warnings:`, body.warnings);
  return NextResponse.json(body, { headers: NO_STORE });
}
