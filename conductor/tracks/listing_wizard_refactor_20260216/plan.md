# Implementation Plan: Refactor ListingWizard for Modularity

## Phase 1: Setup & Data Consolidation
- [ ] Task: Create Directory Structure
    - [ ] Create `app/src/components/ListingWizard/`
    - [ ] Create sub-directories: `steps/`, `hooks/`, `context/`, `constants/`
- [ ] Task: Extract Shared Types and Constants
    - [ ] Move `ListingFormData`, `ConditionChecklist`, and related interfaces to `types.ts`
    - [ ] Move `PHOTO_SLOTS`, `SA_LOCATIONS`, `STEPS`, and `DEFAULT_FORM_DATA` to `constants.ts`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Setup & Consolidation' (Protocol in workflow.md)

## Phase 2: Core Logic & Context Extraction
- [ ] Task: Implement ListingWizardContext
    - [ ] Create `ListingWizardContext.tsx`
    - [ ] Define context state and update handlers
    - [ ] Create a `ListingWizardProvider` component
- [ ] Task: Extract useListingMedia Hook
    - [ ] Move Convex upload logic, preview handling, and cleanup logic into `hooks/useListingMedia.ts`
    - [ ] Ensure unit tests cover storage ID resolution and blob cleanup
- [ ] Task: Extract useListingForm Hook
    - [ ] Move step navigation, validation (`getStepError`), and field update logic into `hooks/useListingForm.ts`
    - [ ] Implement TDD: Verify validation logic in isolation
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Logic Extraction' (Protocol in workflow.md)

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
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Decomposition' (Protocol in workflow.md)

## Phase 4: Integration & Verification
- [ ] Task: Reassemble ListingWizard
    - [ ] Update `ListingWizard.tsx` to use the `ListingWizardProvider` and sub-components
    - [ ] Reduce main component file size to < 150 lines
- [ ] Task: Final Verification
    - [ ] Run full test suite (`npm run test`)
    - [ ] Run production build (`npm run build`)
    - [ ] Perform manual end-to-end listing flow test
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration' (Protocol in workflow.md)
