// Small decorative SVGs for the fantasy HUD (leaves, scroll, status badges).
// Pure presentation: no game data.

export function LeafSprig({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <svg className={`fh-leaf ${className}`} viewBox="0 0 64 40" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M62 22 C46 20 30 22 6 30" fill="none" stroke="#5a3d16" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 21 C40 8 30 4 22 6 C26 14 34 20 44 21Z" fill="#4f9a2f" stroke="#2d5a17" strokeWidth="1.6" />
      <path d="M30 24 C22 14 12 13 5 17 C11 24 20 27 30 24Z" fill="#6cb83a" stroke="#2d5a17" strokeWidth="1.6" />
      <path d="M38 22 C34 32 26 37 18 37 C22 29 29 24 38 22Z" fill="#3f8526" stroke="#2d5a17" strokeWidth="1.6" />
      <path d="M52 21 C52 12 58 7 63 6 C63 14 59 19 52 21Z" fill="#6cb83a" stroke="#2d5a17" strokeWidth="1.6" />
      <path d="M44 21 C38 15 32 11 24 8 M30 24 C22 21 14 18 7 17" fill="none" stroke="#2d5a17" strokeWidth="1" opacity=".6" />
    </svg>
  );
}

export function ScrollIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6 4h11a3 3 0 0 1 3 3v1h-3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h3Z" fill="#f2dfae" stroke="#5a3a17" strokeWidth="1.5" />
      <path d="M17 4a3 3 0 0 0-3 3v11a3 3 0 0 1-3 3" fill="none" stroke="#5a3a17" strokeWidth="1.5" />
      <path d="M8 9h5M8 12h5M8 15h4" stroke="#8a6a3a" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: "COMPLETED" | "ACTIVE" | "LOCKED" }) {
  if (status === "COMPLETED") {
    return (
      <svg className="fh-badge" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10.5" fill="#3aa83a" stroke="#1d5e1d" strokeWidth="1.6" />
        <path d="M7 12.5l3.2 3.2L17.2 8.6" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "ACTIVE") {
    return (
      <svg className="fh-badge is-active" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10.5" fill="#ffcf3f" stroke="#7a4d0a" strokeWidth="1.6" />
        <path d="M12 6.5v7" stroke="#3b2405" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="17.3" r="1.7" fill="#3b2405" />
      </svg>
    );
  }
  return (
    <svg className="fh-badge" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#8d8478" stroke="#4d463e" strokeWidth="1.6" />
      <rect x="8" y="11" width="8" height="6.5" rx="1.2" fill="#f1ece4" />
      <path d="M9.6 11V9.4a2.4 2.4 0 0 1 4.8 0V11" fill="none" stroke="#f1ece4" strokeWidth="1.8" />
    </svg>
  );
}

export function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="11" width="12" height="9" rx="2" fill="#cfc6b6" stroke="#4d463e" strokeWidth="1.4" />
      <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="#cfc6b6" strokeWidth="2.2" />
      <circle cx="12" cy="15.4" r="1.3" fill="#4d463e" />
    </svg>
  );
}

export function SubCheck({ done }: { done: boolean }) {
  return done ? (
    <svg className="fh-subcheck" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="#3aa83a" stroke="#1d5e1d" />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="fh-subcheck" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="#7d6a4a" strokeWidth="1.6" />
    </svg>
  );
}
