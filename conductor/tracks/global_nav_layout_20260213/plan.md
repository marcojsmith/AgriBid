# Implementation Plan: Global Navigation & Brand Layout

## Phase 1: Core Layout Foundation
Establish the shared structural components and refactor the routing to use a centralized Layout wrapper.

- [x] Task: Create a base `Layout` component and `Footer` placeholder. (77f5753)
    - [ ] Write tests for `Layout` component (rendering children, Presence of Header/Footer).
    - [ ] Implement `src/components/Layout.tsx`.
    - [ ] Implement a basic `src/components/Footer.tsx`.
- [ ] Task: Refactor `App.tsx` to use the `Layout` wrapper for all routes.
    - [ ] Update `App.tsx` to wrap `Routes` with `Layout`.
    - [ ] Verify that all pages still render correctly within the layout.
- [ ] Task: Conductor - User Manual Verification 'Core Layout Foundation' (Protocol in workflow.md)

## Phase 2: Global Header & Auth Integration
Implement the responsive navigation bar with authentication awareness and the "Hybrid Sticky" behavior.

- [ ] Task: Build the `Header` component structure and navigation links.
    - [ ] Write tests for `Header` (Navigation links presence, mobile menu toggle).
    - [ ] Implement `src/components/Header.tsx` with Marketplace, Sell, and Watchlist links.
- [ ] Task: Implement "Hybrid Sticky" and Responsive behavior.
    - [ ] Add Tailwind classes for desktop sticky (`sticky top-0`) and mobile static positioning.
    - [ ] Implement mobile hamburger menu for small screens.
- [ ] Task: Integrate Better Auth into the Header.
    - [ ] Write tests for Auth states (Login button when out, Profile menu when in).
    - [ ] Implement Auth logic in `Header.tsx` using `src/lib/auth-client.ts`.
- [ ] Task: Conductor - User Manual Verification 'Global Header & Auth Integration' (Protocol in workflow.md)

## Phase 3: Global Search & Refinement
Implement the navbar search bar and final branding refinements.

- [ ] Task: Add the Global Search Bar to the Header.
    - [ ] Write tests for Search input (Typing, Form submission).
    - [ ] Implement the search input UI in `Header.tsx`.
    - [ ] Wire up search to redirect to `/` with query parameters.
- [ ] Task: Implement the detailed Global Footer.
    - [ ] Write tests for `Footer` (Links: How it works, Safety, etc.).
    - [ ] Complete `src/components/Footer.tsx` with specified branding and link sections.
- [ ] Task: Global Styling & Cleanup.
    - [ ] Remove page-specific headers (e.g., from `AuctionDetail.tsx`).
    - [ ] Ensure consistent horizontal padding across all pages via `Layout.tsx`.
- [ ] Task: Conductor - User Manual Verification 'Global Search & Refinement' (Protocol in workflow.md)
