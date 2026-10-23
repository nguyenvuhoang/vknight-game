// Data model for adventure-puzzle stages: a scene, hotspots (NPCs / objects /
// exit), items, and rules that map (verb, target, item, conditions) to effects.
import type { HeroId } from "@/lib/types";

/** All listed conditions must hold. */
export type Cond = {
  flags?: string[];
  notFlags?: string[];
  has?: string[];
  lacks?: string[];
};

/** `who` is "hero", "narrator" or a hotspot id (its name/portrait is used). */
export type Line = { who: string; text: string };

export type Choice = {
  options: { label: string; effects: Effect[] }[];
};

export type Effect =
  | { say: Line[] }
  | { give: string }
  | { take: string }
  | { set: string }
  | { choice: Choice }
  | { win: string };

export type Verb = "talk" | "inspect" | "use" | "skill";

export type Rule = {
  on: string;
  verb: Verb;
  /** For "use": the item being used. */
  item?: string;
  when?: Cond;
  effects: Effect[];
};

/** Positions are % of the scene (x of width, y of height). */
export type Point = { x: number; y: number };

export type Hotspot = {
  id: string;
  name: string;
  kind: "npc" | "object" | "exit";
  /** Clickable area over the painted art or sprite. */
  box: { x: number; y: number; w: number; h: number };
  /** Where the hero walks to before interacting. */
  stand: Point;
  /** Optional drawn character standing at `feet`, `height` % of scene. */
  sprite?: { kind: "granny" | "dog"; feet: Point; height: number };
};

export type Item = { name: string; icon: string; description: string };

export type AdventureStageConfig = {
  level: number;
  /** Crop of a larger painting used as the scene backdrop (source pixels). */
  scene: {
    src: string;
    width: number;
    height: number;
    crop: { x: number; y: number; w: number; h: number };
  };
  spawn: Point;
  /** Walkable ground: union of rectangles (% of scene). */
  walk: { x0: number; x1: number; y0: number; y1: number }[];
  intro: Line[];
  items: Record<string, Item>;
  hotspots: Hotspot[];
  rules: Rule[];
  objectives: { when?: Cond; text: string; count?: { flags: string[] } }[];
  hints: { when?: Cond; hints: string[] }[];
  notes: { label: string; done: Cond }[];
  /** Fallback skill reaction per hero; {target} = hotspot name. */
  skill: Record<HeroId, string>;
};
