# Implementation Plan: Refactor ListingWizard for Modularity

## Phase 1: Setup & Data Consolidation [checkpoint: 7b82a3f]
- [x] Task: Create Directory Structure
    - [x] Create `app/src/components/ListingWizard/`
    - [x] Create sub-directories: `steps/`, `hooks/`, `context/`, `constants/`
- [x] Task: Extract Shared Types and Constants
    - [x] Move `ListingFormData`, `ConditionChecklist`, and related interfaces to `types.ts`
    - [x] Move `PHOTO_SLOTS`, `SA_LOCATIONS`, `STEPS`, and `DEFAULT_FORM_DATA` to `constants.ts`
- [x] Task: Conductor - User Manual Verification 'Phase 1: Setup & Consolidation' (Protocol in workflow.md)

## Phase 2: Core Logic & Context Extraction
- [x] Task: Implement ListingWizardContext
    - [x] Create `ListingWizardContext.tsx`
    - [x] Define context state and update handlers
    - [x] Create a `ListingWizardProvider` component
- [x] Task: Extract useListingMedia Hook
    - [x] Move Convex upload logic, preview handling, and cleanup logic into `hooks/useListingMedia.ts`
    - [x] Ensure unit tests cover storage ID resolution and blob cleanup
- [x] Task: Extract useListingForm Hook
    - [x] Move step navigation, validation (`getStepError`), and field update logic into `hooks/useListingForm.ts`
    - [x] Implement TDD: Verify validation logic in isolation
- [ ] Task: Conductor - Manual Verification using Chromedevtools 'Phase 2: Logic Extraction' (Protocol in workflow.md)

## Phase 3: Component Decomposition
- [ ] Task: Create Step Components
    - [ ] Create `GeneralInfoStep.tsx`
    - [ ] Create `TechnicalSpecsStep.tsx`
    - [ ] Create `ConditionChecklistStep.tsx`
    - [ ] Create `MediaGalleryStep.tsx`
    - [ ] Create `PricingDurationStep.tsx`
    - [ ] Create `ReviewSubmitStep.tsx`
- [ ] Task: Create UI Utility Components
    - [ ] Create `StepIndicator.tsx` (Progress bar and step labels)
    - [ ] Create `WizardNavigation.tsx` (Previous/Next buttons)
- [ ] Task: Conductor - Manual Verification using Chromedevtools 'Phase 3: Decomposition' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [ ] Task: Reassemble ListingWizard
    - [ ] Update `ListingWizard.tsx` to use the `ListingWizardProvider` and sub-components
    - [ ] Reduce main component file size to < 150 lines
- [ ] Task: Final Verification
    - [ ] Run full test suite (`npm run test`)
    - [ ] Run production build (`npm run build`)
    - [ ] Perform manual end-to-end listing flow test
- [ ] Task: Conductor - Manual Verification using Chromedevtools 'Phase 4: Integration' (Protocol in workflow.md)
