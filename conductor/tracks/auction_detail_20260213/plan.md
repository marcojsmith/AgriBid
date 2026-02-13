# Implementation Plan: Auction Detail Page and Bid Submission Flow

## Phase 1: Routing and Basic Layout
- [x] Task: Install `react-router-dom` and set up basic routing. (3723f42)
    - [ ] Create a `pages/` directory.
    - [ ] Implement a placeholder `AuctionDetail` page.
    - [ ] Configure routes in `App.tsx` for `/` and `/auction/:id`.
- [x] Task: Implement the "Above-the-Fold" layout structure. (3723f42)
    - [ ] Create the grid/flex container for desktop and mobile stacking.
    - [ ] Implement the `AuctionHeader` section (Title, Specs summary).
- [~] Task: Conductor - User Manual Verification 'Phase 1: Routing and Basic Layout' (Protocol in workflow.md)

## Phase 2: Equipment Inspection (Image Gallery)
- [ ] Task: Create the `ImageGallery` component.
    - [ ] Write tests for gallery navigation (thumbnail clicks).
    - [ ] Implement thumbnail carousel and main hero image display.
- [ ] Task: Implement Lightbox zoom functionality.
    - [ ] Write tests for lightbox opening/closing.
    - [ ] Integrate a lightbox library or custom modal for full-screen inspection.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Equipment Inspection (Image Gallery)' (Protocol in workflow.md)

## Phase 3: Real-Time Bidding Panel
- [ ] Task: Implement the `BiddingPanel` component.
    - [ ] Write tests for price and timer display updates.
    - [ ] Display current price, minimum bid, and countdown timer using `useQuery` for real-time reactivity.
- [ ] Task: Implement Bid Submission Form.
    - [ ] Write tests for bid validation logic (manual input >= increment).
    - [ ] Create manual bid input field and "Place Bid" button.
    - [ ] Implement "Quick Bid" buttons for the next logical increment.
- [ ] Task: Implement Bid Confirmation Dialog.
    - [ ] Write tests for confirmation flow (triggering mutation only after confirm).
    - [ ] Create a confirmation modal/dialog to prevent accidental bids.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Real-Time Bidding Panel' (Protocol in workflow.md)

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
