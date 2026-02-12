# AgriBid - Development Checklist

## Project Setup & Infrastructure

### Initial Setup
- [ ] Create `app/` directory for monorepo-style structure
- [ ] Initialise Vite + React + TypeScript project in `app/`
- [ ] Configure Tailwind CSS with custom theme (Earth tones)
- [ ] Install and configure Shadcn/UI components
- [ ] Set up ESLint + Prettier with project rules
- [ ] Configure Vitest for unit testing
- [ ] Create `.env.example` with required variables
- [ ] Set up Git repository with `.gitignore`
- [ ] Create initial folder structure (`src/components`, `src/pages`, `src/lib`, etc.)

### Convex Configuration
- [ ] Install Convex CLI (`npm install convex`)
- [ ] Run `npx convex dev` to initialise project in `app/`
- [ ] Configure `convex.json` with deployment settings
- [ ] Set up environment variables in Convex dashboard
- [ ] Create initial schema (`convex/schema.ts`)
- [ ] Implement seeding script (`convex/seed.ts`) for equipment metadata and mock data
- [ ] Test database connection with sample query

### Better Auth Integration
- [ ] Install `@better-auth/cli` and dependencies
- [ ] Generate Better Auth component (`npx @better-auth/cli init`)
- [ ] Configure auth providers (email/password, Google OAuth)
- [ ] Set up auth middleware in `convex/http.ts`
- [ ] Create auth client utilities (`src/lib/auth-client.ts`)
- [ ] Test authentication flow (register, login, logout)
- [ ] Implement role-based access control (RBAC)

---

## Database Schema & Backend Logic

### Schema Definition
- [ ] Define `equipmentMetadata` table (static lookup)
  - [ ] Fields: make, models, category
  - [ ] Index: `by_make`
- [ ] Define `users` table with indexes
  - [ ] Fields: email, name, role, isVerified, createdAt
  - [ ] Index: `by_email`
- [ ] Define `auctions` table with indexes
  - [ ] Fields: title, make, model, year, operatingHours, location, prices, timestamps, status, images, minIncrement
  - [ ] Indexes: `by_status`, `by_seller`, `by_end_time`, `by_location`
- [ ] Define `bids` table with indexes
  - [ ] Fields: auctionId, bidderId, amount, timestamp, isAutoBid
  - [ ] Indexes: `by_auction`, `by_bidder`
- [ ] Define `watchlist` table
  - [ ] Fields: userId, auctionId, createdAt
  - [ ] Index: `by_user_auction`
- [ ] Define `audit_logs` table (for admin)
  - [ ] Fields: userId, action, resourceType, resourceId, metadata, timestamp
  - [ ] Index: `by_timestamp`, `by_user`

### Convex Queries
- [ ] `getActiveAuctions` - fetch all active auctions with pagination
- [ ] `getAuctionById` - fetch single auction with full details
- [ ] `getUserAuctions` - fetch auctions by seller (with status filter)
- [ ] `getAuctionBids` - fetch bid history for an auction
- [ ] `getUserBids` - fetch bids placed by a user
- [ ] `getWatchlist` - fetch user's watched auctions
- [ ] `searchAuctions` - implement search/filter logic
  - [ ] Filter by: make, model, year range, hours range, location radius, price range
  - [ ] Sort by: ending soon, newest, price (low/high)

### Convex Mutations
- [ ] `createAuction` - create new auction (seller only)
  - [ ] Validate required fields (using equipmentMetadata for lookup)
  - [ ] Upload images to Convex File Storage
  - [ ] Set initial status to "draft"
- [ ] `updateAuction` - edit draft auction
- [ ] `publishAuction` - change status from "draft" to "active"
- [ ] `placeBid` - place a bid with soft close logic
  - [ ] Enforce minimum bid increment (`currentPrice + minIncrement`)
  - [ ] Check auction is active and not expired
  - [ ] Extend endTime if bid in final 2 minutes
  - [ ] Create audit log entry
- [ ] `setProxyBid` - set maximum auto-bid amount
- [ ] `addToWatchlist` / `removeFromWatchlist`
- [ ] `uploadConditionReport` - upload PDF to Convex Storage
- [ ] `flagAuction` - report suspicious listing (buyer/admin)

### Scheduled Functions (Cron)
- [ ] `settleExpiredAuctions` - run every 1 minute
  - [ ] Find auctions where `endTime < Date.now()` and status = "active"
  - [ ] Determine winner (highest bid)
  - [ ] Update status to "sold" or "unsold" (if reserve not met)
  - [ ] Create notification for winner and seller
  - [ ] Log settlement in audit_logs
- [ ] `cleanupDrafts` - run daily to delete old drafts (>30 days)

### Convex Actions (External API Calls)
- [ ] `calculateShipping` - call haulage API (Shiply/uShip)
  - [ ] Input: origin postcode, destination postcode, equipment dimensions
  - [ ] Output: estimated cost
- [ ] `sendEmailNotification` - trigger email via Resend/SendGrid
  - [ ] Use cases: outbid alert, auction won, auction ending soon

---

## Authentication & User Management

### Registration & Login
- [ ] Create registration page (`/register`)
  - [ ] Form: email, password, name, role selection (buyer/seller)
  - [ ] Validation: email format, password strength
  - [ ] Success: redirect to onboarding/dashboard
- [ ] Create login page (`/login`)
  - [ ] Form: email, password
  - [ ] "Forgot password" link
  - [ ] Google OAuth button
- [ ] Create password reset flow
- [ ] Implement OAuth callback handler
- [ ] Create protected route wrapper component

### User Profile
- [ ] Create profile page (`/profile`)
  - [ ] Display: name, email, role, verification status
  - [ ] Edit: name, profile photo
- [ ] Create seller verification flow
  - [ ] Upload business registration document
  - [ ] Admin approval workflow
  - [ ] Display "Verified Dealer" badge

### Role-Based Access
- [ ] Buyer role: can bid, watchlist, view auctions
- [ ] Seller role: can create listings, view analytics
- [ ] Admin role: can approve sellers, flag listings, view audit logs
- [ ] Implement route guards for role-specific pages

---

## Frontend Pages & Components

### Global Components
- [ ] **NavBar** (`src/components/NavBar.tsx`)
  - [ ] Logo, navigation links (Home, Dashboard, Profile)
  - [ ] Auth status (Login/Register or User menu)
  - [ ] Responsive mobile menu
- [ ] **Footer** (`src/components/Footer.tsx`)
  - [ ] Links: About, Terms, Privacy, Contact
- [ ] **LoadingSpinner** (`src/components/LoadingSpinner.tsx`)
- [ ] **ErrorBoundary** (`src/components/ErrorBoundary.tsx`)
- [ ] **Toast** notifications (Shadcn Toast)

### Home Page (`/`)
- [ ] **Hero Section**
  - [ ] Search bar (make, model, location)
  - [ ] CTA button: "Browse Auctions"
- [ ] **Filter Sidebar**
  - [ ] Equipment type dropdown
  - [ ] Location radius slider
  - [ ] Max operating hours input
  - [ ] Price range slider
  - [ ] "Apply Filters" button
- [ ] **Auction Grid**
  - [ ] `AuctionCard` component (reusable)
    - [ ] Display: hero image, title, current bid, countdown timer
    - [ ] Actions: "Watch" button, "View Details" link
  - [ ] Pagination or infinite scroll
  - [ ] Empty state: "No auctions found"

### Auction Detail Page (`/auction/:id`)
- [ ] **ImageGallery** component
  - [ ] Main image with zoom
  - [ ] Thumbnail navigation (max 20 images)
  - [ ] Lightbox view on click
- [ ] **Equipment Specs Table**
  - [ ] Make, Model, Year, Operating Hours, Location
  - [ ] Condition report download link (if available)
- [ ] **Bidding Panel**
  - [ ] Current bid display (real-time updates)
  - [ ] Bid history (collapsible list)
  - [ ] Bid form: amount input + "Place Bid" button
  - [ ] Enforce Minimum Bid Increment logic in UI and Backend
  - [ ] Proxy bid toggle: "Set Max Bid"
  - [ ] Shipping calculator: postcode input → API call → cost display
- [ ] **Seller Info**
  - [ ] Seller name, verification badge
  - [ ] "Contact Seller" button
- [ ] **Countdown Timer**
  - [ ] Display time remaining (days, hours, minutes, seconds)
  - [ ] Auto-update every second
  - [ ] Show "Auction Ended" when expired

### Seller Dashboard (`/dashboard/seller`)
- [ ] **My Listings Tabs**
  - [ ] Draft, Active, Ended
  - [ ] Table view: title, status, current bid, end time, actions
- [ ] **Analytics Panel**
  - [ ] Total views, bid count, conversion rate
  - [ ] Chart: views over time (optional)
- [ ] **Create Listing Button**
  - [ ] Opens multi-step form modal
- [ ] **Create Listing Form** (Multi-Step)
  - [ ] **Step 1: Equipment Details**
    - [ ] Make, Model, Year (dropdowns with autocomplete)
    - [ ] Operating Hours, Location (postcode)
    - [ ] Description (rich text editor)
  - [ ] **Step 2: Photos**
    - [ ] Drag-and-drop upload (max 20, 5MB each)
    - [ ] Image preview with delete option
    - [ ] Compress to WebP on upload
  - [ ] **Step 3: Pricing**
    - [ ] Starting price, Reserve price (optional)
    - [ ] Auction duration (3, 5, 7, 10 days)
  - [ ] **Step 4: Review & Publish**
    - [ ] Summary of all details
    - [ ] "Save as Draft" or "Publish" buttons
- [ ] **Edit Listing Modal** (for drafts only)

### Buyer Dashboard (`/dashboard/buyer`)
- [ ] **Active Bids Tab**
  - [ ] List of auctions user is bidding on
  - [ ] Status: "Winning" / "Outbid"
  - [ ] Quick rebid button
- [ ] **Watchlist Tab**
  - [ ] Grid of watched auctions
  - [ ] Remove from watchlist button
- [ ] **Won Auctions Tab**
  - [ ] Past wins with seller contact info
  - [ ] "Open Dispute" button (within 48 hours)

### Admin Dashboard (`/admin`)
- [ ] **Pending Verifications**
  - [ ] List of sellers awaiting verification
  - [ ] View documents, approve/reject
- [ ] **Flagged Listings**
  - [ ] Review flagged auctions
  - [ ] Actions: remove, warn seller, dismiss
- [ ] **Audit Logs**
  - [ ] Searchable table: user, action, timestamp
  - [ ] Export to CSV

---

## Core Features Implementation

### Real-Time Bidding
- [ ] Implement optimistic updates for bid submission
- [ ] Handle race conditions (multiple simultaneous bids)
- [ ] Display error if bid fails (network issue)
- [ ] Show "Bid Accepted" success message
- [ ] Implement retry logic (exponential backoff)

### Soft Close Logic
- [ ] Detect if bid placed in final 2 minutes
- [ ] Extend `endTime` by 2 minutes
- [ ] Notify all watchers of extension (toast/push)
- [ ] Update countdown timer for all connected clients
- [ ] Log extension in audit_logs

### Proxy Bidding
- [ ] Allow user to set max bid amount
- [ ] Store max bid in database (encrypted or separate table)
- [ ] Auto-increment bid by minimum increment when outbid
- [ ] Stop auto-bidding when max reached
- [ ] Notify user when max reached and outbid

### Watchlist
- [ ] Add/remove auctions from watchlist (mutation)
- [ ] Display watchlist count badge in NavBar
- [ ] Send notifications when watched auction ending soon (1 hour)
- [ ] Highlight watched auctions in grid view

### Image Upload & Storage
- [ ] Integrate Convex File Storage API
- [ ] Compress images to WebP (client-side or server-side)
- [ ] Generate responsive image sizes (thumbnail, medium, large)
- [ ] Implement lazy loading for images in grid
- [ ] Add alt text for accessibility

### Search & Filters
- [ ] Implement text search on title, make, model
- [ ] Add location radius filter (use postcode lookup API)
- [ ] Filter by operating hours range
- [ ] Filter by price range
- [ ] Sort by: ending soon, newest, price (low/high)
- [ ] Persist filters in URL query params

### Countdown Timer
- [ ] Create reusable `CountdownTimer` component
- [ ] Calculate time remaining: `endTime - Date.now()`
- [ ] Update every second using `setInterval`
- [ ] Display format: "2d 5h 32m 15s" or "Ended"
- [ ] Change colour to red when < 1 hour remaining

### Shipping Calculator
- [ ] Integrate with haulage API (Shiply or uShip)
- [ ] Input: origin postcode (from auction), destination postcode (user input)
- [ ] Display estimated cost range
- [ ] Cache results for 24 hours (same route)
- [ ] Handle API errors gracefully ("Unable to calculate")

---

## Trust & Transparency Features

### Seller Verification
- [ ] Create admin interface to review verification requests
- [ ] Store business registration number
- [ ] Display "Verified Dealer" badge on listings
- [ ] Unverified sellers: "Private Seller" label

### Condition Reports
- [ ] Allow PDF upload (max 10MB)
- [ ] Store in Convex File Storage
- [ ] Display download link on auction detail page
- [ ] Admin can mark as "Verified Report" (badge)

### Inspection Gallery
- [ ] Require minimum 5 photos for listing
- [ ] Suggest photo categories: engine, hour meter, hydraulics, tyres, controls
- [ ] Allow 360° photo stitching (optional, Phase 4)

### Bid History
- [ ] Display all bids in reverse chronological order
- [ ] Show: bidder (anonymised: "Bidder A"), amount, timestamp
- [ ] Real-time updates via Convex `useQuery`

### Audit Logs (Admin Only)
- [ ] Log critical actions: bid placed, auction created, seller verified
- [ ] Store: userId, action type, resourceId, timestamp, metadata (IP address)
- [ ] Admin can search/filter logs

---

## Testing & Quality Assurance

### Unit Tests (Vitest)
- [ ] Test Convex queries (mock database responses)
- [ ] Test Convex mutations (bid validation, soft close logic)
- [ ] Test utility functions (date formatting, price formatting)
- [ ] Test React components (snapshot tests)
- [ ] Aim for >80% code coverage

### Integration Tests
- [ ] Test full bidding flow (place bid → update price → extend timer)
- [ ] Test auction creation flow (upload images → save draft → publish)
- [ ] Test authentication flow (register → login → access protected page)

### End-to-End Tests (Chrome DevTools MCP)
- [ ] Test user registration and login
- [ ] Test creating and publishing an auction
- [ ] Test placing a bid and outbidding
- [ ] Test watchlist add/remove
- [ ] Test search and filter functionality
- [ ] Test seller dashboard analytics

### Accessibility Audit
- [ ] Run Lighthouse accessibility scan (score >90)
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Test screen reader compatibility (NVDA/JAWS)
- [ ] Ensure colour contrast ratio >4.5:1
- [ ] Add ARIA labels to all interactive elements

### Performance Optimisation
- [ ] Code splitting (React.lazy for pages)
- [ ] Lazy load images (Intersection Observer)
- [ ] Compress images to WebP
- [ ] Minify CSS and JavaScript
- [ ] Enable Vite build optimisations
- [ ] Test on 4G network (Lighthouse throttling)

---

## Deployment & DevOps

### Environment Configuration
- [ ] Create `.env.local` for development
- [ ] Create `.env.production` for production
- [ ] Document all required environment variables in README

### Convex Deployment
- [ ] Deploy to Convex Cloud (`npx convex deploy`)
- [ ] Configure production environment variables in Convex dashboard
- [ ] Test database migrations (if schema changes)

### Frontend Deployment (Vercel/Netlify)
- [ ] Connect GitHub repository
- [ ] Configure build settings:
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
- [ ] Add environment variables (Convex URL, Better Auth keys)
- [ ] Enable HTTPS
- [ ] Configure custom domain (optional)

### Monitoring & Analytics
- [ ] Set up error tracking (Sentry or similar)
- [ ] Implement analytics (Plausible or Google Analytics)
- [ ] Monitor Convex usage (bandwidth, function calls)
- [ ] Set up uptime monitoring (UptimeRobot)

---

## Documentation

### Code Documentation
- [ ] Add JSDoc comments to all functions
- [ ] Document Convex schema fields
- [ ] Create `CONTRIBUTING.md` for open-source contributors
- [ ] Create `CHANGELOG.md` to track version changes

### User Documentation
- [ ] Create FAQ page (`/faq`)
- [ ] Write "How to Sell" guide
- [ ] Write "How to Buy" guide
- [ ] Create Terms of Service (`/terms`)
- [ ] Create Privacy Policy (`/privacy`)

### README.md
- [ ] Project overview and features
- [ ] Tech stack
- [ ] Setup instructions (clone, install, run)
- [ ] Environment variables table
- [ ] Deployment instructions
- [ ] Contributing guidelines
- [ ] License

---

## Risk Mitigation

### Technical Risks
- [ ] **Convex scaling**: Monitor bandwidth usage, optimise queries
- [ ] **Real-time sync failures**: Implement retry logic with exponential backoff
- [ ] **Image storage costs**: Use WebP compression, CDN caching
- [ ] **Payment fraud**: Require ID verification, use Stripe Radar

### Business Risks
- [ ] **Seller adoption resistance**: Offer free listings for first 3 months
- [ ] **Trust issues**: Mandatory inspection reports, seller verification badges
- [ ] **Logistics friction**: Partner with haulage providers for discounted rates

---

## Dependencies

### NPM Packages
- [ ] `react`, `react-dom` - UI framework
- [ ] `react-router-dom` - routing
- [ ] `convex` - backend and database
- [ ] `@better-auth/cli`, `better-auth` - authentication
- [ ] `tailwindcss` - styling
- [ ] `shadcn-ui` - component library (install via CLI)
- [ ] `date-fns` or `dayjs` - date manipulation
- [ ] `zod` - schema validation
- [ ] `react-hook-form` - form management
- [ ] `lucide-react` - icons
- [ ] `vitest`, `@testing-library/react` - testing

### External Services
- [ ] **Convex Cloud** - database and backend hosting
- [ ] **Vercel/Netlify** - frontend hosting
- [ ] **Stripe** - payments (Phase 3)
- [ ] **Shiply or uShip API** - shipping calculator (Phase 3)
- [ ] **Resend or SendGrid** - transactional emails
- [ ] **Sentry** - error tracking
- [ ] **Plausible** - privacy-friendly analytics
