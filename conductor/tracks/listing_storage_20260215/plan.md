# Implementation Plan: Listing Creation & Convex File Storage Integration

## Phase 1: Listing Wizard Foundation & State Management
- [x] Task: Define Multi-Step State Schema and Navigation Logic
    - [x] Create a comprehensive state type for the listing form
    - [x] Implement `nextStep` and `prevStep` transitions in `ListingWizard.tsx`
- [x] Task: Implement Step 1 - Equipment Details
    - [x] Write unit tests for Step 1 validation
    - [x] Build form fields: Make, Model, Year, Hours, Location
    - [x] Implement zod/form-level validation
- [x] Task: Implement Step 2 - Condition Checklist
    - [x] Write unit tests for Step 2 checklist logic
    - [x] Build UI for Engine, Hydraulics, Tires, and Service History toggles
    - [x] Add free-text notes field
- [x] Task: Conductor - User Manual Verification 'Phase 1: Wizard Foundation' (Protocol in workflow.md)

## Phase 2: Convex File Storage & Image Upload
- [x] Task: Implement Backend Upload Support
    - [x] Implement `generateUploadUrl` action in `app/convex/auctions.ts`
    - [x] Update `schema.ts` if any additional file metadata is required (optional)
- [x] Task: Build Drag-and-Drop Upload Component
    - [x] Create a reusable `ImageUploader` component using Shadcn/UI
    - [x] Implement client-side file type and size validation
- [x] Task: Implement Upload Logic and Preview
    - [x] Write integration tests for image upload flow (mocking storage)
    - [x] Implement concurrent uploads to Convex
    - [x] Build a thumbnail grid with "Remove" functionality
    - [x] Store Storage IDs in the wizard's state
- [x] Task: Conductor - User Manual Verification 'Phase 2: Image Management' (Protocol in workflow.md)

## Phase 3: Pricing, Review, and Submission
- [x] Task: Implement Step 4 - Pricing & Duration
    - [x] Build fields for Starting Price and Reserve Price
    - [x] Add duration selector (e.g., 3, 7, 14 days)
- [x] Task: Implement Step 5 - Review Summary
    - [x] Build a summary UI displaying all gathered data and uploaded images
- [x] Task: Submission Logic Integration
    - [x] Write unit tests for `createAuction` data mapping
    - [x] Connect the "Submit" button to the `api.auctions.createAuction` mutation
    - [x] Implement success/failure feedback (Toasts) and redirection
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Submission' (Protocol in workflow.md)

## Phase 4: Approval Workflow
- [x] Task: Build Admin Pending List
    - [x] Create a simple view (or filter on Home) to list auctions with status `pending_review`
    - [x] Restrict view to Admin roles
- [x] Task: Implement Approval Action
    - [x] Write unit tests for `approveAuction` status transition
    - [x] Add "Approve" button to the pending auction items
    - [x] Verify approved auctions move to `active` and appear on the public Home page
- [x] Task: Conductor - User Manual Verification 'Phase 4: Approval Workflow' (Protocol in workflow.md)
