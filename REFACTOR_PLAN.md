# Plan: Recreate Lost Changes — `chore/refactor-auction-mutations`

## Context

The branch `chore/refactor-auction-mutations` had 4 commits worth of changes (barrel file removal, import path updates, type safety improvements, new utility files, new tests) that were permanently lost due to `git reset --hard`. This plan recreates those changes systematically.

---

## ✅ Completed

### 1. Enable Strict TypeScript ESLint

- [x] `eslint.config.js`: Uncommented `tseslint.configs.strictTypeChecked` + `tseslint.configs.stylisticTypeChecked`

### 2. Delete Barrel Files + Update Import Paths

- [x] Deleted `convex/auctions/index.ts`
- [x] Deleted `convex/auctions/mutations/index.ts`
- [x] Updated `convex/auctions/adminUpdate.test.ts` → `"./mutations"` → `"./mutations/update"`
- [x] Updated `convex/auctions/approval.test.ts` → `"./mutations"` → `"./mutations/publish"`
- [x] Updated `convex/auctions/bulkUpdate.test.ts` → `"./mutations"` → `"./mutations/update"`
- [x] Updated `convex/auctions/closeAuctionEarly.test.ts` → `"./mutations"` → `"./mutations/publish"`
- [x] Updated `convex/auctions/deleteConditionReport.test.ts` → `"./mutations"` → `"./mutations/delete"`
- [x] Updated `convex/auctions/deleteDraft.test.ts` → `"./mutations"` → `"./mutations/delete"`
- [x] Updated `convex/auctions/publishAuction.test.ts` → `"./mutations"` → `"./mutations/publish"`
- [x] Updated `convex/auctions/updateAuction.test.ts` → `"./mutations"` → `"./mutations/update"`
- [x] Updated `convex/auctions/updateConditionReport.test.ts` → `"./mutations"` → `"./mutations/update"`
- [x] Updated `convex/auctions/dismissFlag.test.ts` → `"./mutations"` → `"./mutations/publish"`
- [x] Updated `convex/auctions/flagAuction.test.ts` → `"./mutations"` → `"./mutations/publish"`
- [x] Updated `convex/auctions/mutations_branch.test.ts` → split imports across `create`, `update`, `delete`, `publish`

### 3. New Test Files Created

- [x] `src/components/DashboardListSkeleton.test.tsx` — Created
- [x] `src/contexts/createTypedContext.test.tsx` — Created
- [x] `src/components/admin/confirmResolveTicket.ts` — Created
- [x] `src/components/admin/confirmResolveTicket.test.ts` — Created

### 4. SupportTab Refactor

- [x] `src/components/admin/SupportTab.tsx` — Uses `confirmResolveTicket` utility
- [x] `src/components/admin/SupportTab.test.tsx` — Updated for refactored component

### 5. Type Safety Improvements

- [x] `convex/auctions/dismissFlag.test.ts` — Updated import path
- [x] `convex/auctions/flagAuction.test.ts` — Updated import path
- [x] `convex/auctions/mutations_branch.test.ts` — Split imports across modules
- [x] `src/contexts/createTypedContext.ts` — Added `Context.displayName`
- [x] `src/components/ui/skeleton.tsx` — Added `data-testid` prop forwarding
- [x] `src/components/DashboardListSkeleton.tsx` — Added `data-testid` attributes

---

## 🔲 Pending

### Run Verification

- [x] `bun run lint` — Passes (0 errors, 540 warnings)
- [x] `bun run test --run` — All 1713 tests pass
- [x] `bun run build` — Succeeds

### Commit Strategy (4 Commits)

#### Commit 1: `refactor(auctions): remove barrel re-exports and update import paths`

> Removes `convex/auctions/index.ts` and `convex/auctions/mutations/index.ts`. Updates all test files and source files that imported from these barrels to use direct module paths.

#### Commit 2: `fix(tests): improve type safety in auction and auth test files`

> Converts `type` aliases to `interface` where appropriate. Removes `eslint-disable` and `@ts-expect-error` suppressions. Fixes type safety issues across test files.

#### Commit 3: `feat(admin): extract confirmResolveTicket utility and add tests`

> Extracts the `confirmResolve` function from `SupportTab.tsx` into a standalone `confirmResolveTicket.ts` utility. Updates `SupportTab.tsx` to use the extracted utility. Creates comprehensive tests.

#### Commit 4: `test: add coverage for DashboardListSkeleton and createTypedContext`

> Adds unit tests for `DashboardListSkeleton` component and `createTypedContext` utility function.

---

## Notes

- **Strict ESLint**: Temporarily enabled during development to catch type issues. Reverted to `recommended` before committing per AGENTS.md workflow.
- **Recovery attempt**: The 4 commits were lost forever. Files were manually recreated based on documented changes.
- **All tests pass**: Verify `bun run test --run` before each commit.
- **NO `eslint-disable`**: Per AGENTS.md, do NOT add any suppression comments. Refactor to comply instead.
- **Lint passes**: 0 errors, 540 warnings (all pre-existing in codebase).
