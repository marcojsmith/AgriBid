# Implementation Plan: Listing Creation & Convex File Storage Integration

## Phase 1: Listing Wizard Foundation & State Management
- [ ] Task: Define Multi-Step State Schema and Navigation Logic
    - [ ] Create a comprehensive state type for the listing form
    - [ ] Implement `nextStep` and `prevStep` transitions in `ListingWizard.tsx`
- [ ] Task: Implement Step 1 - Equipment Details
    - [ ] Write unit tests for Step 1 validation
    - [ ] Build form fields: Make, Model, Year, Hours, Location
    - [ ] Implement zod/form-level validation
- [ ] Task: Implement Step 2 - Condition Checklist
    - [ ] Write unit tests for Step 2 checklist logic
    - [ ] Build UI for Engine, Hydraulics, Tires, and Service History toggles
    - [ ] Add free-text notes field
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Wizard Foundation' (Protocol in workflow.md)

## Phase 2: Convex File Storage & Image Upload
- [ ] Task: Implement Backend Upload Support
    - [ ] Implement `generateUploadUrl` action in `app/convex/auctions.ts`
    - [ ] Update `schema.ts` if any additional file metadata is required (optional)
- [ ] Task: Build Drag-and-Drop Upload Component
    - [ ] Create a reusable `ImageUploader` component using Shadcn/UI
    - [ ] Implement client-side file type and size validation
- [ ] Task: Implement Upload Logic and Preview
    - [ ] Write integration tests for image upload flow (mocking storage)
    - [ ] Implement concurrent uploads to Convex
    - [ ] Build a thumbnail grid with "Remove" functionality
    - [ ] Store Storage IDs in the wizard's state
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Image Management' (Protocol in workflow.md)

## Phase 3: Pricing, Review, and Submission
- [ ] Task: Implement Step 4 - Pricing & Duration
    - [ ] Build fields for Starting Price and Reserve Price
    - [ ] Add duration selector (e.g., 3, 7, 14 days)
- [ ] Task: Implement Step 5 - Review Summary
    - [ ] Build a summary UI displaying all gathered data and uploaded images
- [ ] Task: Submission Logic Integration
    - [ ] Write unit tests for `createAuction` data mapping
    - [ ] Connect the "Submit" button to the `api.auctions.createAuction` mutation
    - [ ] Implement success/failure feedback (Toasts) and redirection
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Final Submission' (Protocol in workflow.md)

## Phase 4: Approval Workflow
- [ ] Task: Build Admin Pending List
    - [ ] Create a simple view (or filter on Home) to list auctions with status `pending_review`
    - [ ] Restrict view to Admin roles
- [ ] Task: Implement Approval Action
    - [ ] Write unit tests for `approveAuction` status transition
    - [ ] Add "Approve" button to the pending auction items
    - [ ] Verify approved auctions move to `active` and appear on the public Home page
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Approval Workflow' (Protocol in workflow.md)
