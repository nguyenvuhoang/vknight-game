import { evaluate } from "./condition-evaluator";
import type { EngineResult, GameplayItem, GameplayState } from "./gameplay-types";

export const quantityOf = (s: GameplayState, code: string) => s.inventory[code] ?? 0;
export const hasItem = (s: GameplayState, code: string, qty = 1) => quantityOf(s, code) >= qty;

export function addItem(s: GameplayState, code: string, qty: number): EngineResult {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, state: s, error: `Số lượng không hợp lệ: ${qty}` };
  return {
    ok: true,
    state: {
      ...s,
      inventory: { ...s.inventory, [code]: quantityOf(s, code) + qty },
      collected: { ...s.collected, [code]: (s.collected[code] ?? 0) + qty },
    },
  };
}

/** Validates ownership and quantity; never goes negative. Collection history is kept. */
export function removeItem(s: GameplayState, code: string, qty: number): EngineResult {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, state: s, error: `Số lượng không hợp lệ: ${qty}` };
  const have = quantityOf(s, code);
  if (have < qty) return { ok: false, state: s, error: `Không đủ vật phẩm (${have}/${qty})` };
  const inventory = { ...s.inventory, [code]: have - qty };
  if (inventory[code] === 0) delete inventory[code];
  return { ok: true, state: { ...s, inventory } };
}

/** Is this spawn currently on the ground (spawn condition met, not yet picked up)? */
export function isItemVisible(item: GameplayItem, s: GameplayState): boolean {
  if (s.pickedSpawns.includes(item.spawnCode)) return false;
  if (item.initiallyVisible) return true;
  return item.spawnCondition !== null && evaluate(item.spawnCondition, s);
}

/** Pick up a spawn once per run. */
export function pickUp(item: GameplayItem, s: GameplayState): EngineResult {
  if (s.pickedSpawns.includes(item.spawnCode)) return { ok: false, state: s, error: "Đã nhặt rồi." };
  if (!isItemVisible(item, s)) return { ok: false, state: s, error: "Chưa thấy vật phẩm này đâu cả." };
  if (item.spawnType !== "PICKUP") return { ok: false, state: s, error: "Không nhặt được vật này." };
  const r = addItem(s, item.code, item.quantity);
  if (!r.ok) return r;
  return { ok: true, state: { ...r.state, pickedSpawns: [...r.state.pickedSpawns, item.spawnCode] } };
}
