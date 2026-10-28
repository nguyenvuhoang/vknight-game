// Server-only: frontend HeroId -> backend character id (ChapterCharacter.id),
// the CharacterId that player-scoped workflows (puzzle submit / progress) need.
// Resolved here so the browser never chooses a backend character id itself.
import { resolveHeroId } from "@/lib/api/character-adapter";
import type { HeroId } from "@/lib/types";
import { callWorkflow, WORKFLOWS } from "./o24-gateway";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; ids: Map<HeroId, number> } | null = null;
let inflight: Promise<Map<HeroId, number>> | null = null;

async function load(): Promise<Map<HeroId, number>> {
  const data = await callWorkflow<{ characters?: unknown }>(WORKFLOWS.listCharacters, { include_inactive: false });
  const ids = new Map<HeroId, number>();
  for (const c of Array.isArray(data.characters) ? data.characters : []) {
    if (typeof c !== "object" || c === null) continue;
    const { id, character_code, hero_id } = c as Record<string, unknown>;
    const hero = resolveHeroId(character_code, hero_id);
    if (hero && typeof id === "number" && Number.isInteger(id) && id > 0 && !ids.has(hero)) ids.set(hero, id);
  }
  return ids;
}

/** Backend character id for a hero, or null when the backend has no such character. */
export async function backendCharacterId(hero: HeroId): Promise<number | null> {
  if (!cache || Date.now() - cache.at >= TTL_MS) {
    inflight ??= load().finally(() => (inflight = null));
    const ids = await inflight;
    if (ids.size) cache = { at: Date.now(), ids };
    return ids.get(hero) ?? null;
  }
  return cache.ids.get(hero) ?? null;
}
