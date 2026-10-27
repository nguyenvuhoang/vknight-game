// Shared HUD types. Activity events are produced by GameplayStage from real
// state transitions (never a canned history).
export type ActivityKind = "system" | "quest" | "item" | "npc" | "gate";

export type ActivityEvent = {
  id: number;
  /** Local wall-clock time, HH:MM. */
  time: string;
  kind: ActivityKind;
  text: string;
};
