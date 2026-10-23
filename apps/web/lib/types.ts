export type HeroId = "sword" | "professor" | "chairman" | "angry" | "comedian";
export type Hero = {
  id: HeroId;
  name: string;
  tagline: string;
  ability: string;
  asset: string;
  tint: string;
  /** Transparent space under the feet in the sprite, % of image height. */
  footPad?: number;
};
export type Level = {
  id: string;
  number: number;
  title: string;
  story: string;
  width: number;
  spawn: { x: number; y: number };
  groundY: number;
  platforms: { x: number; y: number; w: number; h: number }[];
  hazards: { x: number; y: number; w: number; h: number }[];
  npc: {
    x: number;
    name: string;
    lines: Record<HeroId, string>;
    required: boolean;
  };
  exitX: number;
  bg: string;
  difficulty: number;
};
export type Chapter = {
  id: string;
  title: string;
  version: number;
  levels: Level[];
};
export type GameNotice = {
  kind: "message" | "win" | "death" | "npc";
  text: string;
};
