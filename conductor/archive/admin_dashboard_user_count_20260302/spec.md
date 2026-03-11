# Specification: Admin Dashboard User Count Inconsistency (Issue #139)

## Overview

The Admin Dashboard currently displays inconsistent data for "LIVE USERS", "TOTAL USERS", and "Total Profiles" on the Admin Users page. This track aims to standardize the counting logic and ensure real-time accuracy.

## Functional Requirements

- **Standardize Metrics:** Set `TOTAL USERS` to reflect all registered accounts in the system.
- **Real-time Tracking:** Implement `LIVE USERS` based on active WebSocket connections using Convex presence or similar session tracking.
- **Consistency across Pages:** Ensure the Admin Users page total matches the dashboard's total, with clear filters for verified or pending profiles.
- **Backend Refactoring:** Standardize user counting logic in `app/convex/admin/statistics.ts` and `app/convex/admin/index.ts`.
- **UI Label Updates:** Update labels on the dashboard and users page to be more descriptive (e.g., "All Registered Users", "Currently Connected").

## Acceptance Criteria

- **Consistent Totals:** "TOTAL USERS" on the dashboard matches the total count on the Admin Users page.
- **Accurate Live Count:** "LIVE USERS" reflects actual active WebSocket connections in real-time.
- **Clear Labels:** UI labels are updated for clarity and match the standardized definitions.
- **Performance:** Ensure statistics queries are efficient and do not degrade dashboard performance.

## Out of Scope

- Adding new user metrics not related to the current inconsistency issue.
- Significant UI redesign of the Admin Dashboard beyond label changes.
