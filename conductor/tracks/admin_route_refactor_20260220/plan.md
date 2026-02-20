# Plan: Admin Dashboard Route-Based Local State Management

## Phase 1: Preparation & Refactor Structure
- [x] 1. Identify all state currently managed in `AdminDashboardProvider` and mapping to specific views.
- [x] 2. Create `AdminLayout.tsx` as a shared wrapper for admin routes, containing the KPI header.
- [x] 3. Create placeholder route components for each view:
    - [x] `AdminAuctions.tsx`
    - [x] `AdminUsers.tsx` (Handles Users and KYC)
    - [x] `AdminAnnouncements.tsx` (Issue #58)

## Phase 2: Route Component Implementation (Issue #62)
- [x] 4. Refactor `AdminAuctions.tsx`:
    - [x] Move auction-related state (filters, pagination, tabs) to local state.
    - [x] (Issue #56) Implement tabs for "New Approval" vs. "Live Bidding". (Note: Split into AdminModeration and AdminMarketplace)
- [x] 5. Refactor `AdminUsers.tsx`:
    - [x] Move user-related state (search, filters) to local state.
- [x] 6. Refactor Admin KYC functionality (Integrated into AdminUsers.tsx):
    - [x] Move KYC-related state to local state.
- [x] 7. Implement `AdminAnnouncements.tsx` (Issue #58):
    - [x] Add backend queries for announcement listing and stats.
    - [x] Implement UI for listing and creating announcements.

## Phase 3: Navigation & Routing (Issue #57)
- [x] 8. Implement the Sidebar navigation component within `AdminLayout`.
- [x] 9. Update `App.tsx` to handle route-based admin navigation:
    - [x] Define routes for `/admin/auctions`, `/admin/users`, `/admin/kyc`, `/admin/announcements`.
    - [x] Ensure all are wrapped in `RoleProtectedRoute`.
- [x] 10. Update the global `Header.tsx` to link to the new admin routes.

## Phase 4: Cleanup & Finalization
- [x] 11. Decommission and remove `AdminDashboardProvider` and related context logic.
- [x] 12. Cleanup `AdminDashboard.tsx` or refactor it to a simple entry point if needed.
- [x] 13. Remove legacy announcement button and related code from the main admin view.
- [x] 14. Verify all admin functionality is working as expected across all routes.
- [x] 15. Run lint and build to ensure no errors.
