# Task: Multi-lot auctions — Step 7: core lot detail + bidding UI

Part of the multi-lot auction rework (GitHub issue #318). Step 7 of 8.

**Work alone. Do not delegate to, spawn, or invoke any other opencode/agent instance for any part of this task — do all edits yourself directly.**

Backend is fully done (steps 1-6, all committed): schema (`lots`/`auctions` split), migration, lot lifecycle, bidding/settlement/anti-snipe, fees, and the full read-query layer. Read `convex/schema.ts` and `convex/auctions/helpers.ts` in full now — these define the exact shape the frontend now receives.

## Context

The backend query layer (step 6) renamed the core read queries and changed their return shape:
- `api.auctions.queries.browse.getLotById` (was `getAuctionById`) — returns a `LotDetailValidator`-shaped object: all the old per-item fields (title, make, model, currentPrice, reservePrice, minIncrement, images, sellerId, winnerId, status, etc.) **plus** new joined fields populated from the parent auction: `auctionId?`, `auctionStartTime?`, `auctionEndTime?`, `auctionStatus?` (`"draft"|"published"|"closed"`), `extendedEndTime?`. Status is now one of `draft|pending_review|approved|assigned|sold|unsold|rejected` — there is no `"active"` status anymore.
- **Live/biddable rule:** a lot is live when `status === "assigned" && auctionStatus === "published" && auctionStartTime <= now < (extendedEndTime ?? auctionEndTime)`. This is the same closing-time rule used throughout the backend (steps 4 and 6) — implement it once as a small shared helper/hook, don't duplicate the boolean logic in every component.
- `api.auctions.queries.bids.getLotBids`/`getLotBidCount` (was `getAuctionBids`/`getAuctionBidCount`), args `auctionId` → `lotId`.
- `api.auctions.mutations.bidding.placeBid`, args `auctionId` → `lotId`.
- `api.auctions.getMyProxyBid`, args `auctionId` → `lotId`.
- `api.admin.getLotFeesForUser` (was `getAuctionFeesForUser`), args `auctionId` → `lotId`.
- `api.watchlist.toggleWatchlist`/`isWatched`, args `auctionId` → `lotId`. `api.watchlist.getWatchedAuctionIds` was renamed to `getWatchedLotIds` (and `getWatchedAuctionsHandler` → `getWatchedLots`).
- `api.auctions.mutations.publish.flagAuction`, args `auctionId` → `lotId`.

Run `bun run type-check` first and read the full list of errors in the files listed below — they tell you exactly which prop/arg renames are needed, file by file. This task is fixing all of them for the files in scope.

## Files in scope for this task

- `src/pages/AuctionDetail.tsx` — the lot detail page. Fetches via `getLotById`, renders `BiddingPanel`, `FeeBreakdown`, watchlist toggle, flag action.
- `src/components/bidding/BiddingPanel.tsx`
- `src/components/bidding/BidForm.tsx`
- `src/components/bidding/MobileBidBar.tsx`
- `src/components/auction/FeeBreakdown.tsx`
- `src/components/auction/AuctionCard.tsx`, `src/components/auction/AuctionCardThumbnail.tsx`, `src/components/auction/AuctionCardPrice.tsx` (check these last two compile; only touch if they reference renamed fields/queries)
- `src/components/AuctionHeader.tsx`
- `src/hooks/useAuctionStarted.ts`
- `src/types/auction.ts`
- `src/hooks/usePriceHighlight.ts` (only if it references renamed fields — check)

Out of scope (step 8): `src/pages/Home.tsx`, `src/pages/Profile.tsx`, `src/pages/SellerListings.tsx`, `src/pages/Watchlist.tsx`, `src/pages/dashboard/MyBids.tsx`, `src/pages/dashboard/MyListings.tsx`, `src/pages/admin/*`, `src/components/admin/*`, `src/components/NotificationListener.tsx`, any new admin auction-creation/lot-review/assignment UI, the auction gallery page. Do not touch these even if `bun run type-check` shows errors in them — leave them for step 8.

## Instructions

### 1. `src/types/auction.ts`

- `AuctionWithCategory = Doc<"auctions"> & { categoryName?: string }` is now wrong — `Doc<"auctions">` is the container shape, not an item. Replace with a type derived from the actual query return shape rather than hand-rolling fields (which will drift out of sync): use `FunctionReturnType<typeof api.auctions.queries.browse.getLotById>` (there's existing precedent for this pattern in `src/pages/dashboard/MyBids.tsx` — follow it) for the detail shape, and similarly for the list/summary shape if `AuctionSummary` (the hand-written interface below `AuctionWithCategory`) is still used anywhere — check its call sites first. Rename the exported type(s) to reflect they're lot-shaped now (e.g. `LotWithCategory`) but keep a compatible alias if that reduces churn in files outside this task's scope — use your judgment, note the choice in Results. `AuctionImages` can stay as-is (still an accurate shape).

### 2. `src/hooks/useAuctionStarted.ts`

- This hook currently only tracks whether `startTime` has passed. The new live/biddable rule needs both a start check and an end check (including the anti-snipe-extended end). Either (a) extend this hook to accept both start and effective-end timestamps and return a richer status, or (b) add a new small hook/helper (e.g. `useLotLiveWindow` or a plain `isLotLive(lot)` function) that composes with the existing hook rather than replacing it. Prefer (b) if it keeps the diff smaller and the existing hook's single responsibility (self-updating "has it started" boolean) still gets reused — use your judgment, document the choice in Results. Whatever you build, it must self-update (via timer/interval) so a lot transitions from "not started" → "live" → "ended" in the UI without a manual refresh, matching the existing hook's behavior.

### 3. `src/components/bidding/BiddingPanel.tsx`

- Prop `auction: Doc<"auctions">` → the new lot detail type from instruction 1.
- Replace every `auction.status !== "active"` / `auction.status === "sold"` check with the new status vocabulary and the live-window rule from Context (use the helper from instruction 2).
- `placeBid({ auctionId: auction._id, ... })` → `placeBid({ lotId: lot._id, ... })` (rename the local variable from `auction` to `lot` throughout if that reads more clearly — your call, but be consistent).
- `getMyProxyBid` query arg → `lotId`.
- `CountdownTimer endTime={...}` → use the effective end time (`extendedEndTime ?? auctionEndTime`) when live, `auctionStartTime` when not-yet-started.
- The "not active" branch (currently `auction.status !== "active"`) needs to handle the fuller status set now: `draft`/`pending_review`/`approved` (not yet assigned to an auction — not biddable, show an appropriate "not yet available" state distinct from "ended"), `assigned` but auction not yet published/started (not-started state, existing UI), `assigned` and live (existing bidding UI), `sold`/`unsold`/`rejected` (existing "ended" UI). Don't just lump every non-live status into the old "ended" branch — a `draft` lot showing "Auction Closed / Reserve price was not met" would be misleading. Use your judgment on copy/wording for the new intermediate states, keep it consistent with the existing component's tone.
- `auction.isExtended` (soft-close banner) — check whether `lots` still has an `isExtended` field (per step 4's decision) or whether liveness of the extension should now be inferred from `extendedEndTime` being present/in the future. Use whichever is actually populated by the backend (check `toLotDetail` in `convex/auctions/helpers.ts`).

### 4. `src/components/bidding/BidForm.tsx`, `src/components/bidding/MobileBidBar.tsx`

- Same prop-type and field-rename treatment as `BiddingPanel`. Read both in full first — they likely take a similar `auction` prop and reference `currentPrice`/`minIncrement`/`reservePrice`/`status`.

### 5. `src/components/auction/FeeBreakdown.tsx`

- `auctionId: Id<"auctions">` prop → `lotId: Id<"lots">`. `api.admin.getAuctionFeesForUser` → `api.admin.getLotFeesForUser`, arg `auctionId` → `lotId`. No other logic changes needed (the fee-array rendering is unchanged).

### 6. `src/components/AuctionHeader.tsx`

- Prop `auction: Doc<"auctions"> & { categoryName?: string }` → the new lot type. `api.watchlist.isWatched`/`toggleWatchlist` args `auctionId` → `lotId`. `auction.winnerId`/`auction.sellerId` unchanged field names, just now on the lot type.

### 7. `src/pages/AuctionDetail.tsx`

- This is the main page component — read it in full, it's 533 lines. Update the query call from `getAuctionById` to `getLotById`, arg rename, pass the lot through to `BiddingPanel`/`FeeBreakdown`/`AuctionHeader` with their new prop names. Update any inline status checks (`auction.status === "active"` etc.) to the new vocabulary + live-window helper. Update the flag mutation call (`api.auctions.mutations.publish.flagAuction`, arg `auctionId` → `lotId`) and the watchlist calls. If this page fetches related/similar items via `getRelatedAuctions`, note that query's args/return shape per step 6 (check `convex/auctions/queries/browse.ts` — it should already be lot-shaped from step 6, just verify the frontend call site matches).

### 8. `src/components/auction/AuctionCard.tsx` and its sub-components

- Prop `auction: AuctionWithCategory` → the new type. `api.watchlist.toggleWatchlist` arg rename. `api.auctions.mutations.bidding.placeBid` arg rename (this card appears to support inline quick-bidding — check). Status checks updated to new vocabulary + live-window helper, consistent with `BiddingPanel`'s treatment.

## Testing

- Run `bun run type-check` and confirm **zero errors** in every file listed under "Files in scope" above (some errors in other `src/` files are expected to remain — those are step 8's job).
- If component tests exist for any of these files (check `src/components/bidding/BiddingPanel.test.tsx`, `BidForm.test.tsx`, `src/components/auction/FeeBreakdown.test.tsx`, `AuctionCard.test.tsx`, etc. — per the git status at the start of this whole effort, `BiddingPanel.test.tsx` and `FeeBreakdown.test.tsx` already exist and were pre-existing modified files), update them to match: new prop shapes, new query/mutation names and args, new status vocabulary in test fixtures, live-window mocking (mock a lot + its resolved `auctionStartTime`/`auctionEndTime`/`auctionStatus` fields rather than a flat `status: "active"`/`endTime`). Don't weaken assertions.
- Run `bun run test --run` scoped to whatever test files you touch; report pass/fail.
- Run `bunx eslint` on every touched file; report results.
- Do NOT start, stop, or restart the dev server or `bunx convex dev` — the user is running both manually in their own terminal right now to watch logs. Rely on `bun run type-check`, `bun run test --run`, and `bunx eslint` for verification instead. If you want to sanity-check rendering and the servers happen to already be reachable (e.g. `https://localhost:5173`), you may check via a read-only HTTP request, but never launch or kill the dev/Convex processes yourself.

## Constraints

- Follow the existing code style (this codebase uses `@/` path aliases, shadcn/ui components, Tailwind).
- Do not touch `convex/` in this task — read-only reference for the shapes you're consuming.
- Do not touch any file in the "Out of scope" list in Context, even if it has compile errors.
- No speculative abstractions beyond the one small live-window helper described in instruction 2 — reuse existing patterns (hooks, utils) wherever one already exists.

## Results

### Status: complete

- **Type-check:** `bun run type-check` reports **zero errors** in every file listed under "Files in scope" (plus `BidHistory.tsx`/`BidHistory.test.tsx`, see below). Out-of-scope errors expected to remain for step 8: `Home.tsx`, `Profile.tsx`, `SellerListings.tsx`, `Watchlist.tsx`, `dashboard/MyBids.tsx`, `dashboard/MyListings.tsx`, `admin/*`, `components/admin/*`, `NotificationListener.tsx`, `types/fees.ts`, and pre-existing `convex/*` errors (untouched).
- **Tests:** `bun run test --run` on all 8 touched test files → **135 passed / 135** (`useLotLiveWindow.test.ts`, `BiddingPanel.test.tsx`, `BidForm.test.tsx`, `MobileBidBar.test.tsx`, `BidHistory.test.tsx`, `FeeBreakdown.test.tsx`, `AuctionCard.test.tsx`, `AuctionHeader.test.tsx`).
- **ESLint:** `bunx eslint` on all 18 touched files → clean (fixed 4 errors + 6 warnings encountered: import ordering, void-arrow returns, unused directive, stale `??`/optional-chain assumptions).

### Key decisions

1. **Types (`src/types/auction.ts`):** Added query-derived `LotDetail` (`NonNullable<FunctionReturnType<typeof api.auctions.queries.browse.getLotById>>`) and `LotSummary` (`FunctionReturnType<typeof getActiveAuctions>["page"][number]`). Kept `AuctionWithCategory` and `AuctionSummary` as deprecated aliases to `LotSummary` — this kept out-of-scope call sites compiling and actually resolved several of their pre-existing errors (e.g. `ModerationCard`) without touching them.
2. **Live-window helper:** Chose option (b). New `src/hooks/useLotLiveWindow.ts` exports a pure `getLotLiveWindow(lot, now)` and a reactive `useLotLiveWindow(lot)`. The hook composes the existing `useAuctionStarted` for the start transition and schedules a timeout for the effective end, so lots move `upcoming → live → ended` without a manual refresh. Phases: `unavailable` (draft/pending_review/approved), `upcoming`, `live`, `ended` (sold/unsold/rejected, or window closed). A missing effective end is treated as `ended`, matching the backend rule. `useAuctionStarted` is unchanged and still reused.
3. **Soft close:** Kept `auction.isExtended` (populated by both `toLotDetail` and `toLotSummary`) for the banner; countdowns use `extendedEndTime ?? auctionEndTime`.
4. **`BiddingPanel`:** Added a distinct "Not Yet Available" branch (per-status copy for draft/pending_review/approved) so it is not mislabelled as "Auction Closed". The fresh bid guard now uses `getLotLiveWindow(auction, Date.now())`.
5. **`AuctionCard`:** Images simplified to the object-only shape the query layer always returns (`additional` array is required). Button label now handles `Not Started` / `Unavailable` / `Closed` distinctly and is disabled unless `isLive`.
6. **`BidHistory.tsx` (not in the listed scope):** It is rendered by `AuctionDetail` and used the renamed bid queries, so its `auctionId` prop became `lotId` and queries moved to `api.auctions.queries.bids.getLotBids`/`getLotBidCount` (plus `getLotById`). Noted here since it fell outside the explicit scope list but was required to keep `AuctionDetail` error-free. Its test was updated accordingly.
7. **`SellerInfo` follow-up:** `messages.startConversation` (convex, out of scope) still keys on `auctionId`, so `AuctionDetail` passes the parent `auction.auctionId` for now. Once messaging migrates to `lotId`, this call site and `SellerInfo`'s prop should be renamed.
8. **Out-of-list additions:** Only `BidHistory.tsx`/`BidHistory.test.tsx` were added beyond the listed files. No `convex/` files were modified.

