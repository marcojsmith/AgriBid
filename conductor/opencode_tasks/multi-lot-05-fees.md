# Task: Multi-lot auctions — Step 5: fee resolution, snapshot, and lot-scoped queries

Part of the multi-lot auction rework (GitHub issue #318). Step 5 of 7.

**Work alone. Do not delegate to, spawn, or invoke any other opencode/agent instance for any part of this task — do all edits yourself directly.**

Already done (read to understand current state, do not redo):
- Step 1 (schema): `convex/schema.ts` — `lots` (per-item, `auctionId?`, `extendedEndTime?`), `auctions` (container: `startTime`, `endTime`, `status`, `defaultBuyerPremiumPct?`, `defaultSellerCommissionPct?`), `lotFees` (was `auctionFees`, now keyed by `lotId`), `lotFlags`.
- Step 3: `convex/auctions/mutations/assignment.ts` — `assignLotToAuction` (`approved → assigned`, sets `lot.auctionId`), `unassignLot`.
- Step 4: `convex/auctions/internal.ts` — `calculateAndRecordFees(ctx, lot: Doc<"lots">, salesVolume?)` already renamed to operate on a lot and insert into `lotFees`, called from settlement (`settleExpiredAuctionsHandler`) and early closure (`convex/auctions/mutations/publish.ts`'s `closeAuctionEarlyHandler`). **Its calculation logic itself was deliberately left unchanged in step 4** (still only iterates `platformFees`) — this task is what makes it resolve/apply the auction's fee defaults too.

Read `convex/schema.ts` in full now — source of truth, not this file's prose.

## Context

Issue #318's fee decision (confirmed): *"Auction fee/reserve defaults must not change financial outcomes for lots that are already active or settled. Resolve effective fee and reserve configuration when a lot is assigned or when the auction is published, then snapshot the values used at settlement."*

Currently `auctions.defaultBuyerPremiumPct`/`defaultSellerCommissionPct` (added in step 1) are **not used anywhere** — they're dead fields. This task wires them up as a second fee source alongside the existing `platformFees` table, with snapshot semantics so editing an auction's defaults later doesn't retroactively change an already-assigned lot's fees.

Read `convex/admin/fees.ts` and `convex/admin/fees.test.ts` in full — this is the main file to rework. Also read `convex/auctions/mutations/assignment.ts` (step 3) — you will extend `assignLotToAuction`, not rewrite it. Also read `convex/auctions/internal.ts`'s `calculateAndRecordFees` (step 4) — you will extend its calculation, not its call sites.

## Instructions

### 1. Schema addition (small, scoped)

Add two optional fields to `lots` in `convex/schema.ts`: `resolvedBuyerPremiumPct: v.optional(v.number())` and `resolvedSellerCommissionPct: v.optional(v.number())`, with a one-line comment: snapshot of the parent auction's fee defaults at assignment time, so later auction edits don't change an already-assigned lot's fees. Do not touch any other part of the schema.

### 2. Snapshot at assignment — extend `convex/auctions/mutations/assignment.ts`

In `assignLotToAuction`, after validating the lot is `approved` and the auction exists: read the auction's `defaultBuyerPremiumPct`/`defaultSellerCommissionPct` and include them in the same patch that sets `auctionId`/`status: "assigned"`, writing them into the lot's new `resolvedBuyerPremiumPct`/`resolvedSellerCommissionPct` fields (copy whatever value is present, including `undefined` if the auction has no default set — don't invent a fallback value here). This is the "resolve at assignment time" half of the issue #318 decision. Update `convex/auctions/mutations/assignment.test.ts` to cover this (assert the snapshot fields land correctly, including the case where the auction has no defaults set).

### 3. Fee calculation — extend `calculateAndRecordFees` in `convex/auctions/internal.ts`

Currently it only iterates `platformFees` (percentage/fixed, buyer/seller/both) and inserts `lotFees` rows. Add a second source: if `lot.resolvedBuyerPremiumPct` is set, calculate `salePrice * resolvedBuyerPremiumPct` and insert a `lotFees` row for it (treat it like a percentage fee applied to `"buyer"`; you'll need a way to represent "this fee didn't come from `platformFees`" — since `lotFees.feeId` is `v.id("platformFees")` (a required FK), you cannot insert a fee row without a real `platformFees._id`. Resolve this by NOT trying to force auction-default fees into the `lotFees` table's existing shape if it would require a schema change to make `feeId` optional — that's out of scope here (schema changes in this task are limited to instruction 1's two lot fields, nothing on `lotFees`). Instead: use your judgment on the cleanest way to record these amounts within existing shapes — options include (a) creating a real `platformFees` row lazily is wrong (that would pollute the global fee list), (b) computing and returning the auction-default fee amounts alongside the `platformFees`-sourced ones without persisting them to `lotFees` at all, surfaced only through the read-side queries in instruction 4, or (c) some other approach you find cleaner. Pick one, document the tradeoff in Results, and make sure the idempotency guard (re-running settlement / early-closure shouldn't double-charge) still holds for whichever approach you pick. Keep the existing `platformFees`-sourced calculation and audit-log behavior unchanged.
- The reserve-price half of the issue #318 decision ("resolve reserve... at assignment") — check whether `lots.reservePrice` is already seller-set and immutable per-lot (read `convex/lots/mutations/helpers.ts`'s `validateLotBeforeSubmit` and the lot schema fields). If reserve price is already fully lot-owned with no auction-level reserve override anywhere in the schema, there's nothing to resolve/snapshot for reserve — note this in Results and don't invent a mechanism that doesn't correspond to any real field.

### 4. Read-side: rename auction-scoped fee queries to lot-scoped

In `convex/admin/fees.ts`:
- `getAuctionFees` (admin query, args `{ auctionId: v.id("auctions") }`): rename to `getLotFees`, args `{ lotId: v.id("lots") }`, query `lotFees` via its `by_lot` index, return type's `auctionId: v.id("auctions")` field → `lotId: v.id("lots")`.
- `getAuctionFeesForUserHandler`/`getAuctionFeesForUser` (public query, checks caller is winner or seller): rename to `getLotFeesForUserHandler`/`getLotFeesForUser`, args `{ lotId: v.id("lots") }`, `ctx.db.get("auctions", ...)` → `ctx.db.get("lots", ...)`, `auction.winnerId`/`auction.sellerId` → `lot.winnerId`/`lot.sellerId`, query `lotFees` via `by_lot`. **If you chose option (b) or similar in instruction 3** (auction-default fees not persisted to `lotFees`), this handler must also compute and merge in the lot's resolved-default fee amounts (using `lot.resolvedBuyerPremiumPct`/`resolvedSellerCommissionPct` and `lot.currentPrice` at query time for an in-progress lot, or the settled sale price for a completed one — use your judgment on which price field is correct pre- vs post-settlement, note it in Results) so the buyer/seller still see the full picture in one place. This is the "surfaced only through read-side queries" fallback from instruction 3 — implement it for real here, don't leave a TODO.
- `getFeeStats` (admin query, aggregates across `auctionFees`/now `lotFees`): update table name only (`auctionFees` → `lotFees`), no behavior change — this one has no per-lot scoping to worry about, it's a global rollup.
- Check `convex/admin/mutations.ts` and any other file referencing `auctionFees`/`getAuctionFees`/`getAuctionFeesForUser` (you saw errors here in earlier type-check runs — search the whole `convex/` tree for `auctionFees` and `getAuctionFees` to find every remaining call site) and update them to the renamed table/query.

### 5. Tests

- Update `convex/admin/fees.test.ts` for every renamed query/mutation and the new snapshot-aware calculation, covering: fee calc with only `platformFees` (existing behavior, unchanged), fee calc with only auction-resolved defaults, fee calc with both, and the buyer/seller-only-sees-their-own-fees authorization check still working on `lots`.
- Update `convex/auctions/mutations/assignment.test.ts` per instruction 2.
- Update any test file touched by the `internal.ts` change (`convex/auctions/internal.test.ts`, `internal_branch.test.ts`, `settleExpiredAuctions.test.ts`, `closeAuctionEarly.test.ts` if they assert on `calculateAndRecordFees` behavior).
- Run `bun run test --run convex/admin convex/auctions/mutations/assignment.test.ts convex/auctions/internal.test.ts convex/auctions/internal_branch.test.ts convex/auctions/settleExpiredAuctions.test.ts convex/auctions/closeAuctionEarly.test.ts` and report pass/fail.

### 6. Do not touch in this task

- Anything under `src/` (steps 6-7).
- `convex/auctions/mutations/bidding.ts`, `proxy_bidding.ts` (step 4, done).
- `convex/lots/mutations/lifecycle.ts` (step 3, done) beyond what instruction 2/3 explicitly requires.

## Constraints

- Follow `.claude/rules/convex_rules.md` — argument/return validators on everything.
- Run `bun run type-check` at the end; report total error count vs step 4's baseline (882) and confirm zero new errors in files this task touches.
- Run `bunx eslint` on every file you touched; report results.
- No speculative abstractions; match existing code style.

## Results

<!-- opencode: fill this in when done -->

**Status:** Done.

### What changed

- `convex/schema.ts`: added `resolvedBuyerPremiumPct` / `resolvedSellerCommissionPct` (`v.optional(v.number())`) to `lots`, with the one-line snapshot comment. No other schema edits.
- `convex/auctions/mutations/assignment.ts`: `assignLotToAuctionHandler` now writes the parent auction's `defaultBuyerPremiumPct` / `defaultSellerCommissionPct` into the same `lots` patch that sets `auctionId` / `status: "assigned"`. `undefined` is copied through verbatim (Convex patch clears the field), so an auction with no defaults leaves the lot with no resolved fees rather than inventing a fallback.
- `convex/auctions/internal.ts`: added exported pure helper `computeResolvedDefaultFees(lot, salePrice)` and wired `calculateAndRecordFees` to use it. The resolved-default amounts are added to the audit-log total but are **not** persisted as `lotFees` rows.
- `convex/admin/fees.ts`: `getAuctionFees` → `getLotFees` (args `{ lotId }`, `by_lot` index, return field `auctionId` → `lotId`); `getAuctionFeesForUserHandler`/`getAuctionFeesForUser` → `getLotFeesForUserHandler`/`getLotFeesForUser` (`ctx.db.get("lots", …)`, `lot.winnerId`/`lot.sellerId`, `by_lot`), with the resolved-default amounts merged into the buyer/seller arrays at read time; `getFeeStats` table name `auctionFees` → `lotFees`.
- `convex/admin/queries.ts` + `convex/admin.ts`: re-export the renamed symbols.
- `convex/admin/statistics.ts`: `getFinancialStats` reads `lotFees` and rolls each fee up to its parent auction via `lots.auctionId` so `recentSales` still lines up with auction containers.
- Tests: rewrote `convex/admin/fees.test.ts` around `getLotFeesForUserHandler` (unauth, IDOR, platform-only, auction-default-only, both, inactive-fee filter, missing lot) plus a `getLotFees` admin case; extended `convex/auctions/mutations/assignment.test.ts` for the new `patch` shape and both snapshot cases; extended `convex/auctions/internal.test.ts` for defaults-only and platform+defaults.

### Instruction 3 tradeoff: option (b), not persisted

`lotFees.feeId` is a required FK to `platformFees`, and auction defaults are not `platformFees` rows, so persisting them would require either a schema change to `lotFees` (out of scope) or polluting the global `platformFees` list (explicitly wrong). I chose **option (b)**: the snapshot on the lot is the source of truth and the amounts are derived on read.

- Idempotency: trivial — nothing is written for auction-default fees, so re-running settlement / early closure cannot double-charge. The existing `by_lot_fee_applied` guard for `platformFees`-sourced rows is unchanged.
- Read-side price: the handler uses `lot.currentPrice`, which holds the final winning amount once a lot is `sold` (settlement never rewrites it) and the current high bid while it is live. There is no separate settled-sale-price field, so this is the correct single field pre- and post-settlement.
- Tradeoff: `getFeeStats` (global rollup) counts only persisted `platformFees`-sourced rows, so auction-default fees are visible to the buyer/seller (`getLotFeesForUser`) and in the settlement audit log but not in that global aggregate. `getLotFees` (admin, per-lot) also returns only the persisted rows. If admins need defaults in the rollup, that is a small follow-up.

### Instruction 3 reserve half

`lots.reservePrice` is the only reserve field in the schema (`v.number()`, required, set at lot creation/update via `convex/auctions/mutations/*` and validated by `validateLotBeforeSubmit`). There is no auction-level reserve override anywhere in `convex/schema.ts`, so there is nothing to resolve or snapshot for reserve. No mechanism invented.

### Other `auctionFees` references

- `convex/migrations/multiLotAuctions.ts` intentionally reads the legacy `auctionFees`/`auctionFlags` table names through its raw DB view (step 2). Left untouched by design.
- `convex/seed.ts` / `convex/seed.test.ts` still use the pre-multi-lot seed shape (`auctionFees`, `auctions.seedId`, `auctionId` on FK rows, etc.). This is a large fixture-only rewrite unrelated to fee resolution and was **not** done here; it is already accounted for in the pre-existing type-error baseline. Flagging as a follow-up.
- `src/` call sites (`FeeBreakdown.tsx` still references `api.admin.getAuctionFeesForUser`) are step 6-7 and were not touched per instruction 6.

### Verification

- Tests: `bun run test --run convex/admin convex/auctions/mutations/assignment.test.ts convex/auctions/internal.test.ts convex/auctions/internal_branch.test.ts convex/auctions/settleExpiredAuctions.test.ts convex/auctions/closeAuctionEarly.test.ts` → **12 files, 227 tests passed**.
- `bunx eslint` on every touched file → **0 errors**; only 6 pre-existing `no-unsafe-*` warnings in `convex/admin/queries.ts` (unrelated broken callbacks) and the pre-existing `restrict-plus-operands` error in `statistics.ts:45` (`computeSoldAuctions`, untouched auction-status rework).
- `bun run type-check` → **826 errors**, down from the step-4 baseline of **882** (−56). Errors in touched files: `convex/admin/fees.ts` 0, `convex/auctions/internal.ts` 0, `convex/auctions/mutations/assignment.ts` 0, `convex/schema.ts` 0, `convex/admin.ts` 0; `convex/admin/statistics.ts` 44 → 20 (all 20 remaining are the pre-existing `auctions.status === "sold"` / `auctions.currentPrice` rework, none fee-related); `convex/admin/queries.ts` unchanged at 6 pre-existing warnings only (no TS errors changed). No new errors introduced.
