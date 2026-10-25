// Local presentation for backend-driven stages: backdrop art, walkable ground
// and actor sizes. Gameplay content (NPC/item positions, dialogue, objectives)
// always comes from WF_BO_GET_MAP_GAMEPLAY — never from here.
import type { Point, WalkRect } from "@/lib/scene/use-scene-walker";

export type StageScene = {
  /** Backdrop image and the crop used as the world (source pixels). */
  src: string;
  width: number;
  height: number;
  crop: { x: number; y: number; w: number; h: number };
  /** Walkable ground, % of the world; traced from the artwork. */
  walk: WalkRect[];
  spawn: Point;
  /** Actor heights at depth 1, % of world height (scaled by backend `scale`). */
  heroHeight: number;
  npcHeight: number;
  itemHeight: number;
  /** Max visual distance (% of width) for talking / picking up. */
  interactRadius: number;
};

const STAGE_SCENES: Record<string, StageScene> = {
  // Ải 1 — Bước Ra Khỏi Nhà: the map's own illustration (CHAP01_MAP01
  // image_url). Backend spawn coordinates line up with its house fronts.
  CHAP01_MAP01: {
    src: "/chapters/chap01/chap01-map01.jpg",
    width: 500,
    height: 500,
    crop: { x: 0, y: 0, w: 500, h: 500 },
    walk: [
      { x0: 28, x1: 74, y0: 85, y1: 92 }, // cobbles in front of the houses
      { x0: 44, x1: 60, y0: 90, y1: 99 }, // path down to the gate
      { x0: 46, x1: 62, y0: 66, y1: 86 }, // path up the middle
      { x0: 56, x1: 66, y0: 57, y1: 68 }, // path to the back house
      { x0: 58, x1: 70, y0: 74, y1: 86 }, // grass by the right house
      { x0: 8, x1: 30, y0: 90, y1: 99 }, // lawn in front of the left house
      { x0: 62, x1: 82, y0: 88, y1: 97 }, // lawn bottom right
    ],
    spawn: { x: 32, y: 89 }, // just outside the left house's door
    heroHeight: 14,
    npcHeight: 7.5,
    itemHeight: 4,
    interactRadius: 12,
  },
};

export const getStageScene = (mapCode: string): StageScene | undefined => STAGE_SCENES[mapCode];

/** CHAP01 + level 1 -> "CHAP01_MAP01" (backend map_code convention). */
export const mapCodeFor = (chapterCode: string, level: number) => `${chapterCode}_MAP${String(level).padStart(2, "0")}`;
