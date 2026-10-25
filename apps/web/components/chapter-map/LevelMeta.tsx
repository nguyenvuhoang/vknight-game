import type { FrontendChapterMap } from "@/lib/api/chapter-types";

const TYPE_LABEL: Record<string, string> = {
  NORMAL: "🗺 Thường",
  PUZZLE: "🧩 Giải đố",
  BOSS: "👑 Trùm cuối",
};
const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Dễ",
  MEDIUM: "Vừa",
  HARD: "Khó",
};

/** Small chips: type · difficulty · duration · rewards. Renders nothing for fallback data. */
export default function LevelMeta({ map, compact }: { map: FrontendChapterMap; compact?: boolean }) {
  const chips: { key: string; text: string; cls?: string; title?: string }[] = [];
  if (map.mapType) {
    chips.push({ key: "type", text: TYPE_LABEL[map.mapType] ?? map.mapType, cls: map.isBoss ? "is-boss" : undefined });
  }
  if (map.difficulty) {
    chips.push({
      key: "diff",
      text: `⚔ ${DIFFICULTY_LABEL[map.difficulty] ?? map.difficulty}`,
      cls: `is-${map.difficulty.toLowerCase()}`,
      title: "Độ khó",
    });
  }
  if (map.estimatedDuration != null) {
    chips.push({ key: "dur", text: `⏱ ~${map.estimatedDuration} phút`, title: "Thời gian dự kiến" });
  }
  if (map.rewardCoins != null) chips.push({ key: "coins", text: `🪙 +${map.rewardCoins}`, title: "Thưởng xu" });
  if (map.rewardExperience != null) {
    chips.push({ key: "xp", text: `⭐ +${map.rewardExperience} KN`, title: "Thưởng kinh nghiệm" });
  }
  if (!chips.length) return null;
  return (
    <ul className={`level-meta ${compact ? "is-compact" : ""}`} aria-label="Thông tin ải">
      {chips.map((c) => (
        <li key={c.key} className={c.cls} title={c.title}>
          {c.text}
        </li>
      ))}
    </ul>
  );
}
