import ChapterMap from "@/components/ChapterMap";
import { CHAPTER1_LEVELS } from "@/lib/chapter1";
import { isHeroId } from "@/lib/heroes";

export const metadata = {
  title: "Bản đồ Chapter 1: Làng Ngáo · vKnight Phiêu Lưu Ký",
};

export default async function Chapter1MapPage({
  searchParams,
}: {
  searchParams: Promise<{ hero?: string; level?: string }>;
}) {
  const { hero, level } = await searchParams;
  const n = Number(level);
  return (
    <ChapterMap
      hero={isHeroId(hero) ? hero : "sword"}
      initialLevel={
        Number.isInteger(n) && n >= 1 && n <= CHAPTER1_LEVELS.length
          ? n
          : undefined
      }
    />
  );
}
