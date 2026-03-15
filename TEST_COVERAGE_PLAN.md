# Test Coverage Improvement Plan

## Target: >95% Aggregate Statement Coverage (ACHIEVED)

### Current Status (2026-03-15)

- **Overall Statement Coverage:** 95.71% ✅ (Exceeds >95% aggregate threshold)
- **Branch Coverage:** 89.23% (Target: >89% aggregate)
- **Function Coverage:** 94.47% (Target: >94% aggregate)
- **Line Coverage:** 96.87% (Target: >96% aggregate)

---

## 🛑 Testing Anti-Patterns to Avoid

Based on the recent review of uncommitted test scripts, all future and revised tests **MUST NOT** do the following:

1. **No Over-Mocking of Hooks:** Do not mock internal custom hooks (like `useUserManagement`). This bypasses the actual logic of the component.
2. **No Over-Mocking of Sub-components:** Do not mock interactive child components (like `SettingsCard` or tabs). Let them render so their click handlers and visual states can be properly tested.
3. **No Passive Tests:** Asserting that a container `<div>` is in the document is not enough. Tests must interact with the component (clicks, typing, submitting).
4. **No Type Safety Bypasses:** Do not blindly `useQuery as Mock` and return hardcoded objects that lack proper schema validation. Mock API responses securely. **Avoid `as any` in mocks; cast through `unknown` to the concrete type if necessary.**

**Correct Methodology:**

- Use `@testing-library/user-event` (or `fireEvent` if necessary) to simulate user flows.
- Assert that API mutations (`approveAuction`, `rejectAuction`, etc.) are triggered with the correct arguments when buttons are clicked.
- Assert conditional rendering (error states, missing data, empty arrays).
- Validate complex forms (validation messages, email confirmations).

---

## Phase 1: Overhaul Flawed / "Fake" Tests ✅ COMPLETED

The following newly created tests must be completely rewritten to actually test the components' internal logic, interactions, and branches:

- [x] **`src/pages/admin/AdminUsers.test.tsx`**: Stop mocking `useUserManagement`. Test the actual search logic, KYC review dialog toggling, and user promotion interactions. Target >90% per-file statement coverage.
- [x] **`src/pages/admin/AdminModeration.test.tsx`**: Add interaction tests to click "Approve", "Reject", and "Dismiss" buttons and assert that the mocked mutations are called. Target >90% per-file statement coverage.
- [x] **`src/pages/admin/AdminAnnouncements.test.tsx`**: Stop mocking inner components. Test the "New Announcement" flow, loading states, and stats rendering. Target >90% per-file statement coverage.
- [x] **`src/pages/admin/AdminSettings.test.tsx`**: Stop mocking `SettingsCard`. Test the click actions of the settings cards and ensure toasts or dialogs are triggered. Target >90% per-file statement coverage.
- [x] **`src/pages/kyc/sections/PersonalInfoSection.test.tsx`**: Add tests for required field validation, email mismatch validation, and error states. Target >90% per-file statement coverage.
- [x] **`src/pages/admin/AdminMarketplace.test.tsx`**: Write tests that interact with the active auctions, checking pagination or filters if present.
- [x] **`src/pages/admin/AdminFinance.test.tsx`**: Remove excessive UI mocking and ensure the actual finance metrics rendering is tested.
- [x] **`src/pages/admin/AdminAudit.test.tsx`**: Stop mocking `AuditTab` and verify that the logs are listed and paginated correctly.

---

## Phase 2: Add Tests for Completely Untested Files (The Right Way) ✅ COMPLETED

### Remaining Admin Pages

- [x] `src/pages/admin/AdminAuctions.tsx` - Focus on list rendering, sorting, and row interactions. ✅ COMPLETED (97% Statements, 90% Branches)

### Core Pages

- [x] `src/pages/Login.tsx` - Focus on authentication flows, form inputs, validation, and error state display. ✅ COMPLETED (100% Statements, 87% Branches)
- [x] `src/pages/Sell.tsx` - Expand existing basic test to include integration with the Listing Wizard logic if applicable. ✅ COMPLETED (100% via ListingWizard.test.tsx integration)

### KYC Sections

- [x] `src/pages/kyc/sections/VerificationStatusSection.tsx` - Focus on conditional rendering based on different KYC statuses (pending, approved, rejected). ✅ COMPLETED (100% Statements, 100% Branches)

### Critical Low-Coverage Files

- [x] `src/App.tsx` (Currently 55% statements) - Test routing fallback and global providers. ✅ COMPLETED (95.7% Statements, 100% Branches)
- [x] `src/components/NotificationDropdown.tsx` (Currently 39% statements) - Expand tests to cover conditional UI logic and missing branches. ✅ COMPLETED (100% Statements, 100% Branches)
- [x] `src/components/listing-wizard/hooks/useListingWizard.ts` (0% coverage) - Requires unit tests for state management, step progression, and validation. ✅ COMPLETED (100% Statements, 100% Branches)

---

## Phase 3: Improve Existing Backend Test Coverage ✅ COMPLETED

Ensure the backend operations have strict tests checking authorization rules, error throws, and data transformations.

- [x] `convex/support.ts` - 58% statements → **96.77%** ✅
- [x] `convex/admin_utils.ts` - 77% statements → **97.36%** ✅
- [x] `convex/config.ts` - 69% statements → **100%** ✅
- [x] `convex/lib/storage.ts` - Create comprehensive unit tests. → **100%** ✅
- [x] `convex/lib/auth.ts` - Improve coverage to **97.5%** statements. ✅
- [x] `convex/notifications.ts` - Improve coverage to **97.08%** statements. ✅
- [x] `convex/auctions/proxy_bidding.ts` - Improve coverage to **96.73%** statements. ✅

---

## Phase 4: Final Verification & Locking ✅ COMPLETED

- [x] Achieve >95% overall aggregate statement coverage. (Current: **95.71%**)
- [x] Ensure all individual functional files meet >90% statement coverage.
- [x] Update global thresholds in `vitest.config.ts` to `95%`.

---

## Progress Log

### 2026-03-15

- **ACHIEVED TARGET: 95.71% Statement Coverage.**
- Updated `vitest.config.ts` global thresholds to lock in progress.
- Fixed `withIndex` query mocks across all backend tests to ensure internal logic paths are executed.
- Added comprehensive interaction tests for `MetadataCatalog`, `AuctionCard`, and `CountdownTimer`.
- Resolved coverage gaps in Listing Wizard steps (`GeneralInfoStep`, `PricingDurationStep`).
- Hardened backend tests for `notifications`, `watchlist`, and `proxy_bidding`.
- Refactored `internal.ts` mutations for better testability and consistency.
