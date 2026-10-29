// Content readiness per stage, separate from player progression: progress
// decides LOCKED / unlocked, this decides whether an unlocked stage has
// finished gameplay. A READY stage plays backend-driven gameplay
// (WF_BO_GET_MAP_GAMEPLAY + puzzles) and needs a scene in stage-scenes.ts;
// anything else shows the "under development" screen. Activating a stage is a
// one-line change here. (Could later come from ChapterMap metadata or a backend
// publishing field; ChapterMap.Status is not used for this.)

export type StageAvailability = "READY" | "IN_DEVELOPMENT";

type StageContent = {
  status: StageAvailability;
  /** Shown on the under-development screen; a generic line is used otherwise. */
  devNote?: string;
};

const CHAPTER_STAGES: Record<number, Record<number, StageContent>> = {
  1: {
    1: { status: "READY" },
    2: { status: "READY" },
    3: { status: "READY" },
    4: { status: "READY" },
  },
};

export const DEFAULT_DEV_NOTE = "Thợ dựng ải đang gõ búa chan chát, sơn còn chưa khô. Quay lại sau nhé!";

/** Unlisted stages are IN_DEVELOPMENT until verified. */
export function stageContent(chapter: number, level: number): StageContent {
  return CHAPTER_STAGES[chapter]?.[level] ?? { status: "IN_DEVELOPMENT" };
}

export const isStageReady = (chapter: number, level: number) => stageContent(chapter, level).status === "READY";
