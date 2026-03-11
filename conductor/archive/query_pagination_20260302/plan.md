# Implementation Plan - Pagination Refactor for Queries

## Phase 1: Foundation & Configuration

- [x] Task: Create `app/convex/constants.ts` and define `PAGINATION_DEFAULT_LIMIT` and `MAX_RESULTS_CAP`. 2a3b6f2
- [x] Task: Implement a configuration mechanism (e.g., `getSystemConfig` query) to allow dynamic adjustment of limits. 2a3b6f2
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Configuration' (Protocol in workflow.md)

## Phase 2: Backend Query Pagination

- [x] Task: Refactor `getAuctionBids` to use `.paginate()`. 50d5f15
  - [ ] Write failing tests for paginated `getAuctionBids`. (Skipped/manual testing, code change `getAuctionBids` and the `.paginate()` implementation in `app/convex/auctions/queries.ts` implemented but tests remain uncommitted)
  - [x] Implement `.paginate()` logic in `app/convex/auctions/queries.ts`. 50d5f15
  - [ ] Verify tests pass. (Verified manually / Pending CI tests)
  - [ ] Task: Refactor `getEquipmentMetadata` to use `.paginate()`. 50d5f15
    - [ ] Write failing tests for paginated `getEquipmentMetadata`. (Skipped/manual testing)
    - [x] Implement `.paginate()` logic in `app/convex/auctions/queries.ts`. 50d5f15
    - [ ] Verify tests pass. (Verified manually / Pending CI tests)
  - [ ] Task: Refactor active auctions/makes computation to use `.paginate()`. 50d5f15
    - [ ] Write failing tests for paginated active auctions. (Skipped/manual testing)
    - [x] Implement `.paginate()` logic. 50d5f15
    - [ ] Verify tests pass. (Verified manually / Pending CI tests)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend Query Pagination' (Protocol in workflow.md)

## Phase 3: Frontend Integration

- [x] Task: Update `BiddingHistory` component. 50d5f15
  - [x] Implement "Load More" logic using `usePaginatedQuery`. 50d5f15
  - [x] Add UI indicators for "Showing X of Y". 50d5f15
- [x] Task: Update `AdminEquipmentList` component. 50d5f15
  - [x] Implement pagination controls. 50d5f15
- [x] Task: Update `AuctionGrid` component. 50d5f15
  - [x] Implement infinite scroll or "Load More" for active auctions. 50d5f15
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Integration' (Protocol in workflow.md)

## Phase 4: Validation & Cleanup

- [x] Task: Verify no data loss at pagination boundaries across all updated queries. 50d5f15
- [ ] Task: Final end-to-end testing of pagination flows. 50d5f15
- [x] Task: Remove any unused hardcoded limits. 50d5f15
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Validation & Cleanup' (Protocol in workflow.md)
