import { notFound } from "next/navigation";
import StageScreen from "@/components/StageScreen";
import { CHAPTER1_LEVELS } from "@/lib/chapter1";
import { isHeroId } from "@/lib/heroes";

export const metadata = {
  title: "Chapter 1: Làng Ngáo · vKnight Phiêu Lưu Ký",
};

export default async function Chapter1StagePage({
  params,
  searchParams,
}: {
  params: Promise<{ level: string }>;
  searchParams: Promise<{ hero?: string }>;
}) {
  const [{ level }, { hero }] = await Promise.all([params, searchParams]);
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1 || n > CHAPTER1_LEVELS.length) notFound();
  return <StageScreen key={n} hero={isHeroId(hero) ? hero : "sword"} level={n} />;
}
