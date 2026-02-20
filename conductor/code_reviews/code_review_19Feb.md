# PR Review Findings - 19 Feb 2026

1.  [x] **AdminUsers.tsx**: Prevent overlapping KYC fetch requests in `handleReviewKYCClick`.
2.  [x] **users.ts**: Update `listAllProfiles` to have required `paginationOpts` (to satisfy `usePaginatedQuery`), and remove "as any" in `AdminUsers.tsx`.
3.  [x] **App.tsx**: Update route-listing comments to reflect new admin subroutes.
4.  [x] **admin.ts**: Fix N+1 query in `listAnnouncements` by batching `readReceipts` lookups.
5.  [x] **Layout.tsx**: Remove trailing whitespace in `useEffect`.
6.  [x] **AdminAuctions.tsx**: Rename "Total Records" badge to "Loaded Records".
7.  [x] **auctions.ts (backend)**: Make `paginationOpts` required for `getAllAuctions` and remove fallback.
8.  [x] **AdminAuctions.tsx**: Remove "as any" cast for `getAllAuctions`.
9.  [x] **AdminAnnouncements.tsx**: Mirror server-side title/message length validation in `handleSendAnnouncement`.
10. [x] **AdminDialogs.tsx**: Simplify URL validation in KYC document links (remove unnecessary scheme checks).
11. [x] **AdminUsers.tsx**: Clear stale dialog state (`kycRejectionReason`, `showFullId`) when `KycReviewDialog` is closed.
