// Backend puzzle payloads -> puzzle-types. Progress and submit shapes are the
// confirmed WF_BO_GET_PLAYER_PUZZLE_PROGRESS / WF_BO_SUBMIT_PUZZLE_ANSWER
// responses. Definitions (WF_BO_GET_MAP_PUZZLES) accept the common field
// spellings and drop what cannot be played, with a warning.
import type { MapPuzzle, PuzzleOption, PuzzleProgress, PuzzleSubmitResult, PuzzleType } from "./puzzle-types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const bool = (v: unknown) => v === true || v === 1 || v === "true";
const strOrNull = (v: unknown) => (isStr(v) ? v.trim() : null);
/** First string among the given keys. */
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) if (isStr(o[k])) return (o[k] as string).trim();
  return null;
};
/** JSON columns may arrive as strings. */
const json = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
const list = (v: unknown): unknown[] => {
  const j = json(v);
  return Array.isArray(j) ? j : [];
};

const TYPES: PuzzleType[] = ["MULTIPLE_CHOICE", "WORD_ORDER", "MEMORY_SEQUENCE"];

function options(raw: unknown[], prefix: string): PuzzleOption[] {
  return raw
    .map((o, i): PuzzleOption | null => {
      if (isStr(o)) return { code: o.trim(), text: o.trim(), imageUrl: null };
      if (!isObj(o)) return null;
      const text = pick(o, "option_text", "text", "label", "content", "word", "value", "name", "symbol");
      const code = pick(o, "option_code", "code", "key", "id", "value") ?? (num(o.id) != null ? String(num(o.id)) : null) ?? text ?? `${prefix}${i}`;
      if (!text) return null;
      return { code, text, imageUrl: pick(o, "image_url", "icon_url", "icon") };
    })
    .filter((o): o is PuzzleOption => o !== null);
}

function adaptPuzzle(raw: unknown, warn: (m: string) => void): MapPuzzle | null {
  if (!isObj(raw)) return null;
  const code = pick(raw, "map_puzzle_code", "puzzle_code", "code");
  if (!code) {
    warn("puzzle without map_puzzle_code — skipped");
    return null;
  }
  const type = (pick(raw, "puzzle_type", "type") ?? "").toUpperCase() as PuzzleType;
  if (!TYPES.includes(type)) {
    warn(`${code}: unsupported puzzle_type "${type}" — skipped`);
    return null;
  }
  // Type-specific content may sit at the top level or inside a JSON config
  // (WF_BO_GET_MAP_PUZZLES sends puzzle_config and options as JSON strings).
  const cfg = [raw.puzzle_config, raw.puzzle_data, raw.config, raw.content, raw.data, raw.settings].map(json).find(isObj) ?? {};
  const field = (...keys: string[]) => keys.map((k) => raw[k] ?? cfg[k]).find((v) => v != null);

  const opts = options(list(field("options", "choices", "words", "tokens", "fragments", "symbols", "items")), `${code}_`);
  const seqRaw = list(field("sequence", "display_sequence", "show_sequence", "pattern"));
  const sequence = seqRaw
    .map((s) => (isStr(s) ? s.trim() : isObj(s) ? pick(s, "option_code", "code", "key", "symbol", "value") : num(s) != null ? String(s) : null))
    .filter((s): s is string => s !== null);
  // Memory symbols may be implied by the sequence alone.
  const symbols = type === "MEMORY_SEQUENCE" && opts.length === 0 ? [...new Set(sequence)].map((s) => ({ code: s, text: s, imageUrl: null })) : opts;

  if (symbols.length < 2) {
    warn(`${code}: needs at least 2 options/words/symbols — skipped`);
    return null;
  }
  if (type === "MEMORY_SEQUENCE" && (sequence.length < 2 || sequence.some((s) => !symbols.some((o) => o.code === s)))) {
    warn(`${code}: memory sequence missing or refers to unknown symbols — skipped`);
    return null;
  }

  const suffix = code.replace(/^MAP_PUZZLE_/, "");
  const trigger = (pick(raw, "trigger_type") ?? "ITEM_INTERACT").toUpperCase() === "ITEM_INTERACT" ? pick(raw, "trigger_code") : null;
  const replay = field("allow_replay");
  return {
    code,
    type,
    title: pick(raw, "title", "name") ?? "Câu đố",
    question: pick(raw, "question", "question_text", "prompt", "description") ?? pick(cfg, "question", "prompt") ?? "",
    instruction: pick(raw, "instruction", "instructions") ?? pick(cfg, "instruction", "instructions"),
    spawnCode: pick(raw, "spawn_code", "item_spawn_code", "trigger_spawn_code") ?? (suffix !== code ? `SPAWN_${suffix}` : null),
    itemCode: pick(raw, "item_code", "trigger_item_code", "linked_item_code", "target_code") ?? trigger,
    options: symbols,
    sequence,
    showMs: Math.min(3000, Math.max(300, num(field("display_duration_ms", "show_ms", "display_ms", "step_ms", "display_time_ms")) ?? 800)),
    pauseMs: Math.min(2000, Math.max(100, num(field("pause_duration_ms", "pause_ms", "gap_ms")) ?? 260)),
    allowReplay: replay == null || bool(replay),
    hint: pick(raw, "hint", "hint_text") ?? pick(cfg, "hint"),
    maxAttempts: num(raw.max_attempts) || null,
    rewardItemCode: strOrNull(raw.reward_item_code),
    answerSeparator: typeof field("answer_separator", "separator") === "string" ? (field("answer_separator", "separator") as string) : null,
    displayOrder: num(raw.display_order) ?? 0,
  };
}

/** WF_BO_GET_MAP_PUZZLES data -> playable puzzles, in display order. */
export function adaptPuzzles(data: unknown, warn: (m: string) => void = () => {}): MapPuzzle[] {
  const d = isObj(data) ? data : {};
  const raw = Array.isArray(data) ? data : list(d.puzzles ?? d.map_puzzles ?? (isObj(d.data) ? (d.data as Obj).puzzles : undefined));
  return raw
    .map((p) => adaptPuzzle(p, warn))
    .filter((p): p is MapPuzzle => p !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** WF_BO_GET_PLAYER_PUZZLE_PROGRESS data. */
export function adaptProgress(data: unknown, mapCode: string): PuzzleProgress {
  const d = isObj(data) ? data : {};
  const puzzles: PuzzleProgress["puzzles"] = {};
  for (const p of list(d.puzzles)) {
    if (!isObj(p)) continue;
    const code = pick(p, "map_puzzle_code", "puzzle_code", "code");
    if (!code) continue;
    puzzles[code] = {
      code,
      completed: bool(p.is_completed),
      attempts: num(p.attempt_count) ?? 0,
      rewardClaimed: bool(p.reward_claimed),
      completedOn: strOrNull(p.completed_on_utc),
    };
  }
  const entries = Object.values(puzzles);
  return {
    mapCode: pick(d, "map_code") ?? mapCode,
    total: num(d.total_puzzles) ?? entries.length,
    completed: num(d.completed_puzzles) ?? entries.filter((e) => e.completed).length,
    puzzles,
  };
}

/** WF_BO_SUBMIT_PUZZLE_ANSWER data, or null when it is not a submit result. */
export function adaptSubmit(data: unknown, puzzleCode: string): PuzzleSubmitResult | null {
  if (!isObj(data) || typeof data.is_correct !== "boolean") return null;
  const remaining = num(data.remaining_attempts);
  return {
    code: pick(data, "map_puzzle_code") ?? puzzleCode,
    correct: data.is_correct,
    completed: bool(data.is_completed),
    alreadyCompleted: bool(data.already_completed),
    canRetry: bool(data.can_retry),
    attempts: num(data.attempt_count) ?? 0,
    remainingAttempts: remaining && remaining > 0 ? remaining : null,
    message: strOrNull(data.message),
    rewardItemCode: strOrNull(data.reward_item_code),
  };
}

/**
 * The player's answer in the string form WF_BO_SUBMIT_PUZZLE_ANSWER takes:
 * option ids — one for MULTIPLE_CHOICE ("B"), in the player's order for
 * WORD_ORDER ("4,2,1,3") and MEMORY_SEQUENCE ("A,C,B,A"). The backend compares ids, not texts.
 */
export function encodeAnswer(p: MapPuzzle, parts: PuzzleOption[]): string {
  if (p.type === "MULTIPLE_CHOICE") return parts[0]?.code ?? "";
  return parts.map((o) => o.code).join(p.answerSeparator ?? ",");
}
