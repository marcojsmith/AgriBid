# Task: Multi-lot auctions — Step 2: data migration script

Part of the multi-lot auction rework (GitHub issue #318). Step 2 of 7. The schema change (step 1, already merged into this branch) renamed the old single-item `auctions` table to `lots` and added a new `auctions` table for scheduled sale windows, plus renamed `auctionId` → `lotId` on `bids`, `proxy_bids`, `lotFees` (was `auctionFees`), `watchlist`, `reviews`, `conversations`, `supportTickets`, `lotFlags` (was `auctionFlags`). Read `convex/schema.ts` now to see the current (already-migrated) shape — do not re-derive it from git history.

This task writes and runs the data migration: every existing `lots` row (which used to be an `auctions` row before the rename) needs a parent `auctions` container, and needs its `startTime`/`endTime` legacy fields carried into that new container.

## Context

- `lots` rows created by the step-1 rename retain their legacy `startTime`/`endTime` fields (now optional) — these are the source of truth for how long each item's sale window originally was.
- Per GitHub issue #318 decision: **one auto-generated `auctions` container per legacy lot** (not one shared container) — this preserves each item's original per-item timing exactly.
- After migration, every `lots` row must have `auctionId` set to its new container's `_id`.
- Convex has no bulk rename/backfill built-in — since step 1 already renamed the table and FK fields at the schema level, there's no "old field" data loss to worry about for `bids`/`reviews`/etc. (Convex documents keep their stored field values; only the schema's declared shape changed, and since the field was renamed via schema edit rather than a data copy, verify how the currently-stored data actually looks — Convex requires backfilling renamed fields explicitly, it does NOT auto-rename data in existing documents). Read `convex/schema.ts` and cross-check against what's actually stored today by running a query/script that inspects a few existing documents in `lots` and `bids` — confirm whether the field is literally still named `auctionId` in stored data (schema validation would currently be failing dev pushes if so) or already `lotId`. Report what you find before writing the migration; if documents still have old field names, this migration must also handle that field rename as a data operation, not just linking lots to new auction containers.

## Instructions

1. First, investigate actual stored data shape. Run `bunx convex dev` is likely already running per AGENTS.md ("Assume the dev and Convex servers are already running") — do NOT start a new one. Instead write a throwaway internal query (or use existing dashboard/CLI tooling) to sample a few `lots` documents and a few `bids` documents and report their actual field names in the Results section. This determines whether step 1's schema-only change already broke local dev data (Convex will refuse to serve documents that don't match schema) — if so, note that clearly; this affects how urgent/blocking this migration is.

2. Write an internal migration mutation (or Convex migration using whatever migration pattern this codebase already uses — check for existing precedent, e.g. search for "migration" in `convex/` before inventing a new pattern) that, for every `lots` document without an `auctionId`:
   - Creates a new `auctions` document:
     - `title`: derive from the lot's own `title` field (e.g. reuse the same title, or prefix — your judgment, keep it simple, just reuse the lot's title).
     - `description`: omit (leave undefined).
     - `bannerImage`: omit.
     - `startTime`: the lot's legacy `startTime` if present, else the lot's `_creationTime`.
     - `endTime`: the lot's legacy `endTime` if present, else `startTime + (durationDays ?? 7) * 86400000`.
     - `status`: `"closed"` if the lot's status is `sold`/`unsold`/`rejected`, else `"published"`.
     - `defaultBuyerPremiumPct` / `defaultSellerCommissionPct`: omit.
     - `createdBy`: the lot's `sellerId` is wrong here — use a placeholder system identifier, e.g. `"system:migration"`, and add a one-line comment explaining why (no real admin created these legacy containers).
     - `createdAt` / `updatedAt`: the lot's `_creationTime`.
   - Patches the `lots` document with `auctionId` set to the new container's `_id`.
   - Must be idempotent: skip lots that already have `auctionId` set (so it's safe to re-run).
   - Must be batchable / resumable for large tables — check how many `lots` documents currently exist (via a count query) and decide whether a single mutation call is safe within Convex's mutation size/time limits, or whether it needs pagination across multiple scheduled calls. Report the row count in Results.

3. After writing the migration mutation, run it against the local dev deployment and report: how many `lots` were processed, how many `auctions` containers were created, and any errors encountered.

4. Verify referential integrity after the run: write and run a throwaway verification query that checks every `bids`, `proxy_bids`, `lotFees`, `watchlist`, `reviews`, `conversations` (where `lotId` is set), `supportTickets` (where `lotId` is set), and `lotFlags` document's `lotId` still resolves to an existing `lots` document (it will, since step 1 only renamed the field, not the referenced IDs — but confirm and report). Also verify every `lots` document now has a non-null `auctionId` pointing to a real `auctions` document.

5. Do not delete the legacy `startTime`/`endTime` fields from `lots` yet — leave them for now (a later cleanup task will remove them once the whole rework is confirmed working end-to-end).

6. Do not modify any query/mutation/UI logic beyond what's strictly needed to define and run the migration (e.g. a new file under `convex/migrations/` or similar). Do not fix the 1071 pre-existing type errors from step 1 — that's steps 3-7.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument/return validators on all functions, use `internalMutation`/`internalQuery` for migration-only functions (not public).
- Write the migration as a standalone, clearly-named file (e.g. `convex/migrations/multiLotAuctions.ts`) so it can be deleted/archived after use.
- Do not use `ctx.db.query(...).collect()` on a table that might be large without checking row count first — prefer paginated iteration if the `lots` table has more than a few hundred rows.
- Report exact commands you ran to execute the migration (e.g. via Convex dashboard function runner or a CLI script) in the Results section, so this can be re-run in other environments (staging/prod) later.

## Results

**Status:** Done, but the plan's premise was wrong and had to be adapted. See "Critical findings" below.

### Critical findings (investigation, step 1 of the plan)

The plan assumed step 1's schema-only rename had carried the old `auctions` data into `lots` and renamed the FK fields in stored documents. It had not — **Convex does not rename tables or document fields**, so none of the data moved:

- `lots` table: **0 documents**. The new `auctions` table: **22 documents — all legacy per-item auction rows** (field keys `make`, `model`, `currentPrice`, `startTime`, `endTime`, … — not container shape).
- `bids` (47), `proxy_bids` (2), `watchlist` (6), `reviews` (3), `conversations` (3), `supportTickets` (3), `auctionFees` (6), `auctionFlags` (1) all still store the **old field name `auctionId`**, not `lotId`.
- The physical `lotFees`/`lotFlags` tables exist but are empty; the old `auctionFees`/`auctionFlags` tables still hold their rows.
- **Dev pushes are currently broken in two independent ways:** (1) `bunx convex dev` fails type-check with 451 errors from step 1 (expected, steps 3-7), and (2) with type-check disabled the schema push fails *schema validation*: `Document ... in table "auctions" does not match the schema: Object is missing the required field 'createdAt'`. So step 1 did break local dev data — the deployment could not accept the new schema until this migration ran.
- Legacy `status` values found: `active` (14), `draft` (1), `pending_review` (2), `sold` (3), `unsold` (2). 19/22 had `startTime`/`endTime`; none had `durationDays`.

### Approach actually taken

Because Convex cannot rename tables/fields, `convex/migrations/multiLotAuctions.ts` performs the **whole rename as a data operation**, not just container linking:

1. For every legacy `auctions` row: inserts a new `lots` row (all legacy fields, `status` `active` → `approved`, legacy `startTime`/`endTime` retained), inserts a new `auctions` **container** per the task spec (title = lot title, `startTime` = legacy start ?? `_creationTime`, `endTime` = legacy end ?? start + `(durationDays ?? 7) * 86_400_000`, status `closed` for `sold`/`unsold`/`rejected` else `published`, `createdBy: "system:migration"` with a comment explaining no admin created these, `createdAt`/`updatedAt` = `_creationTime`), sets `lots.auctionId`, then deletes the legacy auction row so `auctions` holds only containers.
2. Repoints `auctionId` → `lotId` on `bids`, `proxy_bids`, `watchlist`, `reviews`, `conversations`, `supportTickets` (new IDs, so an old→new id map is applied).
3. Copies `auctionFees` → `lotFees` and `auctionFlags` → `lotFlags` with `lotId` remapped, deleting the old rows.
4. Idempotent (only legacy rows without `createdAt` are processed; re-run is a no-op). Batched via `batchSize` with `ctx.scheduler.runAfter` continuation when more legacy rows remain.

### Execution (dev deployment `useful-blackbird-263`)

Backup first (disposable seed data, but took one anyway; stored outside the repo at `%TEMP%/opencode/agribid-backup/pre-migration.zip`):

```bash
bunx convex export --path "<temp>/agribid-backup/pre-migration.zip"
```

Because the new schema could not be pushed while legacy data existed, schema validation was temporarily disabled (`defineSchema({...}, { schemaValidation: false })` in `convex/schema.ts`), then the migration was deployed with type-check disabled:

```bash
bunx convex dev --once --typecheck disable
bunx convex run migrations/multiLotAuctions:inspect
bunx convex run migrations/multiLotAuctions:migrate '{"batchSize":50}'
bunx convex run migrations/multiLotAuctions:verify
```

`schema.ts` was then **restored to its original form (validation enabled)** and re-pushed with `--typecheck disable`; the push succeeded, proving all stored data now matches the new schema. `git diff convex/schema.ts` is clean.

### Results of the run

- `migrate` → `{ legacyFound: 22, lotsCreated: 22, containersCreated: 22, fkPatched: 63, feesCopied: 6, flagsCopied: 1, remainingLegacy: 0, done: true }`
- Re-running `migrate` afterwards → all zeros, `legacyFound: 0` (confirmed idempotent).
- Row count for batching decision: **22 lots** — one mutation was safely within limits, so no continuation was needed; the batching/scheduler path is implemented for larger tables.

### Verification (`verify`, after run)

- `lotsTotal: 22`, `lotsMissingAuctionId: 0`, `lotsWithDanglingAuctionId: 0`, `legacyAuctionsRemaining: 0`.
- All FK `lotId` values resolve to existing `lots` rows: `bids` 47/47, `conversations` 3/3, `proxy_bids` 2/2, `reviews` 3/3, `watchlist` 6/6, `supportTickets` 2/3 (the third ticket never had an `auctionId` — it is optional and was correctly skipped). `fkWithOldAuctionId` is 0 for every table. `fkDanglingLotId` is 0 for every table.
- Sampled stored field names after migration: `lots` has `auctionId` + legacy `startTime`/`endTime`; `bids` has `lotId` (no `auctionId`); new containers have `createdBy`/`createdAt`/`updatedAt`; `lotFees` has `lotId`. Legacy `auctionFees`/`auctionFlags` are now empty.

### Notes / follow-ups

- Legacy `lots.startTime`/`endTime` were **left in place** per instruction 5; a later cleanup task should drop them (and the now-empty physical `auctionFees`/`auctionFlags` tables).
- This migration needs `schemaValidation` temporarily off whenever it runs, because it reads old names and writes new ones in the same pass. For staging/prod, back up, disable validation, `bunx vercel`/`convex deploy` with type-check disabled, run the three CLI commands above, re-enable validation, then re-push.
- `convex/_generated/api.d.ts` gained the `migrations/multiLotAuctions` module and `server.d.ts`/`server.js` were already modified before this task; generated files were not hand-edited (per step-1 notes).
- New file `convex/migrations/multiLotAuctions.ts` is intentionally standalone and can be deleted/archived once the rework is verified end-to-end. Lint on it is clean of errors (10 `security/detect-object-injection` warnings on trusted dynamic key access in throwaway migration code).
- The deployed function code is still the step-1-broken code (451 type errors); nothing beyond the migration was "fixed", as instructed.
