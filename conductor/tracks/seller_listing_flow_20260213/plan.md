# Implementation Plan: Seller Listing Flow

## Phase 1: Foundation & Navigation
- [x] Task: Update navigation for unified account access. (6b896f8)
    - [x] Add "Sell Equipment" button to main navigation (if not present).
    - [x] Implement protected route `/sell` using Better Auth middleware.
- [x] Task: Define Schema updates for Listing Moderation. (6b896f8)
    - [x] Update `auctions` status to include `pending_review`.
    - [x] Add `conditionChecklist` object field to `auctions` table in `schema.ts`.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Navigation' (Protocol in workflow.md) (f2c93f7)

## Phase 2: Listing Wizard - Equipment & Specs
- [x] Task: Implement Wizard Layout & State Management. (f2c93f7)
    - [x] Create a multi-step form container with progress indicator.
    - [x] Implement persistent local state to prevent data loss on refresh.
- [x] Task: Step 1 & 2: General Info & Metadata Lookup. (f2c93f7)
    - [x] Write tests for Make/Model auto-population logic.
    - [x] Implement Step 1: Basic details (Year, Title, Location).
    - [x] Implement Step 2: Technical specs with search/lookup from `equipmentMetadata`.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Listing Wizard - Equipment & Specs' (Protocol in workflow.md) (d348257)

## Phase 3: Condition & Pricing Strategy
- [x] Task: Step 3: Guided Condition Checklist. (d348257)
    - [x] Create reusable checklist component for Yes/No machinery questions.
    - [x] Implement mandatory field validation for core components (Engine, Hydraulics).
- [x] Task: Step 5: Pricing Strategy & Recommendations. (d348257)
    - [x] Write tests for reserve price recommendation logic.
    - [x] Implement pricing inputs with live "Market Confidence" feedback.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Condition & Pricing Strategy' (Protocol in workflow.md) (d348257)

## Phase 4: Media Gallery & Submission
- [x] Task: Step 4: Guided Image Upload. (d348257)
    - [x] Implement file upload component with guided "Angle Slots" (e.g., Front, Side, Engine).
    - [x] Add image preview and removal functionality.
- [x] Task: Submission Logic & Moderation Queue. (d348257)
    - [x] Write tests for `createAuction` mutation with `pending_review` status.
    - [x] Implement final review step and submission to Convex.
    - [x] Create success/thank you page with moderation status info.
- [x] Task: Conductor - User Manual Verification 'Phase 4: Media Gallery & Submission' (Protocol in workflow.md) (d348257)

## Phase 5: Polish & Mobile Optimization
- [ ] Task: Refine Mobile UX.
    - [ ] Ensure all inputs have appropriate `inputmode` and `autocomplete`.
    - [ ] Optimize photo upload performance for slower connections.
- [ ] Task: Final Verification & Quality Gates.
    - [ ] Run full test suite and verify >80% coverage.
    - [ ] Conduct accessibility audit (keyboard nav through wizard).
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Edge Cases' (Protocol in workflow.md)
