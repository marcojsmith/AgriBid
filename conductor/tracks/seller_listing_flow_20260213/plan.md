# Implementation Plan: Seller Listing Flow

## Phase 1: Foundation & Navigation
- [ ] Task: Update navigation for unified account access.
    - [ ] Add "Sell Equipment" button to main navigation (if not present).
    - [ ] Implement protected route `/sell` using Better Auth middleware.
- [ ] Task: Define Schema updates for Listing Moderation.
    - [ ] Update `auctions` status to include `pending_review`.
    - [ ] Add `conditionChecklist` object field to `auctions` table in `schema.ts`.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Navigation' (Protocol in workflow.md)

## Phase 2: Listing Wizard - Equipment & Specs
- [ ] Task: Implement Wizard Layout & State Management.
    - [ ] Create a multi-step form container with progress indicator.
    - [ ] Implement persistent local state to prevent data loss on refresh.
- [ ] Task: Step 1 & 2: General Info & Metadata Lookup.
    - [ ] Write tests for Make/Model auto-population logic.
    - [ ] Implement Step 1: Basic details (Year, Title, Location).
    - [ ] Implement Step 2: Technical specs with search/lookup from `equipmentMetadata`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Listing Wizard - Equipment & Specs' (Protocol in workflow.md)

## Phase 3: Condition & Pricing Strategy
- [ ] Task: Step 3: Guided Condition Checklist.
    - [ ] Create reusable checklist component for Yes/No machinery questions.
    - [ ] Implement mandatory field validation for core components (Engine, Hydraulics).
- [ ] Task: Step 5: Pricing Strategy & Recommendations.
    - [ ] Write tests for reserve price recommendation logic.
    - [ ] Implement pricing inputs with live "Market Confidence" feedback.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Condition & Pricing Strategy' (Protocol in workflow.md)

## Phase 4: Media Gallery & Submission
- [ ] Task: Step 4: Guided Image Upload.
    - [ ] Implement file upload component with guided "Angle Slots" (e.g., Front, Side, Engine).
    - [ ] Add image preview and removal functionality.
- [ ] Task: Submission Logic & Moderation Queue.
    - [ ] Write tests for `createAuction` mutation with `pending_review` status.
    - [ ] Implement final review step and submission to Convex.
    - [ ] Create success/thank you page with moderation status info.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Media Gallery & Submission' (Protocol in workflow.md)

## Phase 5: Polish & Mobile Optimization
- [ ] Task: Refine Mobile UX.
    - [ ] Ensure all inputs have appropriate `inputmode` and `autocomplete`.
    - [ ] Optimize photo upload performance for slower connections.
- [ ] Task: Final Verification & Quality Gates.
    - [ ] Run full test suite and verify >80% coverage.
    - [ ] Conduct accessibility audit (keyboard nav through wizard).
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Edge Cases' (Protocol in workflow.md)
