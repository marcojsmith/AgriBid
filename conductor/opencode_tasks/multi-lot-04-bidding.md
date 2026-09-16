# Task: Multi-lot auctions — Step 4: bidding, anti-snipe, and settlement

Part of the multi-lot auction rework (GitHub issue #318). Step 4 of 7.

Already done (read to understand current state, do not redo):
- Step 1 (schema): `convex/schema.ts` — `lots` (status `draft|pending_review|approved|assigned|sold|unsold|rejected`, `auctionId?`, `extendedEndTime?`, plus legacy `startTime?`/`endTime?` still present but superseded), `auctions` (container: `startTime`, `endTime`, `status: draft|published|closed`, fee defaults, etc.), FK tables use `lotId` not `auctionId` (`bids`, `proxy_bids`, `lotFees`, `watchlist`, `reviews`, `conversations`, `supportTickets`, `lotFlags`).
- Step 2 (migration): data is already in the new shape on local dev.
- Step 3: `convex/lots/mutations/lifecycle.ts` (submitLotForReview/approveLot/rejectLot), `convex/auctions/mutations/adminCrud.ts` (createAuction/updateAuction/publishAuctionContainer/closeAuctionContainer), `convex/auctions/mutations/assignment.ts` (assignLotToAuction/unassignLot). `flagAuction`/`dismissFlag` in `publish.ts` already repointed to `lots`/`lotFlags`.

Read `convex/schema.ts` in full now — it is the source of truth, not this file's prose.

## Context

This is the biggest remaining backend chunk: bidding, proxy bidding, anti-snipe, and settlement (both manual early-closure and the expiry cron), all of which currently operate on the old single-item `auctions` table and must move to operating on `lots` gated by their parent `auctions` container's window.

**The closing-time rule (issue #318, confirmed):**
```ts
effectiveLotEndTime = lot.extendedEndTime ?? auction.endTime;
// a bid is allowed only when:
auction.status === "published" && auction.startTime <= now && now < effectiveLotEndTime
```
Anti-snipe extends `lot.extendedEndTime` (not the auction's `endTime`) and is allowed to push past the auction's own `endTime` — that's the point of the extension. `lot.currentPrice`/`lot.winnerId`/`lot.reservePrice`/`lot.minIncrement`/`lot.startingPrice` are the per-lot pricing fields already present on `lots` (carried over unchanged from the old per-item `auctions` fields in step 1's rename) — bidding logic keys off the **lot**, not the auction, for everything price/winner-related. The auction only gates the *time window*.

Files to read in full before starting: `convex/auctions/mutations/bidding.ts`, `convex/auctions/proxy_bidding.ts`, `convex/auctions/internal.ts`, `convex/auctions/mutations/publish.ts` (specifically `closeAuctionEarlyHandler`/`closeAuctionEarly` — the only piece of that file left untouched by step 3), `convex/constants.ts` (`SOFT_CLOSE_THRESHOLD_MS`, `PRICE_THRESHOLD_FOR_INCREMENT`, `SMALL_INCREMENT_AMOUNT`, `LARGE_INCREMENT_AMOUNT`, `DRAFT_RETENTION_MS`, `DRAFT_RETENTION_DAYS`, `CLEANUP_BATCH_SIZE`), and their test files (`bidding.test.ts`, `proxy_bidding.test.ts`, `internal.test.ts` if present, `mutations_branch.test.ts`).

## Instructions

### 1. `convex/auctions/proxy_bidding.ts` — rename + relocate pricing/anti-snipe to the lot

- Every `auctionId: Id<"auctions">` parameter that's actually identifying *which item is being bid on* becomes `lotId: Id<"lots">`. Every `ctx.db.get("auctions", ...)` fetching the item becomes `ctx.db.get("lots", ...)`. `proxy_bids.auctionId` → `proxy_bids.lotId` (already renamed in schema step 1 — just fix the call sites), index `by_bidder_auction` → `by_bidder_lot`, `by_auction` → `by_lot`, `by_auction_maxBid` → `by_lot_maxBid` (see schema for exact index names).
- `getMinIncrement`, `getMostRecentBid`, `getCurrentHighestBidAmount`, `validateBid`, `upsertProxyBid`, `resolveProxyBids`, `handleNewBid`, `getProxyBid`: all operate on `Doc<"lots">` now instead of `Doc<"auctions">`. Patches to `currentPrice`/`winnerId` target `ctx.db.patch("lots", lotId, ...)`.
- `extendAuctionIfNeeded` → rename to `extendLotIfNeeded`. It currently does `if (auction.endTime && auction.endTime - now < SOFT_CLOSE_THRESHOLD_MS) { patch auction.endTime = now + SOFT_CLOSE_THRESHOLD_MS, isExtended: true }`. Replace with: fetch the lot's parent auction (`ctx.db.get("auctions", lot.auctionId)` — if the lot has no `auctionId`, this function should not have been called; throw or no-op with a comment, your judgment), compute `effectiveLotEndTime = lot.extendedEndTime ?? auction.endTime`; if `effectiveLotEndTime - now < SOFT_CLOSE_THRESHOLD_MS`, patch `lots` with `extendedEndTime: now + SOFT_CLOSE_THRESHOLD_MS` (do NOT touch `auction.endTime` — per issue #318 the extension is per-lot and may exceed the auction's own window). Drop `isExtended` from this patch (it was an `auctions`-table field for UI display; `lots` doesn't have it in the new schema unless you check and find it's still there from the step-1 rename — if it is, keep using it on the lot; if not, note in Results and skip rather than adding a new field to schema.ts, which is out of scope for this task).
- `getMyProxyBidHandler`/`getMyProxyBid` query: rename `args.auctionId` → `args.lotId`, `v.id("auctions")` → `v.id("lots")`, return type's `auctionId: v.id("auctions")` field → `lotId: v.id("lots")`.

### 2. `convex/auctions/mutations/bidding.ts` — gate bids on lot + parent auction window

- `placeBidHandler`: rename `args.auctionId` → `args.lotId`. Fetch the lot (`ctx.db.get("lots", args.lotId)`). If the lot has no `auctionId` (not assigned to an auction), reject with `ConvexError("Lot is not assigned to an auction")`. Fetch the parent auction. Replace the current status/startTime/endTime checks with the closing-time rule from Context above: reject if `auction.status !== "published"`, reject if `auction.startTime > now` ("Auction has not started"), reject if `now >= effectiveLotEndTime` ("Auction ended") where `effectiveLotEndTime = lot.extendedEndTime ?? auction.endTime`. Keep the seller-can't-bid-on-own-lot check (`lot.sellerId === userId`). Keep the cooldown logic as-is (user-scoped, not lot-scoped, unaffected by this rework).
- Update `placeBid`'s arg/return validators: `auctionId: v.id("auctions")` → `lotId: v.id("lots")`.
- `logActivity` call: `relatedId: args.auctionId` → `relatedId: args.lotId` (the activity feed entry is about the lot the user bid on).

### 3. `convex/auctions/internal.ts` — settlement + draft cleanup move to lots

- `calculateAndRecordFees(ctx, auction, salesVolume?)`: rename parameter/usage from `auction: Doc<"auctions">` to `lot: Doc<"lots">`, `auction._id` → `lot._id`, `auction.currentPrice` → `lot.currentPrice`, `auctionFees` table → `lotFees`, `auctionId` field → `lotId`, index `by_auction_fee_applied` → `by_lot_fee_applied`, audit `targetType: "auction"` → `targetType: "lot"`. **Do not** change the fee *calculation* logic itself (percentage/fixed math, active-fee iteration, idempotency guard) — that's step 5's job to make it resolve auction-level defaults; this task only needs it to compile against the renamed lot/lotFees shape and keep behaving exactly as before.
- `logAuctionSettlementActivity`: same rename treatment, `auction: Doc<"auctions">` → `lot: Doc<"lots">`, uses `lot.sellerId`/`lot.currentPrice`/`lot._id`.
- `settleExpiredAuctionsHandler`/`settleExpiredAuctions` (the cron-driven settlement): this needs a real logic change, not just a rename. It currently queries `auctions` where `status === "active"` and `endTime <= now`. Rewrite to: query `lots` where `status === "assigned"` (use the `by_status_auctionId` or `by_status` index — check `convex/schema.ts` for the actual index name on `lots.status`), for each assigned lot fetch its parent auction, compute `effectiveLotEndTime = lot.extendedEndTime ?? auction.endTime`, and settle only if `auction.status === "published" && effectiveLotEndTime <= now`. Settlement logic (bid lookup, reserve check, winner determination, status → `sold`/`unsold`, `calculateAndRecordFees`, `logAuctionSettlementActivity`) stays the same shape but operates on the lot: `ctx.db.patch("lots", lot._id, { status: finalStatus, winnerId, settledAt: now })`. **Also** implement the "unsold lots return to pool for reassignment" decision from issue #318: when `finalStatus === "unsold"`, additionally clear `auctionId: undefined` and set `status: "unsold"` still records the outcome, but since `unsold` is a distinct status from `approved`/`assigned` in this schema, decide and document in Results whether "returned to pool" means (a) lot stays `status: "unsold"` with `auctionId` cleared so an admin query can filter `status === "unsold"` for reassignment, or (b) something else — pick (a), it's simplest and matches the status vocabulary, just make sure `assignLotToAuction` (step 3, `convex/auctions/mutations/assignment.ts`) already accepts assigning from... check it — it currently requires `status === "approved"`. If unsold lots need re-approval before reassignment per the existing lot lifecycle, leave `assignLotToAuction` as-is (admin must move `unsold → approved` via some path first) and note this as a gap for a future task rather than silently changing step 3's file; do not modify `assignment.ts` in this task.
- `updateCounter` calls throughout: `"auctions"` counter-table name argument → check `convex/admin_utils.ts`'s `updateCounter` signature (first arg is likely a literal table-name-like string, not necessarily the Convex table name) and align with whatever step 3 decided in `convex/lots/mutations/helpers.ts` (`getLotCounterKey`/`adjustLotStatusCounters` — read that file, it made a counter-mapping decision already: `approved`+`assigned` → `active`, `sold` → `soldCount`, `unsold`/`rejected` → no counter). Use `"lots"` as the counter-table argument to match.
- `cleanupDraftsHandler`/`cleanupDrafts`: currently deletes old draft **auctions**. Drafts are lots now (a lot in `draft` status, never submitted). Rewrite to query `lots` where `status === "draft"` past the retention cutoff, delete their images/condition report, `ctx.db.delete("lots", lot._id)`. Update audit/counter calls to use `"lots"`.

### 4. `convex/auctions/mutations/publish.ts` — `closeAuctionEarlyHandler`/`closeAuctionEarly`

This is the one remaining unconverted piece from step 3 (it was explicitly left broken pending this step). Rename `args.auctionId` → `args.lotId`, fetch `ctx.db.get("lots", args.lotId)` instead of `"auctions"`, require `lot.status === "assigned"` (replacing the old `auction.status !== "active"` check — an admin can only early-close a lot that's currently assigned/live), bid lookup via `by_lot` index, settlement patches target `"lots"`, `calculateAndRecordFees`/`logAuctionSettlementActivity` now take a lot per the internal.ts changes above. This does **not** need to touch the lot's `auctionId` or the parent auction's status — early-closing one lot doesn't close the whole auction container (other lots may still be running). Update the `EarlyClosureResult` interface/JSDoc only if field meaning changed (it shouldn't — same shape, different underlying entity).

### 5. Do not touch in this task

- `convex/admin/fees.ts`, `fees.test.ts` (step 5 — this task only needs `calculateAndRecordFees` in `internal.ts` to compile against the new lot shape, not to gain auction-default-inheritance behavior).
- `convex/auctions/mutations/assignment.ts` (per instruction 3, leave as-is even if you identify a gap).
- Anything under `src/` (steps 6-7).

## Constraints

- Follow `.claude/rules/convex_rules.md`.
- Update every test file that covers the code you change (`bidding.test.ts`, `proxy_bidding.test.ts`, any `internal`-related test file, `mutations_branch.test.ts`, and the early-closure tests in `publish.test.ts` if present) to match the new lot-shaped args/behavior — rename mocks/fixtures, don't weaken assertions. Where a test asserted old-model behavior that no longer applies (e.g. "auction endTime extends on soft-close"), adapt the assertion to the new lot-level behavior rather than deleting the test's intent.
- Run `bun run test --run convex/auctions` and report pass/fail counts.
- Run `bun run type-check`; report total error count vs step 3's baseline (1012) and confirm zero new errors in files this task touches.
- Run `bunx eslint` on every file you touched; report warnings/errors.
- No speculative abstractions; match existing code style and function granularity.

## Results

<!-- opencode: fill this in when done -->
