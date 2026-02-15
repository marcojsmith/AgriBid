# Specification: Listing Creation & Convex File Storage Integration

## Overview
This track focuses on the end-to-end seller experience for creating equipment auctions. It transitions the current static listing logic into a dynamic, multi-step wizard that supports high-resolution image uploads via Convex File Storage and implements a formal review/approval workflow.

## Functional Requirements

### 1. Multi-Step Listing Wizard (`ListingWizard.tsx`)
- **State Management**: Implement a robust state machine to handle transitions between steps:
    - **Step 1: Equipment Details**: Make, Model, Year, Hours, Location.
    - **Step 2: Condition & Specs**: Condition checklist (Engine, Hydraulics, Tires, Service History) and free-text notes.
    - **Step 3: Media Upload**: Drag-and-drop image interface.
    - **Step 4: Pricing**: Starting price, Reserve price, and Auction duration.
    - **Step 5: Review & Submit**: Final summary of all data before database insertion.
- **Persistence**: Ensure form data is preserved if a user navigates between steps.

### 2. Media Management & Convex File Storage
- **Image Processing**: Implement client-side validation (file size, type) and potential optimization before upload.
- **Upload Flow**: 
    - Use `generateUploadUrl` (Convex action/mutation) to get a secure destination.
    - Perform direct-to-Convex uploads for each image.
    - Maintain a list of Convex Storage IDs to associate with the final auction record.
- **Preview UI**: Provide a responsive grid of thumbnails for selected images with the ability to remove/reorder.

### 3. Submission & Bidding Integration
- **Mutation Link**: Connect the "Submit" action to the `createAuction` mutation, passing the gathered form state and storage IDs.
- **Status Transition**: New listings must default to `pending_review`.

### 4. Admin/Developer Approval Workflow
- **Approval Interface**: Create a basic UI (accessible to Admin roles or via a hidden dev toggle) to list `pending_review` auctions.
- **Activation Logic**: Implement a control to trigger the `approveAuction` mutation, which sets the status to `active` and calculates the final `endTime`.

## Non-Functional Requirements
- **Performance**: Image upload progress indicators to maintain perceived speed.
- **User Experience**: Clear validation errors at each step to prevent submission failure.
- **Security**: Enforce that only the listing owner or an admin can modify/delete files associated with the listing.

## Acceptance Criteria
- [ ] Users can navigate from Step 1 to Step 5 without losing data.
- [ ] Multiple high-resolution images can be uploaded and correctly stored in Convex.
- [ ] The `images` field in the `auctions` table contains valid Convex Storage IDs.
- [ ] A submitted auction is visible in the "Pending" state and NOT visible on the public Home page.
- [ ] An Admin can successfully "Approve" an auction, making it appear in the public active list.

## Out of Scope
- Advanced AI-powered pricing suggestions (Phase 4).
- Post-auction logistics and shipping calculator integration (Phase 3).
- Video upload support.
