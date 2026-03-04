# Pages Documentation

This document describes all pages in the AgriBid application, their layouts, components, and functionality.

---

## Public Pages

### Home Page (`/`)

The main marketplace landing page displaying active auctions.

**Layout:**
- Hero section with search bar and featured auctions
- Filter sidebar (left, collapsible on mobile)
- Auction grid (main content area)
- Footer

**Components:**
- `Header` - Navigation bar with search
- `SearchBar` - Global search input
- `FilterSidebar` - Advanced filtering options
- `AuctionCard` - Auction listing cards
- `AuctionCardSkeleton` - Loading placeholder

**Features:**
- Dynamic view toggle (Detailed/Compact)
- Real-time countdown timers
- Quick watch action
- Advanced filtering (Make, Year, Price, Hours)

**Responsive:**
- Desktop: Sidebar visible, 3-4 column grid
- Tablet: Collapsible sidebar, 2-3 column grid
- Mobile: Hidden sidebar (drawer), 1-2 column grid

---

### Login Page (`/login`)

User authentication page.

**Layout:**
- Centered login form
- OAuth provider buttons (Google)
- Email/password form
- Registration link

**Components:**
- `Login` form component
- OAuth buttons

**Features:**
- Email/password login
- Google OAuth integration
- Registration redirect

---

### Auction Detail Page (`/auction/:id`)

Detailed view of a single auction listing.

**Layout:**
- Two-column layout (images left, info right)
- Bid history section (collapsible)
- Related auctions footer

**Components:**
- `ImageGallery` - Main image with thumbnails
- `AuctionHeader` - Title, make, model, year
- `BiddingPanel` - Current bid, bid form
- `BidHistory` - List of all bids
- `CountdownTimer` - Live countdown
- `SellerInfo` - Seller profile summary

**Features:**
- Real-time bid updates via Convex
- Image lightbox gallery
- Bid confirmation modal
- Outbid notifications
- Watch/unwatch functionality

---

## User Dashboard Pages

### My Bids (`/dashboard/bids`)

User's active and historical bids.

**Layout:**
- Tabs: Active Bids | Winning | Lost
- Bid cards with auction details

**Components:**
- `MyBids` - Main dashboard component
- Bid cards showing auction info, bid amount, status

**Features:**
- Filter by status (active, winning, lost)
- Quick navigation to auction
- Bid amount display

---

### My Listings (`/dashboard/listings`)

Seller's auction listings.

**Layout:**
- Tabs: Draft | Active | Ended
- Listing cards with status

**Components:**
- `MyListings` - Main dashboard component
- Listing cards with status badges

**Features:**
- Filter by status
- Edit draft listings
- View active/ended listings
- Create new listing button

---

### Watchlist (`/watchlist`)

User's saved auctions.

**Layout:**
- Grid of watched auctions
- Empty state when no items

**Components:**
- `Watchlist` - Main page component
- `AuctionCard` - Watched auction cards

**Features:**
- Real-time status updates
- Quick unwatch action
- Navigate to auction

---

### Profile (`/profile`)

User profile management.

**Layout:**
- Profile information form
- Avatar upload
- Account settings

**Components:**
- `Profile` - Main page component
- Profile form with fields

**Features:**
- Edit profile information
- View KYC status
- Manage account settings

---

### Support (`/support`)

User support ticket creation and viewing.

**Layout:**
- Ticket list (existing tickets)
- New ticket form

**Components:**
- `Support` - Main page component
- Ticket creation form

**Features:**
- Create new support tickets
- View ticket history
- Ticket status tracking

---

## Seller Pages

### Sell/Create Listing (`/sell`)

Multi-step listing wizard for creating new auction listings.

**Layout:**
- Step indicator (top)
- Step content (main area)
- Navigation buttons (bottom)

**Steps:**

1. **General Info** (`GeneralInfoStep`)
   - Title
   - Make/Model selection
   - Year
   - Category

2. **Technical Specs** (`TechnicalSpecsStep`)
   - Operating hours
   - Location
   - Condition checklist
   - Description

3. **Media Gallery** (`MediaGalleryStep`)
   - Front view (required)
   - Engine view
   - Cabin view
   - Rear view
   - Additional photos (up to 10)

4. **Pricing** (`ReviewSubmitStep`)
   - Starting price
   - Reserve price
   - Minimum increment
   - Duration
   - Review all details

**Components:**
- `WizardNavigation` - Back/Next buttons
- `StepIndicator` - Visual step progress

---

## KYC Pages

### KYC Verification (`/kyc`)

Know Your Customer verification flow.

**Layout:**
- Verification status section
- Document upload section
- Personal information section

**Sections:**
- `VerificationStatusSection` - Current status display
- `DocumentUploadSection` - ID document upload
- `PersonalInfoSection` - Personal details form

**Features:**
- Upload government ID
- Submit personal information
- Track verification status
- View rejection reason if rejected

---

## Admin Pages

### AdminLayout Component

All admin pages share a common layout component that provides consistent navigation and a persistent KPI header.

**Location:** `components/admin/AdminLayout.tsx`

**Features:**
- **KPI Header**: Persistent header displayed on all `/admin/*` routes showing:
  - Live Auctions
  - Total Users
  - Moderation Queue
  - Platform Growth
- **Navigation**: Sidebar or tabs for switching between admin sections
- **Layout**: KPI header above per-page content

**Usage:** All admin route pages wrap their content with `<AdminLayout>` to ensure consistent header and navigation across:
- Admin Dashboard (`/admin`)
- Admin Marketplace (`/admin/marketplace`)
- Admin Auctions (`/admin/auctions`)
- And other admin routes

---

### Admin Dashboard (`/admin`)

Main admin overview with statistics.

**Layout:**
- Statistics cards (top)
- Tabs for different admin functions

**Components:**
- `StatCard` - Key metrics display
- `SummaryCard` - Summary statistics
- `BidMonitor` - Real-time bid activity

**Metrics:**
- Total auctions
- Active auctions
- Total users
- Pending KYC
- Open support tickets

---

### Admin Marketplace (`/admin/marketplace`)

Marketplace overview and management.

**Layout:**
- Marketplace statistics
- Recent activity

---

### Admin Auctions (`/admin/auctions`)

Auction moderation and management.

**Layout:**
- Auction list with filters
- Bulk action toolbar
- Individual auction actions

**Components:**
- `AdminAuctions` - Main page
- `BulkActionDialog` - Bulk operations

**Features:**
- Filter by status
- Approve/reject listings
- View auction details
- Bulk status updates

---

### Admin Moderation (`/admin/moderation`)

Content moderation interface.

**Layout:**
- Pending listings queue
- Moderation actions

**Components:**
- `AdminModeration` - Main page
- `ModerationCard` - Listing for review

**Features:**
- Review pending listings
- Approve with conditions
- Reject with reason

---

### Admin Users (`/admin/users`)

User management interface.

**Layout:**
- User list with search
- User detail view

**Components:**
- `AdminUsers` - Main page
- User action buttons

**Features:**
- View user profiles
- Promote to admin
- View KYC status

---

### Admin KYC (`/admin/kyc`)

KYC verification management.

**Layout:**
- Pending applications queue
- Document review interface
- Approval/rejection actions

**Components:**
- KYC application list
- `KycReviewDialog` - Review modal
- Document viewer

**Features:**
- Review pending applications
- Approve/reject with reason
- View submitted documents

---

### Admin Support (`/admin/support`)

Support ticket management.

**Layout:**
- Ticket list with filters
- Ticket detail view

**Components:**
- `AdminSupport` - Main page
- `SupportTab` - Ticket list

**Features:**
- View open tickets
- Mark as resolved
- Assign priority

---

### Admin Finance (`/admin/finance`)

Financial overview and tracking.

**Layout:**
- Revenue statistics
- Transaction history

**Components:**
- `FinanceTab` - Financial data

---

### Admin Audit (`/admin/audit`)

Audit log viewer.

**Layout:**
- Filterable audit log table
- Action details

**Components:**
- `AuditTab` - Audit log display

**Features:**
- View all admin actions
- Filter by admin, action type, date

---

### Admin Announcements (`/admin/announcements`)

Platform announcement management.

**Layout:**
- Announcement list
- Create announcement form

**Components:**
- `AdminAnnouncements` - Main page

**Features:**
- Create announcements
- Schedule announcements
- Target all users or specific users

---

### Admin Settings (`/admin/settings`)

Platform settings management.

**Layout:**
- Settings form
- Configuration options

**Components:**
- `AdminSettings` - Main page

---

## Notifications Page (`/notifications`)

User notification center.

**Layout:**
- Notification list
- Mark all read action

**Components:**
- `Notifications` - Main page component

**Features:**
- View all notifications
- Mark as read
- Navigate to related content

---

## Route Protection

### Role-Based Access

| Route | Required Role |
|-------|---------------|
| `/dashboard/*` | Authenticated user |
| `/sell` | `seller` or `buyer` |
| `/kyc` | Authenticated user |
| `/admin/*` | `admin` |
| `/watchlist` | Authenticated user |

### Components

- `RoleProtectedRoute` - Route wrapper for role checking

---

## Error Pages

### 404 Not Found

Displayed when a route doesn't exist.

### 403 Forbidden

Displayed when user lacks permission.

### 500 Error

Displayed on server errors.

---

*Last Updated: 2026-03-02*
