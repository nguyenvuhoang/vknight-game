// Local presentation for backend-driven stages: backdrop art, walkable ground
// and actor sizes. Gameplay content (NPC/item positions, dialogue, objectives)
// always comes from WF_BO_GET_MAP_GAMEPLAY — never from here.
import type { MapGameplay } from "@/lib/gameplay/gameplay-types";
import type { Point, WalkRect } from "@/lib/scene/use-scene-walker";

export type StageScene = {
  /** Backdrop image and the crop used as the world (source pixels). */
  src: string;
  /**
   * Content version of the backdrop file (first 8 hex of its SHA-1). Set it when
   * an asset pack replaces the file under the same name: the backdrop is then
   * served directly at `src?v=…` (no optimizer), so neither the image optimizer
   * nor a browser can keep showing the old picture. Update it with the file.
   */
  srcVersion?: string;
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
  /**
   * Physical world objects drawn from transparent sprites (bridges, gates, traps,
   * props). Each may add walkable surface (a bridge deck), a solid footprint the
   * hero walks around, or a trap zone; all in the same world % as the spawns.
   */
  worldObjects?: WorldObject[];
  /** Click-to-walk follows the ground (over bridges, around water and solid objects). */
  pathfind?: boolean;
  /** Sprite drawn for (non-painted) exits instead of the built-in gate. */
  exitArt?: { src: string; frame?: SpriteFrame; height: number; label?: string };
  /**
   * Portrait screens only: enlarge the world so a playfield band that is a small
   * part of the backdrop (e.g. art padded to 16:9 with soft bands) fills the space
   * between HUD and dock. Landscape keeps the whole world in view.
   */
  portraitZoom?: number;
  /**
   * Wide panoramas: draw the world at this many CSS px per source px (never
   * taller than the space available, never narrower than the screen) instead of
   * filling the screen height, which would blow the art up; the camera pans.
   */
  nativeScale?: number;
  /** Fill the screen around a world shorter than it with a blurred copy of the backdrop (no extra art). */
  ambient?: boolean;
  /** Camera may pan this far (fraction of screen width) past the world's right edge (needs `ambient`). */
  cameraRightPad?: number;
  /** Puzzle-protected items stay locked if puzzle definitions fail to load (no direct pick-up fallback). */
  puzzlesFailClosed?: boolean;
  /** Failure screen line when a run-limited map's attempts run out ("Mất Trí Nhớ Tạm Thời"). */
  failText?: string;
};

type Box = { x: number; y: number; w: number; h: number };

export type WorldObject = {
  id: string;
  kind: "bridge" | "gate" | "trap" | "prop";
  /** Shown on hover / in the activity log. */
  name?: string;
  /** Sprite (bottom-centre anchored at x, y); omitted when the object is painted into the backdrop. */
  src?: string;
  frame?: SpriteFrame;
  x: number;
  y: number;
  /** Drawn height, % of world height (no depth scaling: objects are measured on the art). */
  height?: number;
  flip?: boolean;
  /** Flat on the ground (bridge decks, mud): drawn under everyone standing on it. */
  flat?: boolean;
  /** Walkable surface the object adds (e.g. a bridge deck over water). */
  walk?: WalkRect[];
  /** Solid footprint the hero cannot enter. */
  block?: WalkRect[];
  /** Trap zone: movement speed factor while inside, and what the player is told. */
  trap?: { rect: WalkRect; speed: number; message: string };
  /** Repairable object (e.g. a broken bridge); see RepairArt. Its `walk` applies only once REPAIRED. */
  repair?: RepairArt;
};

/**
 * Repair phases of a world object. REPAIRED is the backend INTERACT on
 * `target`, allowed only while the objective waiting on it is unlocked (so the
 * backend decides which materials are needed); a new run always starts BROKEN.
 * PARTIAL is shown while the repair plays out and is never walkable.
 */
export type RepairPhase = "BROKEN" | "PARTIAL" | "REPAIRED";

export type RepairArt = {
  /** INTERACT target code the backend objective waits on. */
  target: string;
  /**
   * Sprite per phase, cropped to its drawn content (frame). With `anchors` and
   * the phase's `ends`, it is placed by those two points (anchoredPlacement);
   * otherwise base-centred at the object's (x, y), sized by `height` (% of world height).
   */
  phases: Record<RepairPhase, RepairSprite>;
  /**
   * Where the object meets the terrain at its two ends (% of the world), e.g. the
   * bank lips a bridge rests on. Every phase's `ends` land exactly on them, so the
   * outer endpoints never move between phases.
   */
  anchors?: [Point, Point];
  /** Where the hero stands to do the repair (on reachable ground). */
  at: Point;
  /** Prompt / log wording, e.g. "Sửa cầu". */
  action: string;
  /** Spoken when the repair is done (presentation only; no backend dialogue for it). */
  done: { npc?: string; text: string };
};

export type RepairSprite = {
  src: string;
  frame?: SpriteFrame;
  height?: number;
  /** The sprite's own two endpoints (source px of the image, e.g. the outer post bases), left then right. */
  ends?: [Point, Point];
};

/**
 * Place a sprite by two points: its `ends` land exactly on the world `anchors`,
 * with one uniform scale (aspect kept, never stretched per axis) and, when the
 * sprite's ends are not level like the anchors, a small rotation about the left
 * end. World size is in source px (the scene crop). Returns CSS (% of the world).
 */
export function anchoredPlacement(sprite: RepairSprite, anchors: [Point, Point], world: { w: number; h: number }) {
  const c = sprite.frame?.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const [el, er] = sprite.ends!;
  const al = { x: (anchors[0].x * world.w) / 100, y: (anchors[0].y * world.h) / 100 };
  const ar = { x: (anchors[1].x * world.w) / 100, y: (anchors[1].y * world.h) / 100 };
  const s = Math.hypot(ar.x - al.x, ar.y - al.y) / Math.hypot(er.x - el.x, er.y - el.y);
  const turn = Math.atan2(ar.y - al.y, ar.x - al.x) - Math.atan2(er.y - el.y, er.x - el.x);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return {
    left: pct(al.x - (el.x - c.x) * s, world.w),
    top: pct(al.y - (el.y - c.y) * s, world.h),
    width: pct(c.w * s, world.w),
    height: pct(c.h * s, world.h),
    transformOrigin: `${((el.x - c.x) / c.w) * 100}% ${((el.y - c.y) / c.h) * 100}%`,
    transform: `rotate(${turn}rad)`,
    /** The sprite ends inside its frame box (% of the box), for debug markers. */
    ends: [el, er].map((e) => ({ x: ((e.x - c.x) / c.w) * 100, y: ((e.y - c.y) / c.h) * 100 })),
  };
}

/** The backdrop URL the browser loads: versioned when the scene says so (see srcVersion). */
export const backdropSrc = (s: StageScene) => (s.srcVersion ? `${s.src}?v=${s.srcVersion}` : s.src);

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

const STAGE01_ART = "/chapters/chap01/gameplay/stage01";
const STAGE02_ART = "/chapters/chap01/gameplay/stage02";
const STAGE03_ART = "/chapters/chap01/gameplay/stage03";
const STAGE04_ART = "/chapters/chap01/gameplay/stage04";
/** Frame = measured opaque bounds of a PNG, so its bottom edge is the drawn contact point. */
const frame = (w: number, h: number, x: number, y: number, cw: number, ch: number): SpriteFrame => ({ w, h, crop: { x, y, w: cw, h: ch } });
const STAGE02_HUD_ART: HudArt = {
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
};

const STAGE_SCENES: Record<string, StageScene> = {
  // Ải 1 — Bước Ra Khỏi Nhà: the Stage 01 pack panorama (1672×607, the whole
  // painting is the world). Thatched house on the left (door x 8–15, step y 64–69),
  // a dirt yard that runs down to the bottom edge and right to the pier; the
  // pots, fences, rocks, flower bushes and the river are not walkable.
  CHAP01_MAP01: {
    src: `${STAGE01_ART}/stage01-background.png`,
    width: 1672,
    height: 607,
    crop: { x: 0, y: 0, w: 1672, h: 607 },
    walk: [
      { x0: 6, x1: 20, y0: 65, y1: 69 }, // stone step in front of the door
      { x0: 11, x1: 46, y0: 69, y1: 75 }, // yard in front of the house (pots / grass above y 69)
      { x0: 18, x1: 46, y0: 75, y1: 80 }, // yard, down to the rocks (bushes left of x 18)
      { x0: 44, x1: 64, y0: 66, y1: 84 }, // the open yard in the middle
      { x0: 57, x1: 73, y0: 62, y1: 69 }, // dirt to the pier (fence above y 62, pier from x 73)
      { x0: 63, x1: 69, y0: 69, y1: 77 }, // grass beside the rocks (rocks from x 69, fence from y 80)
      { x0: 46, x1: 60, y0: 84, y1: 96 }, // the road down to the bottom edge
    ],
    spawn: { x: 14, y: 71 }, // just off the step, feet on the dirt
    // Depth runs 0.7 (y 62) → 1.05 (y 96): at the door the hero is ~2/3 of its
    // height, the dog about 40 % of the hero.
    heroHeight: 28,
    npcHeight: 12,
    itemHeight: 5,
    interactRadius: 6,
    pathfind: true,
    nativeScale: 1.15,
    ambient: true,
    // Stage 01 sprite pack (gameplay/*.png at the backend image_url): each frame is
    // the measured opaque bounds of its 512 / 256 px canvas, so the bottom edge is
    // where the paws / item touch the ground.
    sprites: {
      npc_dog_teaser: { frame: frame(512, 512, 171, 339, 170, 162), anchor: "ground" },
      item_dog_bone: { frame: frame(256, 256, 64, 163, 127, 82), anchor: "ground", height: 4.5 },
      item_sandal_left: { frame: frame(256, 256, 67, 133, 121, 112), anchor: "ground", height: 4.5 },
      item_sandal_right: { frame: frame(256, 256, 51, 141, 154, 104), anchor: "ground", height: 4.5 },
    },
    spawnFixes: {
      // Recommended data fixes (ChapterMapNpcSpawn / ChapterMapItemSpawn), authored for chap01-map01.jpg:
      NPC_DOG_TEASER: { backend: { x: 65, y: 78 }, use: { x: 58, y: 75 }, reason: "on the grass against the rocks; use (58, 75) on the yard road" },
      SPAWN_STAGE01_SANDAL_LEFT: { backend: { x: 72, y: 82 }, use: { x: 51, y: 89 }, reason: "on the front fence post; use (51, 89) on the road down" },
      SPAWN_STAGE01_SANDAL_RIGHT: { backend: { x: 78, y: 82 }, use: { x: 69, y: 66 }, reason: "behind the front fence (unreachable); use (69, 66) on the dirt by the pier" },
    },
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
  // Ải 3 — Ruộng Lúa Bất Ổn: the Stage 3 asset pack. The world is the whole
  // 1920×1080 background — the frame stage03-scene-reference.json and the
  // backend positions are authored in — so nothing is cropped or zoomed on a
  // 16:9 screen; the soft extension bands sit under the HUD and the playfield
  // is the sharp panorama band (rows 270–770 px = y 25–71 %). The ground is
  // split by ponds, so walking follows the dirt paths and the painted bridges.
  CHAP01_MAP03: {
    src: `${STAGE03_ART}/stage03-background.png`,
    width: 1920,
    height: 1080,
    crop: { x: 0, y: 0, w: 1920, h: 1080 },
    walk: [
      { x0: 18, x1: 25, y0: 56.5, y1: 61 }, // path end by the left dock (farmer)
      { x0: 23, x1: 30, y0: 59, y1: 63 }, // path bend down to the front
      { x0: 25.5, x1: 31, y0: 62.5, y1: 66 }, // (clear of the lily pond on its left)
      { x0: 27.5, x1: 46, y0: 65.5, y1: 69.5 }, // front path under the stone bank
      { x0: 44, x1: 62, y0: 64, y1: 69.5 }, // front path, middle
      { x0: 58, x1: 64, y0: 61.5, y1: 66 }, // foot of the right bridge
      { x0: 72, x1: 87, y0: 59.5, y1: 66.5 }, // yard by the haystacks
      { x0: 48, x1: 62, y0: 48.5, y1: 52 }, // upper path between the fields
      { x0: 59, x1: 63.5, y0: 51, y1: 54 }, // trodden grass at the scarecrow's feet
    ],
    spawn: { x: 24, y: 61 }, // arriving on the path from the left
    heroHeight: 12.5,
    npcHeight: 12.5,
    itemHeight: 6.5,
    interactRadius: 7, // the scarecrow stands in the field, a step off the path
    hud: "fantasy",
    hudArt: STAGE02_HUD_ART,
    pathfind: true,
    puzzlesFailClosed: true,
    portraitZoom: 1.8, // the sharp band is 46 % of the world height
    worldObjects: [
      // Bridges are painted into the art; their decks are the only way over the water.
      {
        id: "bridge-middle",
        kind: "bridge",
        name: "Cầu gỗ giữa ao",
        x: 31,
        y: 57,
        walk: [
          { x0: 24.5, x1: 29.5, y0: 55.5, y1: 59.5 },
          { x0: 28.5, x1: 37, y0: 53.5, y1: 57 },
          { x0: 36, x1: 50, y0: 51.5, y1: 54.5 },
        ],
      },
      {
        id: "bridge-right",
        kind: "bridge",
        name: "Cầu gỗ bờ phải",
        src: `${STAGE03_ART}/wooden-bridge.png`,
        frame: frame(384, 256, 15, 60, 353, 188),
        x: 67.5,
        y: 63.5,
        height: 11,
        flat: true,
        flip: true, // the sprite falls to the right; the painted crossing rises to the right
        walk: [
          { x0: 61.5, x1: 66, y0: 60, y1: 63 },
          { x0: 65, x1: 70, y0: 58.5, y1: 61.5 },
          { x0: 69, x1: 73.5, y0: 58, y1: 60.5 },
        ],
      },
      {
        id: "water-gate",
        kind: "gate",
        name: "Cống nước",
        src: `${STAGE03_ART}/water-gate.png`,
        frame: frame(320, 256, 13, 63, 294, 185),
        x: 80.5,
        y: 59,
        height: 11,
        block: [{ x0: 76.5, x1: 84.5, y0: 55, y1: 60 }],
      },
      {
        id: "mud-front",
        kind: "trap",
        name: "Vũng bùn",
        src: `${STAGE03_ART}/mud-trap.png`,
        frame: frame(320, 192, 13, 17, 294, 169),
        x: 53,
        y: 68.5,
        height: 5.5,
        flat: true,
        trap: { rect: { x0: 50.5, x1: 55.5, y0: 64.5, y1: 68.5 }, speed: 0.3, message: "Sa lầy! Bùn dính chặt chân, đi chậm hẳn lại…" },
      },
      {
        id: "mud-yard",
        kind: "trap",
        name: "Vũng bùn",
        src: `${STAGE03_ART}/mud-trap.png`,
        frame: frame(320, 192, 13, 17, 294, 169),
        x: 76,
        y: 65.5,
        height: 5,
        flat: true,
        trap: { rect: { x0: 73.8, x1: 78.2, y0: 62, y1: 65.5 }, speed: 0.3, message: "Ối! Lại một vũng bùn trông vô hại…" },
      },
      {
        id: "sign-exit",
        kind: "prop",
        name: "Biển chỉ đường",
        src: `${STAGE03_ART}/sign-post.png`,
        frame: frame(128, 192, 15, 14, 97, 172),
        x: 92,
        y: 63,
        height: 8,
        block: [{ x0: 91.4, x1: 92.6, y0: 61.5, y1: 63 }],
      },
    ],
    exitArt: { src: `${STAGE03_ART}/exit-marker.png`, frame: frame(256, 256, 10, 58, 235, 190), height: 13, label: "Rời ruộng lúa" },
    sprites: {
      farmer_idle: { frame: frame(256, 256, 26, 18, 204, 230), anchor: "ground" },
      // Drawn over the scarecrow painted in the field, so the scene shows one.
      scarecrow_idle: { frame: frame(256, 256, 13, 18, 230, 230), anchor: "ground", height: 15.5 },
      rice_bundle: { frame: frame(192, 192, 11, 14, 170, 172), anchor: "ground" },
      water_key: { frame: frame(192, 192, 27, 14, 137, 172), anchor: "ground" },
      route_map: { frame: frame(192, 192, 8, 47, 176, 139), anchor: "ground" },
    },
  },
  // Ải 4 — Cây Cầu Lung Lay: the bridge alignment pack. stage04-background.png is
  // the hand-painted panorama (1916×431, the same painting as the concept
  // panorama's band, no bridge), drawn near its native size with the camera
  // panning, and a blurred copy of it fills the screen above and below. The
  // river (x ≈ 36–63 %) separates the west bank (hut, path) from the east bank
  // (path up to the banner gate). The three bridge states are full-world
  // overlays (bridge-*-aligned.png) sharing one placement; the bridge deck is
  // the only link, and only once repaired.
  // Backend positions were authored for the old flat background; three don't fit
  // the painting and are corrected below (spawnFixes), with the data fix reported.
  CHAP01_MAP04: {
    src: `${STAGE04_ART}/stage04-background.png`,
    // The pack replaced the old flat 1920×1080 background under this same name;
    // cached copies of the old picture were showing under the new bridge.
    srcVersion: "164cf80f",
    width: 1916,
    height: 431,
    crop: { x: 0, y: 0, w: 1916, h: 431 },
    walk: [
      // West bank: hut front, the path up to the fence, the grass at the river.
      { x0: 1, x1: 11, y0: 58, y1: 64 }, // hut porch (the hut stands above y 57)
      { x0: 11, x1: 30, y0: 51, y1: 64 }, // path in front of the hut
      { x0: 12, x1: 27, y0: 38, y1: 51 }, // path towards the fence (cart at x 27–33 above y 51)
      { x0: 30, x1: 36, y0: 54, y1: 64 }, // grass at the west bank lip (bridge post base at x 37)
      // East bank: rock ledge at the east landing, grass under the bamboo, path up to the gate.
      { x0: 65, x1: 77, y0: 58, y1: 67 }, // flat stone ledge at the east lip, then the bushes to the path
      { x0: 72, x1: 90, y0: 50, y1: 68 }, // lower path (stone wall from x ≈ 91)
      { x0: 80, x1: 88, y0: 32, y1: 50 }, // path climbing to the gate
      { x0: 83, x1: 92, y0: 23, y1: 33 }, // between the gate posts
    ],
    spawn: { x: 7, y: 61 }, // in front of the hut
    heroHeight: 20, // about the hut door's height
    npcHeight: 20,
    itemHeight: 11,
    interactRadius: 7,
    hud: "fantasy",
    hudArt: STAGE02_HUD_ART,
    pathfind: true,
    puzzlesFailClosed: true,
    nativeScale: 1.15,
    ambient: true,
    cameraRightPad: 0.22, // the exit gate (x 89 %) clears the quest tracker on desktop
    failText: "Não bạn vừa tự khởi động lại! Mọi ký ức về cây cầu đã bay theo dòng nước…",
    spawnFixes: {
      // Recommended data fixes (ChapterMapItemSpawn / ChapterMap.gameplay_config):
      SPAWN_STAGE04_WOOD: { backend: { x: 22, y: 78 }, use: { x: 19, y: 62 }, reason: "in the bushes below the path; use (19, 62) on the path" },
      SPAWN_STAGE04_ROPE: { backend: { x: 35, y: 54 }, use: { x: 31.5, y: 59 }, reason: "on the river boulders; use (31.5, 59) at the bridge landing" },
      SPAWN_STAGE04_EXIT: { backend: { x: 89, y: 65 }, use: { x: 89, y: 30 }, reason: "against the stone wall; use (89, 30) between the gate posts" },
    },
    worldObjects: [
      {
        id: "bridge",
        kind: "bridge",
        name: "Cây cầu lung lay",
        x: 51,
        y: 65.5,
        flat: true,
        // Walkable only once REPAIRED: mid-plank across the river (planks y ≈ 49–60),
        // and a step at each end down to the bank it rests on.
        walk: [
          { x0: 35, x1: 66, y0: 51, y1: 58 }, // on the planks
          { x0: 34, x1: 39, y0: 54, y1: 60 }, // west end, onto the bank lip
          { x0: 61, x1: 67, y0: 55, y1: 62 }, // east end, onto the stone ledge
        ],
        repair: {
          target: "SPAWN_STAGE04_BRIDGE",
          // The bridge rests on the two bank lips at deck-post height (measured on
          // stage04-background.png at 1916×431): the grass/boulder lip of the west
          // bank, px (709, 282), and the flat stone ledge of the east bank, px (1245, 282).
          anchors: [
            { x: 37, y: 65.5 },
            { x: 65, y: 65.5 },
          ],
          // Cropped sprites (one strategy for every phase), each placed by its outer
          // post bases (ends, measured on the alpha) so all phases share the same
          // endpoints. Partial / repaired are cut at the top of the pale concept-sheet
          // water baked under the planks; their ends are the posts on that line.
          // bridge-broken.png currently duplicates bridge-partial.png; the pack's
          // broken art is the 2172×724 sprite saved as bridge-broken-aligned.png
          // (not a full-world canvas; its ends are not level, hence a 0.97° turn).
          // ?v = content hash: these files were replaced under the same names.
          phases: {
            BROKEN: { src: `${STAGE04_ART}/bridge-broken-aligned.png?v=90712579`, frame: frame(2172, 724, 112, 140, 1954, 474), ends: [{ x: 253, y: 578 }, { x: 1912.5, y: 606 }] },
            PARTIAL: { src: `${STAGE04_ART}/bridge-partial.png?v=f1d6358e`, frame: frame(201, 70, 0, 0, 200, 64), ends: [{ x: 11.5, y: 64 }, { x: 186.5, y: 64 }] },
            REPAIRED: { src: `${STAGE04_ART}/bridge-repaired.png?v=8a646f00`, frame: frame(234, 76, 0, 2, 234, 64), ends: [{ x: 15.5, y: 66 }, { x: 217.5, y: 66 }] },
          },
          at: { x: 33, y: 58 },
          action: "Sửa cầu",
          done: {
            npc: "NPC_STAGE04_BRIDGE_KEEPER",
            text: "Ui chà, cầu chắc như lời hứa… à không, chắc hơn nhiều! Ván mới, dây căng, búa còn nóng. Qua đi, đừng nhảy tưng tưng là được!",
          },
        },
      },
    ],
    // Only the glowing ring of exit-marker.png (rows 56+): the banner gate is painted.
    exitArt: { src: `${STAGE04_ART}/exit-marker.png`, frame: frame(100, 107, 0, 56, 98, 51), height: 11, label: "Sang bờ bên kia" },
    sprites: {
      // Feet end at row 280; the baked shadow below is left out (the scene draws one).
      stage04_bridge_keeper: { frame: frame(256, 320, 29, 4, 206, 276), anchor: "ground" },
      stage04_wood: { frame: frame(105, 69, 1, 0, 104, 69), anchor: "ground" },
      stage04_rope: { frame: frame(94, 80, 0, 0, 94, 80), anchor: "ground" },
      stage04_toolbox: { frame: frame(96, 98, 0, 1, 96, 97), anchor: "ground" },
    },
  },
};

export const getStageScene = (mapCode: string): StageScene | undefined => STAGE_SCENES[mapCode];

/** INTERACT targets a scene provides itself (repairable objects), so data validation knows them. */
export const sceneInteractTargets = (mapCode: string): string[] =>
  (STAGE_SCENES[mapCode]?.worldObjects ?? []).flatMap((o) => (o.repair ? [o.repair.target] : []));

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
