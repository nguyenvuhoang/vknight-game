// Character Profile API contracts.
//  - Api*  : snake_case shapes at the network boundary (O24OpenAPI gateway).
//  - others: the normalized frontend model returned by GET /api/game/characters.
import type { HeroId } from "@/lib/types";

/** O24OpenAPI gateway envelope. */
export type GatewayResponse<T> = {
  code: string;
  success: boolean;
  message: string | null;
  data: T | null;
  errors: unknown[] | null;
  metadata?: unknown;
};

export type ApiCharacterStats = {
  strength: number;
  intelligence: number;
  speed: number;
  luck: number;
  humor: number;
};

export type ApiCharacterAbility = {
  ability_code: string;
  name: string;
  description: string | null;
  ability_type: string | null;
  power: number | null;
  cooldown: number | null;
  energy_cost: number | null;
  required_level: number | null;
  icon_url: string | null;
  animation_key: string | null;
  is_special: boolean;
};

export type ApiCharacter = {
  id: number;
  character_code: string;
  hero_id: string;
  name: string;
  nickname: string | null;
  title: string | null;
  character_class: string | null;
  personality: string | null;
  backstory: string | null;
  funny_quote: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  stats: ApiCharacterStats;
  special_ability: ApiCharacterAbility;
  abilities: ApiCharacterAbility[] | null;
  image_url: string | null;
  thumbnail_url: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  base_health: number | null;
  base_attack: number | null;
  base_defense: number | null;
  base_movement_speed: number | null;
  is_default: boolean;
  is_unlockable: boolean;
  unlock_level: number | null;
  unlock_coins: number | null;
  display_order: number;
  is_active: boolean;
};

export type ApiCharacterListData = { characters: ApiCharacter[] };

// ---------- normalized frontend model ----------

export type CharacterStatKey = keyof ApiCharacterStats;
/** Each stat is clamped to 0–100. */
export type CharacterStats = Record<CharacterStatKey, number>;

export type CharacterAbility = {
  code: string;
  name: string;
  description: string;
  type: string | null;
  power: number | null;
  cooldown: number | null;
  energyCost: number | null;
  requiredLevel: number | null;
  isSpecial: boolean;
};

export type CharacterProfile = {
  /** Existing frontend/gameplay id — never the backend hero_id. */
  heroId: HeroId;
  characterCode: string;
  name: string;
  nickname: string;
  title: string;
  characterClass: string;
  personality: string;
  backstory: string;
  funnyQuote: string;
  strengths: string[];
  weaknesses: string[];
  stats: CharacterStats;
  specialAbility: CharacterAbility;
  abilities: CharacterAbility[];
  unlock: { unlockable: boolean; level: number; coins: number };
  base: { health: number | null; attack: number | null; defense: number | null; moveSpeed: number | null };
  isDefault: boolean;
  displayOrder: number;
  // Gameplay registry values (from HEROES), authoritative for visuals.
  asset: string;
  footPad?: number;
  tint: string;
};

/** Body of GET /api/game/characters. */
export type CharacterListResponse = {
  characters: CharacterProfile[];
  /** Backend records the game could not map (unknown codes / invalid data). */
  skipped: { characterCode: string | null; reason: string }[];
};

/** Error body of GET /api/game/characters. */
export type CharacterListError = { error: string };
