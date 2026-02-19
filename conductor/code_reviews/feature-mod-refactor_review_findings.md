# PR Review Findings - Modularization Refactor (Round 2)

## Convex Backend
1. [x] **admin.ts**: Replace live collection scans in `getAdminStats` with indexed filters or transactionally updated counters to avoid full table scans.

## UI & Accessibility
2. [x] **DetailItem.tsx**: Update prop type for `value` to allow `null | undefined` to match runtime nullish check.
3. [x] **ModerationCard.tsx**: Add meaningful `alt` text to the auction image (e.g., `{auction.title} - front view`).
4. [x] **StatCard.tsx**: Consolidate duplicate `StatCard` implementations by adding optional styling props (`padding`, `bgVariant`, `iconSize`) to the shared component.
5. [x] **UserDropdown.tsx**: Fix invalid Tailwind classes `h-4.5` and `w-4.5` on the User icon.
6. [x] **AdminDashboardContent.tsx**: Wire up the Filter Button or mark it as `disabled` with a "coming soon" message.
7. [x] **MarketplaceTab.tsx**: Use visible ID Set for `isAllSelected` and `isPartiallySelected` logic to correctly handle multi-page/filtered selections.
8. [x] **MarketplaceTab.tsx**: Fix `Checkbox` usage by passing `checked={isPartiallySelected ? "indeterminate" : isAllSelected}` and updating `onCheckedChange`.
9. [x] **ModerationTab.tsx**: Remove redundant optional chaining (`?.`) on `pendingAuctions` after the initial guard.
10. [x] **UsersTab.tsx**: Remove redundant interactivity from the "KYC Pending" Badge (keep the "Review KYC" button as the sole action).
11. [x] **UsersTab.tsx**: Add `aria-label` to the icon-only "View details" button.
12. [x] **DocumentUploadSection.tsx**: Add accessible labeling (`id` + `htmlFor` or `aria-label`) to the hidden file Input.
13. [x] **DocumentUploadSection.tsx**: Fix inconsistent indentation around the delete control Button.
14. [x] **PersonalInfoSection.tsx**: Programmatically associate Labels with Input elements using `htmlFor` and `id`.
15. [x] **VerificationStatusSection.tsx**: Provide fallbacks ("N/A" or "—") for missing fields and show an empty state if no documents are verified.

## Logic & Type Safety
16. [x] **useFileUpload.ts**: Add `autoClear` flag to `uploadFiles` to optionally reset `files` state after successful upload.
17. [x] **auction-utils.ts**: Ensure `normalizeAuctionImages` always returns a predictable `additional` array (default to `[]`).
18. [x] **AdminDashboardContext.ts**: Import `React` (or `Dispatch`, `SetStateAction`) to resolve compilation issues.
19. [x] **AdminDashboardProvider.tsx**: Log full error and include more context in toasts within `handleKycReview` and `handleSendAnnouncement`.
20. [x] **AdminDashboardProvider.tsx**: Add explanatory comments for `@ts-expect-error` usage on `usePaginatedQuery`.
21. [x] **SettingsTab.tsx**: Replace placeholder TODOs with GitHub issue links (create issues if necessary).
22. [x] **UsersTab.tsx**: Log specific errors in `verifyUser` catch block and improve toast messages.
23. [x] **KYC.tsx**: Properly validate/sanitize `storageIds` and `existingDocuments` before casting to `Id<"_storage">[]`.
24. [x] **KYC.tsx**: Only seed the form when `myKycDetails` is actually loaded to avoid flashes of empty fields.
25. [x] **useKYCForm.ts**: Update `resetForm` to set `isFormInitialized(true)` to prevent immediate re-hydration from stale `initialData`.

## Documentation & Cleanup
26. [x] **tracks.md**: Add blank lines around "## Active Tracks" heading.
27. [x] **index.md (track)**: Add blank lines around "Status: Completed", "Contents", and "Key Files" headings.
