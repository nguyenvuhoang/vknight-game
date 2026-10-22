import type { CharacterProfile } from "@/lib/character-profiles";

export default function CharacterAbility({
  ability,
}: {
  ability: CharacterProfile["specialAbility"];
}) {
  return (
    <div className="cp-ability">
      <strong>{ability.name}</strong>
      <p>{ability.description}</p>
    </div>
  );
}
