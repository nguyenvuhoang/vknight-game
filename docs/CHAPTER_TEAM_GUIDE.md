# Chapter contract: vKnight Phiêu Lưu Ký

## One team, one chapter

- Team CH01: `chapters/ch01-lang-ngao/` + published JSON `apps/web/public/chapters/ch01-lang-ngao.json`.
- Team CH02: `chapters/ch02-rung-lua/` + published JSON `apps/web/public/chapters/ch02-rung-lua.json`.
- Team CH03: `chapters/ch03-thanh-pho-bat-on/` etc.
- Core team owns `apps/web/lib/game/`, `apps/api/`, `lib/types.ts`, shared UI, release branches.
- Branch names: `feature/ch01-*`, `feature/ch02-*`, `feature/engine-*`. Merge via PR; chapter PRs must not modify engine.

## JSON Chapter schema (prototype)

Each chapter object:
- `id`, `title`, `version`, `levels[]`.
- Each level has `id`, `number`, `title`, `story`, `width`, `spawn`, `groundY`, `platforms`, `hazards`, `npc`, `exitX`, `bg`, `difficulty`.
- `platforms[]`: center x/y, width/height; physics collision provided by engine.
- `hazards[]`: x/y/w/h; touched hazard causes death.
- `npc.required`: blocks win until player presses E/F near NPC.
- `npc.lines`: MUST contain **all five** keys `sword`, `professor`, `chairman`, `angry`, `comedian`.
- Level ids globally unique, for example `CH02_L01`; number is 1-based **inside the chapter**.

## Definition of Done for a chapter

1. JSON schema passes validation script (`python tools/validate_chapters.py`).
2. At least one uniquely authored story moment for each hero per level.
3. All geometry reachable with current movement speed and jump height; no unwinnable stage.
4. Keyboard and touch controls tested; a hitbox makes physical sense.
5. Assets belong under `/public/chapters/<chapter-id>/assets`, and have licensing documentation.
6. UX testing at 360x780 mobile and 1366x768 desktop.
7. New mechanic needs a separate engine PR defining reusability, automated tests, and versioning.

## Suggested team split

- Core Engine: Phaser scenes, mechanics, touch controls, camera, physics, sound.
- Story / CH01: 10 village levels, NPC dialogue, funny failure text.
- CH02: forest chapter data/assets. Can work in parallel with CH01 after common engine stable.
- Backend: auth, real persistence, battle validation, paid skip entitlement, payment.
- Art/Animation: remake supplied original characters as properly rigged animations, background and NPC art.

## Payment workflow (NOT implemented)

Skip Level 1,000 VND design: CreateSkipOrder -> QR provider -> verified signed webhook -> grant `SkipTicket` entitlement -> `ConsumeSkipTicket` atomic transaction -> completion.
Do not grant a skip on client redirect or browser-provided `paid=true`. Bind entitlement to authenticated/recoverable player. Confirm Vietnamese legal/commercial and provider terms. For MVP test only with a stub; never show a real banking transfer request from this starter.
