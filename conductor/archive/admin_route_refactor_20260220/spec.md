# Specification: Admin Dashboard Route-Based Local State Management

## Goal
Convert the admin dashboard from a shared context (`AdminDashboardProvider`) to route-based local state management to improve modularity and maintainability.

## Current State
- `AdminDashboard.tsx` manages a large shared state via `AdminDashboardProvider`.
- All admin views (Auctions, Users, KYC, etc.) are rendered within a single tabbed interface.
- State is shared across all tabs, even when not needed.
- URL does not reflect the active tab.

## Desired State
- Separate route components for each admin view:
  - `/admin/auctions`
  - `/admin/users`
  - `/admin/kyc`
  - `/admin/notifications` (Issue #58)
- Each route component manages its own local state (filters, pagination, etc.).
- `AdminDashboardProvider` is decommissioned.
- A shared `AdminLayout` provides the common KPI header and navigation.
- The router in `App.tsx` handles the per-route rendering.

## Requirements
- Maintain existing functionality for each admin view.
- Ensure the KPI header remains visible across all admin routes.
- Use `RoleProtectedRoute` to ensure only admins can access these routes.
- (Issue #57) Implement a sidebar for navigation between admin pages.
- (Issue #56) Separate auction approval and live bidding into separate tabs/pages.
- (Issue #58) Create a dedicated announcements page.

## Related Issues
- #62: Refactor to Route-Based Local State
- #57: Sidebar Navigation
- #56: Separate Auction Approval and Live Bidding
- #58: Dedicated Announcements Page
