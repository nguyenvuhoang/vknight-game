// Map puzzles (WF_BO_GET_MAP_PUZZLES / WF_BO_SUBMIT_PUZZLE_ANSWER /
// WF_BO_GET_PLAYER_PUZZLE_PROGRESS), normalized by puzzle-adapter.ts.
// The backend decides correctness and completion; the client only renders
// questions and sends the player's answer.

export type PuzzleType = "MULTIPLE_CHOICE" | "WORD_ORDER" | "MEMORY_SEQUENCE";

export type PuzzleOption = { code: string; text: string; imageUrl: string | null };

export type MapPuzzle = {
  code: string;
  type: PuzzleType;
  title: string;
  question: string;
  instruction: string | null;
  /** The item this puzzle guards: explicit backend link, else the SPAWN_<x> ↔ MAP_PUZZLE_<x> convention. */
  spawnCode: string | null;
  itemCode: string | null;
  /** MULTIPLE_CHOICE: choices · WORD_ORDER: the words (any order) · MEMORY_SEQUENCE: the symbols. */
  options: PuzzleOption[];
  /** MEMORY_SEQUENCE: option codes shown to the player, in order. */
  sequence: string[];
  /** MEMORY_SEQUENCE: how long each step is lit, and the dark gap between steps, ms. */
  showMs: number;
  pauseMs: number;
  /** MEMORY_SEQUENCE: whether the player may watch the sequence again on request. */
  allowReplay: boolean;
  hint: string | null;
  maxAttempts: number | null;
  /** Eligible reward only — the backend has not credited it to any inventory. */
  rewardItemCode: string | null;
  /** Separator the backend expects between answer parts, when it says so. */
  answerSeparator: string | null;
  displayOrder: number;
};

export type PuzzleProgressEntry = {
  code: string;
  completed: boolean;
  attempts: number;
  /** Mirrors the backend flag; the client never sets it. */
  rewardClaimed: boolean;
  completedOn: string | null;
};

export type PuzzleProgress = {
  mapCode: string;
  total: number;
  completed: number;
  puzzles: Record<string, PuzzleProgressEntry>;
};

export type PuzzleSubmitResult = {
  code: string;
  correct: boolean;
  completed: boolean;
  alreadyCompleted: boolean;
  canRetry: boolean;
  attempts: number;
  /** null = the backend gave no limit (it sends 0 for unlimited retries). */
  remainingAttempts: number | null;
  message: string | null;
  rewardItemCode: string | null;
};

/** Body of GET /api/game/maps/[mapCode]/puzzles. Each half can fail on its own. */
export type MapPuzzlesResponse = {
  puzzles: MapPuzzle[] | null;
  puzzlesError: string | null;
  progress: PuzzleProgress | null;
  progressError: string | null;
  warnings: string[];
  /** The current stage run on a run-limited map (lib/server/puzzle-runs); null elsewhere. */
  run?: PuzzleRunStatus | null;
};

/**
 * A stage run's puzzle attempts, kept server-side: backend-graded wrong answers
 * per puzzle in this run (not the lifetime AttemptCount). Failed after
 * `maxWrong` on one puzzle; then submits are refused until a restart.
 */
export type PuzzleRunStatus = { id: string; maxWrong: number; wrong: Record<string, number>; failed: boolean; failedPuzzle: string | null };

/** Body of POST /api/game/maps/[mapCode]/puzzles/[puzzleCode]/answer. */
export type PuzzleAnswerResponse = { result: PuzzleSubmitResult; run?: PuzzleRunStatus | null };

/** Body of POST /api/game/maps/[mapCode]/run/restart. */
export type PuzzleRunResponse = { run: PuzzleRunStatus };

export type PuzzleApiError = {
  error: string;
  code: "bad_request" | "config" | "timeout" | "unavailable" | "not_found" | "stage_failed" | "busy" | "not_failed";
  run?: PuzzleRunStatus | null;
};
