# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: 83.65% statements, 76.43% branches, 73.28% functions, 85.09% lines (Project-wide)
- **Tests Passing**: 692 tests
- **Target**: 95% across all metrics (Project Thresholds updated to 83/76/73/85)

## Critical Areas (Low Coverage)

1.  `convex/auctions/queries.ts`: 66.05% (Statements)
2.  `src/pages/KYC.tsx`: 70.31%
3.  `src/pages/Home.tsx`: 82.45%
4.  `src/components/header/Header.tsx`: 65.21%
5.  `src/components/header/MobileMenu.tsx`: 55.81%

## Implementation Plan

### Phase 1: Backend "Deep Dive" [DONE]

- [x] **Lib Utilities (`convex/lib/`)**:
  - [x] Refactor `auth.test.ts` to cover all fallback logic and `resolveUserId` edge cases (95% reached).
  - [x] Expand `encryption.test.ts` to include successful encryption/decryption cycles and data integrity checks (98% reached).
- [x] **Queries (`convex/auctions/queries.ts`)**: Initial pass completed, complex filters and batching still need deeper coverage.

### Phase 2: Frontend Page Integration [PARTIAL]

- [x] **Auction Detail Page**: Increased from 52% to 89.47%. Tested flagging system and condition reports.
- [ ] **KYC Page**: Cover all form validation states, file upload progress, and API error handling (Currently 70%).
- [ ] **Home Page**: Test the interaction between search, category filters, and infinite scrolling (Currently 82%).

### Phase 3: Complex Components & Hooks [PARTIAL]

- [x] **Listing Wizard**: Increased to 90.8%. Full integration for multi-step flow and draft auto-saving.
- [x] **useListingMedia Hook**: Increased to 91.04%. Tested reordering, batch deletions, and upload failure recovery.

### Phase 4: Final Audit & Threshold Lock-in

- [x] **Threshold Update**: Updated `vitest.config.ts` to 83/76/73/85.
- [ ] **Final Sweep**: Remove remaining `as any` and ensure 100% type safety in tests.
- [ ] **Target Reached**: Reach 95% project-wide.

## Progress Log

- **2026-03-12**:
  - Reached 83.65% project-wide.
  - `auth.ts` (95%), `encryption.ts` (98%), `AuctionDetail.tsx` (89%), `ListingWizard.tsx` (90%).
  - Resolved 40+ lint/build errors in tests.
  - Updated thresholds in `vitest.config.ts`.
