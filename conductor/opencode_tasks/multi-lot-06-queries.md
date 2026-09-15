# Task: Multi-lot auctions — Step 6: read-query layer (browse, bids, listings, watchlist, reviews)

Part of the multi-lot auction rework (GitHub issue #318). Step 6 of 8 (renumbered from the original 7-step plan — this query-layer rework was missing from the original plan and must happen before frontend work in steps 7-8).

**Work alone. Do not delegate to, spawn, or invoke any other opencode/agent instance for any part of this task — do all edits yourself directly.**

Already done (read to understand current state, do not redo): schema (`lots`/`auctions` split, FK tables use `lotId`), migration, lot lifecycle mutations, bidding/settlement, fees. Read `convex/schema.ts` in full now — source of truth.

## Context

**This is the bug you're fixing:** `convex/auctions/helpers.ts`, `convex/auctions/queries/browse.ts`, `bids.ts`, `listings.ts`, `convex/watchlist.ts`, `convex/reviews.ts`, and `convex/auctions/queries/admin.ts` all still call `ctx.db.query("auctions")` expecting *item* data (title, make, model, currentPrice, sellerId, etc.). Since step 1's schema rename, the `auctions` table holds **containers** (title, startTime, endTime, status draft/published/closed) — the item data now lives in `lots`. These files currently fail to type-check against the real schema (hundreds of the ~826 remaining errors come from here). This task repoints them all to `lots`, with `auctionId` args/fields renamed to `lotId` throughout, matching the pattern already used in steps 3-5.

Read these files in full before starting: `convex/auctions/helpers.ts`, `convex/auctions/queries/shared.ts`, `convex/auctions/queries/browse.ts`, `convex/auctions/queries/bids.ts`, `convex/auctions/queries/listings.ts`, `convex/auctions/queries/admin.ts`, `convex/watchlist.ts`, `convex/reviews.ts`, `convex/support.ts`.

## Instructions

### 1. `convex/auctions/helpers.ts` — the shared serialization layer

- `AuctionSummaryValidator` → rename `LotSummaryValidator`; `_id: v.id("auctions")` → `v.id("lots")`. Add two new optional fields for auction-window display: `auctionId: v.optional(v.id("auctions"))`, and — since the frontend needs to know the *effective* live window without a second round-trip — either (a) add `auctionStartTime`/`auctionEndTime`/`auctionStatus` optional fields populated by looking up the parent auction inside `toLotSummary`, or (b) leave the lot's own legacy `startTime`/`endTime`/`extendedEndTime` fields as the only window info and let the frontend fetch the parent auction separately when needed. Prefer (a) — it avoids an extra query per card in list views — but use your judgment; document the choice in Results.
- `toAuctionSummary` → rename `toLotSummary`, `auction: Doc<"auctions">` → `lot: Doc<"lots">`, all field reads from `auction.*` → `lot.*`. If you chose (a) above, fetch `lot.auctionId ? ctx.db.get("auctions", lot.auctionId) : null` and populate the new fields.
- `AuctionDetailValidator`/`toAuctionDetail` → same rename treatment (`LotDetailValidator`/`toLotDetail`), same auction-window field decision as above (be consistent with your choice for the summary).
- `BidValidator`: `auctionId: v.id("auctions")` → `lotId: v.id("lots")`.
- `validateAuctionStatus`/`validateStartTimeBounds`: read these — if they operate on the old `active`/`endTime` auction-item semantics, check whether anything still calls them (search the repo). If nothing calls them after steps 3-5's rework, leave them as harmless dead code for now (do not delete — out of scope) unless they cause a compile error, in which case make the minimal rename fix. Note which in Results.

### 2. `convex/auctions/queries/browse.ts`

- `matchesAuctionFilter`, `getActiveAuctionsHandler`/`getActiveAuctions`: rename the underlying data source from `auctions` to `lots` throughout (`ctx.db.query("auctions")` → `ctx.db.query("lots")`, `Doc<"auctions">` → `Doc<"lots">`). The **status semantics change**: `statusesForFilter("active")` currently returns `["active"]` — a lot's "active/browsable and biddable" state is no longer a stored status, it's `status === "assigned"` **and** its parent auction is `published` and currently in-window (`auction.startTime <= now < effectiveLotEndTime`). `statusesForFilter("closed")` (`sold`/`unsold`) stays a simple status check (no window check needed — those are terminal). Implement "active" filtering as: query `lots` where `status === "assigned"` (via whatever index is closest — check `by_status_auctionId` from step 1), then for each candidate resolve its parent auction and keep only those currently in-window; do this efficiently, not via `.collect()` + JS filter across a potentially large table if you can index down first (use your judgment; this is a browse/list query so correctness matters more than micro-optimization here, but don't be needlessly slow either — note your approach in Results). All the surrounding search/index/pagination plumbing stays structurally the same, just retargeted to `lots` and its indexes (`search_title`, `by_status_make`, `by_status_year`, `by_status_endTime` → check if `lots` still has these indexes from step 1, some may reference the legacy `endTime` field which is now superseded — use `by_status` alone plus JS filtering where a compound index doesn't exist rather than inventing new schema indexes, since schema changes are out of scope for this task).
- `getRelatedAuctions`: same lot-shaped rename.
- `getActiveMakesHandler`/`getActiveMakes`: same rename, `make` values now sourced from `lots`.
- `getAuctionByIdHandler`/`getAuctionById`: rename to `getLotByIdHandler`/`getLotById`, args `{ auctionId: v.id("auctions") }` → `{ lotId: v.id("lots") }`, fetch `ctx.db.get("lots", args.lotId)`, return via `toLotDetail`.
- `getSellerInfoHandler`/`getSellerInfo`, `getSellerListingsHandler`/`getSellerListings`: rename `auctionId`/`Doc<"auctions">` occurrences to lot-shaped equivalents; these query by `sellerId` which is unchanged (still a lot field).

### 3. `convex/auctions/queries/bids.ts`

- `getAuctionBidsHandler`/`getAuctionBids` → rename `getLotBidsHandler`/`getLotBids`, args `auctionId` → `lotId`, `bids` query via `by_lot` (not `by_auction`), `ctx.db.get("auctions", args.auctionId)` → `ctx.db.get("lots", args.lotId)` (for the seller-visibility check), `auction.sellerId` → `lot.sellerId`.
- `getAuctionBidCountHandler`/`getAuctionBidCount` → `getLotBidCountHandler`/`getLotBidCount`, same rename pattern.
- `getMyBidsHandler`/`getMyBids`, `getMyBidsCountHandler`/`getMyBidsCount`, `getMyBidsStatsHandler`/`getMyBidsStats`: these look up bids by `bidderId` then resolve each bid's item via `toAuctionSummary`/`ctx.db.get("auctions", ...)` — retarget to `toLotSummary`/`ctx.db.get("lots", bid.lotId)`.

### 4. `convex/auctions/queries/listings.ts`

- `getMyListingsHandler`/`getMyListings`, `getMyListingsCountHandler`/`getMyListingsCount`, `getMyListingsStatsHandler`/`getMyListingsStats`: `ctx.db.query("auctions").withIndex("by_seller", ...)` → `ctx.db.query("lots").withIndex("by_seller", ...)` (the `by_seller` index name is unchanged on `lots` per step 1's schema — verify), `toAuctionSummary` → `toLotSummary`.

### 5. `convex/watchlist.ts`

- All `auctionId` args/fields → `lotId`, `ctx.db.query("auctions")`/`ctx.db.get("auctions", ...)` → `lots`, index `by_user_auction` → `by_user_lot` (per step 1's schema rename — verify exact name), `toAuctionSummary` usage → `toLotSummary`. Rename `getWatchedAuctionsHandler`/`getWatchedAuctions` → `getWatchedLotsHandler`/`getWatchedLots`, `getWatchedAuctionIdsHandler`/`getWatchedAuctionIds` → `getWatchedLotIdsHandler`/`getWatchedLotIds`. Keep `toggleWatchlist`/`isWatched` names (still accurate) but rename their `auctionId` arg to `lotId`.

### 6. `convex/reviews.ts`

- `reviews.auctionId` is already `lotId` in the schema (step 1) — this file's handlers likely still reference `args.auctionId`/`ctx.db.get("auctions", ...)` for the review's subject item. Rename to `args.lotId`/`ctx.db.get("lots", ...)`. `submitReviewHandler`/`submitReview`: the review is left by "the auction winner" for "the seller" — check it resolves `winnerId`/`sellerId` from the item (now `lots`), not the container. `getSellerReviews` likely doesn't reference auctions directly (reviews are keyed by `revieweeId`) — verify and leave unchanged if so.

### 7. `convex/support.ts`

- `supportTickets.lotId` is already the schema field name (step 1). Check this file for any `ctx.db.get("auctions", ...)` or `Doc<"auctions">` usage tied to a support ticket's referenced item, and retarget to `lots`.

### 8. `convex/auctions/queries/admin.ts`

- `getPendingAuctionsHandler`/`getPendingAuctions`: currently likely queries `auctions` by `status === "pending_review"` — this is now a **lot** concept (`pending_review` is a lot status per step 1's schema, not a valid `auctions` container status which is `draft|published|closed`). Rename to `getPendingLotsHandler`/`getPendingLots`, query `lots`.
- `getAllAuctionsHandler`/`getAllAuctions`: decide whether this should become "all lots" (item-centric admin view) or stay "all auction containers" (admin view of scheduled sales) — given the surrounding functions in this file are about moderation/review of submitted items (flags, pending review), rename to `getAllLotsHandler`/`getAllLots` operating on `lots`, matching the rest of the file's item-centric focus. Note this decision in Results.
- `getAuctionFlagsHandler`/`getAuctionFlags`, `getAllPendingFlagsHandler`/`getAllPendingFlags`: rename to lot-flag equivalents (`getLotFlagsHandler`/`getLotFlags`, etc. — check for naming collisions with anything from steps 3-5 first), query `lotFlags` (already renamed in step 1), `auctionId` → `lotId`.
- `getEquipmentMetadataHandler`/`getEquipmentMetadata`, `getCategoriesHandler`/`getCategories`: these operate on `equipmentMetadata`/`equipmentCategories`, unrelated to the auctions/lots split — leave unchanged unless they fail to compile for an unrelated reason.

### 9. Update every test file for the functions you touch

Find them via `bun run test --run convex/auctions/queries convex/watchlist.test.ts convex/reviews.test.ts convex/support.test.ts` (adjust paths to whatever actually exists — check the directory listing first) and fix fixtures/mocks/assertions to match, same standard as prior steps: don't weaken assertions, adapt them to the new lot+auction model where the old assertion's intent no longer applies (e.g. "active" filter tests now need a mocked published in-window parent auction, not just a lot status).

## Constraints

- Follow `.claude/rules/convex_rules.md`.
- Do not touch `convex/schema.ts` in this task — no new fields, this is a pure read-layer rename/retarget. If you genuinely believe a schema change is required (e.g. a missing index makes an efficient query impossible), stop and document the specific need in Results rather than editing schema.ts yourself.
- Do not touch anything under `src/` (steps 7-8) or the mutation files already completed in steps 3-5.
- Run `bun run test --run` across every file you touched (list the exact paths used) and report pass/fail counts.
- Run `bun run type-check`; report total error count vs step 5's baseline (826) and confirm zero new errors in files this task touches. A large drop is expected since this is a lot of dead-code-against-new-schema being fixed.
- Run `bunx eslint` on every touched file; report results.
- No speculative abstractions; match existing code style and function granularity. This is fundamentally a rename/retarget task — resist the urge to refactor beyond what's needed to compile correctly against the new schema.

## Results

## Results

**Status:** Done.

### Design choices

- **Window fields — chose option (a).** `LotSummaryValidator`/`LotDetailValidator` (renamed from `AuctionSummaryValidator`/`AuctionDetailValidator`) now carry `auctionId`, `auctionStartTime`, `auctionEndTime`, `auctionStatus`, and `extendedEndTime` (all optional). `toLotSummary`/`toLotDetail` resolve `lot.auctionId ? ctx.db.get("auctions", lot.auctionId) : null` and populate them, so list views get the parent auction's window (and per-lot soft-close extension) without an extra round-trip per card. Legacy lot `startTime`/`endTime` were left on the summary for backward compatibility.
- **"Active" filter is derived, not stored.** `statusesForFilter` now maps `active → ["assigned"]`, `closed → ["sold", "unsold"]`, `all → ["assigned", "sold", "unsold"]`. A lot is live when `status === "assigned"` **and** its parent auction is `published` and `auction.startTime <= now < (lot.extendedEndTime ?? auction.endTime)`.
- **Active/search query strategy.** Because liveness requires joining the parent auction, `getActiveAuctionsHandler` runs the existing indexed search/filter scan bounded by `MAX_RESULTS_CAP + 1`, then applies `matchesLotFilter` + the async `isLotLive` check in memory, and paginates manually — mirroring the pre-existing search-path approach. The `closed`/`all` paths keep the original `.paginate()` + `countQuery()` plumbing. `getRelatedAuctions` takes `by_status_make` candidates for `status === "assigned"`, filters live, and slices to 4.
- **Indexes.** Used `lots` indexes `by_status`, `by_status_make`, `by_status_year`, `search_title`, `search_title_simple`. `by_status_endTime` was not used (the lot `endTime` is legacy/superseded and liveness now comes from the parent auction). No schema changes were made; `by_status` + JS filtering covers cases with no compound index.
- **`getActiveMakesHandler` left unchanged** — it queries `equipmentMetadata`, never `auctions`/`lots`, so there was nothing to retarget.
- **`validateAuctionStatus` / `validateStartTimeBounds` kept unchanged.** They are not dead code: `validateStartTimeBounds` is still called by `convex/auctions/mutations/create.ts`, and `validateAuctionStatus` by `convex/auctions/mutations/update.ts`. No compile error, so no minimal rename was needed.
- **Admin queries are item-centric.** `getAllAuctions` → `getAllLots` operating on `lots` (matching the moderation/review focus of the file), `getPendingAuctions` → `getPendingLots` on `lots.by_status = "pending_review"`, `getAuctionFlags` → `getLotFlags` on `lotFlags.by_lot`, and `getAllPendingFlags` retargeted to `lotFlags` with output `auctionTitle → lotTitle`. `getAllPendingFlags` kept its (already generic, non-auction) name.
- **Status remaps for seller-facing views:** `getSellerListings` "active" → `assigned`; `getMyListingsCount` "active" → `assigned`; `getMyListingsStats` counts both `approved` and `assigned` under the existing `active` output key; `getSellerInfo` `activeListings` counts `assigned`. `getMyBids` sorting now uses `extendedEndTime ?? auctionEndTime`, and `calculateUserBidStats` treats `assigned` as the active state.
- `reviews.submitReview` arg `auctionId → lotId` (review subject is the lot); `getSellerReviews` output field `auctionId → lotId`. `support.createTicket` arg `auctionId → lotId`. `watchlist` fields/index → `lotId`/`by_user_lot`, functions renamed to `getWatchedLots`/`getWatchedLotIds`. Barrel `convex/auctions.ts` updated to export the new names.
- **No changes to `convex/schema.ts`.** No frontend/`src/` or step 3-5 mutation files were touched; the expected `src/` breakages are left for steps 7-8.

### Verification

- **Tests (all pass):**
  - `bun run test --run convex/auctions/helpers.test.ts convex/auctions/queries.test.ts convex/auctions/queries_extra.test.ts convex/auctions/queries_branch.test.ts convex/auctions/queries/browse.test.ts convex/auctions/queries/admin.test.ts convex/watchlist.test.ts convex/reviews.test.ts convex/support.test.ts` → **9 files, 147 passed, 0 failed**.
  - `bun run test --run convex/auctions/queries convex/watchlist.test.ts convex/reviews.test.ts convex/support.test.ts` (task-specified command) → **8 files, 123 passed, 0 failed**.
- **Type-check:** `bun run type-check` → **522 errors**, down from the step-5 baseline of **826** (−304). **Zero errors in any file this task touched.** Remaining errors are pre-existing in `src/` (steps 7-8) and other mutation/seed files out of scope.
- **ESLint:** `bunx eslint` on all 18 touched source/test files → **0 errors, 0 warnings.**

### Notes

- `convex/_generated/server.d.ts`/`server.js` were already modified in the working tree before this task (regenerated by the dev server); they are not part of this change.
- New tests were added for the parent-auction window population in `toLotSummary`; existing "active" filter tests were updated to mock a `published`, in-window parent auction (e.g. `queries_extra.test.ts`, `queries_branch.test.ts`) rather than weakening their assertions.

