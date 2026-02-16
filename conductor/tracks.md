# Project Tracks

This file tracks all major tracks for the project. Each track has its own detailed plan in its respective folder.

---

## Active Tracks

- [ ] **Track: deploy to vercel**
*Link: [./tracks/vercel_deploy_20260213/](./tracks/vercel_deploy_20260213/)*

- [ ] **Track: Refactor ListingWizard for Modularity**
*Link: [./tracks/listing_wizard_refactor_20260216/](./tracks/listing_wizard_refactor_20260216/)*

---

## Archive

- [x] **Track: Listing Creation & Convex File Storage Integration**
*Link: [./tracks/listing_storage_20260215/](./tracks/listing_storage_20260215/)*

- [x] **Track: Global Navigation & Brand Layout**
*Link: [./tracks/global_nav_layout_20260213/](./tracks/global_nav_layout_20260213/)*

- [x] **Track: Auction Detail Page and Bid Submission Flow**
*Link: [./archive/auction_detail_20260213/](./archive/auction_detail_20260213/)*

- [x] **Track: Seller Listing Flow**
*Link: [./archive/seller_listing_flow_20260213/](./archive/seller_listing_flow_20260213/)*

---

## Minor-tracks to be created
The following items are planned but not yet created. They need to be investigated and addressed as part of the appropriate track/branch.

### General

- [x] **Determine which code files need to be refactored where they exceed 300 lines and plan the refactor**
`app/src/components/ListingWizard.tsx` (990 lines) identified.

### Listing Creation & Convex File Storage Integration
- [x] **Extract duplicate setup steps to reduce duplication**
Completed in `ListingWizard.test.tsx`.

- [x] **Refactor global.fetch mock in tests to avoid pollution**
Completed in `ListingWizard.test.tsx`.

- [x] **Clarify userId index documentation in Brief.md**
Completed in `Brief.md`.

- [x] **Update App.tsx JSDoc to include new /admin route**
Completed in `App.tsx`.

- [x] **Add test for Admin link visibility in Header for admin users**
Completed in `Header.test.tsx`.

- [x] **Refactor ListingWizard image cleanup effect to separate concerns and avoid unnecessary re-subscriptions**
Completed in `ListingWizard.tsx`.

- [x] **Clarify intent of legacy URL check in ListingWizard preview URL fallback**
Completed in `ListingWizard.tsx`.

- [x] **Determine which code files need to be refactored to use the new Convex File Storage API and plan the refactor**
`auctions.ts` queries updated to resolve storage IDs; `ListingWizard.tsx` already uses it.

- [x] **Update the images schema in auctions.ts to make 'additional' optional**
Completed in `auctions.ts`.

- [x] **Handle unused reason parameter in rejectAuction mutation**
Completed in `auctions.ts` (removed unused parameter).

- [x] **Improve RoleProtectedRoute UX by separating unauthenticated and unauthorized cases**
Completed in `RoleProtectedRoute.tsx`.

- [x] **Remove redundant auth checks from AdminDashboard or add comments if intentional**
Completed in `AdminDashboard.tsx`.

- [x] **Refine button disabled logic in AdminDashboard to target only the processing auction**
Completed in `AdminDashboard.tsx`.

- [x] **Simplify avgReviewTime calculation in AdminDashboard by removing unnecessary useMemo**
Completed in `AdminDashboard.tsx`.