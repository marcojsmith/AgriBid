# PR Review Findings - Modularization Refactor (Round 5)

## Convex Backend
1. [ ] **admin.ts**: Replace `.collect().then(res => res.length)` in `initializeCounters` with a safe counting approach (pagination loop or count aggregator).
2. [ ] **admin_utils.ts**: Fix the initialization branch in `updateCounter` to set `total: delta` whenever `field === "total"`, regardless of the counter name.
3. [ ] **admin_utils.ts**: In `updateCounter`, detect and log a warning if a value would go below zero before clamping to 0.
4. [ ] **auctions.ts**: Update bulk-update counter logic to handle all relevant statuses (sold, unsold, rejected, draft) using a status-to-counter-key map.

## UI & Accessibility
5. [ ] **Header.tsx / MobileMenu.tsx**: Memoize `onClose` with `useCallback` in `Header.tsx` to prevent `previousFocus` from being clobbered in `MobileMenu`.
6. [ ] **UsersTab.tsx**: Change `isFetchingKYC` to a per-user state to allow concurrent KYC reviews.

## Logic & Type Safety
7. [ ] **useFileUpload.ts**: Ensure consistent non-throwing behavior in `performCleanup` by wrapping `cleanupHandler` in try/catch and logging errors.
8. [ ] **useKYCForm.ts**: Add an inline comment documenting the 2-digit year ambiguity and its 100-year limitation for KYC purposes.

## Round 4 (Verified/Completed)
- [x] Backend: Aggregate counter system implemented.
- [x] A11y: MobileMenu focus/trap hardened.
- [x] Logic: Robust SA ID validation.
- [x] UX: Per-user verifying state in UsersTab.
