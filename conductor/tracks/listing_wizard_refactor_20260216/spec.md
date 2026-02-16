# Specification: Refactor ListingWizard for Modularity

## Overview
The `ListingWizard.tsx` component has grown into a "mega-component" (~990 lines), making it difficult to maintain and test. This track will decompose the wizard into a modular, directory-based structure using React Context for state management and custom hooks for business logic.

## Functional Requirements
- **Directory Structure**: Create a dedicated `app/src/components/ListingWizard/` directory.
- **State Management**: Implement a `ListingWizardContext` to provide form state and update handlers, eliminating prop drilling.
- **Component Decomposition**:
  - Extract each of the 6 steps into isolated components within a `steps/` sub-directory.
  - Create a generic `StepIndicator` component for progress visualization.
- **Logic Extraction**:
  - Move form state and validation logic into a `useListingForm` hook.
  - Move Convex file upload and preview handling into a `useListingMedia` hook.
- **Constants & Types**: Centralize all shared types and constants (e.g., `PHOTO_SLOTS`, `SA_LOCATIONS`) into dedicated files.

## Non-Functional Requirements
- **Maintainability**: The main `ListingWizard.tsx` entry point should be reduced to < 150 lines.
- **Testability**: Ensure individual steps can be tested in isolation.
- **Performance**: Use React Context effectively to prevent unnecessary re-renders of non-active steps.

## Acceptance Criteria
- [x] `app/src/components/ListingWizard/` follows the agreed folder structure.
- [x] `ListingWizard.tsx` acts only as a thin orchestrator.
- [x] All existing functionality (multi-step navigation, file uploads, validation, submission) remains identical.
- [x] All current unit tests in `ListingWizard.test.tsx` pass without modification to the test logic.

## Out of Scope
- Adding new steps or changing existing form fields.
- Modifying the backend Convex schema.
- UI/UX redesign (styling should remain consistent with current implementation).
