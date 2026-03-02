# Plan: Listing Lifecycle & Management (Drafts & Refinement)

This track implements the missing auction lifecycle mutations (update, publish) and enhances the listing creation experience with draft persistence.

## Phase 1: Backend Mutations
- [ ] 1. Implement `updateAuction` in `app/convex/auctions/mutations.ts` (allowing sellers to edit their own draft/pending auctions).
- [ ] 2. Implement `publishAuction` in `app/convex/auctions/mutations.ts` (changing status from `draft` to `pending_review`).
- [ ] 3. Implement `uploadConditionReport` action/mutation for handling PDF uploads to Convex Storage.
- [ ] 4. Add `cleanupDrafts` cron job in `app/convex/crons.ts` to delete abandoned drafts (>30 days).

## Phase 2: Frontend Refinement
- [ ] 5. Update `ListingWizard` to support "Save as Draft" functionality.
- [ ] 6. Implement "Edit Listing" page for sellers to modify existing drafts.
- [ ] 7. Add `LoadingSpinner` and `ErrorBoundary` global components for improved UX.
- [ ] 8. Implement `flagAuction` for buyers/admins to report suspicious listings.

## Phase 3: Testing & Verification
- [ ] 9. Unit tests for update/publish permissions (Vitest).
- [ ] 10. Manual verification of the draft-to-publish flow.
- [ ] 11. Verify file storage for PDFs (Condition Reports).
- [ ] 12. Run lint and build.
