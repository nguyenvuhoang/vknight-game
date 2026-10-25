import GameplaySprite from "./GameplaySprites";
import type { GameplayItem, GameplayState } from "@/lib/gameplay/gameplay-types";

/** Bag slots: current quantities only (consumed items disappear). */
export default function InventoryPanel({ items, state, slots = 4 }: { items: GameplayItem[]; state: GameplayState; slots?: number }) {
  const owned = Object.entries(state.inventory).filter(([, q]) => q > 0);
  const byCode = (code: string) => items.find((i) => i.code === code);
  return (
    <div className="adv-inventory gp-inventory" aria-label="Túi đồ">
      {Array.from({ length: Math.max(slots, owned.length) }, (_, i) => {
        const entry = owned[i];
        if (!entry) return <span key={`empty-${i}`} className="adv-slot is-empty" aria-hidden />;
        const [code, qty] = entry;
        const it = byCode(code);
        return (
          <span key={code} className="adv-slot gp-slot" title={it?.name ?? code} aria-label={`${it?.name ?? code} × ${qty}`}>
            <span className="gp-slot-icon" aria-hidden>
              {it ? (
                <GameplaySprite name={it.name} imageUrl={it.imageUrl} imageAvailable={it.imageAvailable} spriteKey={it.spriteKey} />
              ) : (
                "❔"
              )}
            </span>
            <span className="adv-slot-name">{it?.name ?? code}</span>
            {qty > 1 && <span className="gp-slot-qty">×{qty}</span>}
          </span>
        );
      })}
    </div>
  );
}
