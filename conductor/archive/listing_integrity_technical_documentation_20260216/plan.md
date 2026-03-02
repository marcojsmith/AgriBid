# Plan: Wizard Hardening & Data Integrity

## Phase 1: Input & Validation Hardening
- [x] Fix `GeneralInfoStep.tsx` year input logic to prevent clobbering.
- [x] Implement `min="0"` and non-negative validation in `PricingDurationStep.tsx`.
- [x] Add real-time comparison validation for Reserve Price vs Starting Price in UI.
- [x] Update `WizardNavigation.tsx` to disable "Next" if `getStepError` returns a value.

## Phase 2: Accessibility & Polish
- [x] Add `aria-label` attributes to all hidden file inputs in `MediaGalleryStep.tsx`.
- [x] Fix price rendering locale (en-ZA) in `ReviewSubmitStep.tsx`.
- [x] Ensure consistent numeric input behavior across all steps.
