import type { Chapter } from "./types";
export async function loadChapter(id = "ch01-lang-ngao"): Promise<Chapter> {
  const r = await fetch(`/chapters/${id}.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Không tải được chapter ${id}: ${r.status}`);
  return (await r.json()) as Chapter;
}
