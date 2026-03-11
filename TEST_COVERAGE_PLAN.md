# Test Coverage Plan: 95% Target

## Current State

- **Current Coverage**: ~58% statements, ~56% branches, ~58% functions, ~59% lines
- **Tests Passing**: 370+ tests
- **Target**: 95% across all metrics (Project Threshold)

---

## Coverage Gap Analysis

Despite completing Phases 1-4, overall coverage remains at ~56-59% across metrics. The remaining ~36-39 percentage points to reach the 95% target are distributed across:

### Uncovered Areas by Phase

| Phase | Area                     | Current Coverage | Gap to 95% | Estimated Delta |
| ----- | ------------------------ | ---------------- | ---------- | --------------- |
| 5     | Page Integration Tests   | ~70%             | ~25%       | +10-15%         |
| 6     | Core Backend (convex/)   | ~56%             | ~39%       | +15-20%         |
| 7     | Complex Components       | ~63%             | ~32%       | +8-12%          |
| 8     | UI Components & Branches | Varies           | ~20%       | +5-8%           |

### Additional Work Required Beyond Phase 5

1.  **More Page Tests**: Dashboard/Admin/KYC pages currently have minimal coverage
2.  **E2E/Integration Tests**: Auth flows, real-time bidding scenarios
3.  **Backend Unit Tests**: Convex mutations, auth logic, encryption utilities
4.  **Mutation/Edge-Case Tests**: Error handling, race conditions, boundary values
5.  **Branch Coverage Polish**: Target all uncovered lines in coverage report

The Phase 5 entries (MyBids, MyListings, AdminDashboard, KYC, Profile, Watchlist, Notifications, Support) will contribute approximately **+10-15%** toward the 95% target. Full coverage of Phases 6-8 will be needed to close the remaining gap.

---

## Phase 1-4: Completed

- [x] Phase 1: Fix Failing Tests
- [x] Phase 2: Frontend Component Unit Tests (Standard)
- [x] Phase 3: Lib/Utility Tests
- [x] Phase 4: Hook Logic Tests

---

## Phase 5: Page Integration Tests (Remaining)

Target: `src/pages/` coverage from ~70% to >95%

- [ ] **5.1** `MyBids.test.tsx` (Dashboard Bids)
- [ ] **5.2** `MyListings.test.tsx` (Dashboard Listings)
- [ ] **5.3** `AdminDashboard.test.tsx`
- [ ] **5.4** `KYC.test.tsx`
- [ ] **5.5** `Profile.test.tsx`
- [ ] **5.6** `Watchlist.test.tsx`
- [ ] **5.7** `Notifications.test.tsx`
- [ ] **5.8** `Support.test.tsx`

---

## Phase 6: Core Backend & Logic

Target: `convex/` coverage from ~56% to >95%

- [ ] **6.1** `convex/auctions/mutations.ts` (Large blocks 415-1204: bidding, creation, updates)
- [ ] **6.2** `convex/lib/auth.ts` (Currently 1.25%)
- [ ] **6.3** `convex/lib/encryption.ts` (Currently 18%)
- [ ] **6.4** `convex/auctions/internal.ts` (Currently 42%)
- [ ] **6.5** `convex/config.ts` (Currently 22%)

---

## Phase 7: Complex & Real-Time Components

Target: `src/components/` coverage from ~63% to >95%

- [ ] **7.1** `MetadataCatalog.tsx` (Admin Catalog Management - Currently 10%)
- [ ] **7.2** `MobileMenu.tsx` (Currently 25%)
- [ ] **7.3** `NotificationListener.tsx` & `PresenceListener.tsx` (Real-time sync)
- [ ] **7.4** `BiddingPanel.tsx` & `BidForm.tsx` (Edge cases, outbid alerts, proxy bidding)
- [ ] **7.5** `ListingWizard.tsx` (Deep integration with all steps and context)

---

## Verification Protocol

1.  **Run Coverage**: `bun run test:coverage`
2.  **Increase Thresholds**: Update `vitest.config.ts` thresholds incrementally as coverage improves.
3.  **Lint & Build**: `bun run lint` and `bun run build`.
4.  **Commit & Push**: Ensure all tests pass and coverage thresholds are met before pushing.
5.  **Iterate**: Address uncovered lines, add tests, and repeat until 95% is achieved.
6.  **Check Thresholds**: Ensure `vitest.config.ts` thresholds are met (95%).
