import type { HeroId } from "./types";
const PREFIX = "vknight-v1:";
export function completed(hero: HeroId): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(PREFIX + hero) || "0") || 0;
}
export function saveLocal(hero: HeroId, level: number) {
  localStorage.setItem(PREFIX + hero, String(Math.max(level, completed(hero))));
}
export async function syncProgress(
  playerId: string,
  hero: HeroId,
  level: number,
) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return; // Local-only demo works without .NET API.
  try {
    await fetch(`${base}/api/v1/progress/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, heroId: hero, level }),
    });
  } catch (e) {
    console.warn("API sync failed; local progress preserved", e);
  }
}
export function getGuestId() {
  let id = localStorage.getItem(PREFIX + "guest");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PREFIX + "guest", id);
  }
  return id;
}
