# vKnight — Chapter 1 / Stage 2 / Con Chó Đầu Ngõ

This pack is extracted from generated concept-art contact sheets. The files are SEPARATE PNGs ready to inspect and integrate, but **not production-polished original-layer exports**. Transparent edges may need manual cleanup.

## Critical visual caveats
- `stage02-background.png` currently includes a painted CLOSED GATE, village sign and a hanging bell, because those are part of the source painting. If rendering `gate-open.png` over it, remove/mask the baked-in gate or use the overlaid gate to fully cover the original. Do not let both gate images appear together.
- UI ornaments may contain painted texture and imperfect alpha. Never use the full concept board as the game background.
- Hero is intentionally NOT replaced; use the existing game's five hero assets.
- Dog and clue sprites are transparent extracted concept sprites; check visual quality at actual resolution before release.
- Position/scale remain configured in the backend; do not hardcode NPC positions from the artwork.

## Backend asset paths
Copy these files to `apps/web/public/chapters/chap01/gameplay/stage02/`:
- `gate-dog.png` → `/chapters/chap01/gameplay/stage02/gate-dog.png`
- `wood-sign.png` → `/chapters/chap01/gameplay/stage02/wood-sign.png`
- `torn-note.png` → `/chapters/chap01/gameplay/stage02/torn-note.png`
- `old-bell.png` → `/chapters/chap01/gameplay/stage02/old-bell.png`

Additional assets: `stage02-background.png`, `gate-closed.png`, `gate-open.png`, NPC variants, markers and HUD motifs.

## Integration
- Stage 2 (`CHAP01_MAP02`) only.
- Render separate dynamic React/CSS HUD.
- Do not turn on HUD for Stage 1.
- Keep existing quest/dialogue/progress and backend API.
