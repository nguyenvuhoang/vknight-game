import type { Hero } from "@/lib/types";
import type { CharacterProfile } from "@/lib/character-profiles";

type Props = { hero: Hero; profile: CharacterProfile; isSelected: boolean };

export default function CharacterPortrait({ hero, profile, isSelected }: Props) {
  return (
    <div className="cp-portrait">
      <div className="cp-portrait-frame">
        {isSelected && <span className="cp-stamp">Đang chọn</span>}
        <img src={hero.asset} alt={`Chân dung ${profile.name}`} />
      </div>
      <h2 id="cp-title" className="cp-name">
        {profile.name}
      </h2>
      <p className="cp-class">
        <span className="cp-badge">{profile.title}</span>
        <span className="cp-ability-tag">⚔ {hero.ability}</span>
      </p>
      <p className="cp-tagline">“{hero.tagline}”</p>
    </div>
  );
}
