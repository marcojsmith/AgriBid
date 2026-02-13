# Specification: Auction Detail Page and Bid Submission Flow

## Overview
This track focuses on implementing the core "active" experience of the AgriBid platform: the Auction Detail Page. This page is the primary destination for buyers to inspect equipment, monitor live prices, and place bids in real-time.

## Functional Requirements
- **Navigation**:
  - Direct navigation from Home Page auction cards to the detail page.
  - Implement a dedicated route (e.g., `/auction/:id`).
- **Above-the-Fold View**:
  - **Image Gallery**: A hero image with a thumbnail carousel. Support for Lightbox zoom on click for high-resolution inspection.
  - **Real-Time Bidding Panel**: Display of current price, countdown timer, and minimum bid required.
  - **Key Equipment Specs**: Summary table of Make, Model, Year, Operating Hours, and Location.
- **Bidding System**:
  - **Manual Bid Input**: Validation ensuring bids meet the minimum increment.
  - **Quick Bid Buttons**: Single-tap buttons for the next logical bid amount.
  - **Bid Confirmation**: A verification step (dialog or confirmation toast) before committing the bid.
  - **Soft Close**: Visual feedback when the auction is extended due to last-minute bidding.
- **Information Architecture**:
  - **Collapsible Bid History**: Real-time list of recent bids (anonymized) in an expandable section below the bidding panel.
  - **Seller Info**: Display of seller name and verification status.

## Non-Functional Requirements
- **Latency**: Bid placement and price updates must reflect across all clients in < 200ms using Convex's reactive queries.
- **Responsiveness**: The layout must adapt seamlessly from desktop (sidebar bidding) to mobile (stacked view).
- **Accessibility**: Bidding buttons and inputs must be keyboard-navigable and screen-reader friendly.

## Acceptance Criteria
- [ ] Users can navigate to any active auction from the grid.
- [ ] The image gallery correctly cycles through thumbnails and opens a lightbox.
- [ ] The bidding panel updates current price and timers in real-time without page refresh.
- [ ] Manual and quick bids successfully trigger the `placeBid` mutation with confirmation.
- [ ] Bid history reactively updates when any user places a bid.

## Out of Scope
- Seller dashboard analytics for the auction.
- Logistics/shipping calculator integration (Phase 3).
- User watchlist management (separate track).
