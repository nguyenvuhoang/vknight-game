// WF_BO_GET_CHAPTER_MAP payload -> FrontendGameChapter.
import { CHAPTER1_LEVELS, CHAPTER1_STORY, CHAPTER1_TITLE } from "@/lib/chapter1";
import type {
  ApiChapterMap,
  ApiGameChapter,
  ChapterMapsResponse,
  FrontendChapterMap,
  FrontendGameChapter,
} from "./chapter-types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const strOrNull = (v: unknown) => (isStr(v) ? v : null);
const numOrNull = (v: unknown) => (isNum(v) ? v : null);

type MapResult = { ok: true; map: FrontendChapterMap } | { ok: false; mapCode: string | null; reason: string };

export function adaptMap(raw: unknown): MapResult {
  if (!isObj(raw)) return { ok: false, mapCode: null, reason: "not an object" };
  const m = raw as Partial<ApiChapterMap>;
  const code = isStr(m.map_code) ? m.map_code : null;
  const fail = (reason: string): MapResult => ({ ok: false, mapCode: code, reason });
  if (!code) return fail("missing map_code");
  if (!isPosInt(m.level)) return fail("invalid level");
  if (!isStr(m.title)) return fail("missing title");
  if (!isStr(m.image_url)) return fail("missing image_url");
  const mapType = strOrNull(m.map_type)?.toUpperCase() ?? null;
  return {
    ok: true,
    map: {
      level: m.level,
      code,
      title: m.title,
      description: typeof m.description === "string" ? m.description : "",
      image: m.image_url,
      thumbnail: strOrNull(m.thumbnail_url),
      story: strOrNull(m.story),
      guideText: strOrNull(m.guide_text),
      hintText: strOrNull(m.hint_text),
      completionText: strOrNull(m.completion_text),
      mapType,
      difficulty: strOrNull(m.difficulty)?.toUpperCase() ?? null,
      isBoss: m.is_boss_level === true || mapType === "BOSS",
      bossCode: strOrNull(m.boss_code),
      estimatedDuration: numOrNull(m.estimated_duration),
      recommendedPower: numOrNull(m.recommended_power),
      requiredLevel: numOrNull(m.required_level),
      allowSkip: m.allow_skip === true,
      skipPrice: numOrNull(m.skip_price),
      rewardCoins: numOrNull(m.reward_coins),
      rewardExperience: numOrNull(m.reward_experience),
      accentColor: strOrNull(m.accent_color),
      displayOrder: isNum(m.display_order) ? m.display_order : m.level,
    },
  };
}

/**
 * Chapter story: backend first. Only Chapter 1 may fall back to the bundled
 * CHAPTER1_STORY while the backend still returns [] — never other chapters.
 */
export function resolveStory(chapterNumber: number, backendStory: unknown): Pick<FrontendGameChapter, "story" | "storySource"> {
  const story = Array.isArray(backendStory) ? backendStory.filter(isStr) : [];
  if (story.length) return { story, storySource: "backend" };
  if (chapterNumber === 1) return { story: [...CHAPTER1_STORY], storySource: "local-fallback" };
  return { story: [], storySource: "none" };
}

export type AdaptChapterResult =
  | { ok: true; body: ChapterMapsResponse }
  | { ok: false; code: "not_found" | "empty" | "format"; reason: string };

/** Validate `data` from the gateway; filter, sort and normalize its maps. */
export function adaptChapter(data: unknown, requested: number): AdaptChapterResult {
  if (!isObj(data) || !("chapter" in data)) return { ok: false, code: "format", reason: "missing data.chapter" };
  const c = data.chapter as Partial<ApiGameChapter> | null;
  if (c === null) return { ok: false, code: "not_found", reason: `chapter ${requested} not found` };
  if (!isObj(c)) return { ok: false, code: "format", reason: "chapter is not an object" };
  if (c.is_published === false || c.is_active === false) {
    return { ok: false, code: "not_found", reason: `chapter ${requested} is not published` };
  }
  if (!isPosInt(c.chapter_number) || c.chapter_number !== requested) {
    return { ok: false, code: "format", reason: `chapter_number ${String(c.chapter_number)} ≠ requested ${requested}` };
  }
  if (!isStr(c.chapter_code) || !isStr(c.title)) return { ok: false, code: "format", reason: "missing chapter_code/title" };
  if (!Array.isArray(c.maps)) return { ok: false, code: "format", reason: "maps is not an array" };

  const skipped: ChapterMapsResponse["skipped"] = [];
  const seen = new Set<number>();
  const maps: FrontendChapterMap[] = [];
  for (const raw of c.maps) {
    if (isObj(raw) && (raw.is_published === false || raw.is_active === false)) continue;
    const r = adaptMap(raw);
    if (!r.ok) skipped.push({ mapCode: r.mapCode, reason: r.reason });
    else if (seen.has(r.map.level)) skipped.push({ mapCode: r.map.code, reason: `duplicate level ${r.map.level}` });
    else {
      seen.add(r.map.level);
      maps.push(r.map);
    }
  }
  maps.sort((a, b) => a.displayOrder - b.displayOrder || a.level - b.level);
  if (!maps.length) return { ok: false, code: "empty", reason: `chapter ${requested} has no playable maps` };

  return {
    ok: true,
    body: {
      chapter: {
        chapterNumber: c.chapter_number,
        code: c.chapter_code,
        title: c.title,
        subtitle: typeof c.subtitle === "string" ? c.subtitle : "",
        description: typeof c.description === "string" ? c.description : "",
        ...resolveStory(c.chapter_number, c.story),
        coverImage: strOrNull(c.cover_image_url),
        recommendedLevel: numOrNull(c.recommended_level),
        maps,
      },
      skipped,
    },
  };
}

/**
 * Compatibility fallback, Chapter 1 only: the bundled level list used when the
 * backend is unreachable. It carries no backend metadata (difficulty, rewards…).
 */
export function localChapter1(): FrontendGameChapter {
  return {
    chapterNumber: 1,
    code: "CHAP01",
    title: CHAPTER1_TITLE,
    subtitle: "",
    description: "",
    story: [...CHAPTER1_STORY],
    storySource: "local-fallback",
    coverImage: CHAPTER1_LEVELS[0]?.image ?? null,
    recommendedLevel: null,
    maps: CHAPTER1_LEVELS.map((l) => ({
      level: l.level,
      code: `CHAP01_MAP${String(l.level).padStart(2, "0")}`,
      title: l.title,
      description: l.description,
      image: l.image,
      thumbnail: null,
      story: null,
      guideText: null,
      hintText: null,
      completionText: null,
      mapType: null,
      difficulty: null,
      isBoss: false,
      bossCode: null,
      estimatedDuration: null,
      recommendedPower: null,
      requiredLevel: null,
      allowSkip: false,
      skipPrice: null,
      rewardCoins: null,
      rewardExperience: null,
      accentColor: null,
      displayOrder: l.level,
    })),
  };
}
