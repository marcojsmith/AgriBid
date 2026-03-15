# Test Coverage Improvement Plan

## Target: >95% Overall Coverage

### Current Status (2026-03-15)

_Note: Previous testing efforts resulted in "fake coverage" by heavily mocking internal logic, which artificially kept coverage low and bypassed actual functionality. Current metrics reflect the actual tested codebase minus the flawed tests._

| Metric     | Current (~Actual) | Target | Gap     |
| ---------- | ----------------- | ------ | ------- |
| Statements | ~90.48%           | 95%    | +4.52%  |
| Branches   | ~84.42%           | 95%    | +10.58% |
| Functions  | ~82.59%           | 95%    | +12.41% |
| Lines      | ~91.78%           | 95%    | +3.22%  |

---

## 🛑 Testing Anti-Patterns to Avoid

Based on the recent review of uncommitted test scripts, all future and revised tests **MUST NOT** do the following:

1. **No Over-Mocking of Hooks:** Do not mock internal custom hooks (like `useUserManagement`). This bypasses the actual logic of the component.
2. **No Over-Mocking of Sub-components:** Do not mock interactive child components (like `SettingsCard` or tabs). Let them render so their click handlers and visual states can be properly tested.
3. **No Passive Tests:** Asserting that a container `<div>` is in the document is not enough. Tests must interact with the component (clicks, typing, submitting).
4. **No Type Safety Bypasses:** Do not blindly `useQuery as Mock` and return hardcoded objects that lack proper schema validation. Mock API responses securely.

**Correct Methodology:**

- Use `@testing-library/user-event` (or `fireEvent` if necessary) to simulate user flows.
- Assert that API mutations (`approveAuction`, `rejectAuction`, etc.) are triggered with the correct arguments when buttons are clicked.
- Assert conditional rendering (error states, missing data, empty arrays).
- Validate complex forms (validation messages, email confirmations).

---

## Phase 1: Overhaul Flawed / "Fake" Tests

The following newly created tests must be completely rewritten to actually test the components' internal logic, interactions, and branches:

- [x] **`src/pages/admin/AdminUsers.test.tsx`**: Stop mocking `useUserManagement`. Test the actual search logic, KYC review dialog toggling, and user promotion interactions. Target >90% coverage (currently ~47%).
- [x] **`src/pages/admin/AdminModeration.test.tsx`**: Add interaction tests to click "Approve", "Reject", and "Dismiss" buttons and assert that the mocked mutations are called. Target >90% coverage (currently ~42%).
- [x] **`src/pages/admin/AdminAnnouncements.test.tsx`**: Stop mocking inner components. Test the "New Announcement" flow, loading states, and stats rendering. Target >90% coverage (currently ~31%).
- [x] **`src/pages/admin/AdminSettings.test.tsx`**: Stop mocking `SettingsCard`. Test the click actions of the settings cards and ensure toasts or dialogs are triggered. Target >90% coverage (currently ~55%).
- [x] **`src/pages/kyc/sections/PersonalInfoSection.test.tsx`**: Add tests for required field validation, email mismatch validation, and error states. Target >90% coverage (currently ~28%).
- [x] **`src/pages/admin/AdminMarketplace.test.tsx`**: Write tests that interact with the active auctions, checking pagination or filters if present.
- [x] **`src/pages/admin/AdminFinance.test.tsx`**: Remove excessive UI mocking and ensure the actual finance metrics rendering is tested.
- [x] **`src/pages/admin/AdminAudit.test.tsx`**: Stop mocking `AuditTab` and verify that the logs are listed and paginated correctly.

---

## Phase 2: Add Tests for Completely Untested Files (The Right Way)

### Remaining Admin Pages

- [ ] `src/pages/admin/AdminAuctions.tsx` - Focus on list rendering, sorting, and row interactions.

### Core Pages

- [ ] `src/pages/Login.tsx` - Focus on authentication flows, form inputs, validation, and error state display.
- [ ] `src/pages/Sell.tsx` - Expand existing basic test to include integration with the Listing Wizard logic if applicable.

### KYC Sections

- [ ] `src/pages/kyc/sections/VerificationStatusSection.tsx` - Focus on conditional rendering based on different KYC statuses (pending, approved, rejected).

### Critical Low-Coverage Files

- [ ] `src/App.tsx` (Currently 55% statements) - Test routing fallback and global providers.
- [ ] `src/components/NotificationDropdown.tsx` (Currently 39% statements) - Expand tests to cover conditional UI logic and missing branches.
- [ ] `src/components/listing-wizard/hooks/useListingWizard.ts` (0% coverage) - Requires unit tests for state management, step progression, and validation.

---

## Phase 3: Improve Existing Backend Test Coverage

Ensure the backend operations have strict tests checking authorization rules, error throws, and data transformations.

- [ ] `convex/support.ts` - 58% statements → improve to 95%+
- [ ] `convex/admin_utils.ts` - 77% statements → improve to 95%+
- [ ] `convex/config.ts` - 69% statements → improve to 95%+
- [ ] `convex/lib/storage.ts` - Create comprehensive unit tests.

---

## Phase 4: Update Coverage Thresholds

- [ ] Once all files meet the individual >90% requirements and tests are no longer shallow, update `vitest.config.ts` global thresholds to `95%`.

---

## Progress Log

### 2026-03-15

- [Phase 1] Overhauled all "fake" tests in Admin and KYC sections.
- [Phase 1] Removed excessive mocking of hooks (`useUserManagement`) and sub-components (`SupportTab`, `AuditTab`, `AdminLayout`).
- [Phase 1] Added comprehensive interaction tests, edge case coverage, and error state validation.
- [Phase 1] Verified >90% coverage for all Phase 1 target files.
- [Plan Update] Audited uncommitted tests and discovered high instances of fake testing/over-mocking.
- [Plan Update] Restructured plan to mandate interaction-based testing and realistic component rendering.

### Completed (Pending Revision due to Fake Testing)

- `AdminSupport.test.tsx`
- `AdminSettings.test.tsx`
- `AdminAudit.test.tsx`
- `AdminFinance.test.tsx`
- `AdminModeration.test.tsx`
- `AdminMarketplace.test.tsx`
- `Sell.test.tsx`
- `AdminAnnouncements.test.tsx`
- `AdminUsers.test.tsx`
- `PersonalInfoSection.test.tsx`
- `DocumentUploadSection.test.tsx`
