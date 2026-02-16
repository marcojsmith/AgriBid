# Specification: Listing Creation & Convex File Storage Integration

## Overview
This track focuses on the end-to-end seller experience for creating equipment auctions. It transitions the current static listing logic into a dynamic, multi-step wizard that supports high-resolution image uploads via Convex File Storage and implements a formal review/approval workflow.

## Functional Requirements

### 1. Multi-Step Listing Wizard (`ListingWizard.tsx`)
Implement a robust state machine to handle transitions between steps with the following validation rules:

#### Step 1: Equipment Details
- **Year**: Required. Integer between 1900 and (Current Year + 1).
- **Make/Model**: Required. Non-empty strings.
- **Location**: Required. Free-text format (e.g., "City, State/Province").
- **Title**: Auto-generated from Year + Make + Model, but editable.

#### Step 2: Condition & Specs
- **Condition Checklist**: Boolean flags for Engine, Hydraulics, and Tires. All must be toggled (Yes/No).
- **Service History**: Required. Boolean flag indicating if records exist, plus a structured text field for brief summary/notes.
- **Validation**: Ensure all checklist items are selected before proceeding.

#### Step 3: Media Gallery
- **Limits**: MIN_IMAGES: 1, MAX_IMAGES: 10.
- **File Constraints**: MAX_SIZE_PER_IMAGE: 5MB. MAX_TOTAL_SIZE: 50MB.
- **Optimization**: Mandatory client-side resize to 1920x1080 (max width/height) at 80% quality (JPEG/WebP) to reduce bandwidth and storage costs.

#### Step 4: Pricing & Duration
- **Starting Price**: Required. Positive number, currency format (max 2 decimals).
- **Reserve Price**: Optional. If provided, must be >= Starting Price.
- **Auction Duration**: Required. Selection from predefined list (3, 5, 7, 10 days).

#### Step 5: Review & Submit
- **Summary**: Final display of all gathered data and image previews.
- **Persistence**: Form state must survive browser refresh and back/forward navigation within the wizard.

### 2. Media Management & Convex File Storage
- **Upload Flow**: 
    - Use `generateUploadUrl` to obtain a secure destination.
    - Implement robust error handling: 3 retries for transient failures, 30s timeout per upload.
    - Display per-image progress indicators. Partial failures (some images failing) block final submission until resolved.
- **Lifecycle & Cleanup**:
    - Mark storage IDs as "pending" until auction creation.
    - Implement a background garbage-collection TTL for orphaned storage IDs (e.g., from abandoned wizards).
    - Remove/Clean up storage IDs on listing rejection if resubmission is not expected.
- **Server-Side Validation**: Backend must enforce MIME type (image/jpeg, image/png), size limits, and basic content scanning.

### 3. Submission & Bidding Integration
- **Pre-Submission Validation**: Call a central validator to verify all steps are valid before enabling "Submit".
- **Mutation Payload**: `createAuction` expects:
    - `title`, `description`, `make`, `model`, `year`, `location`, `operatingHours`, `startingPrice`, `reservePrice`, `duration`.
    - `images`: Object `{ front, engine, cabin, rear, additional: string[] }`.
- **Status**: New listings default to `pending_review`.
- **Error Handling**: Map backend validation errors back to specific wizard fields. Implement exponential backoff for network-related failures.
- **Feedback**: Show a success modal on completion and redirect to the Seller Dashboard.

### 4. Admin/Developer Approval Workflow
- **RBAC**: Access to approval tools is restricted to users with `Admin` or `Developer` roles.
- **Mutations**:
    - `approveAuction(auctionId)`: Sets status to `active`. Computes `endTime = currentTime + durationDays`.
    - `rejectAuction(auctionId, rejectionReason)`: Sets status to `rejected`.
- **Audit Trail**: Every approve/reject action must log an entry in the `audit_logs` table (who, what, when, reason).
- **Notifications**: Trigger a "Listing Outcome" event to notify the seller via their preferred channel (Internal/Email) with the reason if rejected.

## Non-Functional Requirements
- **Security**: 
    - Enforce ownership/admin checks in ALL listing-related mutations and queries.
    - Implement rate limiting for file uploads and form submissions.
    - Sanitize all text inputs and ensure XSS output-encoding for location/notes.
- **Accessibility**: 
    - WCAG 2.1 AA compliance.
    - Full keyboard navigation for the wizard.
    - ARIA roles/labels for all form controls and focus management on step transitions.
- **Performance**: 
    - Step transitions < 200ms.
    - Image thumbnails must load in < 1s on 4G networks.

## Acceptance Criteria
- [ ] Users can navigate through all steps without losing data, even after a page refresh.
- [ ] Images are client-side optimized and correctly stored as Convex Storage IDs in the `auctions.images` field.
- [ ] Upload failures and validation errors (e.g., Reserve < Starting) are clearly communicated and block submission.
- [ ] A submitted auction is in "Pending" state and is filtered out from the public Home page.
- [ ] Only authorized Admins can view/approve/reject pending auctions.
- [ ] Rejections capture a reason, log an audit entry, and notify the seller.
- [ ] The wizard is fully navigable via keyboard and accessible to screen readers.

## Out of Scope
- Advanced AI-powered pricing suggestions (Future Phase).
- Post-auction logistics and shipping calculator integration (Future Phase).
- Video upload support.
