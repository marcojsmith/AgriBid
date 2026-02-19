# Plan: Admin Dashboard Route-Based Local State Management

## Phase 1: Preparation & Refactor Structure
- [ ] 1. Identify all state currently managed in `AdminDashboardProvider` and mapping to specific views.
- [ ] 2. Create `AdminLayout.tsx` as a shared wrapper for admin routes, containing the KPI header.
- [ ] 3. Create placeholder route components for each view:
    - [ ] `AdminAuctions.tsx`
    - [ ] `AdminUsers.tsx`
    - [ ] `AdminKyc.tsx`
    - [ ] `AdminAnnouncements.tsx` (Issue #58)

## Phase 2: Route Component Implementation (Issue #62)
- [ ] 4. Refactor `AdminAuctions.tsx`:
    - [ ] Move auction-related state (filters, pagination, tabs) to local state.
    - [ ] (Issue #56) Implement tabs for "New Approval" vs. "Live Bidding".
- [ ] 5. Refactor `AdminUsers.tsx`:
    - [ ] Move user-related state (search, filters) to local state.
- [ ] 6. Refactor `AdminKyc.tsx`:
    - [ ] Move KYC-related state to local state.
- [ ] 7. Implement `AdminAnnouncements.tsx` (Issue #58):
    - [ ] Add backend queries for announcement listing and stats.
    - [ ] Implement UI for listing and creating announcements.

## Phase 3: Navigation & Routing (Issue #57)
- [ ] 8. Implement the Sidebar navigation component within `AdminLayout`.
- [ ] 9. Update `App.tsx` to handle route-based admin navigation:
    - [ ] Define routes for `/admin/auctions`, `/admin/users`, `/admin/kyc`, `/admin/announcements`.
    - [ ] Ensure all are wrapped in `RoleProtectedRoute`.
- [ ] 10. Update the global `Header.tsx` to link to the new admin routes.

## Phase 4: Cleanup & Finalization
- [ ] 11. Decommission and remove `AdminDashboardProvider` and related context logic.
- [ ] 12. Cleanup `AdminDashboard.tsx` or refactor it to a simple entry point if needed.
- [ ] 13. Remove legacy announcement button and related code from the main admin view.
- [ ] 14. Verify all admin functionality is working as expected across all routes.
- [ ] 15. Run lint and build to ensure no errors.
