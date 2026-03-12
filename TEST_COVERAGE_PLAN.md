# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: 85.63% statements, 78.33% branches, 76.08% functions, 87.01% lines (Project-wide)
- **Tests Passing**: 737 tests
- **Target**: 95% across all metrics (Project Thresholds updated to 85/78/76/87)

## Critical Areas (Low Coverage)

1.  `convex/auctions/queries.ts`: 71.31% (Statements)
2.  `src/lib/notifications.tsx`: 25% (Needs dedicated integration test)
3.  `src/components/admin/MetadataCatalog.tsx`: 61.33%

## Implementation Plan

### Phase 1: Backend "Deep Dive" [DONE]
- [x] **Lib Utilities (`convex/lib/`)**:
    - [x] Refactor `auth.test.ts` to cover all fallback logic and `resolveUserId` edge cases (95% reached).
    - [x] Expand `encryption.test.ts` to include successful encryption/decryption cycles and data integrity checks (98% reached).
- [x] **Queries (`convex/auctions/queries.ts`)**: Increased to 71.31%. Added advanced coverage for index selection, internal stats logic, and reveal rules.

### Phase 2: Frontend Page Integration [DONE]
- [x] **Auction Detail Page**: Increased from 52% to 89.47%.
- [x] **KYC Page**: Cover all form validation states, file upload progress, and API error handling (93.75% reached).
- [x] **Home Page**: Test the interaction between search, category filters, and infinite scrolling (94.73% reached).

### Phase 3: Complex Components & Hooks [DONE]
- [x] **Listing Wizard**: Increased to 90.8%. Full integration for multi-step flow and draft auto-saving.
- [x] **useListingMedia Hook**: Increased to 91.04%. Tested reordering, batch deletions, and upload failure recovery.

### Phase 4: Final Pass - Queries & Navigation [DONE]
- [x] **Advanced Query Pass**: Added `queries_coverage.test.ts` to hit complex internal branches (71.31% reached).
- [x] **Navigation Components**: Reached >97% on `Header.tsx` and `MobileMenu.tsx`.

### Phase 5: Final Audit & Threshold Lock-in [IN PROGRESS]
- [x] **Threshold Update**: Updated `vitest.config.ts` to 85/78/76/87.
- [ ] **Final Sweep**: Remove remaining `as any` and ensure 100% type safety in tests.
- [ ] **Target Reached**: Reach 95% project-wide.

## Progress Log

- **2026-03-12 (Update 4)**:
    - Reached 85.63% project-wide.
    - `Header.tsx` (>99%), `MobileMenu.tsx` (>97%).
    - Locked new thresholds in `vitest.config.ts`.
