# Implementation Plan: Auction Detail Page and Bid Submission Flow

## Phase 1: Routing and Basic Layout [checkpoint: 0b1b438]
- [x] Task: Install `react-router-dom` and set up basic routing. (3723f42)
    - [x] Create a `pages/` directory.
    - [x] Implement a placeholder `AuctionDetail` page.
    - [x] Configure routes in `App.tsx` for `/` and `/auction/:id`.
- [x] Task: Implement the "Above-the-Fold" layout structure. (3723f42)
    - [x] Create the grid/flex container for desktop and mobile stacking.
    - [x] Implement the `AuctionHeader` section (Title, Specs summary).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Routing and Basic Layout' (Protocol in workflow.md) (0b1b438)

## Phase 2: Equipment Inspection (Image Gallery) [checkpoint: bf57d3a]
- [x] Task: Create the `ImageGallery` component. (0b1b438)
    - [x] Write tests for gallery navigation (thumbnail clicks).
    - [x] Implement thumbnail carousel and main hero image display.
- [x] Task: Implement Lightbox zoom functionality. (0b1b438)
    - [x] Write tests for lightbox opening/closing.
    - [x] Integrate a lightbox library or custom modal for full-screen inspection.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Equipment Inspection (Image Gallery)' (Protocol in workflow.md) (bf57d3a)

## Phase 3: Real-Time Bidding Panel [checkpoint: 7d34e18]
- [x] Task: Implement the `BiddingPanel` component. (bf57d3a)
    - [x] Write tests for price and timer display updates.
    - [x] Display current price, minimum bid, and countdown timer using `useQuery` for real-time reactivity.
- [x] Task: Implement Bid Submission Form. (bf57d3a)
    - [x] Write tests for bid validation logic (manual input >= increment).
    - [x] Create manual bid input field and "Place Bid" button.
    - [x] Implement "Quick Bid" buttons for the next logical increment.
- [x] Task: Implement Bid Confirmation Dialog. (bf57d3a)
    - [x] Write tests for confirmation flow (triggering mutation only after confirm).
    - [x] Create a confirmation modal/dialog to prevent accidental bids.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Real-Time Bidding Panel' (Protocol in workflow.md) (7d34e18)

## Phase 4: Information Architecture & Seller Trust
- [ ] Task: Implement Collapsible Bid History.
    - [ ] Write tests for fetching and displaying the bid list.
    - [ ] Create a collapsible/expandable section showing the latest bids (anonymized).
- [ ] Task: Implement Seller Information section.
    - [ ] Display seller name, verification badge, and location details.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Information Architecture & Seller Trust' (Protocol in workflow.md)

## Phase 5: Polish & Edge Cases
- [ ] Task: Implement Soft Close visual feedback.
    - [ ] Add a visual indicator/alert when the auction is extended.
- [ ] Task: Refine Mobile Responsiveness.
    - [ ] Ensure touch targets for bidding buttons are >= 44x44px.
    - [ ] Optimize the layout for small screens (stacked sections).
- [ ] Task: Final Verification & Quality Gates.
    - [ ] Run full test suite and verify >80% coverage.
    - [ ] Conduct final accessibility audit and linting check.
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Polish & Edge Cases' (Protocol in workflow.md)
