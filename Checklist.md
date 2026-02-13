# AgriBid - Development Checklist

## Project Setup & Infrastructure

### Initial Setup
- [x] Create `app/` directory for monorepo-style structure
- [x] Initialise Vite + React + TypeScript project in `app/`
- [x] Configure Tailwind CSS with custom theme (Earth tones)
- [x] Install and configure Shadcn/UI components
- [x] Set up ESLint + Prettier with project rules (Husky + lint-staged)
- [ ] Configure Vitest for unit testing
- [x] Create `.env.example` with required variables
- [x] Set up Git repository with `.gitignore`
- [x] Create initial folder structure (`src/components`, `src/pages`, `src/lib`, etc.)

### Convex Configuration
- [x] Install Convex CLI (`npm install convex`)
- [x] Run `npx convex dev` to initialise project in `app/`
- [x] Configure `convex.json` with deployment settings
- [x] Set up environment variables in Convex dashboard
- [x] Create initial schema (`convex/schema.ts`)
- [x] Implement seeding script (`convex/seed.ts`) for equipment metadata and mock data
- [x] Test database connection with sample query

### Better Auth Integration
- [x] Install `@better-auth/cli` and dependencies
- [x] Generate Better Auth component (`npx @better-auth/cli init`)
- [x] Configure auth providers (email/password, Google OAuth)
- [x] Set up auth middleware in `convex/http.ts` (with CORS and OIDC rewrites)
- [x] Create auth client utilities (`src/lib/auth-client.ts`)
- [x] Test authentication flow (register, login, logout)
- [x] Implement role-based access control (RBAC)

---

## Database Schema & Backend Logic

### Schema Definition
- [x] Define `equipmentMetadata` table (static lookup)
- [x] Define `users` table with indexes
- [x] Define `auctions` table with indexes
- [x] Define `bids` table with indexes
- [x] Define `watchlist` table
- [x] Define `audit_logs` table (for admin)

### Convex Queries
- [x] `getActiveAuctions` - fetch all active auctions
- [ ] `getAuctionById` - fetch single auction with full details
- [ ] `getUserAuctions` - fetch auctions by seller (with status filter)
- [ ] `getAuctionBids` - fetch bid history for an auction
- [ ] `getUserBids` - fetch bids placed by a user
- [ ] `getWatchlist` - fetch user's watched auctions
- [ ] `searchAuctions` - implement search/filter logic

### Convex Mutations
- [ ] `createAuction` - create new auction (seller only)
- [ ] `updateAuction` - edit draft auction
- [ ] `publishAuction` - change status from "draft" to "active"
- [x] `placeBid` - place a bid with soft close logic
- [ ] `setProxyBid` - set maximum auto-bid amount
- [ ] `addToWatchlist` / `removeFromWatchlist`
- [ ] `uploadConditionReport` - upload PDF to Convex Storage
- [ ] `flagAuction` - report suspicious listing (buyer/admin)

### Scheduled Functions (Cron)
- [ ] `settleExpiredAuctions` - run every 1 minute
- [ ] `cleanupDrafts` - run daily to delete old drafts (>30 days)

### Convex Actions (External API Calls)
- [ ] `calculateShipping` - call haulage API (Shiply/uShip)
- [ ] `sendEmailNotification` - trigger email via Resend/SendGrid

---

## Deploy to vercel

### Vercel Deployment
- [ ] Connect GitHub repository to Vercel
- [ ] Configure build settings (build command: `npm run build`, output directory: `dist/`)
- [ ] Set environment variables in Vercel dashboard
- [ ] Deploy staging environment for testing
- [ ] Deploy production environment after testing

---

## Authentication & User Management

### Registration & Login
- [x] Create registration page (`/register`) -> Implemented in `App.tsx` auth mode
- [x] Create login page (`/login`) -> Implemented in `App.tsx` auth mode
- [ ] Create password reset flow
- [ ] Implement OAuth callback handler
- [ ] Create protected route wrapper component

### User Profile
- [ ] Create profile page (`/profile`)
- [ ] Create seller verification flow

### Role-Based Access
- [ ] Buyer role: can bid, watchlist, view auctions
- [ ] Seller role: can create listings, view analytics
- [ ] Admin role: can approve sellers, flag listings, view audit logs
- [ ] Implement route guards for role-specific pages

---

## Frontend Pages & Components

### Global Components
- [ ] **NavBar** (`src/components/NavBar.tsx`)
- [ ] **Footer** (`src/components/Footer.tsx`)
- [ ] **LoadingSpinner** (`src/components/LoadingSpinner.tsx`)
- [ ] **ErrorBoundary** (`src/components/ErrorBoundary.tsx`)
- [x] **Toast** notifications (Shadcn Toast/Sonner)

### Home Page (`/`)
- [ ] **Hero Section**
- [ ] **Filter Sidebar**
- [x] **Auction Grid** (Basic implementation in `App.tsx`)
  - [x] `AuctionCard` component
- [ ] Pagination or infinite scroll

### Auction Detail Page (`/auction/:id`)
- [ ] **ImageGallery** component
- [ ] **Equipment Specs Table**
- [ ] **Bidding Panel**
- [ ] **Seller Info**
- [x] **Countdown Timer**

### Seller Dashboard (`/dashboard/seller`)
- [ ] **My Listings Tabs**
- [ ] **Analytics Panel**
- [ ] **Create Listing Button**
- [ ] **Create Listing Form** (Multi-Step)

### Buyer Dashboard (`/dashboard/buyer`)
- [ ] **Active Bids Tab**
- [ ] **Watchlist Tab**
- [ ] **Won Auctions Tab**

### Admin Dashboard (`/admin`)
- [ ] **Pending Verifications**
- [ ] **Flagged Listings**
- [ ] **Audit Logs**

---

## Core Features Implementation

### Real-Time Bidding
- [ ] Implement optimistic updates for bid submission
- [ ] Handle race conditions (multiple simultaneous bids)
- [ ] Display error if bid fails (network issue)
- [x] Show "Bid Accepted" success message
- [ ] Implement retry logic (exponential backoff)

### Soft Close Logic
- [x] Detect if bid placed in final 2 minutes
- [x] Extend `endTime` by 2 minutes
- [ ] Notify all watchers of extension (toast/push)
- [x] Update countdown timer for all connected clients

### Proxy Bidding
- [ ] Allow user to set max bid amount
- [ ] Store max bid in database
- [ ] Auto-increment bid by minimum increment when outbid

### Watchlist
- [ ] Add/remove auctions from watchlist (mutation)

### Image Upload & Storage
- [ ] Integrate Convex File Storage API

### Search & Filters
- [ ] Implement text search on title, make, model

### Countdown Timer
- [x] Create reusable `CountdownTimer` component
- [x] Calculate time remaining: `endTime - Date.now()`
- [x] Update every second using `setInterval`
- [x] Display format: "2d 5h 32m 15s" or "Ended"
- [x] Change colour to red when < 1 hour remaining

---

## Testing & Quality Assurance

### Unit Tests (Vitest)
- [ ] Test Convex queries
- [ ] Test Convex mutations
- [ ] Test utility functions
- [ ] Test React components

### Integration Tests
- [ ] Test full bidding flow
- [ ] Test auction creation flow
- [ ] Test authentication flow

---

## Deployment & DevOps

### Environment Configuration
- [x] Create `.env.local` for development
- [ ] Create `.env.production` for production
- [x] Document all required environment variables in README/codebase_notes

### Convex Deployment
- [ ] Deploy to Convex Cloud (`npx convex deploy`)

### Frontend Deployment (Vercel)
- [ ] Connect GitHub repository
- [ ] Configure build settings

---

## Documentation

### Code Documentation
- [ ] Add JSDoc comments to all functions
- [x] Document Convex schema fields
- [ ] Create `CONTRIBUTING.md`
- [ ] Create `CHANGELOG.md`

### User Documentation
- [ ] Create FAQ page
- [ ] Write "How to Sell" guide
- [ ] Write "How to Buy" guide

### README.md
- [x] Project overview and features
- [x] Tech stack
- [x] Setup instructions
- [x] Environment variables table
- [ ] Deployment instructions

---

## Dependencies

### NPM Packages
- [x] `react`, `react-dom`
- [ ] `react-router-dom`
- [x] `convex`
- [x] `@better-auth/cli`, `better-auth`
- [x] `tailwindcss`
- [x] `shadcn-ui`
- [ ] `date-fns` or `dayjs`
- [ ] `zod`
- [ ] `react-hook-form`
- [x] `lucide-react`
- [ ] `vitest`, `@testing-library/react`
