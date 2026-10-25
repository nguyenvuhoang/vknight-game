// Hand-drawn SVG characters in the same thick-outline cartoon style as the
// hero sprites (/characters/hero-*.png).

const INK = "#222";

export function Granny() {
  return (
    <svg viewBox="0 0 100 156" className="sprite-svg" aria-hidden>
      {/* cane */}
      <path d="M80 92 L84 152" stroke="#7a4a1f" strokeWidth="5" strokeLinecap="round" />
      <path d="M74 92 Q80 84 86 92" fill="none" stroke="#7a4a1f" strokeWidth="5" strokeLinecap="round" />
      {/* legs + feet */}
      <path d="M42 128 L40 150 M58 128 L60 150" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="37" cy="152" rx="8" ry="4" fill={INK} />
      <ellipse cx="63" cy="152" rx="8" ry="4" fill={INK} />
      {/* áo bà ba */}
      <path
        d="M34 62 Q50 56 66 62 L76 128 Q50 136 24 128 Z"
        fill="#8e5aa8"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M50 62 L50 128" stroke="#6d3f86" strokeWidth="2" />
      <circle cx="50" cy="80" r="2" fill="#f3d36b" />
      <circle cx="50" cy="96" r="2" fill="#f3d36b" />
      {/* arms */}
      <path d="M36 70 Q24 88 30 102" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M64 70 Q76 82 80 92" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="30" cy="103" r="4.5" fill={INK} />
      <circle cx="80" cy="93" r="4.5" fill={INK} />
      {/* head */}
      <circle cx="50" cy="16" r="10" fill="#cfcfcf" stroke={INK} strokeWidth="3" />
      <circle cx="50" cy="38" r="21" fill="#f6dcbc" stroke={INK} strokeWidth="3.5" />
      <path d="M30 32 Q50 12 70 32" fill="#cfcfcf" stroke={INK} strokeWidth="3" />
      {/* glasses, eyes, smile, blush */}
      <circle cx="42" cy="38" r="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="58" cy="38" r="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <path d="M48 38 H52" stroke={INK} strokeWidth="2.5" />
      <circle cx="42" cy="39" r="2" fill={INK} />
      <circle cx="58" cy="39" r="2" fill={INK} />
      <path d="M44 49 Q50 53 56 49" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="35" cy="46" r="3" fill="#f2a3a3" opacity=".7" />
      <circle cx="65" cy="46" r="3" fill="#f2a3a3" opacity=".7" />
    </svg>
  );
}

/** awake: sitting (with the bone in its mouth unless bone=false); otherwise curled up asleep. */
export function Dog({ awake, bone = true }: { awake: boolean; bone?: boolean }) {
  return awake ? (
    <svg viewBox="0 0 120 80" className="sprite-svg" aria-hidden>
      {/* sitting{bone ? ", chewing the bone" : ""} */}
      <path d="M86 58 Q106 50 104 36" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="66" cy="56" rx="26" ry="18" fill="#e8b64a" stroke={INK} strokeWidth="3.5" />
      <path d="M52 72 V78 M76 72 V78" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="34" r="17" fill="#e8b64a" stroke={INK} strokeWidth="3.5" />
      <path d="M28 22 Q18 30 24 44" fill="#c98f2c" stroke={INK} strokeWidth="3" />
      <circle cx="40" cy="31" r="2.6" fill={INK} />
      <ellipse cx="27" cy="40" rx="5" ry="3.5" fill={INK} />
      {bone && (
      <g transform="rotate(-12 26 52)">
        <rect x="8" y="48" width="34" height="7" rx="3.5" fill="#fff4d6" stroke={INK} strokeWidth="2.5" />
        <circle cx="9" cy="48" r="4.5" fill="#fff4d6" stroke={INK} strokeWidth="2.5" />
        <circle cx="9" cy="56" r="4.5" fill="#fff4d6" stroke={INK} strokeWidth="2.5" />
        <circle cx="41" cy="48" r="4.5" fill="#fff4d6" stroke={INK} strokeWidth="2.5" />
        <circle cx="41" cy="56" r="4.5" fill="#fff4d6" stroke={INK} strokeWidth="2.5" />
      </g>
      )}
    </svg>
  ) : (
    <svg viewBox="0 0 120 80" className="sprite-svg" aria-hidden>
      {/* curled up asleep on the right sandal */}
      <ellipse cx="62" cy="72" rx="30" ry="6" fill="#6d4c2f" stroke={INK} strokeWidth="2.5" />
      <path d="M92 62 Q110 60 106 46" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="66" cy="58" rx="32" ry="15" fill="#e8b64a" stroke={INK} strokeWidth="3.5" />
      <circle cx="36" cy="56" r="15" fill="#e8b64a" stroke={INK} strokeWidth="3.5" />
      <path d="M26 46 Q16 54 22 66" fill="#c98f2c" stroke={INK} strokeWidth="3" />
      <path d="M34 55 Q38 58 42 55" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="23" cy="61" rx="4" ry="3" fill={INK} />
      <text x="70" y="30" className="sprite-zzz">z</text>
      <text x="82" y="20" className="sprite-zzz">z</text>
    </svg>
  );
}

/** Foreground bushes for the parallax layer. */
export function Bushes({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 110"
      className="fg-bush"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
        <circle cx="40" cy="78" r="34" fill="#3f7d34" />
        <circle cx="86" cy="64" r="40" fill="#4f9440" />
        <circle cx="140" cy="80" r="32" fill="#3f7d34" />
        <circle cx="182" cy="92" r="26" fill="#4f9440" />
      </g>
      <g fill="#7cc35a" opacity=".55">
        <circle cx="74" cy="48" r="12" />
        <circle cx="30" cy="66" r="9" />
        <circle cx="132" cy="70" r="8" />
      </g>
      <g fill="#fff" stroke={INK} strokeWidth="1.5">
        <circle cx="62" cy="92" r="4" />
        <circle cx="118" cy="98" r="4" />
        <circle cx="160" cy="76" r="3.5" />
      </g>
      <rect x="0" y="104" width="220" height="6" fill="#2f5a2a" />
    </svg>
  );
}
