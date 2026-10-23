// Backend character records -> frontend CharacterProfile.
// HEROES stays the gameplay registry (ids, sprites, footPad, tint, ability
// codes); the backend is authoritative for profile text, stats and unlocks.
import { HEROES, isHeroId } from "@/lib/heroes";
import type { HeroId } from "@/lib/types";
import type {
  ApiCharacter,
  ApiCharacterAbility,
  CharacterAbility,
  CharacterListResponse,
  CharacterStats,
} from "./character-types";

/**
 * Backend character_code -> existing frontend HeroId. The database hero_id
 * values (swordsman, berserker, trickster…) differ from the game's ids, which
 * are persisted in progress keys and URLs, so they must not leak in.
 */
export const CHARACTER_CODE_TO_HERO_ID = {
  CHAR_SWORDSMAN: "sword",
  CHAR_PROFESSOR: "professor",
  CHAR_CHAIRMAN: "chairman",
  CHAR_BERSERKER: "angry",
  CHAR_TRICKSTER: "comedian",
} as const satisfies Record<string, HeroId>;

const STAT_KEYS = ["strength", "intelligence", "speed", "luck", "humor"] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOrNull = (v: unknown) => (isNum(v) ? v : null);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : []);

/**
 * Resolve the frontend HeroId: character_code first; then hero_id only if it
 * already is a frontend id (environments where the DB was corrected).
 * Unknown characters are rejected, never assigned to another hero.
 */
export function resolveHeroId(characterCode: unknown, heroId: unknown): HeroId | null {
  if (isStr(characterCode) && characterCode in CHARACTER_CODE_TO_HERO_ID) {
    return CHARACTER_CODE_TO_HERO_ID[characterCode as keyof typeof CHARACTER_CODE_TO_HERO_ID];
  }
  return isHeroId(heroId) ? heroId : null;
}

function adaptAbility(raw: unknown): CharacterAbility | null {
  if (!isObj(raw) || !isStr(raw.ability_code) || !isStr(raw.name)) return null;
  const a = raw as Partial<ApiCharacterAbility>;
  return {
    code: a.ability_code!,
    name: a.name!,
    description: str(a.description),
    type: isStr(a.ability_type) ? a.ability_type : null,
    power: numOrNull(a.power),
    cooldown: numOrNull(a.cooldown),
    energyCost: numOrNull(a.energy_cost),
    requiredLevel: numOrNull(a.required_level),
    isSpecial: a.is_special === true,
  };
}

function adaptStats(raw: unknown): CharacterStats | null {
  if (!isObj(raw) || !STAT_KEYS.every((k) => isNum(raw[k]))) return null;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return Object.fromEntries(STAT_KEYS.map((k) => [k, clamp(raw[k] as number)])) as CharacterStats;
}

type Adapted =
  | { ok: true; profile: CharacterListResponse["characters"][number] }
  | { ok: false; characterCode: string | null; reason: string };

export function adaptCharacter(raw: unknown): Adapted {
  if (!isObj(raw)) return { ok: false, characterCode: null, reason: "not an object" };
  const c = raw as Partial<ApiCharacter>;
  const code = isStr(c.character_code) ? c.character_code : null;
  const fail = (reason: string): Adapted => ({ ok: false, characterCode: code, reason });

  if (!code) return fail("missing character_code");
  if (!isStr(c.hero_id)) return fail("missing hero_id");
  if (!isStr(c.name)) return fail("missing name");
  if (!isNum(c.display_order)) return fail("missing display_order");
  const stats = adaptStats(c.stats);
  if (!stats) return fail("invalid stats");
  const special = adaptAbility(c.special_ability);
  if (!special) return fail("invalid special_ability");

  const heroId = resolveHeroId(code, c.hero_id);
  if (!heroId) return fail(`unsupported character (hero_id "${c.hero_id}")`);
  const hero = HEROES.find((h) => h.id === heroId);
  if (!hero) return fail(`no gameplay hero for "${heroId}"`);

  const abilities = (Array.isArray(c.abilities) ? c.abilities : [])
    .map(adaptAbility)
    .filter((a): a is CharacterAbility => a !== null);

  return {
    ok: true,
    profile: {
      heroId,
      characterCode: code,
      name: c.name!,
      nickname: str(c.nickname),
      title: str(c.title),
      characterClass: str(c.character_class),
      personality: str(c.personality),
      backstory: str(c.backstory),
      funnyQuote: str(c.funny_quote),
      strengths: strList(c.strengths),
      weaknesses: strList(c.weaknesses),
      stats,
      specialAbility: { ...special, isSpecial: true },
      abilities,
      unlock: {
        unlockable: c.is_unlockable === true,
        level: numOrNull(c.unlock_level) ?? 0,
        coins: numOrNull(c.unlock_coins) ?? 0,
      },
      base: {
        health: numOrNull(c.base_health),
        attack: numOrNull(c.base_attack),
        defense: numOrNull(c.base_defense),
        moveSpeed: numOrNull(c.base_movement_speed),
      },
      isDefault: c.is_default === true,
      displayOrder: c.display_order!,
      // Local assets are authoritative: backend image_url paths are not shipped.
      asset: hero.asset,
      footPad: hero.footPad,
      tint: hero.tint,
    },
  };
}

/** Validate, map, drop inactive / duplicate / unknown records, sort by display_order. */
export function adaptCharacterList(raw: unknown): CharacterListResponse {
  const list = isObj(raw) && Array.isArray(raw.characters) ? raw.characters : [];
  const out: CharacterListResponse = { characters: [], skipped: [] };
  const seen = new Set<HeroId>();
  for (const item of list) {
    if (isObj(item) && item.is_active === false) continue;
    const r = adaptCharacter(item);
    if (!r.ok) {
      out.skipped.push({ characterCode: r.characterCode, reason: r.reason });
    } else if (seen.has(r.profile.heroId)) {
      out.skipped.push({ characterCode: r.profile.characterCode, reason: `duplicate of ${r.profile.heroId}` });
    } else {
      seen.add(r.profile.heroId);
      out.characters.push(r.profile);
    }
  }
  out.characters.sort((a, b) => a.displayOrder - b.displayOrder);
  return out;
}
