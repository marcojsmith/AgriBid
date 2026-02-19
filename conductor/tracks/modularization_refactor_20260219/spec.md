# Specification: Comprehensive Codebase Modularization & Refactor

## Objective

Apply the established modularization pattern to decompose large React files that mix multiple concerns. The goal is to reduce file sizes to <250 lines (ideally <200) and improve maintainability by extracting components, hooks, and utilities.

## Target Components

### 1. AdminDashboard.tsx

- Current size: ~1,513 lines
- Target size: <200 lines
- Extractions:
  - `DetailItem`, `StatCard`, `ModerationCard`, `ConditionItem`, `SettingsCard`, `EmptyState` -> `app/src/components/admin/`
  - `normalizeAuctionImages()` -> `app/src/lib/` or `app/src/pages/admin/utils.ts`
  - Main logic into feature-specific components (e.g., `ModerationTab`, `UsersTab`, etc.)

### 2. KYC.tsx

- Current size: ~744 lines
- Target size: <250 lines
- Extractions:
  - `ListItem` -> `app/src/components/kyc/`
  - Form state/validation -> `useKYCForm` hook
  - File upload logic -> `useKYCFileUpload` hook
  - Split into `PersonalInfo`, `DocumentUpload`, `VerificationStatus` components

### 3. Header.tsx

- Current size: ~516 lines
- Target size: <250 lines
- Extractions:
  - `MobileMenu`
  - `UserDropdown`
  - `SearchBar`

### 4. AuctionCard.tsx

- Current size: ~324 lines
- Target size: <200 lines
- Extractions:
  - `AuctionImageGallery`
  - `BidSummary`
  - `SellerInfo`

### 5. BiddingPanel.tsx

- Current size: ~285 lines
- Target size: <150 lines
- Extractions:
  - `BidForm` (ensure separation)
  - `BidHistory`
  - Validation logic -> hook

## Infrastructure

- Centralized `app/src/hooks/` directory.
- Documentation on component size guidelines in `conductor/code_styleguides/`.

## Success Criteria

- Files are within target line counts.
- No regressions in functionality.
- Tests continue to pass.
- Clean directory structure for features.
