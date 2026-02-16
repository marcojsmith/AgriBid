# Implementation Plan: Guest Access & Action Restrictions

This plan outlines the steps to implement guest access restrictions and state persistence for the Sell Wizard, ensuring a seamless transition from guest to authenticated user.

## Phase 1: Navigation & Header Adjustments
Focus on hiding restricted elements from unauthenticated users.

- [x] Task: Adjust Header Navigation Visibility
- [x] Task: Conditional Watchlist Visibility (N/A - elements not yet implemented)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Navigation' (Protocol in workflow.md)

## Phase 2: Bidding Interception & Redirect
Enable guests to see the bid button but intercept the action to require login.

- [x] Task: Implement Bidding Interceptor
- [x] Task: Verify Post-Login Redirect
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Bidding' (Protocol in workflow.md)

## Phase 3: Sell Wizard Persistence
Allow guests to fill the wizard and persist their data using `localStorage`.

- [x] Task: Implement LocalStorage Hook for Wizard
- [x] Task: Intercept Wizard Submission
- [x] Task: Implement State Restoration
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Wizard Persistence' (Protocol in workflow.md)

## Phase 4: Route Protection & Security
Ensure pages are secured at the routing level.

- [x] Task: Implement/Review Role-Based Route Guards
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Security' (Protocol in workflow.md)
