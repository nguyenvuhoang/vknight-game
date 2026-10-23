import type { CharacterAbility as Ability } from "@/lib/api/character-types";

export default function CharacterAbility({ ability }: { ability: Ability }) {
  const facts = [
    ability.power != null && `⚡ Uy lực ${ability.power}`,
    ability.cooldown != null && `⏱ Hồi chiêu ${ability.cooldown}s`,
    ability.energyCost != null && `🔋 Tốn ${ability.energyCost} năng lượng`,
    ability.requiredLevel != null && ability.requiredLevel > 1 && `🎖 Cần cấp ${ability.requiredLevel}`,
  ].filter(Boolean) as string[];
  return (
    <div className="cp-ability">
      <strong>
        <span className="cp-ability-code">{ability.code}</span> {ability.name}
      </strong>
      {ability.description && <p>{ability.description}</p>}
      {facts.length > 0 && (
        <ul className="cp-ability-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
