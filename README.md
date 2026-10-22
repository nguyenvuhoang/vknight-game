# vKnight Phiêu Lưu Ký — Chapter 1: Làng Ngáo

**Executable starter scaffold:** Next.js 16 + Phaser 3 + ASP.NET Core 10 SQLite development API, reusable JSON chapter format, 5 characters from the supplied illustration, 10 prototype levels. This is not a production-ready or fully balanced game.

## 1. Prerequisites

- Node.js 20.9+ (Node 22 recommended), npm.
- .NET SDK 10 **only if running the optional backend**.
- Python 3 for validating chapter JSON.

## 2. Run web demo

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000. No database needed. Choose 1 of 5 heroes, choose a stage, then press Play. **Progress is stored in browser localStorage if backend is offline**.

Control: `A/D` or `←/→` move, `Space` jump, `E` interact with NPC, `F` special move (demo effect). Mobile has on-screen touch buttons. Touch UI is prototype, not polished.

## 3. Run optional .NET 10 API

```bash
cd apps/api
dotnet restore
dotnet run --urls http://localhost:5099
```

```bash
cd apps/web
cp .env.example .env.local
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local`.

`/health` and `/api/v1/progress/{playerId}` provide basic API checks. SQLite file `vknight-dev.db` is created automatically. `EnsureCreated` is for prototype only; migrate to EF migrations in production.

**SECURITY WARNING:** Current API trusts supplied `playerId` and client level-completion claims, so progress can be spoofed. Payment is **NOT** implemented, skip endpoint returns HTTP 501, and the demo must not be exposed commercially without proper authorization, server-side win validation and payment reconciliation. Client `localStorage` is a UX convenience, not the authoritative game record.

## 4. Add a new chapter

Duplicate `apps/web/public/chapters/ch01-lang-ngao.json` as `ch02-rung-lua.json` and change `id`, story, level IDs, NPC lines, obstacle layouts. The chapter loading function in `apps/web/lib/catalog.ts` already accepts chapter IDs. Current UI starts in Chapter 1 deliberately; wire a chapter selector to publish Chapter 2. Read `docs/CHAPTER_TEAM_GUIDE.md` before team parallelization.

```bash
python tools/validate_chapters.py
```

## 5. Current features and boundaries

Implemented: 5 avatar selection, 10 JSON-driven stages, per-hero NPC lines, walk/jump, hazard/retry keyboard (R), touch movement, ability label, exit objective, local save, optional SQLite progress API.

Not implemented: individual full animations, per-hero physics abilities, bespoke enemy AI/boss fights, cutscenes, checkpoint system, sprite rigging, authenticated accounts, payment, skip tickets, anti-cheat, shop, production-grade mobile balancing. The image supplied by user is used as a **static sprite prototype**.

## 6. Recommended next milestone

- Engine team: touch-friendly restart, checkpoint and enemy systems; remove coupling from single Adventure scene.
- Art team: create 5 animated sprites while preserving original hand-drawn personality.
- CH01 team: differentiate the 10 stage puzzles beyond the shared NPC/hazard prototype.
- Backend team: authentication + ownership + server-validated progress.
- Payment team: sandbox skip-ticket flow (1,000 VND only when real integration is compliant and confirmed).
