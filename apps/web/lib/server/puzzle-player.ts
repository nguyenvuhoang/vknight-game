// Server-only: the player identity for puzzle workflows. The browser sends the
// existing local GuestId (lib/progress getGuestId) and its HeroId; both are
// validated here and the backend CharacterId is resolved server-side, so the
// same (guest_id, character_id) pair is used for submit and progress.
import { isHeroId } from "@/lib/heroes";
import { backendCharacterId } from "./character-ids";

const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAP_CODE = /^[A-Z][A-Z0-9_]{2,39}$/;
export const PUZZLE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

export type PuzzlePlayer = { guest_id: string; character_id: number };

/**
 * Validate `{ guest, hero }` from a request body. Returns the workflow fields,
 * "bad" for invalid input, or "unknown_hero" when the backend has no character.
 */
export async function puzzlePlayer(body: unknown): Promise<PuzzlePlayer | "bad" | "unknown_hero"> {
  if (typeof body !== "object" || body === null) return "bad";
  const { guest, hero } = body as Record<string, unknown>;
  if (typeof guest !== "string" || !GUEST_ID.test(guest) || typeof hero !== "string" || !isHeroId(hero)) return "bad";
  const characterId = await backendCharacterId(hero);
  return characterId == null ? "unknown_hero" : { guest_id: guest.toLowerCase(), character_id: characterId };
}

/** Read a small JSON body (puzzle requests are tiny). */
export async function readJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
