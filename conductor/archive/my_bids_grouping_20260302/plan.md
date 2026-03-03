# Implementation Plan: My Bids Page - Group Bids by Auction

## Phase 1: Backend Query Optimization
**Goal:** Refactor `getMyBids` query to return grouped auction data with accurate status indicators.

- [x] **Task: Write Tests for `getMyBids` (TDD)**
    - [x] Create `app/convex/auctions/my_bids.test.ts`.
    - [x] Write a test to verify multiple bids on the same auction return a single grouped result.
    - [x] Write a test to verify `isWinning`, `isOutbid`, `isWon`, and `isCancelled` statuses are correctly calculated.
    - [x] Write a test to verify `bidCount` and `myHighestBid` are accurate.
- [x] **Task: Implement Grouped `getMyBids` Query**
    - [x] Modify `app/convex/auctions/queries.ts`'s `getMyBids`.
    - [x] Use `by_bidder` index to collect bids and group them by auction.
    - [x] Include `auction` summary (title, currentPrice, endTime, status, etc.).
    - [x] Implement logic to determine winning/outbid/won/lost statuses.
    - [x] Verify tests pass.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Backend Query Optimization' (Protocol in workflow.md)**

## Phase 2: Frontend Refactor & Dashboard Summary
**Goal:** Update the "My Bids" page UI to handle the new data structure and add a status summary dashboard.

- [x] **Task: Update Types & Data Fetching**
    - [x] Update frontend types to match the new `getMyBids` return shape.
    - [x] Refactor `MyBids.tsx` to use the new data structure.
- [x] **Task: Implement Dashboard Summary**
    - [x] Add a top section to `MyBids.tsx` with statistics (Active, Winning, Outbid, Total Exposure).
    - [x] Style the summary components to be mobile-friendly and visually appealing.
- [x] **Task: Refactor Auction Card Component**
    - [x] Update card layout to be less image-heavy and more information-dense.
    - [x] Integrate `CountdownTimer` for active auctions.
    - [x] Add color-coded status badges (Winning, Outbid, Won, Lost, etc.).
    - [x] Add `bidCount` indicator to the card.
- [x] **Task: Implement "Raise Bid" Quick Action**
    - [x] Add "Raise Bid" button for outbid/active auctions.
    - [x] Implement quick navigation to bid panel.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Frontend Refactor & Dashboard Summary' (Protocol in workflow.md)**

## Phase 3: Filtering & Final Polish
**Goal:** Add sorting/filtering capabilities and ensure high code quality.

- [x] **Task: Add Sorting and Filtering**
    - [x] Implement client-side filtering by status (All, Winning, Active, Outbid, Ended).
    - [x] Implement sorting by "Ending Soonest" (default) and "Highest Bid".
- [x] **Task: Verification & Quality Gate Check**
    - [x] Run `npm run lint` and `npm run build` to ensure no regressions.
    - [ ] Verify responsiveness on mobile and tablet using Chrome DevTools MCP. (Deferred to manual end-to-end)
    - [x] Ensure all tasks meet the Definition of Done (tests pass, coverage >80%, etc.).
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: Filtering & Final Polish' (Protocol in workflow.md)** (Deferred)
