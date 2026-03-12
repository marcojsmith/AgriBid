# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: 84.82% statements, 77.65% branches, 75.38% functions, 86.15% lines (Project-wide)
- **Tests Passing**: 725 tests
- **Target**: 95% across all metrics (Project Thresholds updated to 84/77/75/86)

## Critical Areas (Low Coverage)

1.  `convex/auctions/queries.ts`: 71.31% (Statements)
2.  `src/components/header/Header.tsx`: 65.21%
3.  `src/components/header/MobileMenu.tsx`: 55.81%

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

### Phase 4: Final Pass - Queries & Navigation [PARTIAL]
- [x] **Advanced Query Pass**: Added `queries_coverage.test.ts` to hit complex internal branches (71.31% reached).
- [ ] **Navigation Components**: Reach >90% on `Header.tsx` and `MobileMenu.tsx`.

### Phase 5: Final Audit & Threshold Lock-in
- [x] **Threshold Update**: Updated `vitest.config.ts` to 84/77/75/86.
- [ ] **Final Sweep**: Remove remaining `as any` and ensure 100% type safety in tests.
- [ ] **Target Reached**: Reach 95% project-wide.

## Progress Log

- **2026-03-12 (Update 3)**:
    - Reached 84.82% project-wide.
    - `queries.ts` increased to 71.31% via `queries_coverage.test.ts`.
    - Resolved more TS/Lint issues in test files.
    - Updated thresholds in `vitest.config.ts`.
