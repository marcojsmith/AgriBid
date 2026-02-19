# PR Review Findings - Modularization Refactor (Round 4)

## Convex Backend
1. [ ] **admin.ts**: Replace live collection scans in `getAdminStats` with a production-ready aggregate approach (precomputed count documents) to avoid full index/table scans.

## UI & Accessibility
2. [ ] **App.tsx**: Remove redundant `sr-only` span in `PageLoader` and rely on `LoadingIndicator`'s internal accessibility.
3. [ ] **MobileMenu.tsx**: Capture and restore the previously focused element when opening/closing the menu. Harden focus-trap logic with length checks.
4. [ ] **UserDropdown.tsx**: Surface a user-visible error (e.g., toast) when sign-out fails, in addition to logging.
5. [ ] **SettingsTab.tsx**: Add `noopener,noreferrer` to `window.open` calls for security.
6. [ ] **MarketplaceTab.tsx**: Memoize selection helpers (`selectedSet`, `visibleSelectedCount`, `isAllSelected`, `isPartiallySelected`) using `useMemo`.
7. [ ] **UsersTab.tsx**: Add a per-user "verifying" state to the Verify button to prevent double-clicks.
8. [ ] **UsersTab.tsx**: Track `fetchingKycUserId` separately to reliably show the loading spinner for the row being fetched.
9. [ ] **UsersTab.tsx**: Wire up the "View details" button to a real route (or remove if not supported).
10. [ ] **VerificationStatusSection.tsx**: Avoid trailing space in name display when `lastName` is empty.
11. [ ] **VerificationStatusSection.tsx**: Simplify `hasDocs` expression using `!!myKycDetails.kycDocuments?.length`.

## Logic & Type Safety
12. [ ] **useFileUpload.ts**: Log failures from `deleteUpload` in the fallback cleanup path within `performCleanup`.
13. [ ] **KYC.tsx**: Remove misleading type predicates (`id is Id<"_storage">`) and use explicit casts or comments for branded types.
14. [ ] **useKYCFileUpload.ts**: Collect and log errors from `deleteMyKYCDocument` within the `cleanupHandler`.
15. [ ] **useKYCForm.ts**: Implement robust ID number validation (YYMMDD date check and Luhn checksum).

## Documentation
16. [ ] **react.md**: Add a blank line before "### 2. State Management" heading.
