# Implementation Plan: Listing Lifecycle & Management (Drafts & Refinement)

## Phase 1: Backend Mutations (Convex)
- [x] Task: Implement `updateAuction` mutation [847c3ac]
    - [x] Write unit tests for `updateAuction` validating role and ownership
    - [x] Implement `updateAuction` logic in `app/convex/auctions/mutations.ts`
    - [x] Ensure all fields can be updated for `draft` and `pending_review` statuses
- [x] Task: Implement `publishAuction` mutation [c71772c]
    - [x] Write unit tests for `publishAuction` validating role and ownership
    - [x] Implement `publishAuction` logic in `app/convex/auctions/mutations.ts` to transition `draft` to `pending_review`
- [x] Task: Implement Condition Report Upload logic [42a3dd2]
    - [x] Write unit tests for uploading a condition report
    - [x] Create server-side logic for PDF upload to Convex Storage
    - [x] Implement replacement logic to silently overwrite/delete previous report
- [x] Task: Implement `cleanupDrafts` cron job [bed250f]
    - [x] Write unit tests for the cron job logic
    - [x] Add `cleanupDrafts` to `app/convex/crons.ts` to run daily and delete drafts older than 30 days
- [x] Task: Refactor and verify coverage [1ec4c06]
    - [x] Run coverage reports using Vitest to ensure >80% coverage for new backend code
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend Mutations (Convex)' (Protocol in workflow.md) [checkpoint: 1ec4c06]

## Phase 2: Frontend Refinement (React)
- [x] Task: Update Listing Wizard [23abe2e]
    - [x] Write UI unit tests for saving/resuming drafts
    - [x] Implement logic to persist drafts via `updateAuction` during listing creation
    - [x] Enable resuming/editing existing drafts
- [x] Task: Update Seller Dashboard [efb6c9d]
    - [x] Write UI unit tests for displaying drafts and pending items
    - [x] Modify Seller Dashboard to display `draft` and `pending_review` auctions
    - [x] Add UI controls to trigger `publishAuction` from the dashboard
- [x] Task: Update Auction Details Page [efb6c9d]
    - [x] Write UI unit tests for condition report rendering
    - [x] Display condition report PDF download link if one exists
- [ ] Task: Refactor and verify coverage
    - [ ] Run coverage reports using Vitest to ensure >80% coverage for new frontend code
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Frontend Refinement (React)' (Protocol in workflow.md)