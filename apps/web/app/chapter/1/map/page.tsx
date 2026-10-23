import ChapterMap from "@/components/ChapterMap";
import { isHeroId } from "@/lib/heroes";

export const metadata = {
  title: "Bản đồ Chapter 1: Làng Ngáo · vKnight Phiêu Lưu Ký",
};

export default async function Chapter1MapPage({
  searchParams,
}: {
  searchParams: Promise<{ hero?: string }>;
}) {
  const { hero } = await searchParams;
  return <ChapterMap hero={isHeroId(hero) ? hero : "sword"} />;
}
