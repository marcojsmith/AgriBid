# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: 89.09% statements, 81.27% branches, 82.51% functions, 90.60% lines (Project-wide)
- **Tests Passing**: 816 tests (+53)
- **Target**: 95% across all metrics (Project Thresholds updated to 88/80/80/89)

## Critical Areas (Low Coverage)

1.  `convex/auctions/queries.ts`: 91.84% (Statements)
2.  `src/pages/AuctionDetail.tsx`: 89.47% (target 95%+)
3.  `src/pages/KYC.tsx`: 93.75% (target 98%+)

## Implementation Plan

### Phase 1: Backend "Deep Dive" [DONE]

- [x] **Lib Utilities (`convex/lib/`)**:
  - [x] Refactor `auth.test.ts` to cover all fallback logic and `resolveUserId` edge cases (95% reached).
  - [x] Expand `encryption.test.ts` to include successful encryption/decryption cycles and data integrity checks (98% reached).
- [x] **Queries (`convex/auctions/queries.ts`)**: Increased to 91.84%. Added advanced coverage for index selection, internal stats logic, and reveal rules.

### Phase 2: Frontend Page Integration [DONE]

- [x] **Auction Detail Page**: Increased from 52% to 89.47%.
- [x] **KYC Page**: Cover all form validation states, file upload progress, and API error handling (93.75% reached).
- [x] **Home Page**: Test the interaction between search, category filters, and infinite scrolling (94.73% reached).

### Phase 3: Complex Components & Hooks [DONE]

- [x] **Listing Wizard**: Increased to 90.8%. Full integration for multi-step flow and draft auto-saving.
- [x] **useListingMedia Hook**: Increased to 91.04%. Tested reordering, batch deletions, and upload failure recovery.

### Phase 4: Final Pass - Queries & Navigation [DONE]

- [x] **Advanced Query Pass**: Added `queries_coverage.test.ts` to hit complex internal branches (91.84% reached).
- [x] **Navigation Components**: Reached >97% on `Header.tsx` and `MobileMenu.tsx`.

### Phase 5: Final Audit & Threshold Lock-in [DONE]

- [x] **MetadataCatalog Audit**: Reached 89.33%. Added comprehensive tests for mutations and error states.
- [x] **notifications.tsx lib Audit**: Reached 100%. Added dedicated unit tests for icons and click handling.
- [x] **Threshold Update**: Updated `vitest.config.ts` to 88/80/80/89.
- [x] **Final Sweep**: Remove remaining `as any` and ensure 100% type safety in tests.
- [x] **Target Reached**: Reach 90%+ project-wide for Lines. (Reached 90.60% project-wide)

### Phase 6: Pushing to 95% (In Progress)

- [x] **BiddingPanel.tsx**: Increased to 98.36% Statements, 100% Lines (was 75%).
- [x] **CategoryManager.tsx**: Increased to 97.50% Statements, 97.50% Lines (was 72%).
- [x] **MyListings.tsx**: Increased to 92.72% Statements, 96.07% Lines (was 85%).
- [x] **AuctionDetail.tsx**: Reached 100% Lines (was 89.47%).
- [x] **Home.tsx**: Reached 98.03% Lines (was 94.73%).
- [x] **KYC.tsx**: Reached 96.66% Lines (was 93.75%).

## Progress Log

- **2026-03-12 (Update 8)**:
  - Pushed `AuctionDetail.test.tsx` to 100% Line coverage.
  - Reached target 98%+ on `Home.tsx`.
  - Significant improvement on `KYC.tsx` (96.66%), covering complex file upload and rejection states.
  - Project-wide coverage: 90.96% Statements, 92.12% Lines. (Target 95% project-wide is the next major goal).

- **2026-03-12 (Update 7)**:
  - Successfully targeted low spots: `BiddingPanel.tsx` (now 100% Lines), `CategoryManager.tsx` (now 97.5% Lines), and `MyListings.tsx` (now 96% Lines).
  - Project-wide coverage pushed to 89.09% Statements and 90.60% Lines.
  - Verified 816 tests passing.

- **2026-03-12 (Update 6)**:
