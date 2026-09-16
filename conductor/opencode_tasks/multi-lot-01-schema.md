# Task: Multi-lot auctions — Step 1: schema

Part of the multi-lot auction rework (GitHub issue #318). This is step 1 of 7 — schema only. No migration script, no mutation/query logic changes, no UI changes in this task. Later tasks depend on this one being correct, so match the field names and status vocabulary exactly.

## Context

Read `convex/schema.ts` in full before starting. Today, `auctions` (`convex/schema.ts:23-93`) is a single-item table: one row = one piece of equipment, with its own `startTime`/`endTime`, bids, fees, etc. We are splitting this into two concepts:

- **`lots`** — the seller-owned item (what `auctions` is today), minus its own start/end ownership.
- **`auctions`** (new table) — a scheduled sale window that groups multiple lots.

A lot is only biddable while its parent auction's window is open, with an optional per-lot anti-snipe extension that may push past the auction's `endTime`.

Full design context (read this for the "why" behind each field): GitHub issue https://github.com/marcojsmith/AgriBid/issues/318 — use `gh issue view 318 --repo marcojsmith/AgriBid` to read it.

## Instructions

1. Rename the existing `auctions` table (`convex/schema.ts:23-93`) to `lots`:
   - Keep all existing fields (title, make, model, year, operatingHours, location, categoryId, reservePrice, startingPrice, currentPrice, minIncrement, sellerId, images, description, conditionReportUrl, isExtended, hiddenByFlags, seedId, conditionChecklist).
   - Remove `startTime` and `endTime` as authoritative fields — a lot's biddable window now comes from its parent auction. Keep them as `v.optional(v.number())` legacy fields for the migration step (task 2) to read from; add a one-line comment noting they're superseded by the parent `auctions` row and will be dropped after migration.
   - Add `auctionId: v.optional(v.id("auctions"))` — optional because a lot exists (draft/pending_review/approved) before being assigned to an auction.
   - Add `extendedEndTime: v.optional(v.number())` — bumped by anti-snipe; may exceed the parent auction's `endTime`. One-line comment: `effectiveLotEndTime = extendedEndTime ?? auction.endTime`.
   - Update the `status` union to: `v.literal("draft")`, `v.literal("pending_review")`, `v.literal("approved")`, `v.literal("assigned")`, `v.literal("sold")`, `v.literal("unsold")`, `v.literal("rejected")`. Do NOT add a `"live"` or `"active"` literal — liveness is derived at query time from `auctionId` + the parent auction's window, not stored. Add a one-line comment above the union stating this.
   - Add an index `by_auctionId` on `["auctionId"]`, and `by_status_auctionId` on `["status", "auctionId"]`.
   - Keep all existing indexes/search indexes, renamed only if they reference the table name (they don't need to — Convex indexes are per-table, not name-prefixed — but do audit for any comment referencing "auction" that should now say "lot").

2. Add the new `auctions` table (this is the scheduled sale container):
   ```ts
   auctions: defineTable({
     title: v.string(),
     description: v.optional(v.string()),
     bannerImage: v.optional(v.id("_storage")),
     startTime: v.number(),
     endTime: v.number(),
     status: v.union(
       v.literal("draft"),
       v.literal("published"),
       v.literal("closed")
     ),
     // Auction-wide defaults, inherited by lots unless a lot overrides at assignment time (see task 5 / fees rework)
     defaultBuyerPremiumPct: v.optional(v.number()),
     defaultSellerCommissionPct: v.optional(v.number()),
     createdBy: v.string(), // admin userId
     createdAt: v.number(),
     updatedAt: v.number(),
   })
     .index("by_status", ["status"])
     .index("by_startTime", ["startTime"])
     .index("by_status_startTime", ["status", "startTime"])
     .searchIndex("search_title", { searchField: "title", filterFields: ["status"] }),
   ```
   Do not treat `"live"` as a stored auction status either — "live" is derived from `status === "published" && startTime <= now < endTime`. Only `draft` (being edited, not visible to sellers/bidders), `published` (visible, may be before/during/after its window), `closed` (manually closed by admin) are stored.

3. Rename `auctionId` → `lotId` on every table that currently references the old per-item `auctions` table, and repoint the FK type to `v.id("lots")`. Update every index that includes the field, renaming `..._auction...` index names to `..._lot...` to match (e.g. `by_auction` → `by_lot`, `by_bidder_auction` → `by_bidder_lot`, `by_auction_maxBid` → `by_lot_maxBid`, `by_auction_fee_applied` → `by_lot_fee_applied`, `by_auction_status` → `by_lot_status`, `by_auction_reviewer` → `by_lot_reviewer`, `by_buyer` / `by_seller` on `conversations` are unaffected — only rename fields/indexes that literally contain `auction`). Tables to update:
   - `bids` (`convex/schema.ts:157-167`) — `auctionId` → `lotId`, index `by_auction` → `by_lot`, `by_bidder_auction` → `by_bidder_lot`.
   - `proxy_bids` (`convex/schema.ts:177-185`) — `auctionId` → `lotId`, `by_auction` → `by_lot`, `by_bidder_auction` → `by_bidder_lot`, `by_auction_maxBid` → `by_lot_maxBid`.
   - `auctionFees` (`convex/schema.ts:435-449`) — `auctionId` → `lotId`, `by_auction` → `by_lot`, `by_auction_fee_applied` → `by_lot_fee_applied`. Also rename this table to `lotFees` (it records fees calculated per lot at settlement, per issue #318). Update the doc comment above it.
   - `watchlist` (`convex/schema.ts:335-340`) — `auctionId` → `lotId`, `by_user_auction` → `by_user_lot`.
   - `reviews` (`convex/schema.ts:144-155`) — `auctionId` → `lotId`, `by_auction_reviewer` → `by_lot_reviewer`.
   - `conversations` (`convex/schema.ts:313-322`) — `auctionId` → `lotId` (keep `by_buyer`/`by_seller`/`by_buyer_seller` as-is, unaffected).
   - `supportTickets` (`convex/schema.ts:236-254`) — `auctionId` → `lotId` (field is `v.optional`, keep optional).
   - `auctionFlags` (`convex/schema.ts:96-116`) — `auctionId` → `lotId`. Consider whether to rename this table to `lotFlags` for consistency — rename it, and update the doc comment.

4. Do not touch any file outside `convex/schema.ts` in this task. Downstream code (queries/mutations/UI) referencing the old field/table names will now fail to typecheck — that's expected and handled in tasks 2-7. Do not attempt to fix those errors here.

5. Run `bun run type-check` at the end and confirm the *only* errors are in files outside `convex/schema.ts` (i.e., schema.ts itself is internally consistent and typechecks — the errors should all be call sites elsewhere referencing old names). Paste the full error file list (not full output) into the Results section.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — always-index-fields-in-name rule matters here (e.g. `by_lot_maxBid` must index `["lotId", "maxBid", "updatedAt"]` in that order, matching the old `by_auction_maxBid`).
- Do not rename `_generated/` files or run codegen — that happens automatically when Convex dev picks up the schema change; do not commit generated file changes as part of this task's diff, mention if they appeared.
- Do not write any migration logic, mutations, queries, or UI changes — schema file only.
- Do not add comments beyond the few one-liners explicitly requested above.

## Results

**Status:** Done. Only `convex/schema.ts` was modified.

### What changed

- Renamed `auctions` → `lots`; kept all existing fields, added `auctionId: v.optional(v.id("auctions"))` and `extendedEndTime: v.optional(v.number())`.
- `startTime`/`endTime` retained as `v.optional` legacy fields with a one-line supersession comment (dropped after migration).
- `lots.status` union is now `draft | pending_review | approved | assigned | sold | unsold | rejected` (removed `active`; no stored `live`). Added comment that liveness is derived.
- Added `lots` indexes `by_auctionId` and `by_status_auctionId`; all pre-existing indexes/search indexes retained.
- Added new `auctions` container table exactly as specified (`draft | published | closed`, three indexes + `search_title`).
- Renamed `auctionId` → `lotId` (FK repointed to `lots`) on: `bids`, `proxy_bids`, `lotFees` (was `auctionFees`), `watchlist`, `reviews`, `conversations`, `supportTickets`, `lotFlags` (was `auctionFlags`). Index renames: `by_auction` → `by_lot`, `by_bidder_auction` → `by_bidder_lot`, `by_auction_maxBid` → `by_lot_maxBid`, `by_auction_fee_applied` → `by_lot_fee_applied`, `by_auction_status` → `by_lot_status`, `by_auction_reviewer` → `by_lot_reviewer`, `by_user_auction` → `by_user_lot`. `conversations` `by_buyer`/`by_seller`/`by_buyer_seller` unchanged.
- Updated doc comments for `lotFlags` and `lotFees`; audited in-table comments (e.g. `settledAt`, reviews).

### type-check

`bun run type-check` exits 2 with 1071 `error TS` diagnostics, **none in `convex/schema.ts`**. All errors are downstream call sites referencing the old names (expected, handled in tasks 2-7). Error files:

```
convex/admin/categories.ts
convex/admin/fees.ts
convex/admin/mutations.ts
convex/admin/queries.ts
convex/admin/statistics.ts
convex/auctions/dismissFlag.test.ts
convex/auctions/helpers.test.ts
convex/auctions/helpers.ts
convex/auctions/internal.ts
convex/auctions/mutations/bidding.ts
convex/auctions/mutations/create.test.ts
convex/auctions/mutations/create.ts
convex/auctions/mutations/delete.test.ts
convex/auctions/mutations/delete.ts
convex/auctions/mutations/helpers.ts
convex/auctions/mutations/publish.test.ts
convex/auctions/mutations/publish.ts
convex/auctions/mutations/update.test.ts
convex/auctions/mutations/update.ts
convex/auctions/mutations_branch.test.ts
convex/auctions/proxy_bidding.test.ts
convex/auctions/proxy_bidding.ts
convex/auctions/queries/admin.test.ts
convex/auctions/queries/admin.ts
convex/auctions/queries/bids.ts
convex/auctions/queries/browse.ts
convex/auctions/queries/listings.ts
convex/auctions/queries/shared.ts
convex/lib/storage.ts
convex/messages.ts
convex/reviews.ts
convex/seed.ts
convex/support.ts
convex/watchlist.ts
src/components/AuctionHeader.tsx
src/components/NotificationListener.tsx
src/components/admin/BidMonitor.tsx
src/components/admin/ModerationCard.tsx
src/components/auction/AuctionCard.tsx
src/components/bidding/BidForm.tsx
src/components/bidding/BiddingPanel.tsx
src/components/bidding/MobileBidBar.tsx
src/pages/AuctionDetail.tsx
src/pages/Home.tsx
src/pages/Profile.tsx
src/pages/SellerListings.tsx
src/pages/Watchlist.tsx
src/pages/admin/AdminAuctions.tsx
src/pages/admin/AdminModeration.tsx
src/pages/dashboard/MyBids.tsx
src/pages/dashboard/MyListings.tsx
src/types/fees.ts
```

### Notes

- `convex/_generated/server.d.ts` and `convex/_generated/server.js` were already modified in the working tree before this task began (unrelated pre-existing changes); no codegen was run and no generated changes were introduced here.
