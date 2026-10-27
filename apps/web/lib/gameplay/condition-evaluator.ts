import type { Condition, GameplayState } from "./gameplay-types";

/** null = no condition (always true); INVALID / unknown = never true (fail closed). */
export function evaluate(cond: Condition | null, s: GameplayState): boolean {
  if (!cond) return true;
  switch (cond.type) {
    case "OBJECTIVE_COMPLETED":
      return s.completed.includes(cond.objective_code);
    case "ITEM_COLLECTED":
      // History: still true after the item has been given away.
      return (s.collected[cond.item_code] ?? 0) >= cond.quantity;
    case "HAS_ITEM":
      return (s.inventory[cond.item_code] ?? 0) >= cond.quantity;
    case "DIALOGUE_REACHED":
      return s.reached.includes(cond.dialogue_code);
    case "DIALOGUE_CHOICE":
      return s.choices.includes(cond.choice_id);
    case "INTERACT":
      return (s.interacted ?? []).includes(cond.target_code);
    case "ALL":
      return cond.conditions.every((c) => evaluate(c, s));
    default:
      return false;
  }
}

/** Progress for trackers: ALL counts satisfied parts; item counts use quantities. */
export function progress(cond: Condition | null, s: GameplayState): { done: number; total: number } {
  if (!cond) return { done: 1, total: 1 };
  if (cond.type === "ALL") {
    return { done: cond.conditions.filter((c) => evaluate(c, s)).length, total: cond.conditions.length };
  }
  if (cond.type === "ITEM_COLLECTED" || cond.type === "HAS_ITEM") {
    const have = cond.type === "ITEM_COLLECTED" ? s.collected[cond.item_code] ?? 0 : s.inventory[cond.item_code] ?? 0;
    return { done: Math.min(have, cond.quantity), total: cond.quantity };
  }
  return { done: evaluate(cond, s) ? 1 : 0, total: 1 };
}

/** Human-readable requirement for a disabled choice (item names resolved by caller). */
export function describeMissing(
  cond: Condition | null,
  s: GameplayState,
  itemName: (code: string) => string,
  objectiveTitle: (code: string) => string | null = () => null,
): string | null {
  if (!cond || evaluate(cond, s)) return null;
  switch (cond.type) {
    case "HAS_ITEM":
    case "ITEM_COLLECTED":
      return `Cần ${cond.quantity > 1 ? `${cond.quantity} × ` : ""}${itemName(cond.item_code)}`;
    case "OBJECTIVE_COMPLETED": {
      const title = objectiveTitle(cond.objective_code);
      return title ? `Cần xong: ${title}` : "Cần hoàn thành nhiệm vụ trước";
    }
    case "ALL":
      return cond.conditions.map((c) => describeMissing(c, s, itemName, objectiveTitle)).find(Boolean) ?? null;
    default:
      return "Chưa đủ điều kiện";
  }
}
