# Task: Multi-lot auctions — Step 3: lot lifecycle + auction (container) CRUD

Part of the multi-lot auction rework (GitHub issue #318). Step 3 of 7.

Already done (do not redo, read to understand current state):
- Step 1 (schema): `convex/schema.ts` — `lots` table (seller item, status `draft|pending_review|approved|assigned|sold|unsold|rejected`, `auctionId?`, `extendedEndTime?`), new `auctions` table (container: `title`, `description?`, `bannerImage?`, `startTime`, `endTime`, `status: draft|published|closed`, `defaultBuyerPremiumPct?`, `defaultSellerCommissionPct?`, `createdBy`, `createdAt`, `updatedAt`), FK tables renamed `auctionId`→`lotId` (`bids`, `proxy_bids`, `lotFees`, `watchlist`, `reviews`, `conversations`, `supportTickets`, `lotFlags`).
- Step 2 (migration): `convex/migrations/multiLotAuctions.ts` — already run against local dev; data is in the new shape now (confirm with `bunx convex run migrations/multiLotAuctions:verify` before starting, don't re-run `migrate`).

Read `convex/schema.ts` in full before starting — it is the source of truth for field/table names, not this task file's prose.

## Context

This task rewrites the admin/seller lot & auction lifecycle logic. It does NOT touch bidding/anti-snipe (`convex/auctions/mutations/bidding.ts`, step 4) or fee calculation (`convex/admin/fees.ts`, step 5) or any frontend (steps 6-7).

Current (pre-rework) logic lives in `convex/auctions/mutations/publish.ts` — read it in full now. It currently conflates several concerns for a single-item auction: submit-for-review, approve, reject, flag/dismiss-flag, and early-closure/settlement. In the new model these concerns split:

- **Lot lifecycle** (seller submits, admin reviews): `draft → pending_review → approved | rejected`.
- **Auction (container) lifecycle** (admin creates/edits/publishes a sale window): `draft → published → closed`.
- **Assignment** (admin action): moves an `approved` lot into `assigned` by setting `lot.auctionId`, and moving a lot back out (`assigned → approved`, clearing `auctionId`) for the unsold-relisting case.
- Flagging/moderation and early-closure/settlement stay conceptually close to bidding — leave `flagAuctionHandler`/`dismissFlagHandler`/`closeAuctionEarlyHandler` for now (step 4 will move and rework settlement-adjacent code); this task only needs flag/dismiss updated enough to compile against the renamed `lots`/`lotFlags` tables, without changing their behavior.

Read `convex/auctions/mutations/helpers.ts` and `convex/constants.ts` (`AUCTION_MIN_DURATION_DAYS` etc.) — reuse existing helpers/constants where the concept still applies to a lot; adapt them where it now applies to an auction container instead.

Read `convex/lib/auth.ts` for `requireAdmin`, `tryRequireAdmin`, `getAuthenticatedUserId`, `getCallerRole`, `getAuthUser`, `resolveUserId` — reuse these, don't reinvent auth checks.

## Instructions

### 1. Lot lifecycle mutations — new file `convex/lots/mutations/lifecycle.ts`

Port and adapt from `publish.ts`:

- `submitLotForReview` (mutation): seller-owned, `draft → pending_review`. Same validation as today's `validateAuctionBeforePublish` (title/description/price/images required) — reuse or adapt `helpers.ts`'s `validateAuctionBeforePublish`/`assertOwnership`/`assertEditable` renamed to operate on `Doc<"lots">`. Keep the existing `logActivity` call (`listing_created`).
- `approveLot` (mutation, admin-only via `requireAdmin`): `pending_review → approved`. Unlike today's `approveAuctionHandler`, this does **not** set `startTime`/`endTime` or duration — a lot has no independent window anymore; the window comes from whichever auction it's later assigned to. Just flips status and clears `hiddenByFlags`.
- `rejectLot` (mutation, admin-only): `pending_review → rejected`. Same as today's `rejectAuctionHandler` minus the `startTime`/`endTime` clearing (lots don't own those anymore going forward — leave the legacy fields alone, don't touch them).
- Counter helpers: `adjustStatusCounters`/`getCounterKey` in `helpers.ts` reference an `"auctions"` counter name (see `convex/admin_utils.ts`'s `updateCounter` signature — check its first-arg type) and the status set `active|pending_review|draft`. Update to use a `"lots"` counter name and the new status set (`draft`, `pending_review`, `approved`, `assigned`, `sold`, `unsold`, `rejected` — decide which map to a counter field per the existing `counters` schema table shape at `convex/schema.ts:379-391`; `active`/`pending`/`draft` fields exist there — map `approved`+`assigned` to `active` for now unless you find a cleaner fit, use your judgment and note the decision in Results). Put the updated helpers in `convex/lots/mutations/helpers.ts` (new file, sibling to the new lifecycle file) rather than editing `convex/auctions/mutations/helpers.ts` in place — that old file/directory still needs to exist for step 4 to adapt bidding.ts, but its lot-shaped helpers should move. Use your judgment: if moving is riskier than adapting in place, adapt `convex/auctions/mutations/helpers.ts` in place instead and say so in Results — the goal is no duplicate/conflicting helpers, not a specific file layout.

### 2. Auction (container) CRUD mutations — new file `convex/auctions/mutations/adminCrud.ts`

All admin-only (`requireAdmin`):

- `createAuction`: args `{ title: string, description?: string, bannerImage?: Id<"_storage">, startTime: number, endTime: number, defaultBuyerPremiumPct?: number, defaultSellerCommissionPct?: number }`. Validates `endTime > startTime`. Inserts with `status: "draft"`, `createdBy` = calling admin's userId, `createdAt`/`updatedAt` = now. Returns the new `auctions._id`.
- `updateAuction`: args `{ auctionId: Id<"auctions">, ...same fields as createAuction but all optional }`. Loads the auction; if any lot is currently `assigned` to it AND has accepted bids (check `bids` via `by_lot` index for any bid on any assigned lot), enforce the constraints from issue #318: reject a `startTime` change that would move it later than any accepted bid's timestamp on an assigned lot, and reject an `endTime` change that would shorten the window below any assigned lot's `extendedEndTime` if set. Otherwise apply the patch, bump `updatedAt`. Throw `ConvexError` with a clear message on constraint violation.
- `publishAuctionContainer`: `draft → published`, admin-only. Validates `title` non-empty and `startTime < endTime` (reuse whatever validation pattern `validateAuctionBeforePublish` used, adapt for auction container fields — no images/reserve price requirement, those are lot-level).
- `closeAuctionContainer`: `published → closed`, admin-only. Does NOT touch lots — this task doesn't implement settlement (step 4 does); just flips the container status. Add a one-line comment noting lot settlement is handled separately in step 4.

### 3. Assignment mutations — new file `convex/auctions/mutations/assignment.ts`

- `assignLotToAuction`: args `{ lotId: Id<"lots">, auctionId: Id<"auctions"> }`, admin-only. Requires lot status `approved` (throw otherwise). Requires the target auction exists (throw otherwise) — does not require it to be `published` (an admin may pre-stage lots into a `draft` auction before publishing it; your judgment, note if you decide otherwise). Patches `lot.auctionId = auctionId` and `lot.status = "assigned"`.
- `unassignLot`: args `{ lotId: Id<"lots"> }`, admin-only. Requires lot status `assigned`. Clears `lot.auctionId = undefined`, sets `lot.status = "approved"`. This is the "unsold lot returns to pool for reassignment" path from issue #318 — also usable to unassign a mistakenly-assigned lot before the auction starts. Do not gate this on the auction's own status/window in this task (settlement-driven auto-unassignment on `unsold` is step 4's job) — this is the manual admin action only.

### 4. Flag/moderation compile fix (minimal, behavior-preserving)

In `convex/auctions/mutations/publish.ts`, update `flagAuctionHandler` and `dismissFlagHandler` (and their exported `flagAuction`/`dismissFlag` mutations) to compile against the renamed tables: `ctx.db.get("auctions", ...)` calls that were actually fetching a per-item auction now need `ctx.db.get("lots", ...)`, `auctionFlags` → `lotFlags`, `args.auctionId` → `args.lotId` (rename the arg), index names `by_auction`/`by_auction_status` → `by_lot`/`by_lot_status`. The "auto-hide on N flags" check currently patches `auctions.status`/`hiddenByFlags` — this should now patch the **lot's** status/hiddenByFlags, and the "restore on dismiss" branch same. Do not change the flag threshold logic or auto-hide semantics, just repoint table/field names. Also check `convex/auctions/dismissFlag.test.ts` — update its mocks/fixtures to match (rename `auctionId` args, table names) without changing what it asserts, unless an assertion is now nonsensical (e.g. asserted an `active` status that no longer exists — adapt to `approved`).

### 5. Do not touch in this task

- `convex/auctions/mutations/bidding.ts`, `bidding.test.ts` (step 4).
- `convex/admin/fees.ts`, `fees.test.ts` (step 5).
- Anything under `src/` (steps 6-7).
- `closeAuctionEarlyHandler`/`closeAuctionEarly` in `publish.ts` — leave it broken/uncompiled for now if touching it would require settlement logic; note in Results whether it currently blocks compilation of the rest of `publish.ts` and if so, do the minimal rename-only fix to get it compiling (same pattern as flag/dismiss) without adding auction-window-aware settlement logic (that's step 4).

## Constraints

- Follow `.claude/rules/convex_rules.md` — new function syntax, argument/return validators on everything, `internalMutation` vs `mutation` as appropriate (all of these are admin/seller-facing public mutations, so `mutation` is correct, gated by the auth helper calls).
- Write tests for each new mutation (create test files alongside, e.g. `convex/lots/mutations/lifecycle.test.ts`, `convex/auctions/mutations/adminCrud.test.ts`, `convex/auctions/mutations/assignment.test.ts`) covering: happy path, wrong-status rejection, non-admin rejection (for admin-only ones), ownership check (for seller-owned ones). Check `convex/auctions/mutations/publish.test.ts` for the existing test patterns/mocking setup (`convex-test` or similar) and follow the same conventions.
- Run `bun run test --run convex/lots convex/auctions/mutations` (adjust path to wherever you put the new test files) and report pass/fail counts in Results.
- Run `bun run type-check` at the end; it will still show errors from files not yet touched (bidding.ts, fees.ts, UI — steps 4-7) — paste the count and confirm no NEW errors were introduced in files this task touched, compared to the baseline count from step 2's Results.
- Do not add speculative abstractions beyond what's asked (e.g. no generic "state machine" framework — plain mutations matching the existing codebase style).

## Results

### Migration state (confirmed before starting)

`bunx convex run migrations/multiLotAuctions:verify` reported the new shape is live:
`legacyAuctionsRemaining: 0`, `lotsTotal: 22`, `lotsMissingAuctionId: 0`,
`lotsWithDanglingAuctionId: 0`, `fkWithOldAuctionId` all 0. `migrate` was **not** re-run.

### Files created

- `convex/lots/mutations/helpers.ts` — lot-shaped ports of the old auction helpers:
  `LotValidationInput`, `LOT_EDITABLE_STATUSES`/`isLotEditableStatus`/`assertLotEditable`
  (`Doc<"lots">`), `assertLotOwnership` (`lot.sellerId`), `isNonEmpty`,
  `validateLotBeforeSubmit` (title/description/starting+reserve price/images),
  `getLotCounterKey`/`adjustLotStatusCounters`.
- `convex/lots/mutations/lifecycle.ts` — `submitLotForReview` (seller-owned draft ->
  pending_review, `validateLotBeforeSubmit`, `adjustLotStatusCounters`, `logActivity`
  `listing_created`), `approveLot` (admin, pending_review -> approved, clears
  `hiddenByFlags`, no window/duration), `rejectLot` (admin, pending_review -> rejected,
  does not touch legacy `startTime`/`endTime`).
- `convex/auctions/mutations/adminCrud.ts` — admin `createAuction` (endTime > startTime,
  status draft, createdBy/createdAt/updatedAt, returns new id),
  `updateAuction` (window/bid constraints below), `publishAuctionContainer`
  (draft -> published, validates title + startTime < endTime), `closeAuctionContainer`
  (published -> closed, one-line comment that lot settlement is step 4).
- `convex/auctions/mutations/assignment.ts` — `assignLotToAuction` (admin; lot must be
  `approved`, target auction must exist, may be `draft`; sets `auctionId` + `assigned`)
  and `unassignLot` (admin; lot must be `assigned`; clears `auctionId`, sets `approved`).
- Tests: `convex/lots/mutations/lifecycle.test.ts`,
  `convex/auctions/mutations/adminCrud.test.ts`,
  `convex/auctions/mutations/assignment.test.ts` (happy path, wrong status, missing
  doc, non-admin, ownership; vi.mock pattern copied from `publish.test.ts`).

### `updateAuction` constraint semantics (issue #318)

For every `assigned` lot on the target auction: a `startTime` change is rejected when it
moves later than the lot's accepted bid timestamp (accepted bid = highest non-voided
amount, earliest timestamp breaks ties), and an `endTime` change is rejected when it
falls below that lot's `extendedEndTime` if set. Violations throw `ConvexError` with a
clear message. The new window is also checked for `endTime > startTime`.

### Flag/dismiss compile fix (behavior-preserving)

`flagAuctionHandler`/`flagAuction` and `dismissFlagHandler`/`dismissFlag` in
`convex/auctions/mutations/publish.ts` were repointed to `lots`/`lotFlags`
(`get("lots")`, `by_lot`/`by_lot_status`, `args.auctionId` -> `args.lotId`, insert into
`lotFlags`). Auto-hide now checks/patches the lot: old `active` maps to the lot's
`approved` status (`approved -> pending_review` + `hiddenByFlags: true`, counters
`lots` `active`-1/`pending`+1); dismiss restores `pending_review -> approved`. Threshold
logic and audit action strings (`AUTO_HIDE_AUCTION_FLAGS`, `DISMISS_FLAG`) unchanged;
audit `targetType` is now `lot`/`lotFlag` and details use `lotId`.
`closeAuctionEarlyHandler` was **not** touched: it still blocks compilation of its own
block only (it needs settlement logic, step 4), but that is pre-existing and does not
affect the new files.

Tests updated to match: `convex/auctions/flagAuction.test.ts`,
`convex/auctions/dismissFlag.test.ts`, `convex/auctions/mutations_branch.test.ts`, and
the flag/dismiss blocks of `convex/auctions/mutations/publish.test.ts` (table names,
`lotId`, `active` -> `approved`; assertions otherwise unchanged).

### Counter mapping decision

There are no `approved`/`assigned`/`unsold`/`rejected` fields in the `counters` schema
(`convex/schema.ts:412-424`). Decision (noted per instructions): map
`draft -> draft`, `pending_review -> pending`, `approved` **and** `assigned -> active`
(cleanest fit — both mean "in the sellable pool"), `sold -> soldCount`; `unsold` and
`rejected` map to no counter field. Helper names are distinct from the legacy
auction-shaped ones (`assertLotOwnership`, `validateLotBeforeSubmit`,
`getLotCounterKey`, `adjustLotStatusCounters`) so the old `convex/auctions/mutations/helpers.ts`
can remain for step 4 with no naming conflict.

### Tests

`bun run test --run convex/lots convex/auctions/mutations convex/auctions/flagAuction.test.ts convex/auctions/dismissFlag.test.ts convex/auctions/mutations_branch.test.ts`
→ **Test Files 11 passed (11), Tests 190 passed (190)**.

### Type-check

`bun run type-check` (tsgo): **EXIT 2, 1012 total errors vs. 1071 baseline (-59)**.
- New files (`convex/lots/**`, `adminCrud.ts`, `assignment.ts`): **0 errors**.
- `convex/auctions/mutations/publish.ts`: unique errors dropped from 37 to 11; all 11
  remaining are pre-existing errors in `publishAuctionHandler`/`approveAuctionHandler`/
  `rejectAuctionHandler`/`closeAuctionEarlyHandler` (untouched legacy auction-table
  code awaiting steps 4-7). No new errors were introduced in any file this task touched.
- Remaining errors are in out-of-scope files (bidding.ts, fees.ts, queries, seed, UI).

### Lint

`bunx eslint` over all touched files: **0 errors** (1 pre-existing warning in
`publish.ts:312`, inside untouched `approveAuctionHandler`).
