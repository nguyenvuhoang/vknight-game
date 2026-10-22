import {
  STAT_LABELS,
  type CharacterProfile,
} from "@/lib/character-profiles";

function quip(value: number) {
  if (value >= 100) return "Max luôn!";
  if (value >= 90) return "Đỉnh nóc";
  if (value <= 20) return "Cứu...";
  if (value <= 35) return "Tạm bợ";
  return null;
}

export default function CharacterStats({
  stats,
}: {
  stats: CharacterProfile["stats"];
}) {
  return (
    <ul className="cp-stats">
      {STAT_LABELS.map(({ key, label }) => {
        const value = Math.max(0, Math.min(100, stats[key]));
        const note = quip(value);
        return (
          <li key={key} className="cp-stat">
            <div className="cp-stat-head">
              <span>{label}</span>
              <span className="cp-stat-value">
                {note && <em>{note}</em>} {value}
              </span>
            </div>
            <div
              className="cp-bar"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <div className="cp-bar-fill" style={{ width: `${value}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
