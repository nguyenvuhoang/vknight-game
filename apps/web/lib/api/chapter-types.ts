// Chapter Map API contracts.
//  - Api*      : snake_case DTOs at the network boundary (WF_BO_GET_CHAPTER_MAP).
//  - Frontend* : the normalized model returned by GET /api/game/chapters/[n]/maps.
// Maps are static configuration: they say nothing about the player's progress.
import type { GatewayResponse } from "./character-types";

export type ApiChapterMap = {
  id: number;
  chapter_id: number;
  map_code: string;
  level: number;
  title: string;
  description: string;
  story: string | null;
  guide_text: string | null;
  hint_text: string | null;
  completion_text: string | null;
  image_url: string;
  thumbnail_url: string | null;
  background_image_url: string | null;
  preview_image_url: string | null;
  accent_color: string | null;
  map_type: string;
  difficulty: string;
  boss_code: string | null;
  gameplay_config: string | null;
  recommended_power: number;
  estimated_duration: number;
  required_level: number;
  is_free: boolean;
  allow_skip: boolean;
  skip_price: number;
  reward_coins: number;
  reward_experience: number;
  display_order: number;
  is_boss_level: boolean;
  is_published: boolean;
  is_active: boolean;
};

export type ApiGameChapter = {
  id: number;
  chapter_code: string;
  chapter_number: number;
  title: string;
  subtitle: string;
  description: string;
  story: string[];
  cover_image_url: string;
  background_image_url: string | null;
  thumbnail_url: string | null;
  recommended_level: number;
  display_order: number;
  is_default: boolean;
  is_published: boolean;
  is_active: boolean;
  total_maps: number;
  maps: ApiChapterMap[];
};

export type ChapterMapGatewayResponse = GatewayResponse<{ chapter: ApiGameChapter | null }>;

// ---------- normalized frontend model ----------

/** Known backend values; unknown strings are passed through as-is. */
export type MapType = "NORMAL" | "PUZZLE" | "BOSS" | (string & {});
export type MapDifficulty = "EASY" | "MEDIUM" | "HARD" | (string & {});

export type FrontendChapterMap = {
  level: number;
  code: string;
  title: string;
  description: string;
  /** Authoritative illustration path from the backend (image_url). */
  image: string;
  thumbnail: string | null;
  story: string | null;
  guideText: string | null;
  hintText: string | null;
  completionText: string | null;
  mapType: MapType | null;
  difficulty: MapDifficulty | null;
  isBoss: boolean;
  bossCode: string | null;
  /** Minutes. */
  estimatedDuration: number | null;
  recommendedPower: number | null;
  requiredLevel: number | null;
  allowSkip: boolean;
  /** Informational only — there is no payment flow. */
  skipPrice: number | null;
  rewardCoins: number | null;
  rewardExperience: number | null;
  accentColor: string | null;
  displayOrder: number;
};

export type FrontendGameChapter = {
  chapterNumber: number;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  story: string[];
  /** "local-fallback" = backend story was empty and the bundled Chapter 1 story is used. */
  storySource: "backend" | "local-fallback" | "none";
  coverImage: string | null;
  recommendedLevel: number | null;
  /** Published + active maps, sorted by display_order then level. */
  maps: FrontendChapterMap[];
};

/** Body of GET /api/game/chapters/[n]/maps. */
export type ChapterMapsResponse = {
  chapter: FrontendGameChapter;
  /** Backend maps dropped as invalid (unpublished/inactive ones are filtered silently). */
  skipped: { mapCode: string | null; reason: string }[];
};

export type ChapterMapsError = { error: string; code: "bad_request" | "not_found" | "empty" | "timeout" | "unavailable" | "config" };
