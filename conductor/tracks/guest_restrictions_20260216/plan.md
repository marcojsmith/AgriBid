# Implementation Plan: Guest Access & Action Restrictions

This plan outlines the steps to implement guest access restrictions and state persistence for the Sell Wizard, ensuring a seamless transition from guest to authenticated user.

## Phase 1: Navigation & Header Adjustments
Focus on hiding restricted elements from unauthenticated users.

- [ ] Task: Adjust Header Navigation Visibility
    - [ ] Update `Header.tsx` to conditionally hide "Admin" and dashboard-specific links for guests.
    - [ ] Replace avatar/profile dropdown with a "Sign In" button for unauthenticated users.
- [ ] Task: Conditional Watchlist Visibility
    - [ ] Update `AuctionCard.tsx` to hide the watchlist toggle for guests.
    - [ ] Update `AuctionDetail.tsx` to hide the watchlist toggle for guests.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Navigation' (Protocol in workflow.md)

## Phase 2: Bidding Interception & Redirect
Enable guests to see the bid button but intercept the action to require login.

- [ ] Task: Implement Bidding Interceptor
    - [ ] Modify `BidForm.tsx` or its parent to check authentication status before allowing a bid.
    - [ ] Store the current URL as a `callbackUrl` when redirecting to the login page.
- [ ] Task: Verify Post-Login Redirect
    - [ ] Ensure the auth client correctly handles the `callbackUrl` to return the user to the auction detail page.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Bidding' (Protocol in workflow.md)

## Phase 3: Sell Wizard Persistence
Allow guests to fill the wizard and persist their data using `localStorage`.

- [ ] Task: Implement LocalStorage Hook for Wizard
    - [ ] Create or update a hook to sync `ListingWizard` form state to `localStorage`.
- [ ] Task: Intercept Wizard Submission
    - [ ] Update `ListingWizard.tsx` to check auth status on the final step's "Submit" action.
    - [ ] Redirect to login with a `callbackUrl` that returns the user to the final step of the wizard.
- [ ] Task: Implement State Restoration
    - [ ] Add logic to re-hydrate the wizard state from `localStorage` upon initialization.
    - [ ] Clear `localStorage` only after a successful listing creation.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Wizard Persistence' (Protocol in workflow.md)

## Phase 4: Route Protection & Security
Ensure pages are secured at the routing level.

- [ ] Task: Implement/Review Role-Based Route Guards
    - [ ] Ensure `AdminDashboard.tsx` and dashboard routes redirect guest users to the home or login page.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Security' (Protocol in workflow.md)
