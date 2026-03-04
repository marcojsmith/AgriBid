# Specification: Listing Lifecycle & Management (Drafts & Refinement)

## Overview
Implement the missing auction lifecycle mutations (update, publish) to allow sellers to manage their listings, enhance the listing creation experience with draft persistence, and improve overall UX. This encompasses both backend Convex mutations and frontend refinements.

## Functional Requirements

### Phase 1: Backend Mutations (Convex)
1. **`updateAuction` Mutation**:
   - **Location**: `app/convex/auctions/mutations.ts`
   - **Behavior**: Allows a seller to edit their own `draft` or `pending_review` auctions.
   - **Scope**: Sellers can edit all fields in the auction.
   - **Validation**: Ensure the user is authenticated, has the appropriate seller role, and is the owner of the auction.
2. **`publishAuction` Mutation**:
   - **Location**: `app/convex/auctions/mutations.ts`
   - **Behavior**: Transitions an auction's status from `draft` to `pending_review`.
   - **Validation**: Ensure the user is authenticated, has the appropriate seller role, and is the owner of the auction. Validate required fields are present before publishing.
3. **Condition Report Upload**:
   - **Behavior**: Create server-side logic to handle PDF condition report uploads to Convex Storage (using existing upload URL generation).
   - **Rule**: Uploading a new condition report silently replaces any existing report for that auction.
4. **Draft Cleanup Cron**:
   - **Location**: `app/convex/crons.ts`
   - **Job Name**: `cleanupDrafts`
   - **Behavior**: Automatically deletes abandoned drafts that are older than 30 days.
   - **Frequency**: Runs daily.

### Phase 2: Frontend Refinement (React)
1. **Listing Wizard**:
   - Add support for saving, resuming, and editing drafts.
2. **Seller Dashboard**:
   - Enable viewing of `draft` and `pending_review` auctions.
   - Add capability to invoke `publishAuction` directly from the dashboard.
3. **Auction Details**:
   - Display a download link for the condition report (PDF) if available.

## Non-Functional Requirements
- Ensure highly modular, well-commented code following the `conductor/code_styleguides/` conventions.
- No `any` types in TypeScript.
- Write unit tests for all backend mutations and run the test suite to verify permissions before moving to Phase 2.

## Acceptance Criteria
- [ ] Seller can update all fields of their own `draft` or `pending_review` auctions.
- [ ] Unauthorized users or non-owners are rejected when attempting to update or publish an auction.
- [ ] Seller can transition a `draft` to `pending_review` via the `publishAuction` mutation.
- [ ] Uploading a condition report PDF saves to Convex Storage and replacing it deletes/overwrites the old one.
- [ ] The `cleanupDrafts` cron job successfully identifies and deletes drafts older than 30 days.
- [ ] The Frontend Listing Wizard persists drafts and allows resuming.
- [ ] The Frontend Seller Dashboard displays drafts and `pending_review` items.
- [ ] The Frontend Auction Details view renders the condition report PDF link.

## Out of Scope
- Changes to live or completed auctions.