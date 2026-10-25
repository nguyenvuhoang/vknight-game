// Map gameplay contracts (WF_BO_GET_MAP_GAMEPLAY).
//  - Api*  : snake_case DTOs exactly as the gateway returns them; several fields
//            are JSON *strings* (conditions, choices, actions).
//  - others: parsed, validated model used by the gameplay engines and UI.
import type { GatewayResponse } from "@/lib/api/character-types";

export type ApiGameplayNpc = {
  npc_code: string;
  spawn_code: string;
  name: string;
  image_url: string | null;
  sprite_key: string | null;
  position_x: number;
  position_y: number;
  scale: number | null;
  initial_state: string | null;
  animation_key: string | null;
  is_interactable: boolean;
  is_visible: boolean;
};

export type ApiGameplayItem = {
  item_code: string;
  spawn_code: string;
  name: string;
  image_url: string | null;
  sprite_key: string | null;
  position_x: number;
  position_y: number;
  scale: number | null;
  quantity: number;
  spawn_type: string;
  is_initially_visible: boolean;
  /** JSON-encoded Condition or null. */
  spawn_condition: string | null;
};

export type ApiGameplayObjective = {
  objective_code: string;
  title: string;
  description: string | null;
  objective_type: string;
  target_code: string | null;
  required_quantity: number;
  /** JSON-encoded Condition or null. */
  unlock_condition: string | null;
  /** JSON-encoded Condition. */
  completion_condition: string | null;
  is_required: boolean;
  display_order: number;
};

export type ApiGameplayDialogue = {
  dialogue_code: string;
  speaker_type: string;
  text: string;
  /** JSON-encoded ApiChoice[] or null. */
  choices: string | null;
  next_dialogue_code: string | null;
  /** JSON-encoded Condition or null. */
  trigger_condition: string | null;
  /** JSON-encoded Action[] or null. */
  actions: string | null;
  is_ending: boolean;
};

export type ApiMapGameplay = {
  map_code: string;
  npcs: ApiGameplayNpc[];
  items: ApiGameplayItem[];
  objectives: ApiGameplayObjective[];
  dialogues: ApiGameplayDialogue[];
};

export type MapGameplayGatewayResponse = GatewayResponse<{ gameplay: ApiMapGameplay | null }>;

// ---------- conditions & actions (shared by objectives, spawns, dialogues) ----------

export type Condition =
  | { type: "OBJECTIVE_COMPLETED"; objective_code: string }
  | { type: "ITEM_COLLECTED"; item_code: string; quantity: number }
  | { type: "DIALOGUE_REACHED"; dialogue_code: string }
  | { type: "DIALOGUE_CHOICE"; choice_id: string }
  | { type: "HAS_ITEM"; item_code: string; quantity: number }
  | { type: "ALL"; conditions: Condition[] }
  /** Unparseable / unsupported condition: never satisfied (fail closed). */
  | { type: "INVALID"; reason: string };

export type Action =
  | { type: "REMOVE_ITEM"; item_code: string; quantity: number }
  | { type: "ADD_ITEM"; item_code: string; quantity: number }
  | { type: "COMPLETE_OBJECTIVE"; objective_code: string }
  | { type: "INVALID"; reason: string };

// ---------- normalized model ----------

export type GameplayNpc = {
  code: string;
  spawnCode: string;
  name: string;
  imageUrl: string | null;
  /** False when the backend image does not exist under /public (checked server-side). */
  imageAvailable: boolean;
  spriteKey: string | null;
  /** Feet position, 0–100 of the scene. */
  x: number;
  y: number;
  scale: number;
  state: string | null;
  interactable: boolean;
  visible: boolean;
};

export type GameplayItem = {
  code: string;
  spawnCode: string;
  name: string;
  imageUrl: string | null;
  imageAvailable: boolean;
  spriteKey: string | null;
  x: number;
  y: number;
  scale: number;
  quantity: number;
  spawnType: string;
  initiallyVisible: boolean;
  spawnCondition: Condition | null;
};

export type GameplayObjective = {
  code: string;
  title: string;
  description: string;
  type: string;
  targetCode: string | null;
  requiredQuantity: number;
  unlockCondition: Condition | null;
  completionCondition: Condition | null;
  required: boolean;
  displayOrder: number;
};

export type DialogueChoice = {
  id: string;
  text: string;
  condition: Condition | null;
  actions: Action[];
  next: string | null;
};

export type DialogueNode = {
  code: string;
  speaker: "NPC" | "HERO" | "NARRATOR" | (string & {});
  text: string;
  choices: DialogueChoice[];
  next: string | null;
  trigger: Condition | null;
  actions: Action[];
  ending: boolean;
};

export type MapGameplay = {
  mapCode: string;
  npcs: GameplayNpc[];
  items: GameplayItem[];
  /** Sorted by display_order. */
  objectives: GameplayObjective[];
  /** In backend order (the first root node whose trigger passes starts a conversation). */
  dialogues: DialogueNode[];
};

/** Body of GET /api/game/maps/[mapCode]/gameplay. */
export type MapGameplayResponse = {
  gameplay: MapGameplay;
  /** Data problems found while normalizing (bad JSON, missing assets…). */
  warnings: string[];
};

export type MapGameplayError = {
  error: string;
  code: "bad_request" | "not_found" | "timeout" | "unavailable" | "config";
};

// ---------- runtime state (one stage run; local only, not server-authoritative) ----------

export type GameplayState = {
  /** Current quantities. Never negative. */
  inventory: Record<string, number>;
  /** Lifetime collected totals per item — history survives consumption. */
  collected: Record<string, number>;
  /** Item spawns already picked up (each spawn once per run). */
  pickedSpawns: string[];
  /** Completed objective codes, in completion order. */
  completed: string[];
  /** Dialogue nodes reached. */
  reached: string[];
  /** Dialogue choice ids successfully taken. */
  choices: string[];
  /** Idempotency keys of action batches already applied. */
  applied: string[];
};

export type EngineResult = { ok: true; state: GameplayState } | { ok: false; state: GameplayState; error: string };

export const emptyGameplayState = (): GameplayState => ({
  inventory: {},
  collected: {},
  pickedSpawns: [],
  completed: [],
  reached: [],
  choices: [],
  applied: [],
});
