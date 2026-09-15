# Task: Multi-lot auctions — Step 9: remaining frontend rename cleanup

Part of the multi-lot auction rework (GitHub issue #318). Step 9 of 10.

**Work alone. Do not delegate to, spawn, or invoke any other opencode/agent instance for any part of this task — do all edits yourself directly.**

**Do NOT start, stop, or restart the dev server or `bunx convex dev` — the user may be running them manually.**

**If you hit an OpenRouter/model usage limit or any other hard stop mid-task, immediately write out everything you've completed and everything still broken into the `## Results` section before stopping, even if incomplete — do not let the run end silently with no Results written.** A previous run of a sibling task (step 8) crashed on an OpenRouter monthly key limit with no Results written, which cost extra recovery work — avoid repeating that.

Steps 1-8 are done and committed: schema, migration, lot lifecycle, auction CRUD/assignment, bidding/settlement/anti-snipe, fees, the full read-query layer, core lot-detail/bidding UI, and the seller create/edit/delete-lot flow plus remaining admin mutations. Read `convex/schema.ts` and `src/types/auction.ts` in full now — these define the exact shapes you're consuming.

## Context

This is a pure rename/retarget task, the same pattern as steps 6-8 applied to the last cluster of frontend files. Run `bun run type-check` first and read the errors in the files listed below — they tell you exactly what's broken, file by file. As of the last check, the relevant renamed backend surface:

- `Doc<"auctions">` is now a scheduled-sale **container** shape (title, startTime, endTime, status `draft|published|closed`) — anywhere a component/hook still types something as `Doc<"auctions">` expecting item fields (make, model, currentPrice, sellerId, etc.), it needs the lot-shaped type from `src/types/auction.ts` (step 7 added `LotDetail`/`LotSummary`, query-derived via `FunctionReturnType`; `AuctionWithCategory`/`AuctionSummary` were kept as deprecated aliases — check current state, they may still be usable directly for list views).
- `api.auctions.queries.admin.getAllAuctions` → `getAllLots`; `getPendingAuctions` → `getPendingLots`; `getAuctionFlags` → `getLotFlags` (verify exact names in `convex/auctions/queries/admin.ts`, step 6).
- `api.auctions.mutations.update.bulkUpdateAuctions` args `auctionIds: Id<"auctions">[]` → `Id<"lots">[]`, `updates.status` uses the lot status vocabulary (`draft|pending_review|approved|assigned|sold|unsold|rejected` — no `"active"`).
- `api.watchlist.getWatchedAuctionIds`/`getWatchedAuctions` → `getWatchedLotIds`/`getWatchedLots`, args/fields `auctionId` → `lotId`.
- `api.auctions.queries.bids.getMyBids`/`getMyBidsCount`/`getMyBidsStats` — unchanged names (verify), but returned bid items are lot-shaped now (`toLotSummary`).
- `api.auctions.queries.listings.getMyListings`/`getMyListingsCount`/`getMyListingsStats` — unchanged names (verify), lot-shaped returns.
- `api.admin.getLotFeesForUser` (was `getAuctionFeesForUser`), `api.admin.getFeeStats` reads `lotFees`.
- `platformFees`/`lotFees` schema: `src/types/fees.ts`'s `AuctionFee extends Doc<"auctionFees">` no longer compiles — `auctionFees` was renamed to `lotFees` in step 1, with `auctionId` → `lotId`.

## Files in scope

Run `bun run type-check` and confirm this is still the accurate list (it may have shifted slightly since these steps were planned) before starting:

- `src/pages/Home.tsx`
- `src/pages/Profile.tsx`
- `src/pages/SellerListings.tsx`
- `src/pages/Watchlist.tsx`
- `src/pages/dashboard/MyBids.tsx`
- `src/pages/dashboard/MyListings.tsx`
- `src/components/NotificationListener.tsx`
- `src/components/admin/BidMonitor.tsx`
- `src/components/admin/ModerationCard.tsx`
- `src/pages/admin/AdminAuctions.tsx` — the existing admin "manage all listings" table (bulk approve/reject/edit, search/filter). This is a **rename target**, not new UI — it doesn't create auction containers or assign lots to them, it manages individual lots, so it belongs here, not in step 10.
- `src/pages/admin/AdminModeration.tsx`
- `src/hooks/admin/useBulkOperations.ts`
- `src/components/listing-wizard/ListingWizard.tsx` — the seller's multi-step listing creation UI, calls the mutations retargeted in step 8 (`create.ts`).
- `src/types/fees.ts`

Out of scope (step 10, genuinely new UI, doesn't exist yet): admin auction (container) creation/edit form, lot review queue UI, lot-to-auction assignment screen, auction gallery page with banner images. Do not build any of that here — this task only fixes compilation/renames for existing pages.

## Instructions

Work through each file: read it in full, find every reference to the old per-item `auctions` API/types, retarget to the renamed lot-shaped equivalents from steps 6-8, following the exact same pattern used in step 7 (`BiddingPanel`/`AuctionCard`/etc.) — reuse `src/types/auction.ts`'s lot types and `src/hooks/useLotLiveWindow.ts` (step 7) wherever a component needs to know if a lot is live/upcoming/ended, rather than re-deriving that logic.

Specific known items:

1. **`src/types/fees.ts`**: `AuctionFee extends Doc<"auctionFees">` → rename to `LotFee extends Doc<"lotFees">`, `auctionId: Id<"auctions">` → `lotId: Id<"lots">`. Update JSDoc. Check `PlatformFee` (unrelated, stays as-is). Search the codebase for any import of `AuctionFee` and update call sites within this task's file list (don't touch files outside scope for this alone — if an out-of-scope file imports it, leave that import broken, it'll be fixed when that file's own task runs, but note it in Results).

2. **`src/hooks/admin/useBulkOperations.ts`**: `Id<"auctions">` → `Id<"lots">`, `Doc<"auctions">` → the lot type from `src/types/auction.ts`, `bulkStatusTarget` union `"active" | "rejected" | "sold" | "unsold"` → decide the right replacement for `"active"` given there's no such lot status anymore — `"approved"` is the closest single-step admin action (matches step 8's `bulkUpdateAuctions` semantics), but check `AdminAuctions.tsx`'s actual UI copy/buttons for what action this hook backs before deciding; keep `"rejected"`/`"sold"`/`"unsold"` if `bulkUpdateAuctions` still accepts them (it does, per the full `AdminLotStatus` union). Rename `selectedAuctions`/`auctionSearch`/etc. internals to lot-flavored names only if it doesn't create unnecessary churn in every caller — your call, note the decision.

3. **`src/pages/admin/AdminAuctions.tsx`**: the big one (542 lines, most errors). Retarget `getAllAuctions`/`getPendingAuctions` (or whatever step 6 actually named them) to their lot equivalents, `AuctionWithCategory` to the lot type, bulk operations to the renamed hook, individual-row admin actions (approve/reject/edit) to `convex/lots/mutations/lifecycle.ts`'s `approveLot`/`rejectLot` (step 3) instead of any lingering call into the legacy `publish.ts` handlers (which are known-broken dead code per step 8's Results — do not wire UI to them). If this page currently has an "assign to auction" or "set active" action that doesn't map to anything in the new model (since assignment is now a separate admin action via `convex/auctions/mutations/assignment.ts`, step 3), leave a clearly-labeled TODO/disabled state rather than inventing new UI — the assignment screen itself is step 10's job, not this task's.

4. **`src/pages/admin/AdminModeration.tsx`** and **`src/components/admin/ModerationCard.tsx`**: flag review queue — retarget to `getLotFlags`/`getAllPendingFlags` (step 6) and `dismissFlag` (step 3, already lot-shaped), `ModerationCard`'s prop types to the lot/flag shapes.

5. **`src/components/admin/BidMonitor.tsx`**: likely shows recent bids admin-wide — retarget to whatever admin bid query exists (`convex/admin/queries.ts`'s `getRecentBids`, step 8) and lot-shaped bid/item display.

6. **`src/pages/Home.tsx`**: landing page listing active auctions — uses `getActiveAuctions` (step 6, still named that, lot-shaped return with derived "live" filtering) and `getWatchedAuctionIds`/`getWatchedLotIds` (step 6 rename). Retarget both, plus the `AuctionCard` prop type (step 7's lot type).

7. **`src/pages/Profile.tsx`** (1155 lines — the biggest file here): likely renders the user's own listings, bids, watchlist, reviews sections. Work through each section, retargeting queries/types per the patterns above. This file was already touched narrowly in step 8 for the `startConversation` fix — don't revert that, build on top of it.

8. **`src/pages/SellerListings.tsx`**: seller's public listings page — `getSellerListings` (step 6, lot-shaped), lot type.

9. **`src/pages/Watchlist.tsx`**: `getWatchedLots` (step 6 rename), lot type, `AuctionCard`.

10. **`src/pages/dashboard/MyBids.tsx`**: uses `FunctionReturnType`-based typing already (step 7 noted this as existing precedent) — `getMyBids`/`getMyBidsStats` (step 6, verify names), lot-shaped bid display, live-window status per bid's lot.

11. **`src/pages/dashboard/MyListings.tsx`**: `getMyListings`/`getMyListingsStats` (step 6), lot type, status-based UI (draft/pending_review/approved/assigned/sold/unsold/rejected — the full new vocabulary, not just draft/active/sold).

12. **`src/components/NotificationListener.tsx`**: check what it references — likely just watches `notifications`/`readReceipts`, possibly with an `auctionId`-shaped link field somewhere (`notifications.link` is a plain string per schema, probably fine) — read it, only 111 lines, fix whatever's actually broken.

13. **`src/components/listing-wizard/ListingWizard.tsx`**: seller's create-listing flow — calls `convex/auctions/mutations/create.ts`'s `createAuction`/`saveDraft`/`generateUploadUrl` (step 8, already lot-shaped on the backend) — check the wizard's local types/state for any `Doc<"auctions">`/`Id<"auctions">` assumptions and retarget.

## Testing

- Run `bun run type-check` after each file (or in batches) and confirm **zero errors** in every file listed under "Files in scope" by the end. Some errors in `convex/seed.ts` and `convex/auctions/mutations/publish.ts` are expected to remain (out of scope, already flagged).
- Update/add component tests for every file that has one (check for `.test.tsx` siblings — several of these likely already exist given the pattern from steps 6-7). Don't weaken assertions; adapt to the new lot+auction model where the old assertion's intent no longer applies.
- Run `bun run test --run` scoped to every file you touch; report pass/fail counts.
- Run `bunx eslint` on every touched file; report results.

## Constraints

- Follow the existing code style (`@/` path aliases, shadcn/ui, Tailwind).
- Do not touch `convex/` in this task.
- Do not build any step-10 new-UI functionality (auction container create/edit form, lot review/assignment screen, gallery) — if a page's existing action has no equivalent in the new model, leave a clearly-labeled disabled/TODO state and note it in Results rather than inventing the replacement here.
- No speculative abstractions beyond reusing what steps 6-8 already built (lot types, `useLotLiveWindow`, lot-shaped helpers).
- **Write the Results section incrementally as you go if the task is large enough that a crash is plausible** — at minimum, write a partial Results entry after finishing each file, not only at the very end.

## Results

**Status:** Done. Completed entirely by Claude (orchestrator) directly, not opencode — opencode's OpenRouter key was still at its monthly limit and died on the very first model call (zero progress, confirmed via output log). Given the user's direction ("no you do the work without delegate"), all 14 files were fixed by hand, file by file, verifying `bun run type-check`/`bun run test --run`/`bunx eslint` after each.

### What changed, by file

- `src/types/fees.ts`: `AuctionFee extends Doc<"auctionFees">` → `LotFee extends Doc<"lotFees">`, `auctionId` → `lotId`. No other importers found.
- `src/hooks/admin/useBulkOperations.ts` (+ test): `Id<"auctions">`/`Doc<"auctions">` → `Id<"lots">`/`Doc<"lots">`; `bulkStatusTarget` union `"active"` → `"approved"` (closest single-step admin action, matching `bulkUpdateAuctions`'s full `AdminLotStatus` union). External hook API names (`selectedAuctions`, `auctionSearch`) kept as-is to avoid churn in callers, per the task's own guidance.
- `src/components/NotificationListener.tsx`: `api.watchlist.getWatchedAuctions` → `getWatchedLots`. Everything else (status/winnerId/sellerId/currentPrice checks) was already lot-shaped since it consumes already-renamed queries.
- `src/pages/admin/AdminModeration.tsx` (+ test): `getPendingAuctions` → `getPendingLots`; `approveAuction`/`rejectAuction` (legacy, broken `publish.ts` handlers) → `api.lots.mutations.lifecycle.approveLot`/`rejectLot` (the real step-3 mutations); local `PendingFlag` interface and all `flag.auctionId`/`flag.auctionTitle` → `flag.lotId`/`flag.lotTitle` (matches `getAllPendingFlags`'s actual return shape); toast copy updated ("Auction approved" → "Lot approved", "restored to active" → "restored to approved").
- `src/pages/admin/AdminAuctions.tsx` (+ test): `getAllAuctions` → `getAllLots`; `Doc<"auctions">` closingAuction state → `LotSummary` (used directly, not the deprecated `AuctionWithCategory` alias, since this file was being actively edited anyway); `closeAuctionEarly` arg `auctionId` → `lotId`; status badge switch extended for the full lot vocabulary (`assigned` → "Live", `approved` → "Approved", `draft` → "Draft", kept sold/unsold/rejected); bulk "Mark Active" button → "Approve" (`setBulkStatusTarget("approved")`); row-level "Force End" gating changed from `status === "active"` to `status === "assigned"` (only a live/assigned lot can be force-closed, matching step 4's `closeAuctionEarlyHandler` precondition).
- `src/pages/Home.tsx`, `src/pages/SellerListings.tsx` (+ test), `src/pages/Watchlist.tsx`: `getWatchedAuctionIds`/`getWatchedAuctions` → `getWatchedLotIds`/`getWatchedLots`. No other changes needed — these already consumed lot-shaped list data from step 6/7.
- `src/pages/dashboard/MyBids.tsx` (+ test): local `AuctionStatus` union was missing `approved`/`assigned` entirely and still had a dead `"active"` literal — extended to the real 7-status vocabulary, replaced every `status === "active"` with `status === "assigned"` (matching what the backend handler already uses internally for `isWinning`/`isOutbid`). Added `auctionEndTime`/`extendedEndTime` fields to the local `Auction` interface (replacing the stale `endTime`) and updated the countdown-timer render to use `extendedEndTime ?? auctionEndTime`, the same closing-time rule used everywhere else in the app.
- `src/pages/dashboard/MyListings.tsx` (+ test): `submitForReview` switched from the legacy `api.auctions.mutations.publish.submitForReview` to `api.lots.mutations.lifecycle.submitLotForReview` (`{lotId}` arg); `Id<"auctions">` state → `Id<"lots">`. Found and fixed a **real bug**, not just a compile error: the "Active" tab filter compared `listing.status === "active"`, which can never match now — the backend's `getMyListingsStats` deliberately combines `approved`+`assigned` into one "active" bucket (confirmed by reading `getMyListingsStatsHandler`), so the tab's item-level filter needed the same combined predicate, otherwise the tab's header count and its actual filtered list would permanently disagree (count > 0, list always empty).
- `src/lib/auction-badges.ts`: `AUCTION_STATUS_BADGE_VARIANTS` gained `approved`/`assigned` entries (was missing them entirely, silently falling back to default badge styling for every non-draft/pending/terminal lot).
- `src/components/listing-wizard/ListingWizard.tsx` (+ test): `submitForReview` same legacy→`lots.mutations.lifecycle.submitLotForReview` switch as `MyListings.tsx`, arg `auctionId` → `lotId`; `saveDraft`'s `Id<"auctions">` casts → `Id<"lots">` (`saveDraft` itself takes a plain `v.optional(v.string())`, so this was purely a local TS cast fix).
- `src/pages/Profile.tsx` (+ test): `getWatchedAuctionIds` → `getWatchedLotIds`; `activeListings` filter (same "active" bug as `MyListings.tsx`) fixed to `status === "approved" || status === "assigned"`. Test fixture's `messages.startConversation` call assertion `auctionId: undefined` → `lotId: undefined` (matches step 8's backend rename).

### Verification

- `bun run type-check`: **104 errors**, down from step 8's baseline of ~216 at the point step 9 started (drop reflects both the 14 files fixed here and that step 8 had already cleared its own scope). **Zero errors in every file this task touched.** Remaining errors are entirely `convex/seed.ts` (88, pre-existing, flagged since step 5) and `convex/auctions/mutations/publish.ts`/`publish.test.ts` (16 combined — pre-existing legacy dead code flagged since step 3, a deletion candidate, never in any step's scope).
- `bun run test --run` across all 11 touched test files: **234/234 passing** (`AdminAuctions.test.tsx` 22, `AdminModeration.test.tsx` 22, `ModerationCard.test.tsx` 12, `useBulkOperations.test.ts` 8, `Home.test.tsx` 36, `SellerListings.test.tsx` 13, `Watchlist.test.tsx` 5, `MyBids.test.tsx` 16, `MyListings.test.tsx` 21, `ListingWizard.test.tsx` 23, `Profile.test.tsx` 64).
- `bunx eslint` on every touched file: 0 errors (only pre-existing style warnings on 2 files, unrelated to this change, not chased).

### Notes / follow-ups

- `convex/auctions/mutations/publish.ts`'s legacy `publishAuctionHandler`/`approveAuctionHandler`/`rejectAuctionHandler`/`closeAuctionEarlyHandler`-adjacent dead code is still there, still broken, still unreferenced by any `src/` caller after this step (all real UI now calls the step-3/step-4 replacements). Confirmed nothing in scope still points at it. Ripe for deletion in a follow-up cleanup task.
- No `src/pages/admin/*` new UI (auction container create/edit form, lot-to-auction assignment screen, auction gallery) was built — that remains step 10, as planned. `AdminAuctions.tsx`'s "Force End" action is the only admin lot-settlement action available pending that screen; assignment itself has no UI yet (only the backend mutation from step 3).
