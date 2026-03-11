# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: ~76% statements, ~69% branches, ~68% functions, ~77% lines (Project-wide)
- **Tests Passing**: 635 tests
- **Target**: 95% across all metrics (Project Threshold)

### Key File Coverage (Statements)

- `convex/config.ts`: 97.22%
- `convex/support.ts`: 93.54%
- `convex/lib/encryption.ts`: 93.44%
- `convex/auctions/mutations.ts`: 92.12%
- `convex/notifications.ts`: 89.32%
- `convex/auctions/internal.ts`: 87.93%
- `convex/admin_utils.ts`: 86.84%
- `convex/auctions/proxy_bidding.ts`: 85.86%
- `convex/auctions/bidding.ts`: 85.71%
- `convex/lib/auth.ts`: 83.75%
- `convex/watchlist.ts`: 80.51%

---

## Coverage Gap Analysis

Phase 8 has been completed, pushing global coverage to ~82%. The remaining gap is concentrated in:

- `convex/auctions/queries.ts` (~67%)
- `convex/auth.ts` (~19%)
- `convex/users.ts` (~11%)
- `convex/presence.ts` (~9%)

The strategy of extracting logic into named handlers has proven successful for the backend.

---

## Phase 1-8: Completed

- [x] **Phase 1: Fix Failing Tests**
- [x] **Phase 2: Frontend Component Unit Tests**
- [x] **Phase 3: Lib/Utility Tests**
- [x] **Phase 4: Hook Logic Tests**
- [x] **Phase 5: Page Integration Tests**
- [x] **Phase 6: Mutations, Auth (lib), and Admin Utils**
  - `convex/auctions/mutations.ts`, `convex/lib/auth.ts`, `convex/admin_utils.ts`, `convex/config.ts`, `convex/lib/encryption.ts`.
- [x] **Phase 7: Bidding and Queries (Initial)**
  - `convex/auctions/bidding.ts`, `convex/auctions/proxy_bidding.ts`, `convex/auctions/queries.ts` (partial).
- [x] **Phase 8: Notifications, Support, and Watchlist**
  - `convex/notifications.ts`, `convex/support.ts`, `convex/watchlist.ts`.

---

## Phase 9: Users and Auth (Current)

Target: Increase `convex/users.ts` and root `convex/auth.ts` coverage.

- [ ] **9.1** `convex/users.ts`: Test refactored handlers (`syncUser`, `submitKYC`, `verifyUser`, etc.).
- [ ] **9.2** `convex/auth.ts`: Test BetterAuth integration and session handling.
- [ ] **9.3** `convex/auctions/queries.ts`: Close the remaining 30% gap.

---

## Phase 10: Real-Time & Final Audit

Target: >95% Project-wide

- [ ] **10.1** `convex/presence.ts` (Currently 9%)
- [ ] **10.2** Root `convex/http.ts` and `convex/crons.ts`.
- [ ] **10.3** Final coverage sweep for all `src/components/`.

---

## Verification Protocol

1.  **Run Coverage**: `bun run test:coverage`
2.  **Increase Thresholds**: Update `vitest.config.ts` thresholds incrementally.
3.  **Lint & Build**: `bun run lint` and `bun run build`.
4.  **Commit & Push**: Ensure all tests pass and coverage thresholds are met.
5.  **Check Thresholds**: Ensure `vitest.config.ts` thresholds are met (95%).
