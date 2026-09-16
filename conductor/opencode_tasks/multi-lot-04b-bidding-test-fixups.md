# Task: Multi-lot auctions — Step 4b: fix remaining bidding test fixtures

Follow-up to `multi-lot-04-bidding.md` (step 4 of 7 in the multi-lot auction rework, issue #318). A previous run of step 4 completed the source changes correctly (`convex/auctions/proxy_bidding.ts`, `convex/auctions/internal.ts`, `convex/auctions/mutations/bidding.ts`, `convex/auctions/mutations/publish.ts` all type-check clean with the new lot/auction model) but was interrupted before finishing the test-fixture updates for two files. Do not re-derive or second-guess the source changes — read them as given and make the tests match.

**Work alone. Do not delegate to, spawn, or invoke any other opencode/agent instance for any part of this task — do all edits yourself directly.**

## Context

Run `bun run test --run convex/auctions` first to see current state. As of the last check: 28 test files pass, 2 fail (`convex/auctions/proxy_bidding.test.ts` — 5 failures, `convex/auctions/mutations/bidding.test.ts` — 5 failures), 361/371 individual tests passing.

Read the current (already-updated) source of `convex/auctions/proxy_bidding.ts` and `convex/auctions/mutations/bidding.ts` in full — these are correct and should not be changed. The closing-time rule they implement: a lot can only be bid on when it has an `auctionId`, its parent `auctions` document has `status === "published"`, `auction.startTime <= now`, and `now < (lot.extendedEndTime ?? auction.endTime)`. Anti-snipe extension patches `lots.extendedEndTime`, never the parent auction's `endTime`.

## Instructions

1. Fix `convex/auctions/proxy_bidding.test.ts`: it still mocks/asserts against the old single-item `auctions`-table shape (e.g. `ctx.db.get("auctions", ...)` for the item being bid on, `auctionId` args, `by_auction`/`by_bidder_auction` index names). Update every mock and assertion to match the current `proxy_bidding.ts`: the bid target is fetched via `ctx.db.get("lots", lotId)`, proxy bids use `lotId` and `by_bidder_lot`/`by_lot`/`by_lot_maxBid` indexes, and any test that exercises the soft-close/anti-snipe path (`should handle soft close extension`) must mock a lot with an `auctionId` pointing at a mocked parent `auctions` document (with its own `startTime`/`endTime`), and assert the patch lands on `lots.extendedEndTime` — not `auctions.endTime` — per the current `extendLotIfNeeded` implementation. Fix the "should throw if auction not found" tests to match whatever the current code actually throws when the lot (or its parent auction) is missing — check the exact error message/condition in the source rather than assuming it's unchanged.

2. Fix `convex/auctions/mutations/bidding.test.ts`: the "proxy battles" and "extra branches" describe blocks under `handleNewBid` need the same lot+auction mock treatment as above. The three failing "bid cooldown (issue #283)" tests are failing with `ConvexError: Lot is not assigned to an auction` — their mock lot fixtures need `auctionId` set to a mocked, currently-published, in-window parent `auctions` document (so the bid reaches the cooldown logic being tested, rather than being rejected earlier for lacking an assignment) unless a given test's whole point is to verify that unassigned-lot rejection — check each test's intent before changing its fixture, and only add the auction mock where the test isn't specifically about assignment.

3. Do not weaken any assertion to make it pass — if a test's original intent no longer makes sense under the new model (e.g. it asserted the auction's own `endTime` gets patched on soft-close, which is now the lot's `extendedEndTime`), adapt the assertion to check the new, equivalent behavior, don't delete or loosen it.

4. Run `bun run test --run convex/auctions` and confirm all 30 files / all tests pass. Paste the final summary line in Results.

5. Run `bun run type-check` and confirm the total error count is unchanged from before this task (these are test files; they shouldn't affect the compiled error count either way, but confirm nothing regressed).

6. Run `bunx eslint convex/auctions/proxy_bidding.test.ts convex/auctions/mutations/bidding.test.ts` and report results.

## Constraints

- Only touch `convex/auctions/proxy_bidding.test.ts` and `convex/auctions/mutations/bidding.test.ts` unless you discover the failures actually stem from a bug in the already-changed source files (in which case, fix the minimal source bug and clearly flag it in Results as a deviation, with the exact reasoning) — but the likely cause is purely stale test fixtures, per the Context section.
- No new abstractions/helpers unless the existing test file already uses a shared fixture-builder pattern — match whatever pattern is already in the file.

## Results

All work completed directly, no delegation or subagents used. Source files (`proxy_bidding.ts`, `mutations/bidding.ts`) were read as-given and left unchanged.

### 1. `convex/auctions/proxy_bidding.test.ts`
Rewrote/updated the stale single-item `auctions`-table fixtures to the lot+parent-auction model:
- Bid target is now fetched as `ctx.db.get("lots", lotId)`; lot fixtures replaced `Doc<"auctions">`/`Id<"auctions">` with `Doc<"lots">`/`Id<"lots">`.
- Proxy-bid fixtures migrated from `auctionId` to `lotId`.
- `should place bid successfully for first bidder` now asserts the `bids` insert uses `lotId: "l1"`.
- `should handle proxy bid creation` now asserts the `proxy_bids` insert uses `lotId: "l1"`.
- `should handle soft close extension` now mocks a lot with `auctionId` pointing at a mocked parent `auctions` doc (own `startTime`/`endTime`) and asserts the patch lands on `lots.extendedEndTime` + `isExtended` (not `auctions.endTime`).
- "auction not found" tests corrected to the new error messages: `getCurrentHighestBidAmount` throws `"Lot l1 not found"` and `handleNewBid` throws `"Lot not found"`.
- `extendAuctionIfNeeded` describe renamed to `extendLotIfNeeded`; the "endTime missing" case now mocks an assigned lot whose parent auction has no `endTime` and asserts no `isExtended` patch lands.
- All proxy-trained fixtures (`by_lot` semantics, tie-breaking, Case A/B) converted to `lotId` and lot-shaped parents. Assertions' expected numeric outcomes preserved unchanged.

### 2. `convex/auctions/mutations/bidding.test.ts`
- `handleNewBid proxy battles` / `handleNewBid basic logic` / `handleNewBid extra branches`: fixtures renamed `auction`→`lot`, lot-shaped, `Id<"lots">` args, and `currentPrice` patch assertions changed from table `"auctions"` to `"lots"`. Proxy fixtures gained `_id` fields so `upsertProxyBid` patches the intended row.
- `getMinIncrement` casts changed from `Doc<"auctions">` to `Doc<"lots">`.
- `getProxyBid` lotId arg corrected to `Id<"lots">`.
- Bid cooldown (issue #283): replaced `setupAuction` (which returned a lot without `auctionId`) with `setupLotAndAuction(lot, auction)`. The three failing tests now use an assigned lot (`auctionId: "a1"`) plus a mocked **published, in-window** parent auction, and pass `lotId` args. The fourth ("should not consume the cooldown when a bid is rejected") uses the same assigned lot but a parent auction whose `endTime` is in the past so it correctly reaches `"Auction ended"`; no assertion was weakened.

### 3. Test run
```
bun run test --run convex/auctions
 Test Files  30 passed (30)
      Tests  371 passed (371)
```
(Previously: 28 passed / 2 failed, 361/371.)

### 4. Type-check
`bun run type-check` reports 882 total errors, all pre-existing in unrelated files (mid-refactor source). **Zero** errors reference either target file, and the only files modified in this task were the two `.test.ts` files (which export nothing), so the count is unchanged.

### 5. ESLint
```
bunx eslint convex/auctions/proxy_bidding.test.ts convex/auctions/mutations/bidding.test.ts
✖ 4 problems (0 errors, 4 warnings)
```
0 errors. The 4 warnings are the pre-existing test-mock style: two `@typescript-eslint/no-misused-promises` from `mockImplementation` returning `Promise.resolve(...)` (the existing `mockLotAndAuction` pattern, now shared by `setupLotAndAuction`) and two `no-unsafe-assignment` on `expect.objectContaining(...)`. This matches the fixture-builder pattern already present in the file (per the task constraint), so no new abstraction was introduced.

### Deviation flag
None. No source bug found; all failures were stale test fixtures as anticipated.

