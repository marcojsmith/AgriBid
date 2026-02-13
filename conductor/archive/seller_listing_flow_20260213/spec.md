# Specification: Seller Listing Flow

## Overview
This track implements the "Supply" side of the AgriBid marketplace. It provides a high-integrity, multi-step listing wizard that allows users (who utilize a unified Buy/Sell account) to list heavy machinery for auction. The design is influenced by the ease-of-use seen on `webuycars.co.za`, prioritizing mobile-first entry, guided inspections, and administrative moderation to maintain marketplace quality.

## Functional Requirements

### 1. Unified Account Integration
- The "Sell" entry point must be easily accessible from the main navigation/profile without requiring account "conversion."
- Seller identity is tied to the existing user profile.

### 2. Multi-Step Listing Wizard
- **Step 1: General Information**: Basic details (Title, Year, Location).
- **Step 2: Technical Specifications**: 
  - Make/Model/Year capture via structured lookup.
  - (Future work: Auto-population of extended technical specs via equipmentMetadata).
- **Step 3: Condition Checklist**: 
  - Structured Yes/No questions covering key areas: Engine, Hydraulics, Tires, and Service History.
- **Step 4: Media Gallery**:
  - Guided upload prompts for specific angles (Front 45°, Engine, Instrument Cluster).
  - Support for multi-file uploads.
- **Step 5: Pricing & Strategy**:
  - Input for Starting Price and Reserve Price.
  - Dynamic "Price Recommendation" indicator (illustrative for prototype).

### 3. Listing Moderation
- Listings are submitted with a `pending_review` status.
- Admin review is required to transition a listing to `active`.

## Non-Functional Requirements
- **Mobile First**: Form inputs and photo uploads must be optimized for field use (large touch targets, resilient uploads).
- **Performance**: Metadata lookups and step transitions must be near-instant (< 200ms).
- **Integrity**: Mandatory fields in the condition checklist to ensure buyer confidence.

## Acceptance Criteria
- [ ] Users can navigate from the home page grid to the "Sell Equipment" wizard.
- [ ] The wizard prevents submission if mandatory photo angles are missing.
- [ ] Submitted listings appear in the database with `pending_review` status.
- [ ] The user receives a "Submission Successful" confirmation with next steps regarding moderation.

## Out of Scope
- Administrative dashboard for reviewing/approving listings (separate track).
- Integration with external pricing blue-books (using internal mock data for now).
- Professional inspection service scheduling.
