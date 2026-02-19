# PR Review Findings - Modularization Refactor (Round 7)

## Convex Backend
1. [x] **admin_utils.ts**: Clamp initial delta to 0 in `updateCounter` insert path to avoid negative starts.
2. [x] **admin.ts**: Unify `auctions` and `profiles` counter initialization with consistent fields (0-initialized).
3. [x] **auctions.ts**: Add status-delta logic to `adminUpdateAuction` to keep counters consistent on single status changes.
4. [x] **users.ts**: Fix `verifyUser` to skip patch/counter-update if user is already verified (prevent double-counting).

## UI & Accessibility
5. [x] **App.tsx**: Remove redundant `aria-live="polite"` from the wrapper div around `LoadingIndicator`.
6. [x] **MobileMenu.tsx**: Filter out disabled/hidden elements from the focus trap logic.
7. [x] **MobileMenu.tsx**: Only render status line/name when `userData` is loaded to avoid "Unverified" flash.
8. [x] **AdminDashboardContent.tsx**: Move KPI stats grid into `AdminLayout` for global admin visibility.
9. [x] **AdminDashboardContent.tsx**: Unify `TabsContent` usage (either all internal or all external).
10. [x] **MarketplaceTab.tsx**: Remove unused `visibleSelectedCount` from `useMemo` return.
11. [x] **KYC.tsx**: Await `executeDeleteDocument` in `AlertDialogAction` and handle errors in a try/catch block.

## Logic & Type Safety
12. [x] **useKYCForm.ts**: Prioritize `initialData.confirmEmail` if present.
13. [x] **useKYCForm.ts**: Move required-field check (names) to the start of `validate()`.
14. [x] **useFileUpload.ts**: Detect authorization failures in `performCleanup` and log specific warnings for missing `cleanupHandler`.
15. [x] **Currency Formatting**: Extract a shared `formatCurrency` utility (en-ZA, ZAR) and use consistently across `ModerationCard` and `MarketplaceTab`.
