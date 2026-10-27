import GameplaySprite from "../GameplaySprites";
import type { SpriteArt } from "@/lib/gameplay/stage-scenes";
import type { CharacterProfile } from "@/lib/api/character-types";
import type { GameplayNpc, GameplayState } from "@/lib/gameplay/gameplay-types";
import type { Hero } from "@/lib/types";

type Props = {
  hero: Hero;
  /** Backend Character Profile; null while loading or unavailable. */
  profile: CharacterProfile | null;
  npcs: GameplayNpc[];
  /** Scene sprite presentation (frames that hide captions baked into the PNG). */
  sprites?: Record<string, SpriteArt>;
  state: GameplayState;
};

/**
 * Portrait, name and health. HP is the profile's base_health (this puzzle
 * stage deals no damage, so it stays full). No player level or energy pool
 * exists in the backend yet, so neither is shown.
 */
export default function CharacterHUD({ hero, profile, npcs, state, sprites }: Props) {
  const hp = profile?.base.health ?? null;
  const met = (n: GameplayNpc) => (state.interacted ?? []).includes(n.code);
  return (
    <section className="fh-char" aria-label="Nhân vật">
      <div className="fh-avatar" style={{ "--tint": hero.tint } as React.CSSProperties}>
        <img src={hero.asset} alt="" draggable={false} />
      </div>
      <div className="fh-frame fh-char-panel">
        <strong className="fh-char-name">{profile?.name ?? hero.name}</strong>
        {hp !== null ? (
          <div className="fh-bar is-hp" role="meter" aria-label="Máu" aria-valuemin={0} aria-valuemax={hp} aria-valuenow={hp}>
            <span className="fh-bar-fill" style={{ width: "100%" }} />
            <span className="fh-bar-text">
              {hp} / {hp}
            </span>
          </div>
        ) : (
          <span className="fh-char-title">{hero.tagline}</span>
        )}
        {profile?.title && hp !== null && <span className="fh-char-title">{profile.title}</span>}
      </div>
      {npcs.length > 0 && (
        <ul className="fh-frame fh-companions" aria-label="Nhân vật trong ải">
          {npcs.map((n) => (
            <li key={n.code} className={met(n) ? "is-met" : ""} title={`${n.name}${met(n) ? " · đã gặp" : " · chưa gặp"}`}>
              <GameplaySprite name={n.name} imageUrl={n.imageUrl} imageAvailable={n.imageAvailable} spriteKey={n.spriteKey} frame={n.spriteKey ? sprites?.[n.spriteKey]?.frame : undefined} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
