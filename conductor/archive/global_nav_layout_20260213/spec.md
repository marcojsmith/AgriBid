# Specification: Global Navigation & Brand Layout

## Overview
This track focuses on the implementation of a unified navigation and layout system for AgriBid. The goal is to provide a consistent user experience across all pages, supporting the "Unified Account" (Buy/Sell) philosophy and reinforcing the professional, trust-based brand identity.

## Functional Requirements

### 1. Global Navigation Bar (Header)
- **Brand Identity**: Prominent "AgriBid" logo linked to the home page.
- **Primary Navigation**: 
    - **Marketplace**: Link to the main auction grid.
    - **Sell**: Link to the listing wizard.
    - **Watchlist**: Link to the user's watched auctions.
- **Global Search**:
    - A single input field in the navbar.
    - Searches across equipment Title, Make, and Model.
    - On mobile, this may be collapsed into a search icon or placed below the main navigation.
- **Authentication State**:
    - **Logged Out**: A single "Sign In" button.
    - **Logged In**: A profile dropdown showing the user's name/avatar with links to "My Bids", "My Listings", and "Sign Out".
- **Responsive Behavior**: 
    - **Desktop**: Sticky positioning (`sticky top-0`) to keep navigation and search accessible.
    - **Mobile**: Static positioning (scrolls with page) to maximize vertical space for equipment details and photos.

### 2. Global Footer
- **Trust & Support Focus**: Organized links to help users navigate the platform safely.
    - Sections: "How it Works", "Safety & Trust", "Terms of Service", and "Help Center".
- **Brand Presence**: Secondary logo and brief company mission statement.

### 3. Unified Layout System
- **Layout Wrapper**: A consistent container for all pages ensuring standard horizontal padding and maximum widths (e.g., `container mx-auto`).
- **Standardized Spacing**: Consistent vertical spacing between headers, content areas, and footers.

## Non-Functional Requirements
- **Performance**: Navbar interactions (dropdowns, search focus) must be instantaneous.
- **Accessibility**: ARIA labels for all navigation links and search inputs; keyboard-accessible dropdown menus.
- **Theming**: Strict adherence to the Earth-toned brand palette (Forest Green, Warm Cream).

## Acceptance Criteria
- [ ] The Navbar is visible and functional on the Home, Auction Detail, and Sell pages.
- [ ] Global Search input appears in the Navbar and correctly updates the marketplace view (or redirects with query parameters).
- [ ] Header remains sticky on desktop but scrolls away on mobile devices.
- [ ] The "Sign In" button correctly triggers the auth flow, and the profile menu appears once authenticated.
- [ ] The Footer is present at the bottom of all pages with the specified support links.

## Out of Scope
- Implementation of the actual "Watchlist" or "My Bids" pages (placeholders or simple lists for now).
- Advanced search filtering (category dropdowns, price ranges) within the navbar itself.
