// WF_BO_GET_MAP_GAMEPLAY payload -> MapGameplay. Pure: asset existence is
// injected so the route can check /public while tests stay deterministic.
import type {
  Action,
  ApiGameplayDialogue,
  ApiGameplayItem,
  ApiGameplayNpc,
  ApiGameplayObjective,
  Condition,
  DialogueChoice,
  DialogueNode,
  GameplayItem,
  GameplayNpc,
  GameplayObjective,
  MapGameplay,
} from "./gameplay-types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const posInt = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : fallback);
const pct = (v: unknown) => (isNum(v) ? Math.min(100, Math.max(0, v)) : null);

/** Parse a field that may be a JSON string, an already-decoded value, or null. */
function decode(raw: unknown, warn: (m: string) => void, where: string): unknown {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    warn(`${where}: invalid JSON`);
    return undefined; // distinguishes "malformed" from "absent"
  }
}

export function parseCondition(raw: unknown, warn: (m: string) => void = () => {}, where = "condition"): Condition | null {
  const v = decode(raw, warn, where);
  if (v === null) return null;
  if (!isObj(v)) return { type: "INVALID", reason: `${where}: not an object` };
  const bad = (reason: string): Condition => {
    warn(`${where}: ${reason}`);
    return { type: "INVALID", reason };
  };
  switch (v.type) {
    case "OBJECTIVE_COMPLETED":
      return isStr(v.objective_code) ? { type: v.type, objective_code: v.objective_code } : bad("missing objective_code");
    case "ITEM_COLLECTED":
    case "HAS_ITEM":
      return isStr(v.item_code)
        ? { type: v.type, item_code: v.item_code, quantity: posInt(v.quantity, 1) }
        : bad("missing item_code");
    case "DIALOGUE_REACHED":
      return isStr(v.dialogue_code) ? { type: v.type, dialogue_code: v.dialogue_code } : bad("missing dialogue_code");
    case "DIALOGUE_CHOICE":
      return isStr(v.choice_id) ? { type: v.type, choice_id: v.choice_id } : bad("missing choice_id");
    case "ALL": {
      if (!Array.isArray(v.conditions) || !v.conditions.length) return bad("ALL needs conditions[]");
      return {
        type: "ALL",
        conditions: v.conditions.map((c, i) => parseCondition(c, warn, `${where}.conditions[${i}]`) ?? { type: "INVALID", reason: "null" }),
      };
    }
    default:
      return bad(`unsupported type ${String(v.type)}`);
  }
}

export function parseActions(raw: unknown, warn: (m: string) => void = () => {}, where = "actions"): Action[] {
  const v = decode(raw, warn, where);
  if (v == null) return [];
  if (!Array.isArray(v)) {
    warn(`${where}: not an array`);
    return [{ type: "INVALID", reason: "not an array" }];
  }
  return v.map((a, i): Action => {
    const at = `${where}[${i}]`;
    if (!isObj(a)) return { type: "INVALID", reason: `${at}: not an object` };
    if ((a.type === "REMOVE_ITEM" || a.type === "ADD_ITEM") && isStr(a.item_code)) {
      return { type: a.type, item_code: a.item_code, quantity: posInt(a.quantity, 1) };
    }
    if (a.type === "COMPLETE_OBJECTIVE" && isStr(a.objective_code)) {
      return { type: a.type, objective_code: a.objective_code };
    }
    warn(`${at}: unsupported or incomplete action ${String(a.type)}`);
    return { type: "INVALID", reason: `${at}: ${String(a.type)}` };
  });
}

function parseChoices(raw: unknown, warn: (m: string) => void, where: string): DialogueChoice[] {
  const v = decode(raw, warn, where);
  if (v == null) return [];
  if (!Array.isArray(v)) {
    warn(`${where}: not an array`);
    return [];
  }
  const out: DialogueChoice[] = [];
  v.forEach((c, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(c) || !isStr(c.id) || !isStr(c.text)) {
      warn(`${at}: missing id/text — skipped`);
      return;
    }
    out.push({
      id: c.id,
      text: c.text,
      condition: parseCondition(c.condition ?? null, warn, `${at}.condition`),
      actions: parseActions(c.actions ?? null, warn, `${at}.actions`),
      next: isStr(c.next_dialogue_code) ? c.next_dialogue_code : null,
    });
  });
  return out;
}

export type AdaptGameplayResult =
  | { ok: true; gameplay: MapGameplay; warnings: string[] }
  | { ok: false; code: "not_found" | "format"; reason: string };

/** Validate `data` from the gateway and normalize it. */
export function adaptGameplay(
  data: unknown,
  requestedMapCode: string,
  assetExists: (url: string) => boolean = () => true,
): AdaptGameplayResult {
  if (!isObj(data) || !("gameplay" in data)) return { ok: false, code: "format", reason: "missing data.gameplay" };
  const g = data.gameplay;
  if (g === null) return { ok: false, code: "not_found", reason: `no gameplay for ${requestedMapCode}` };
  if (!isObj(g)) return { ok: false, code: "format", reason: "gameplay is not an object" };
  if (g.map_code !== requestedMapCode) {
    return { ok: false, code: "format", reason: `map_code ${String(g.map_code)} ≠ requested ${requestedMapCode}` };
  }
  for (const k of ["npcs", "items", "objectives", "dialogues"] as const) {
    if (!Array.isArray(g[k])) return { ok: false, code: "format", reason: `${k} is not an array` };
  }
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const asset = (url: unknown, who: string) => {
    if (!isStr(url)) return { imageUrl: null, imageAvailable: false };
    const ok = assetExists(url);
    if (!ok) warn(`${who}: image ${url} does not exist`);
    return { imageUrl: url, imageAvailable: ok };
  };

  const npcs: GameplayNpc[] = [];
  for (const raw of g.npcs as unknown[]) {
    const n = raw as Partial<ApiGameplayNpc>;
    const x = pct(n.position_x), y = pct(n.position_y);
    if (!isStr(n.npc_code) || !isStr(n.name) || x == null || y == null) {
      warn(`npc ${String(n.npc_code)}: missing code/name/position — skipped`);
      continue;
    }
    npcs.push({
      code: n.npc_code,
      spawnCode: isStr(n.spawn_code) ? n.spawn_code : n.npc_code,
      name: n.name,
      ...asset(n.image_url, `npc ${n.npc_code}`),
      spriteKey: isStr(n.sprite_key) ? n.sprite_key : null,
      x,
      y,
      scale: isNum(n.scale) && n.scale > 0 ? n.scale : 1,
      state: isStr(n.initial_state) ? n.initial_state : null,
      interactable: n.is_interactable !== false,
      visible: n.is_visible !== false,
    });
  }

  const items: GameplayItem[] = [];
  const spawnCodes = new Set<string>();
  for (const raw of g.items as unknown[]) {
    const it = raw as Partial<ApiGameplayItem>;
    const x = pct(it.position_x), y = pct(it.position_y);
    if (!isStr(it.item_code) || !isStr(it.spawn_code) || !isStr(it.name) || x == null || y == null) {
      warn(`item ${String(it.item_code)}: missing code/spawn/name/position — skipped`);
      continue;
    }
    if (spawnCodes.has(it.spawn_code)) {
      warn(`item spawn ${it.spawn_code}: duplicate — skipped`);
      continue;
    }
    spawnCodes.add(it.spawn_code);
    items.push({
      code: it.item_code,
      spawnCode: it.spawn_code,
      name: it.name,
      ...asset(it.image_url, `item ${it.item_code}`),
      spriteKey: isStr(it.sprite_key) ? it.sprite_key : null,
      x,
      y,
      scale: isNum(it.scale) && it.scale > 0 ? it.scale : 1,
      quantity: posInt(it.quantity, 1),
      spawnType: isStr(it.spawn_type) ? it.spawn_type : "PICKUP",
      initiallyVisible: it.is_initially_visible === true,
      spawnCondition: parseCondition(it.spawn_condition, warn, `item ${it.spawn_code}.spawn_condition`),
    });
  }

  const objectives: GameplayObjective[] = [];
  for (const raw of g.objectives as unknown[]) {
    const o = raw as Partial<ApiGameplayObjective>;
    if (!isStr(o.objective_code) || !isStr(o.title)) {
      warn(`objective ${String(o.objective_code)}: missing code/title — skipped`);
      continue;
    }
    const completion = parseCondition(o.completion_condition, warn, `objective ${o.objective_code}.completion_condition`);
    if (!completion) warn(`objective ${o.objective_code}: no completion_condition (completes only via COMPLETE_OBJECTIVE)`);
    objectives.push({
      code: o.objective_code,
      title: o.title,
      description: typeof o.description === "string" ? o.description : "",
      type: isStr(o.objective_type) ? o.objective_type : "",
      targetCode: isStr(o.target_code) ? o.target_code : null,
      requiredQuantity: posInt(o.required_quantity, 1),
      unlockCondition: parseCondition(o.unlock_condition, warn, `objective ${o.objective_code}.unlock_condition`),
      completionCondition: completion,
      required: o.is_required !== false,
      displayOrder: isNum(o.display_order) ? o.display_order : objectives.length + 1,
    });
  }
  objectives.sort((a, b) => a.displayOrder - b.displayOrder);

  const dialogues: DialogueNode[] = [];
  for (const raw of g.dialogues as unknown[]) {
    const d = raw as Partial<ApiGameplayDialogue>;
    if (!isStr(d.dialogue_code) || !isStr(d.text)) {
      warn(`dialogue ${String(d.dialogue_code)}: missing code/text — skipped`);
      continue;
    }
    const at = `dialogue ${d.dialogue_code}`;
    dialogues.push({
      code: d.dialogue_code,
      speaker: isStr(d.speaker_type) ? d.speaker_type.toUpperCase() : "NPC",
      text: d.text,
      choices: parseChoices(d.choices, warn, `${at}.choices`),
      next: isStr(d.next_dialogue_code) ? d.next_dialogue_code : null,
      trigger: parseCondition(d.trigger_condition, warn, `${at}.trigger_condition`),
      actions: parseActions(d.actions, warn, `${at}.actions`),
      ending: d.is_ending === true,
    });
  }
  // Dangling references are reported, not fatal.
  const codes = new Set(dialogues.map((d) => d.code));
  for (const d of dialogues) {
    for (const ref of [d.next, ...d.choices.map((c) => c.next)]) {
      if (ref && !codes.has(ref)) warn(`dialogue ${d.code}: next ${ref} does not exist`);
    }
  }

  return { ok: true, gameplay: { mapCode: requestedMapCode, npcs, items, objectives, dialogues }, warnings };
}
