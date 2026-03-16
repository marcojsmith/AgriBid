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

---

## Phase 5: Increase Branch Coverage to >95% (Current: 89.23%)

To push branch coverage past the 95% threshold, we must specifically target the logical branches (if/else statements, ternaries, logical OR/AND fallbacks) that are currently untested in our complex modules.

### Target 1: Core Convex Mutations & Queries

These files have low branch coverage due to complex conditional checks (e.g., authorization, data presence, optional fields, error paths).

- **`convex/auctions/mutations.ts` (Current: 72.81%)**
  - _Strategy:_ Add unit tests that trigger the missing `if` branches and error checks.
  - _Key Branches to Test:_
    - Early returns and specific `ConvexError` throws for invalid `auctionId` or missing records.
    - Conditional state merges when auction status is `pending_review` vs. `draft`.
    - Handling of optional fields like capping additional images (e.g., `images.additional.length > 6`).

- **`convex/auctions/queries.ts` (Current: 81.81%)**
  - _Strategy:_ Add tests for queries with different filter combinations, pagination states, and null-coalescing operations.
  - _Key Branches to Test:_
    - Queries returning empty arrays or `null`.
    - Conditional filter applications (e.g., searching by specific categories or text vs. no filters).
    - Null-handling for joined references (e.g., when a user or metadata record is missing).

- **`convex/watchlist.ts` (Current: 73.52%)**
  - _Strategy:_ Test edge cases when removing items not in the watchlist, or adding items that already exist in the user's watchlist.

- **`convex/users.ts` (Current: 91.46%)**
  - _Strategy:_ Test conditional logic involving partial user profiles, admin promotions/demotions with edge-case inputs, and gracefully handling missing records.

### Target 2: Listing Wizard & UI Components

UI components often lack branch coverage for optional props, empty states, and loading states.

- **`src/components/listing-wizard/hooks/useListingMedia.ts` (Current: 79.16%)**
  - _Strategy:_ Test error branches such as file upload rejections, exceeding maximum file limits, and errors during image deletion.

- **`src/components/listing-wizard/ListingWizard.tsx` (Current: 83.92%)**
  - _Strategy:_ Test all step navigation branches (e.g., attempting to skip steps without validation, going back from the first step, and edge cases around draft saving failure).

- **`src/components/bidding/BidHistory.tsx` (Current: 81.48%) & `src/components/auction/AuctionCard.tsx` (Current: 86.15%)**
  - _Strategy:_ Render the components with empty or minimal props. Test ternary operators (e.g., showing fallback UI when `highestBid` is null, or adjusting styling when the auction is ended vs. active).

### Execution Strategy

1. **Analyze:** Use the HTML coverage report (`coverage/index.html`) to visually identify the exact un-highlighted lines (branches) for the files listed above.
2. **Draft Tests:** For each identified `if`, `?`, or `||`, write a focused test case that explicitly triggers the condition to evaluate to both `true` and `false`. Ensure edge cases like nulls, undefined, and empty arrays are explicitly passed to components/functions.
3. **Verify:** Re-run the coverage report for the targeted file to confirm the branch is hit (e.g., `bun run test --run convex/auctions/mutations.test.ts --coverage`).
4. **Lock:** Once overall branch coverage reaches 95%, update `vitest.config.ts` to enforce a minimum of `95` for the `branches` threshold.
