import ChapterMap from "@/components/ChapterMap";
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
      // The level list comes from the API; the client lands on the nearest existing level.
      initialLevel={Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined}
    />
  );
}
