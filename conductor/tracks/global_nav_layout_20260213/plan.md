# Implementation Plan: Global Navigation & Brand Layout

## Phase 1: Core Layout Foundation [checkpoint: 41760b3]
Establish the shared structural components and refactor the routing to use a centralized Layout wrapper.

- [x] Task: Create a base `Layout` component and `Footer` placeholder. (77f5753)
    - [x] Write tests for `Layout` component (rendering children, Presence of Header/Footer).
    - [x] Implement `src/components/Layout.tsx`.
    - [x] Implement a basic `src/components/Footer.tsx`.
- [x] Task: Refactor `App.tsx` to use the `Layout` wrapper for all routes. (18f6803)
    - [x] Update `App.tsx` to wrap `Routes` with `Layout`.
    - [x] Verify that all pages still render correctly within the layout.
- [x] Task: Conductor - User Manual Verification 'Core Layout Foundation' (Protocol in workflow.md) (23f58ee)

## Phase 2: Global Header & Auth Integration [checkpoint: cc2fe62]
Implement the responsive navigation bar with authentication awareness and the "Hybrid Sticky" behavior.

- [x] Task: Build the `Header` component structure and navigation links. (2a94711)
    - [x] Write tests for `Header` (Navigation links presence, mobile menu toggle).
    - [x] Implement `src/components/Header.tsx` with Marketplace, Sell, and Watchlist links.
- [x] Task: Implement "Hybrid Sticky" and Responsive behavior. (2a94711)
    - [x] Add Tailwind classes for desktop sticky (`sticky top-0`) and mobile static positioning.
    - [x] Implement mobile hamburger menu for small screens.
- [x] Task: Integrate Better Auth into the Header. (825a609)
    - [x] Write tests for Auth states (Login button when out, Profile menu when in).
    - [x] Implement Auth logic in `Header.tsx` using `src/lib/auth-client.ts`.
- [x] Task: Conductor - User Manual Verification 'Global Header & Auth Integration' (Protocol in workflow.md) (825a609)

## Phase 3: Global Search & Refinement
Implement the navbar search bar and final branding refinements.

- [x] Task: Add the Global Search Bar to the Header. (dac899c)
    - [x] Write tests for Search input (Typing, Form submission).
    - [x] Implement the search input UI in `Header.tsx`.
    - [x] Wire up search to redirect to `/` with query parameters.
- [~] Task: Implement the detailed Global Footer.
    - [ ] Write tests for `Footer` (Links: How it works, Safety, etc.).
    - [ ] Complete `src/components/Footer.tsx` with specified branding and link sections.
- [ ] Task: Global Styling & Cleanup.
    - [ ] Remove page-specific headers (e.g., from `AuctionDetail.tsx`).
    - [ ] Ensure consistent horizontal padding across all pages via `Layout.tsx`.
- [ ] Task: Conductor - User Manual Verification 'Global Search & Refinement' (Protocol in workflow.md)
