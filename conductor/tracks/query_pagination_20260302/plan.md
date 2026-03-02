# Implementation Plan - Pagination Refactor for Queries

## Phase 1: Foundation & Configuration
- [x] Task: Create `app/convex/constants.ts` and define `PAGINATION_DEFAULT_LIMIT` and `MAX_RESULTS_CAP`. 2a3b6f2
- [x] Task: Implement a configuration mechanism (e.g., `getSystemConfig` query) to allow dynamic adjustment of limits. 2a3b6f2
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Configuration' (Protocol in workflow.md)

## Phase 2: Backend Query Pagination
- [ ] Task: Refactor `getAuctionBids` to use `.paginate()`.
    - [ ] Write failing tests for paginated `getAuctionBids`.
    - [ ] Implement `.paginate()` logic in `app/convex/auctions/queries.ts`.
    - [ ] Verify tests pass.
- [ ] Task: Refactor `getEquipmentMetadata` to use `.paginate()`.
    - [ ] Write failing tests for paginated `getEquipmentMetadata`.
    - [ ] Implement `.paginate()` logic in `app/convex/auctions/queries.ts`.
    - [ ] Verify tests pass.
- [ ] Task: Refactor active auctions/makes computation to use `.paginate()`.
    - [ ] Write failing tests for paginated active auctions.
    - [ ] Implement `.paginate()` logic.
    - [ ] Verify tests pass.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend Query Pagination' (Protocol in workflow.md)

## Phase 3: Frontend Integration
- [ ] Task: Update `BiddingHistory` component.
    - [ ] Implement "Load More" logic using `usePaginatedQuery`.
    - [ ] Add UI indicators for "Showing X of Y".
- [ ] Task: Update `AdminEquipmentList` component.
    - [ ] Implement pagination controls.
- [ ] Task: Update `AuctionGrid` component.
    - [ ] Implement infinite scroll or "Load More" for active auctions.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Integration' (Protocol in workflow.md)

## Phase 4: Validation & Cleanup
- [ ] Task: Verify no data loss at pagination boundaries across all updated queries.
- [ ] Task: Final end-to-end testing of pagination flows.
- [ ] Task: Remove any unused hardcoded limits.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Validation & Cleanup' (Protocol in workflow.md)
