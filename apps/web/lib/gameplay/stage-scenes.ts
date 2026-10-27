// Local presentation for backend-driven stages: backdrop art, walkable ground
// and actor sizes. Gameplay content (NPC/item positions, dialogue, objectives)
// always comes from WF_BO_GET_MAP_GAMEPLAY — never from here.
import type { MapGameplay } from "@/lib/gameplay/gameplay-types";
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
  /** Exit gate height at depth 1, % of world height. */
  exitHeight?: number;
  /**
   * NPCs already painted into the backdrop. Used only while the backend sprite
   * is missing: the hotspot wraps the painted figure (box, % of world) so we
   * never draw a second copy. Interaction still uses the backend position.
   */
  paintedNpcs?: Record<string, { box: Box }>;
  /**
   * Items painted into the backdrop (keyed by spawn code): a hotspot wraps the
   * painted object (box, % of world) instead of drawing the sprite over it, so
   * the scene never shows two copies. Interaction still uses the backend position.
   */
  paintedItems?: Record<string, { box: Box }>;
  /**
   * Exits drawn over a gate painted into the backdrop (keyed by spawn code).
   * `box` is the painted doorway (% of world): while locked the painting is the
   * gate; once open, the doorway is masked and the open leaves are drawn on top,
   * so the painted closed doors never show through. Interaction still uses the
   * backend exit position.
   */
  paintedExits?: Record<string, { box: Box; open: GateLeavesArt }>;
  /** Per sprite_key presentation of backend sprite images (frame crop, talk pose, size, anchor). */
  sprites?: Record<string, SpriteArt>;
  /** Spawn corrections keyed by NPC code, item spawn code or exit spawn code (see SpawnFix). */
  spawnFixes?: Record<string, SpawnFix>;
  /** HUD skin: the fantasy MMORPG HUD (components/gameplay/hud) or the classic wooden bar. */
  hud?: "fantasy" | "classic";
  /** Decorative frames / marker icons for the fantasy HUD; labels and values stay React. */
  hudArt?: HudArt;
};

type Box = { x: number; y: number; w: number; h: number };

/** Source-pixel frame of a sprite sheet image (e.g. to drop a caption baked into the PNG). */
export type SpriteFrame = { w: number; h: number; crop: Box };

/**
 * How a sprite meets the world at its backend point (x, y):
 * - ground:   the frame's bottom edge is the contact point (feet / base); contact shadow.
 * - wall:     the point is the centre of an object fixed to a wall, post or door; no shadow.
 * - hanging:  the point is the hook the object hangs from (see `hook`); no shadow.
 * - floating: legacy hover (bobs above its point), used when a scene says nothing.
 */
export type SpriteAnchor = "ground" | "wall" | "hanging" | "floating";

export type SpriteArt = {
  /** Replacement for a defective backend sprite image (applied by applySceneFixes). */
  src?: string;
  /** Mirror the sprite horizontally (e.g. to face the arriving hero). */
  flip?: boolean;
  /** Crop to the drawn content so the frame's edges are the object's real edges. */
  frame?: SpriteFrame;
  /** Alternate image (same frame) while this NPC is in dialogue. */
  talkSrc?: string;
  /** Height at depth 1, % of world height; overrides npcHeight / itemHeight. */
  height?: number;
  anchor?: SpriteAnchor;
  /** For `hanging`: the hook inside the frame, as fractions (0–1) of its width / height. */
  hook?: { x: number; y: number };
  /** For `ground`: a flat object (paper, cloth) drawn lying on the ground, foreshortened. */
  lying?: boolean;
};

/**
 * A backend spawn that does not fit the scene art, corrected for presentation
 * AND interaction (one coordinate system). It only applies while the backend
 * still returns `backend`, so once the data is fixed the backend wins again.
 */
export type SpawnFix = { backend: { x: number; y: number }; use: { x: number; y: number }; reason: string };

/** Two door leaves cut from one open-gate image, hinged on the doorway's sides. */
export type GateLeavesArt = {
  src: string;
  size: { w: number; h: number };
  left: Box;
  right: Box;
  /** Leaf height, % of the doorway box. */
  height: number;
};

export type HudArt = {
  panel: string;
  panelDark: string;
  banner: string;
  button: string;
  leaves: string;
  markers: { talk: string; quest: string; item: string; exit: string };
};

const STAGE02_ART = "/chapters/chap01/gameplay/stage02";

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
  // Ải 2 — Con Chó Đầu Ngõ: the Stage 2 asset pack. The world is the whole
  // painting (the frame the backend positions were authored in: sign post,
  // dog in front of the gate, note on the path, bell shelter). The painted gate
  // and bell are hotspots; the dog and the other clues are transparent sprites.
  CHAP01_MAP02: {
    src: `${STAGE02_ART}/stage02-background.png`,
    width: 1920,
    height: 1080,
    crop: { x: 0, y: 0, w: 1920, h: 1080 },
    walk: [
      { x0: 40, x1: 76, y0: 65, y1: 83 }, // dirt path from the gate down to the front
      { x0: 32, x1: 46, y0: 62, y1: 68 }, // path bend towards the fence gap
      { x0: 28, x1: 40, y0: 79, y1: 83 }, // grass in front of the sign's rocks (clear of the activity log)
      { x0: 24, x1: 30, y0: 72, y1: 78 }, // grass beside the sign post, between it and the rock
      { x0: 75, x1: 83, y0: 66, y1: 78 }, // grass by the bell shelter
    ],
    spawn: { x: 40, y: 82 }, // left side of the road, arriving from the village
    // Sizes at depth 1; depth runs 0.7 (gate line) → 1.05 (front), so at the
    // gate the hero is ~2/3 of the door's height and the dog ~half the hero.
    heroHeight: 22,
    npcHeight: 11,
    itemHeight: 8,
    interactRadius: 7,
    hud: "fantasy",
    paintedExits: {
      SPAWN_STAGE02_EXIT: {
        box: { x: 59.38, y: 38.7, w: 17.45, h: 26.3 }, // between the painted posts
        open: {
          src: `${STAGE02_ART}/gate-open.png`,
          size: { w: 512, h: 384 },
          left: { x: 96, y: 100, w: 104, h: 205 },
          right: { x: 312, y: 100, w: 104, h: 205 },
          height: 95.3,
        },
      },
    },
    // Frames are the measured opaque bounds of each PNG, so a frame's bottom edge
    // is the drawn contact point (no transparent padding under feet or legs).
    // The bell hangs in the painted shelter (hook 1661,565 → ring 1712,810 px):
    // a hotspot over it, never a second bell. Picked up at the backend spot (80, 66).
    paintedItems: {
      SPAWN_STAGE02_BELL: { box: { x: 83.4, y: 52, w: 6.2, h: 23 } },
    },
    // Frames are the measured opaque bounds of each PNG, so a frame's bottom edge
    // is the drawn contact point (no transparent padding under feet or legs).
    sprites: {
      // gate-dog.png (and -talk / -blink) were extracted with the head cut flat at
      // row 8 — ears missing in the source. The walk pose is the only intact one
      // (figure 35–234 × 21–183, caption below): use it, mirrored to face the hero.
      npc_stage02_gate_dog: {
        src: `${STAGE02_ART}/gate-dog-walk.png`,
        flip: true,
        frame: { w: 256, h: 256, crop: { x: 30, y: 16, w: 210, h: 170 } },
        anchor: "ground",
      },
      // Board on two short legs (opaque 8–247 × 43–212): stands on the grass by the sign post.
      item_stage02_wood_sign: { frame: { w: 256, h: 256, crop: { x: 8, y: 43, w: 240, h: 170 } }, height: 8, anchor: "ground" },
      // Paper (opaque 15–240 × 8–247): lies flat on the path edge.
      item_stage02_torn_note: { frame: { w: 256, h: 256, crop: { x: 15, y: 8, w: 226, h: 240 } }, height: 9, anchor: "ground", lying: true },
    },
    spawnFixes: {
      // Backend (92, 77) is right of the bell shelter, outside the gate. The
      // passage is centred at x 68 with its threshold at y 65 (painted box above).
      // Recommended data fix: ChapterMap CHAP01_MAP02 gameplay_config exit position (68, 66).
      SPAWN_STAGE02_EXIT: { backend: { x: 92, y: 77 }, use: { x: 68, y: 66 }, reason: "exit outside the painted gate" },
    },
    hudArt: {
      panel: `${STAGE02_ART}/hud-panel.png`,
      panelDark: `${STAGE02_ART}/hud-panel-dark.png`,
      banner: `${STAGE02_ART}/hud-banner.png`,
      button: `${STAGE02_ART}/hud-button.png`,
      leaves: `${STAGE02_ART}/hud-leaves.png`,
      markers: {
        talk: `${STAGE02_ART}/marker-talk.png`,
        quest: `${STAGE02_ART}/marker-quest.png`,
        item: `${STAGE02_ART}/marker-item.png`,
        exit: `${STAGE02_ART}/marker-exit.png`,
      },
    },
  },
};

export const getStageScene = (mapCode: string): StageScene | undefined => STAGE_SCENES[mapCode];

const same = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/**
 * Apply the scene's presentation fixes to the gameplay data, so rendering,
 * minimap, dialogue and interaction distances all agree: spawn fixes (skipped
 * once the backend value no longer matches, i.e. the data was corrected) and
 * replacement images for defective backend sprites.
 */
export function applySceneFixes(g: MapGameplay, scene: StageScene): MapGameplay {
  const fixes = scene.spawnFixes ?? {};
  const fix = <T extends { x: number; y: number }>(key: string, e: T): T => {
    const f = fixes[key];
    if (!f || !same(e, f.backend)) return e;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[stage-scenes] ${key}: backend spawn (${e.x}, ${e.y}) → (${f.use.x}, ${f.use.y}) — ${f.reason}. Fix the backend data to retire this.`);
    }
    return { ...e, ...f.use };
  };
  const image = <T extends { spriteKey: string | null; imageUrl: string | null; imageAvailable: boolean }>(e: T): T => {
    const src = e.spriteKey ? scene.sprites?.[e.spriteKey]?.src : undefined;
    return src && e.imageAvailable ? { ...e, imageUrl: src } : e;
  };
  return {
    ...g,
    npcs: g.npcs.map((n) => image(fix(n.code, n))),
    items: g.items.map((i) => image(fix(i.spawnCode, i))),
    exits: g.exits.map((e) => fix(e.spawnCode, e)),
  };
}

/** CHAP01 + level 1 -> "CHAP01_MAP01" (backend map_code convention). */
export const mapCodeFor = (chapterCode: string, level: number) => `${chapterCode}_MAP${String(level).padStart(2, "0")}`;
