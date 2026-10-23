import type { Hero, HeroId } from "./types";
export const HEROES: Hero[] = [
  {
    id: "sword",
    name: "Kiếm Sĩ Mặt Lạnh",
    tagline: "Chém trước, hỏi sau",
    ability: "SLASH",
    asset: "/characters/hero-1.png",
    footPad: 1.9,
    tint: "#94c98c",
  },
  {
    id: "professor",
    name: "Giáo Sư Bốn Mắt",
    tagline: "Biết hết, làm không được",
    ability: "ANALYZE",
    asset: "/characters/hero-2.png",
    footPad: 4.7,
    tint: "#f4d25b",
  },
  {
    id: "chairman",
    name: "Chủ Tịch Mõm",
    tagline: "Tôi quen ông này!",
    ability: "NEGOTIATE",
    asset: "/characters/hero-3.png",
    footPad: 3.7,
    tint: "#9aaccf",
  },
  {
    id: "angry",
    name: "Đại Ca Cáu Bẳn",
    tagline: "Đấm cả thế giới",
    ability: "SMASH",
    asset: "/characters/hero-4.png",
    footPad: 4.4,
    tint: "#f19e97",
  },
  {
    id: "comedian",
    name: "Thánh Tấu Hài",
    tagline: "Không ai đoán được",
    ability: "TRICK",
    asset: "/characters/hero-5.png",
    footPad: 2.5,
    tint: "#fa8c70",
  },
];
export const getHero = (id: HeroId) => HEROES.find((h) => h.id === id)!;
export const isHeroId = (v: unknown): v is HeroId =>
  HEROES.some((h) => h.id === v);
