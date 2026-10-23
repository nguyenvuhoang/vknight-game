import { STAGE1 } from "./stage1";
import type { AdventureStageConfig } from "./types";

// Levels listed here play as adventure-puzzle scenes; the others keep the
// existing Phaser side-view game.
const STAGES: Record<number, AdventureStageConfig> = { 1: STAGE1 };

export const getAdventureStage = (level: number): AdventureStageConfig | undefined =>
  STAGES[level];
