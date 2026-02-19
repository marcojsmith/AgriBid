# PR Review Findings - Modularization Refactor (Round 3)

## Round 3 New Items
1. [x] **MobileMenu.tsx**: Update `onSignOut` catch block to log or handle errors instead of remaining empty.
2. [x] **useFileUpload.ts**: Modify to accept an injected `cleanupHandler` option. This ensures non-admin flows (like KYC) don't try to use the admin-only `deleteUpload` mutation.
3. [x] **AdminDashboardProvider.tsx**: Implement `isKycProcessing` state to track active KYC review operations.
4. [x] **AdminDialogs.tsx**: Use `isKycProcessing` to disable Approve/Reject buttons and prevent double-submits.
5. [x] **MarketplaceTab.tsx**: Switch to `checked="indeterminate"` (tri-state) instead of the non-existent `indeterminate` prop, and remove the `@ts-expect-error`.

## Previous Rounds (Verified/Completed)
- [x] Convex: Optimized `getAdminStats` with indexed filters.
- [x] UI: Consolidated `StatCard`, fixed `UserDropdown` classes, added `alt` text.
- [x] A11y: Programmatic labels in `PersonalInfoSection`, `aria-labels` on buttons.
- [x] Logic: `autoClear` in `useFileUpload`, `isFormInitialized` fix in `useKYCForm`.
- [x] Types: Branded type validation for storage IDs in `KYC.tsx`, removed `any` where possible.
