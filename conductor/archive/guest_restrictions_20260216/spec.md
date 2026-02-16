# Specification: Guest Access & Action Restrictions

## Overview
Allow unauthenticated users to browse auctions and start the "Sell" wizard while restricting core transactional actions (bidding, finalising listings, watchlisting) behind authentication. This ensures a low-friction "window shopping" experience while maintaining security for critical operations.

## Functional Requirements

### 1. Navigation & UI State
- **Header:** Logged-out users see "Login / Register" instead of the profile menu/avatar.
- **Restricted Links:** Hide "Sell" (main nav), "Admin", and "My Bids" links from the header for guest users.
- **Watchlist:** Hide the heart/watchlist button on auction cards and detail pages for guest users.

### 2. Bidding Flow
- **Auction Detail:** The "Place Bid" button remains visible and enabled.
- **Interception:** Clicking "Place Bid" as a guest triggers a redirect to the login page or opens the auth dialog.
- **Continuity:** After successful login, the user must be redirected back to the specific auction detail page they were viewing.

### 3. Sell Wizard (Guest Mode)
- **Browsing:** Allow guests to access the `/sell` page and fill in all steps of the `ListingWizard`.
- **Persistence:** Use `localStorage` to persist form state during the session so progress isn't lost on refresh or redirect.
- **Save Interception:** The final "Submit" action requires authentication. If the user clicks "Submit" as a guest, redirect to login.
- **Resume:** Upon returning from login, the wizard should re-populate with the data stored in `localStorage` and allow submission.

### 4. Direct Access Prevention
- **Protected Routes:** Ensure `/admin` and user-specific dashboard routes are protected at the component or route level, redirecting guests to the home or login page.

## Non-Functional Requirements
- **User Experience:** Use `callbackUrl` parameters to ensure seamless redirects back to the user's previous context after authentication.
- **Storage Cleanup:** Clear `localStorage` listing data after a successful submission to prevent clutter.

## Acceptance Criteria
- [ ] Guest users can view the home page auction grid and search.
- [ ] Guest users can view auction detail pages.
- [ ] Clicking "Place Bid" as a guest redirects to login and returns to the auction after auth.
- [ ] A guest can complete the Sell Wizard up to the final step.
- [ ] Clicking "Submit" on the Sell Wizard as a guest redirects to login and restores the form state upon return.
- [ ] "Admin" and "Profile" links are hidden from the header for guests.

## Out of Scope
- Server-side draft saving (drafts are client-side only via localStorage for now).
- Guest "Wishlist" (must be logged in to save anything to the database).
