import { describeMissing, evaluate } from "./condition-evaluator";
import { addItem, removeItem } from "./inventory-engine";
import { completeObjective, settleObjectives } from "./objective-engine";
import type { Action, DialogueChoice, DialogueNode, EngineResult, GameplayState, MapGameplay } from "./gameplay-types";

const nodeOf = (g: MapGameplay, code: string | null) => (code ? g.dialogues.find((d) => d.code === code) ?? null : null);

/**
 * Entry nodes: not the target of any `next`. The first whose trigger passes starts the talk.
 * With several NPCs the backend links a dialogue to its speaker only by name
 * (NPC_STAGE03_FARMER ↔ DIALOGUE_STAGE03_FARMER_*): when some entry nodes are
 * named after `npcCode`, only those are considered for that NPC.
 */
export function startNode(g: MapGameplay, s: GameplayState, npcCode?: string): DialogueNode | null {
  const targets = new Set(g.dialogues.flatMap((d) => [d.next, ...d.choices.map((c) => c.next)]).filter(Boolean));
  const roots = g.dialogues.filter((d) => !targets.has(d.code));
  const pool = roots.length ? roots : g.dialogues;
  const prefix = npcCode ? `DIALOGUE_${npcCode.replace(/^NPC_/, "")}` : null;
  const own = prefix ? pool.filter((d) => d.code === prefix || d.code.startsWith(`${prefix}_`)) : [];
  return (own.length ? own : pool).find((d) => evaluate(d.trigger, s)) ?? null;
}

/** Apply a batch atomically: all actions succeed or the state is unchanged. */
export function applyActions(g: MapGameplay, s: GameplayState, actions: Action[]): EngineResult {
  let state = s;
  for (const a of actions) {
    let r: EngineResult;
    if (a.type === "REMOVE_ITEM") r = removeItem(state, a.item_code, a.quantity);
    else if (a.type === "ADD_ITEM") r = addItem(state, a.item_code, a.quantity);
    else if (a.type === "COMPLETE_OBJECTIVE") r = completeObjective(g.objectives, state, a.objective_code);
    else r = { ok: false, state, error: `Hành động không hợp lệ (${a.reason})` };
    if (!r.ok) return { ok: false, state: s, error: r.error };
    state = r.state;
  }
  return { ok: true, state };
}

/** Enter a node: mark reached, run its own actions once, then settle objectives. */
export function reachNode(g: MapGameplay, s: GameplayState, code: string): { state: GameplayState; node: DialogueNode | null; error?: string } {
  const node = nodeOf(g, code);
  if (!node) return { state: s, node: null, error: `Không tìm thấy hội thoại ${code}` };
  let state = s.reached.includes(code) ? s : { ...s, reached: [...s.reached, code] };
  let error: string | undefined;
  const key = `node:${code}`;
  if (node.actions.length && !state.applied.includes(key)) {
    const r = applyActions(g, state, node.actions);
    if (r.ok) state = { ...r.state, applied: [...r.state.applied, key] };
    else error = r.error;
  }
  return { state: settleObjectives(g.objectives, state).state, node, error };
}

export type ChoiceView = DialogueChoice & { enabled: boolean; reason: string | null };

/** Choices as shown: conditional ones stay visible but are not executable. */
export function viewChoices(g: MapGameplay, s: GameplayState, node: DialogueNode): ChoiceView[] {
  const itemName = (code: string) => g.items.find((i) => i.code === code)?.name ?? code;
  const objectiveTitle = (code: string) => g.objectives.find((o) => o.code === code)?.title ?? null;
  return node.choices.map((c) => {
    const done = c.actions.length > 0 && s.applied.includes(`choice:${c.id}`);
    const missing = describeMissing(c.condition, s, itemName, objectiveTitle);
    return { ...c, enabled: !done && !missing, reason: done ? "Đã làm rồi" : missing };
  });
}

/**
 * Take a choice. Re-validates the condition (never trusts the UI), applies its
 * actions atomically and at most once per choice id (so the same bone can't be
 * traded twice from either dialogue node), records the choice, settles
 * objectives and returns the next node code.
 */
export function choose(
  g: MapGameplay,
  s: GameplayState,
  nodeCode: string,
  choiceId: string,
): { ok: true; state: GameplayState; next: string | null } | { ok: false; state: GameplayState; error: string } {
  const node = nodeOf(g, nodeCode);
  const choice = node?.choices.find((c) => c.id === choiceId);
  if (!node || !choice) return { ok: false, state: s, error: "Lựa chọn không hợp lệ." };
  if (!evaluate(choice.condition, s)) return { ok: false, state: s, error: "Chưa đủ điều kiện cho lựa chọn này." };
  let state = s;
  const key = `choice:${choice.id}`;
  if (choice.actions.length) {
    if (state.applied.includes(key)) return { ok: false, state: s, error: "Việc này làm rồi mà!" };
    const r = applyActions(g, state, choice.actions);
    if (!r.ok) return { ok: false, state: s, error: r.error };
    state = { ...r.state, applied: [...r.state.applied, key] };
  }
  if (!state.choices.includes(choice.id)) state = { ...state, choices: [...state.choices, choice.id] };
  return { ok: true, state: settleObjectives(g.objectives, state).state, next: choice.next };
}
