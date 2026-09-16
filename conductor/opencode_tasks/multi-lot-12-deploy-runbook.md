# Runbook: Multi-lot auctions — staging/prod rollout

Companion to `multi-lot-11-review-fixes.md`. Nothing here has been executed
outside **local dev**. The code is complete; this is the data/deployment and
release procedure.

## 0. Current state

- Code: multi-lot rework + review fixes complete on `feature/multi-lot-auctions`.
- Tests: `bun run test --run` → 185 files / 2315 tests pass.
- `bun run lint` / `bun run type-check` / `bun run build` → pass.
- **Blocker:** `bun run test:coverage` fails the 90% global gate
  (branches 88.2%, functions 89.1%; statements 91.67%, lines 92.6%).
- Data: only local dev (`useful-blackbird-263`) has been migrated.

## 1. Commit / PR plan

Keep the multi-lot work separate from unrelated working-tree changes.

1. **PR A — unrelated dev-env changes** (separate branch):
   - `AGENTS.md` Tailscale URL + Clerk note, `.gitignore` `certs/`,
     `vite.config.ts` HTTPS cert loading.
2. **PR B — multi-lot auctions** (`feature/multi-lot-auctions`):
   - schema/lots/auctions split, migration, backend, frontend, admin UI,
     gallery, and the step-11 review fixes.
   - Include the `vitest` coverage-tooling version fix
     (`@vitest/coverage-v8|coverage-istanbul|ui` `4.0.18` → `5.0.0`).
   - `package.json` version `0.16.0`.
3. Each PR: `lint` → `test --run` → `type-check` → `build` green; CodeRabbit
   review clean; merge to `main` via PR only.

## 2. Pre-deploy local rehearsal (already partially done)

```bash
bunx convex run migrations/multiLotAuctions:inspect
bunx convex run migrations/multiLotAuctions:migrate '{"batchSize":50}'
bunx convex run migrations/multiLotAuctions:verify
bunx convex run migrations/multiLotAuctions:clearLegacyLotWindows
```

`migrate` is idempotent; `clearLegacyLotWindows` unsets the superseded
`lots.startTime`/`endTime` fields. Re-run until `done: true`.

## 3. Staging deployment

1. **Back up:** `bunx convex export --path "<temp>/agribid-backup/staging-pre-migration.zip"`.
2. **Disable schema validation:** set `defineSchema({...}, { schemaValidation: false })`
   in `convex/schema.ts` (temporarily — restore immediately after).
3. **Deploy the migration code** (type-check disabled, since legacy data still
   exists): `bunx convex dev --once --typecheck disable` against the staging
   deployment (or `bunx vercel` if staging is on Vercel).
4. **Run the migration** (same commands as §2).
5. **Restore schema validation** and re-push; the push succeeding proves all
   stored data matches the new schema.
6. `bunx convex run migrations/multiLotAuctions:clearLegacyLotWindows`.
7. **Verify** with `verify`: `lotsMissingAuctionId: 0`, no dangling `lotId`,
   `legacyAuctionsRemaining: 0`.
8. Smoke test: marketplace, lot detail + bidding, admin lots/auctions
   assignment, container publish/close, public gallery → `/auctions/:id`.
9. Confirm the `settleExpiredLots` cron runs without errors.

## 4. Production deployment

Repeat §3 exactly against the production deployment. Prod `lots` is empty
pre-migration, so the migration is the first thing that populates it.

## 5. Post-rollout cleanup (only after prod verified)

1. Drop the legacy `startTime`/`endTime` fields from `convex/schema.ts`
   (last step, once `clearLegacyLotWindows` has run everywhere).
2. Delete `convex/migrations/multiLotAuctions.ts`.
3. Drop the now-empty legacy `auctionFees`/`auctionFlags` tables.
4. Remove the temporary migration notes and update `codebase_notes.md`.

## 6. Coverage remediation (commit blocker)

Target the largest deficits (from the v8 report):

| File                                             | Stmts | Branch | Funcs | Notes        |
| ------------------------------------------------ | ----- | ------ | ----- | ------------ |
| `convex/admin/fees.ts`                           | 33%   | 27%    | 14%   | largest drag |
| `convex/auctions/queries/listings.ts`            | 40%   | 32%    | 44%   |              |
| `convex/auctions/queries/browse.ts`              | 69%   | 64%    | 58%   |              |
| `convex/auctions/queries/admin.ts`               | 72%   | 75%    | 64%   |              |
| `convex/errors.ts`                               | 64%   | 59%    | 67%   |              |
| `src/pages/admin/auctions/AuctionFormDialog.tsx` | 82%   | 75%    | 63%   |              |

Global function gap is only ~13 uncovered functions, so a focused pass on
`fees.ts` + `listings.ts` should clear functions; branches need ~91 more
covered, concentrated in those same files.

## 7. Release checklist

- [ ] PR B merged to `main`
- [ ] Staging migration run + `verify` clean + smoke test
- [ ] Production migration run + `verify` clean + smoke test
- [ ] `settleExpiredLots` cron healthy in prod
- [ ] Post-rollout cleanup (§5)
- [ ] Issue #318 closed; track/Checklist updated
