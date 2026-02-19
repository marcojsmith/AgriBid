# PR Review Findings - Modularization Refactor

## UI & Accessibility
1. [x] **App.tsx**: Update `PageLoader` to include accessible loading text (e.g., `sr-only` span or `aria-live` region).
2. [x] **LoadingIndicator.tsx**: Add a screen-reader-only text node (e.g., `<span className="sr-only">Loading</span>`) inside the `role="status"` element.
3. [x] **SettingsCard.tsx**: Make the card focusable and operable via keyboard (`tabIndex={0}`, `role="button"`, `onKeyDown` handler). Ensure an accessible name is present.
4. [x] **MobileMenu.tsx**: Implement a focus trap and handle the 'Escape' key to close the menu.
5. [x] **MobileMenu.tsx**: Fix the grid layout for the admin button to avoid half-width items (e.g., use `col-span-2` for the last item if the count is odd).
6. [x] **DocumentUploadSection.tsx**: Add an `aria-label` to the delete button inside the Badge.
7. [x] **PersonalInfoSection.tsx**: Use semantic HTML types for phone (`type="tel"`) and email (`type="email"`) inputs.
8. [x] **MarketplaceTab.tsx**: Add `aria-label` to the row checkboxes (e.g., "Select auction {title}").
9. [x] **MarketplaceTab.tsx**: Add an empty-state row to the table when `filteredAuctions` is empty.
10. [x] **MarketplaceTab.tsx**: Support `indeterminate` state for the master checkbox.
11. [x] **UsersTab.tsx**: Add an empty-state row to the table when `filteredUsers` is empty.

## Logic & Type Safety
12. [x] **KYC.tsx**: Remove unused `isMounted` ref and its related `useEffect`.
13. [x] **KYC.tsx**: Fix type mismatch for `allDocuments` by ensuring `existingDocuments` and `storageIds` are correctly typed as `Id<"_storage">[]` before combining.
14. [x] **Profile.tsx**: Guard the `isOwner` check with the loading state of `myProfile` to avoid UI flicker.
15. [x] **DetailItem.tsx**: Use nullish coalescing (`??`) instead of logical OR (`||`) for the value fallback.
16. [x] **EmptyState.tsx**: Make the subtitle configurable via an optional prop with a default value.
17. [x] **ModerationCard.tsx**: Use an explicit locale (`"en-ZA"`) for `startingPrice.toLocaleString()`.
18. [x] **SettingsCard.tsx**: Extract the inline prop type into a named interface `SettingsCardProps`.
19. [x] **AuctionCardThumbnail.tsx**: Conditionally render the `CountdownTimer` block only when `isCompact` is true.
20. [x] **useFileUpload.ts**: Remove redundant `setIsUploading(false)` call in the failure branch (it's already in `finally`).
21. [x] **AdminDialogs.tsx**: Trim `kycRejectionReason` before checking if it's empty for the Reject button's `disabled` state.
22. [x] **AdminDialogs.tsx**: Disable the Broadcast button when title/message are empty, and add a guard in `handleSendAnnouncement`.
23. [x] **AdminDashboardContext.ts**: Extract shared profile fields (`name`, `email`, `image`) into a `BaseProfileFields` type.
24. [x] **AdminDashboardContext.ts**: Use specific return types (or `Promise<void>`) instead of `Promise<any>` for action methods.
25. [x] **AdminDashboardProvider.tsx**: Validate the shape of `fullProfile` before calling `setKycReviewUser`.
26. [x] **AdminDashboardProvider.tsx**: Use authoritative aggregate counts from the backend for `stats` instead of deriving them from paginated arrays.
27. [x] **AdminDashboardProvider.tsx**: Replace `any` casts in `usePaginatedQuery` with strongly-typed wrappers or correct parameter types.
28. [x] **ModerationTab.tsx**: Show a loading indicator instead of returning `null` when `pendingAuctions` is undefined.
29. [x] **ModerationTab.tsx**: Log the specific error in the catch blocks for `onApprove` and `onReject`.
30. [x] **SettingsTab.tsx**: Replace placeholder toasts with real navigation paths or `TODO` markers.
31. [x] **UsersTab.tsx**: Change `setPromoteTarget` to accept `AdminProfile` instead of `KycReviewUser` to avoid unsafe casts.
32. [x] **useKYCFileUpload.ts**: Use a functional updater for `setExistingDocuments` in `executeDeleteDocument` to avoid race conditions and stale state.
33. [x] **useKYCForm.ts**: Add format validation helpers for phone numbers and ID numbers.
34. [x] **UserDropdown.tsx**: Wrap `onSignOut` call in a handler that catches and reports rejections.
35. [x] **UserDropdown.tsx**: Add `gap-2` to the Sign Out menu item for consistent icon/text spacing.

## Documentation & Cleanup
36. [x] **BidForm.test.tsx**: Update the top-of-file comment path and verify the import path.
37. [x] **BidForm.tsx**: Update the top-of-file comment path to `app/src/components/bidding/BidForm.tsx`.
38. [x] **BidHistory.tsx**: Update the top-of-file comment path.
39. [x] **tracks.md**: Reconcile track status with `metadata.json` (set both to "completed").
40. [x] **tracks.md**: Add a blank line before the "## Archive" heading.
41. [x] **react.md**: Add guidance on when to use external state libraries (Redux/Zand).
42. [x] **react.md**: Add rule on when to use the full feature directory structure vs. simpler patterns.
43. [x] **react.md**: Add repo-relative paths/links to canonical examples.
44. [x] **index.md (track)**: Add a blank line after "## Status: In Progress".
45. [x] **spec.md (track)**: Ensure all headings have surrounding blank lines.
