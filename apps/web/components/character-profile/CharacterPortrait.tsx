import type { Hero } from "@/lib/types";
import type { CharacterProfile } from "@/lib/api/character-types";

type Props = { hero: Hero; profile: CharacterProfile | null; isSelected: boolean };

export default function CharacterPortrait({ hero, profile, isSelected }: Props) {
  // Name falls back to the gameplay registry while the profile is unavailable.
  const name = profile?.name ?? hero.name;
  return (
    <div className="cp-portrait">
      <div className="cp-portrait-frame">
        {isSelected && <span className="cp-stamp">Đang chọn</span>}
        <img src={hero.asset} alt={`Chân dung ${name}`} />
      </div>
      <h2 id="cp-title" className="cp-name">
        {name}
      </h2>
      <p className="cp-class">
        {profile?.title && <span className="cp-badge">{profile.title}</span>}
        <span className="cp-ability-tag">⚔ {hero.ability}</span>
      </p>
      <p className="cp-tagline">“{hero.tagline}”</p>
    </div>
  );
}
