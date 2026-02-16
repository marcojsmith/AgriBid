# AgriBid - Farming Equipment Auction Platform
## Project Specification Document

---

## 1. Executive Summary

**AgriBid** is a real-time, high-integrity auction platform purpose-built for the **farming equipment marketplace**. The platform leverages modern web technologies—**Vite + React**, **TypeScript**, **Convex (real-time backend)**, and **Better Auth**—to deliver a fast, secure, and transparent bidding experience for buyers and sellers of heavy machinery.

### Key Differentiators:
- **Real-Time Bidding**: Sub-200ms latency using Convex's reactive architecture
- **Farming-Specific Features**: Equipment condition reports, operating hours tracking, and location-based logistics integration
- **Trust & Transparency**: Detailed inspection galleries, verified seller profiles, and immutable bid histories
- **Mobile-First Design**: Optimised for on-the-go farmers and dealers

---

## 2. Market Context & Research Findings (2026)

### Industry Landscape:
- **Inventory Consolidation**: Post-2024 supply chain normalisation has created a secondary market boom for used equipment
- **Trust Gap**: Buyers of $50k–$500k machinery are hesitant about online-only transactions without inspection transparency
- **Logistics Friction**: Transporting a combine harvester can cost R2,000–R10,000+, representing 10–30% of the final bid

### Competitive Analysis:
| Platform | Real-Time Bidding | Equipment Focus | Logistics Integration |
|----------|-------------------|-----------------|----------------------|
| **eBay** | ❌ (polling-based) | General | ❌ |
| **TractorHouse** | ✅ (limited) | ✅ Farming | ⚠️ (manual quotes) |
| **AgriBid** | ✅ (Convex-powered) | ✅ Farming | ✅ (API-driven estimates) |

### Solution Strategy:
AgriBid bridges the trust gap through:
1. **Mandatory Inspection Reports**: Multi-photo galleries with machine hour meters and service logs
2. **Transparent Pricing**: Real-time shipping cost estimates based on buyer location
3. **Verified Seller Profiles**: Better Auth integration with business verification

---

## 3. User Personas & Use Cases

### A. The Seller (Retiring Farmer / Equipment Dealer)
**Goals:**
- Liquidate equipment quickly at fair market value
- Reach a national buyer base without local auction house fees

**Pain Points:**
- Uncertainty about reserve price strategy
- Time investment in photography and documentation

**Use Cases:**
1. Upload 50+ high-resolution photos via drag-and-drop
2. Auto-populate equipment specifications using make/model lookup
3. Set reserve price with guidance from comparable sales data
4. Monitor bid activity via real-time dashboard

---

### B. The Buyer (Active Producer / Investment Buyer)
**Goals:**
- Acquire late-model machinery with verifiable low hours
- Avoid bidding wars through strategic proxy bidding

**Pain Points:**
- Hidden transport costs inflate final purchase price
- Difficulty verifying equipment condition remotely

**Use Cases:**
1. Filter auctions by max operating hours, location radius, and budget
2. View 360° photo galleries with zoom capability
3. Set maximum bid and receive push notifications when outbid
4. Calculate total landed cost (bid + transport + VAT)

---

### C. The Platform Administrator
**Goals:**
- Maintain marketplace integrity
- Resolve disputes efficiently

**Use Cases:**
1. Review flagged listings for compliance
2. Generate analytics reports (GMV, conversion rates, avg. bid-to-ask ratio)
3. Moderate user disputes with access to immutable bid logs

---

## 4. Feature List (Prioritised by MVP Phases)

### Phase 1: MVP - Core Auction Engine
**Must-Have:**
1. [x] **User Authentication (Better Auth)**
   - Email/password registration
   - Role-based access (Buyer / Seller / Admin)

2. [x] **Listing Creation**
   - Multi-step form: Equipment details → Photos → Pricing → Review
   - Fields: Make, Model, Year, Operating Hours, Location, Reserve Price
   - Image upload to Convex File Storage

3. [x] **Real-Time Bidding (Convex)**
   - **Soft Close**: Auction extends by 2 minutes if bid placed in final 2 minutes
   - Live price updates via Convex reactive queries

4. [x] **Auction Dashboard**
   - Grid view of active auctions
   - Countdown timers (using `Date.now()` comparisons)

**Nice-to-Have:**
- Basic proxy bidding (users set max bid, system auto-increments)

---

### Phase 2: Trust & Transparency
**Must-Have:**
1. [x] **Inspection Gallery**
   - Lightbox view
   - Required photos: Front view (Required), Engine, Cabin, Rear (Recommended)

2. [ ] **Condition Reports**
   - Seller-uploaded PDFs (service logs, repair invoices)
   - Admin verification badge for reviewed reports

3. [x] **Seller Verification**
   - Badge system: "Verified User" (Role-based)

**Nice-to-Have:**
- Video upload support (30-second equipment walkarounds)

---

### Phase 3: Logistics & Finalisation
**Must-Have:**
1. [ ] **Shipping Calculator Integration**
   - API integration with haulage providers (e.g., Shiply, uShip)
   - Display estimated transport cost on listing page
   - Buyer can request formal quotes post-auction

2. [ ] **Payment Escrow**
   - Stripe Connect integration for seller payouts
   - Buyer deposit system (10% of winning bid, refundable if item misrepresented)

3. [ ] **Dispute Resolution**
   - Buyer can open case within 48 hours of collection
   - Admin mediation interface

**Nice-to-Have:**
- Automated VAT calculation for cross-border sales

---

### Phase 4: Advanced Features (Post-Launch)
- **AI-Powered Pricing Suggestions**: Use historical sales data to recommend reserve prices
- **Mobile App**: React Native wrapper for iOS/Android
- **Live Auction Events**: Scheduled "mega-auctions" with simulcast video
- **Finance Calculator**: Integrate agricultural lending partners for buyer financing options

---

## 5. File Structure:
The project uses a monorepo-style structure where all application code resides within the `app/` directory.

```
/ (Project Root)
├── app/ (Application Root)
│   ├── convex/
│   │   ├── schema.ts
│   │   ├── auctions.ts (queries/mutations)
│   │   ├── seed.ts (static equipment & mock data)
│   │   ├── betterAuth/
│   │   ├── cron.ts
│   │   └── http.ts
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/ (Shadcn components)
│   │   │   ├── AuctionCard.tsx
│   │   │   ├── BidForm.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   └── App.tsx
│   ├── tailwind.config.js
│   └── package.json
├── Brief.md
├── Checklist.md
└── README.md
```

---

## 5. Technical Architecture

### 5.1 Stack Overview
┌─────────────────────────────────────────┐
│         Frontend (Vite + React)         │
│  • TypeScript                           │
│  • Tailwind CSS + Shadcn/UI             │
│  • React Router DOM                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│       Auth Layer (Better Auth)          │
│  • Convex Component                     │
│  • Email/Password                       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│       Backend (Convex)                  │
│  • Reactive Queries                     │
│  • ACID Transactions (Mutations)        │
│  • Scheduled Functions (Cron)           │
│  • File Storage (Images)                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│       Data Layer (Convex DB)            │
│  Tables:                                │
│  • user                                 │
│  • auctions                             │
│  • bids                                 │
└─────────────────────────────────────────┘


### 5.2 Starting Convex Schema Design
```typescript
// app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Static lookup table for equipment makes/models
  equipmentMetadata: defineTable({
    make: v.string(),
    models: v.array(v.string()),
    category: v.string(), // e.g., "Tractor", "Combine"
  }).index("by_make", ["make"]),

  auctions: defineTable({
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    reservePrice: v.number(),
    startingPrice: v.number(),
    currentPrice: v.number(),
    minIncrement: v.number(),
    startTime: v.number(),
    endTime: v.number(),
    sellerId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("active"),
      v.literal("sold"),
      v.literal("unsold")
    ),
    images: v.object({
      front: v.optional(v.string()), // storageId
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.array(v.string()),
    }),
    conditionChecklist: v.optional(v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    })),
  })
    .index("by_status", ["status"])
    .index("by_seller", ["sellerId"])
    .index("by_end_time", ["endTime"]),

  bids: defineTable({
    auctionId: v.id("auctions"),
    bidderId: v.string(),
    amount: v.number(),
    timestamp: v.number(),
  })
    .index("by_auction", ["auctionId", "timestamp"])
    .index("by_bidder", ["bidderId"]),

  user: defineTable({
    name: v.string(),
    email: v.string(),
    // Better Auth fields (some are optional/null depending on provider)
    userId: v.optional(v.union(v.null(), v.string())), 
    role: v.optional(v.string()),
  }).index("by_userId", ["userId"]), // Note: Index excludes records where userId is null/undefined
});
```

### 5.3 Starting Core Convex Functions

#### Mutation: `placeBid`
```typescript
// app/convex/auctions.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const placeBid = mutation({
  args: { auctionId: v.id("auctions"), amount: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "active") throw new Error("Auction not active");
    
    // Enforce Minimum Bid Increment
    const minimumRequired = auction.currentPrice + auction.minIncrement;
    if (args.amount < minimumRequired) {
      throw new Error(`Bid must be at least R${minimumRequired}`);
    }

    // Extend auction if bid placed in final 2 minutes
    const timeRemaining = auction.endTime - Date.now();
    const newEndTime =
      timeRemaining < 120000
        ? Date.now() + 120000
        : auction.endTime;

    await ctx.db.patch(args.auctionId, {
      currentPrice: args.amount,
      endTime: newEndTime,
    });

    await ctx.db.insert("bids", {
      auctionId: args.auctionId,
      bidderId: user.subject,
      amount: args.amount,
      timestamp: Date.now(),
    });
  },
});
```

#### Query: `getActiveAuctions`
```typescript
export const getActiveAuctions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});
```

#### Scheduled Function: `settleAuctions`
```typescript
// convex/cron.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "settle_auctions",
  { minutes: 1 }, // Check every minute
  internal.auctions.settleExpiredAuctions
);

export default crons;
```

---

## 6. UI/UX Design Principles

### Design System (Tailwind + Shadcn/UI)
- **Colour Palette**: Earth tones (olive greens, warm browns) to reflect agricultural heritage
- **Typography**: Inter for UI, Lora for headings (conveys trust)
- **Component Library**: Shadcn/UI for consistency (buttons, forms, modals)

### Key Pages:

#### 1. Home Page (`/`)
- **Hero Section**: Search bar + featured auctions carousel
- **Filter Sidebar**: Equipment type, location radius, max hours, price range
- **Auction Grid**: Card-based layout with:
  - Hero image
  - Title (Make + Model)
  - Current bid
  - Countdown timer
  - "Watch" button

#### 2. Auction Detail Page (`/auction/:id`)
- **Left Column**: Image gallery (main image + thumbnails)
- **Right Column**:
  - Equipment specs table
  - Current bid + bid history (collapsible)
  - Bid form (amount input + "Place Bid" button)
  - Shipping calculator (postcode input → API call → estimate display)

#### 3. Seller Dashboard (`/dashboard/seller`)
- **My Listings**: Tabs (Draft / Active / Ended)
- **Analytics**: Total views, bid count, conversion rate
- **Create Listing**: Button → multi-step form modal

---

**Core Requirements:**

1. **Authentication (Better Auth + Convex)**
   - Set up Better Auth as a Convex component
   - Implement email/password and Google OAuth
   - Create role-based access (buyer/seller/admin)
   - Generate auth schema using `@better-auth/cli`

2. **Database Schema (Convex)**
   - Create `auctions` table with fields:
     - title, make, model, year, operatingHours, location
     - reservePrice, startingPrice, currentPrice
     - startTime, endTime, status (draft/active/sold/unsold)
     - images (array of Convex Storage IDs)
   - Create `bids` table with auctionId, bidderId, amount, timestamp
   - Add indexes for status, seller, and end time

3. **Bidding Engine**
   - Mutation `placeBid` with validation:
     - Check bid > currentPrice
     - Implement "soft close" (extend by 2 min if bid in final 2 min)
     - Update auction's currentPrice and endTime
   - Query `getActiveAuctions` filtered by status
   - Scheduled function (cron) to settle expired auctions every minute

4. **Frontend Components (React + TypeScript)**
   - **Home Page**:
     - Auction grid with cards showing image, title, current bid, timer
     - Filter sidebar (equipment type, location, hours, price)
   - **Auction Detail Page**:
     - Image gallery with lightbox
     - Live bid history (use Convex `useQuery` for reactivity)
     - Bid submission form with optimistic updates
   - **Seller Dashboard**:
     - "Create Listing" multi-step form
     - Image upload to Convex File Storage
     - Analytics (views, bids, conversion rate)

5. **Real-Time Features**
   - Use Convex's `useQuery` hook for live price updates
   - Countdown timer component using `Date.now()` comparisons
   - Toast notifications when outbid (Shadcn toast component)

6. **Styling (Tailwind + Shadcn/UI)**
   - Use earth-tone colour palette (greens, browns)
   - Responsive grid layouts for auction cards
   - Accessible forms with proper ARIA labels

---

## 7. Non-Functional Requirements

### Performance:
- **Page Load Time**: < 2s on 4G connection
- **Time to Interactive**: < 3s
- **Bid Submission Latency**: < 200ms (p95)

### Security:
- **Authentication**: Better Auth with secure password hashing (bcrypt)
- **HTTPS Only**: Enforce SSL in production
- **Rate Limiting**: Max 10 bids per user per minute (Convex middleware)

### Scalability:
- **Concurrent Users**: Support 10,000+ simultaneous bidders
- **Database**: Convex auto-scales; no manual sharding required

### Accessibility:
- **WCAG 2.1 AA Compliance**: Keyboard navigation, screen reader support
- **Colour Contrast**: 4.5:1 minimum ratio

---

## 8. Development Plan & Milestones

### Sprint 1 (Weeks 1-2): Foundation
- [ ] Set up Vite + React + TypeScript project
- [ ] Configure Convex (schema, basic queries)
- [ ] Integrate Better Auth (email/password)
- [ ] Build NavBar + Home page skeleton

### Sprint 2 (Weeks 3-4): Core Bidding
- [ ] Implement `placeBid` mutation
- [ ] Build Auction Detail page
- [ ] Add real-time bid updates (Convex `useQuery`)
- [ ] Create countdown timer component

### Sprint 3 (Weeks 5-6): Listings & Images
- [ ] Build "Create Listing" form (multi-step)
- [ ] Integrate Convex File Storage
- [ ] Implement image gallery component
- [ ] Add seller dashboard

### Sprint 4 (Weeks 7-8): Trust Features
- [ ] Add condition report uploads
- [ ] Build seller verification system
- [ ] Implement admin review interface

### Sprint 5 (Weeks 9-10): Logistics
- [ ] Integrate shipping calculator API
- [ ] Build payment escrow (Stripe Connect)
- [ ] Add dispute resolution workflow

### Sprint 6 (Weeks 11-12): Polish & Launch
- [ ] Performance optimisation (lazy loading, code splitting)
- [ ] Accessibility audit
- [ ] Beta testing with 50 users
- [ ] Production deployment (Vercel/Netlify + Convex Cloud)

