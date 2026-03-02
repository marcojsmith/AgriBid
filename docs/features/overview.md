# Features Overview

This document provides a comprehensive overview of the AgriBid platform features.

---

## What is AgriBid?

AgriBid is a real-time, high-integrity auction platform purpose-built for the **farming equipment marketplace**. It leverages modern web technologies to deliver a fast, secure, and transparent bidding experience for buyers and sellers of heavy machinery.

---

## Core Value Propositions

### For Buyers

- **Real-Time Bidding**: Sub-200ms latency updates powered by Convex
- **Equipment Transparency**: Detailed inspection galleries, condition reports
- **Trust & Verification**: Verified seller profiles
- **Mobile-First Design**: Browse and bid from anywhere

### For Sellers

- **National Reach**: Access buyers across the country
- **Low Fees**: No local auction house overhead
- **Real-Time Analytics**: Monitor bid activity live
- **Easy Listing**: Multi-step wizard with guidance

### For Administrators

- **Moderation Tools**: Review and approve listings
- **KYC Verification**: Verify seller identities
- **Analytics Dashboard**: Track platform metrics
- **Support System**: Handle user inquiries

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + Vite + TypeScript | User interface |
| Styling | Tailwind CSS + Shadcn/UI | Design system |
| Backend | Convex | Real-time database & functions |
| Auth | Better Auth | User authentication |
| Deployment | Vercel | Hosting & CDN |

---

## Key Terminology

| Term | Definition |
|------|------------|
| **Auction** | A listing for equipment being sold |
| **Bid** | An offer to purchase at a specific price |
| **Reserve Price** | Minimum price seller will accept (hidden) |
| **Starting Price** | Opening bid amount |
| **Soft Close** | Automatic extension when bid placed in final 2 minutes |
| **Proxy Bid** | Automatic bidding up to a maximum |
| **KYC** | Know Your Customer - identity verification |

---

## User Types

### Guests
- Browse active auctions
- View auction details
- Search and filter listings
- Register/login to participate

### Buyers
- All guest capabilities
- Place bids on auctions
- Create watchlists
- View bid history
- Win auctions

### Sellers
- All buyer capabilities
- Create auction listings
- Manage own listings
- View sales analytics
- Cancel listings (if no bids)

### Administrators
- All capabilities
- Moderate listings
- Manage KYC verification
- Handle support tickets
- View analytics
- Manage users

---

## Feature Categories

### 1. Marketplace
- Browse active auctions
- Search and filter
- View auction details
- Image galleries
- View seller information

### 2. Bidding
- Place manual bids
- Set proxy bids (planned/in progress)
- View bid history
- Real-time price updates
- Outbid notifications

### 3. Listings
- Create listings (multi-step wizard)
- Upload images
- Set pricing
- Edit drafts
- Track status

### 4. User Accounts
- Registration (email/password)
- OAuth (Google)
- Profile management
- Role management (buyer/seller)
- KYC verification

### 5. Administration
- Dashboard with metrics
- Listing moderation
- KYC review
- Support ticket management
- Audit logs
- Announcements

---

## Architecture Highlights

### Real-Time Updates

All auction data uses Convex's reactive queries:
- Price updates propagate automatically
- Bid history updates live
- Status changes reflect immediately

### Security

- AES-256-GCM encryption for PII
- Role-based access control
- Server-side authorization
- Audit logging for admins

### Scalability

- Convex auto-scales with demand
- No manual database management
- Efficient queries with indexes
- Optimistic UI updates

---

## Documentation Structure

This `docs/` folder contains detailed documentation for:

- **Database**: Schema, relationships, migrations
- **UI/UX**: Design system, components, pages
- **Data Flow**: Authentication, bidding, listing processes
- **Security**: Authentication, data protection, access control
- **Features**: Completed and planned features

---

## Getting Started

### For Users
1. Register an account
2. Complete profile
3. Browse auctions
4. Place bids

### For Sellers
1. Register as seller (or upgrade)
2. Complete KYC verification
3. Create listing via wizard
4. Wait for approval
5. Monitor bids

### For Administrators
1. Access admin dashboard
2. Review pending listings
3. Process KYC applications
4. Handle support tickets
5. Monitor platform health

---

*Last Updated: 2026-03-02*
