# Implementation Plan - Admin Dashboard User Count Inconsistency (Issue #139)

## Phase 1: Research & Audit

- [x] Task: Audit existing user counting queries
  - [x] Identify all occurrences of `users` table reads for counting in `app/convex/`.
  - [x] Document the filtering logic for "LIVE USERS", "TOTAL USERS" (Dashboard), and "Total Profiles" (Users page).
  - [x] Identify discrepancies between `app/convex/admin/statistics.ts` and `app/convex/admin/index.ts`.

## Phase 2: Standardize Counting Logic (Backend)

- [x] Task: Create standardized user count helper
  - [x] Write tests for a new `countUsers` helper in `app/convex/admin_utils.ts`.
  - [x] Implement `countUsers` with options for status (all, verified, etc.).
- [x] Task: Update statistics queries to use standardized helper
  - [x] Write tests for `admin:getStatistics` query.
  - [x] Refactor `app/convex/admin/statistics.ts` to use the new helper for `TOTAL USERS`.
- [x] Task: Update Admin Users queries to use standardized helper
  - [x] Write tests for `admin:listUsers` or similar query.
  - [x] Refactor `app/convex/admin/index.ts` to ensure the total count matches the dashboard.

## Phase 3: Real-time Live User Tracking

- [x] Task: Implement presence tracking for Live Users
  - [x] Write tests for a new presence-based counting logic in Convex.
  - [x] Implement a mechanism to track active WebSocket connections.
  - [x] Implement a query to count currently connected users accurately.
- [x] Task: Update statistics query for Live Users
  - [x] Refactor `admin:getStatistics` to use the new presence count for `LIVE USERS`.

## Phase 4: Frontend Updates

- [x] Task: Update Admin Dashboard UI
  - [x] Update labels in `app/src/pages/admin/AdminDashboard.tsx` (e.g., "LIVE USERS" -> "Currently Connected").
  - [x] Ensure the dashboard correctly subscribes to the real-time `LIVE USERS` metric.
- [x] Task: Update Admin Users Page UI
  - [x] Update labels in `app/src/pages/admin/AdminUsers.tsx`.
  - [x] Ensure the "Total Profiles" label is clarified or replaced with the standardized "Total Users" count.

## Phase 5: Final Verification

- [x] Task: End-to-End Verification
  - [x] Verify that "TOTAL USERS" matches across the dashboard and users page.
  - [x] Verify that "LIVE USERS" updates in real-time when a user logs in/out.
- [x] Task: Conductor - User Manual Verification 'Comprehensive Final Check' (Protocol in workflow.md)
