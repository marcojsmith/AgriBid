# Specification: Admin Live Monitor Loading Fix (Issue #138)

## Overview

The Admin Live Monitor page (`/admin/marketplace`) is currently stuck in an indefinite "Loading..." state. This prevents administrators from monitoring real-time bidding activity, which is critical for marketplace oversight. This track aims to identify and fix the root cause of this loading failure, ensuring that real-time bid data is correctly fetched and displayed.

## Functional Requirements

- **Fix Loading Failure**: Identify and resolve the issue in `api.admin.getAdminStats` or `api.admin.getRecentBids` that prevents the initial loading state from resolving.
- **Permission Verification**: Ensure that the `admin` role is correctly checked in the Convex queries and that all authorized administrators can access the data.
- **Real-time Bidding Feed**: Restore the functionality of the `BidMonitor` component to display recent bids in real-time.
- **Data Integrity**: Ensure the queries return proper data structures or handle errors gracefully without hanging the UI.
- **Real-time Updates**: Verify that the feed updates automatically (reactive queries) when new bids are placed anywhere on the platform.

## Non-Functional Requirements

- **Performance**: Initial data load should align with project targets (under 2 seconds).
- **Reliability**: Graceful error handling for query failures to avoid indefinite loading states.

## Acceptance Criteria

- [ ] Navigating to `/admin/marketplace` successfully transitions from a loading state to a live bid feed.
- [ ] New bids placed on any auction appear in the admin live feed in real-time without page refresh.
- [ ] Admin role permissions are correctly enforced for these queries.
- [ ] Bid voiding (if part of the view) functions correctly.
- [ ] No console errors related to these queries.

## Out of Scope

- Redesigning the Admin Marketplace UI.
- Adding new administrative features beyond the live monitor.
- Optimization of unrelated admin queries.
