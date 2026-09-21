# Product Vision

## Purpose

AgriBid is a real-time, high-integrity auction platform for the agricultural machinery marketplace (tractors, harvesters, implements). Equipment typically sells for $50k-$500k, and buyers hesitate to transact online without inspection transparency. AgriBid closes that trust gap with verified sellers, condition data and immutable bid history, delivered with low-latency bidding.

## Audience

- **Guests**: prospective buyers and sellers exploring before creating an account.
- **Buyers**: farmers and equipment dealers buying used machinery with confidence.
- **Sellers**: farmers or companies liquidating machinery quickly at fair market value through a national buyer base.
- **Administrators**: platform staff who maintain marketplace integrity, moderate disputes and review listings.

## Goals

- **Transparency**: verified information and instantaneous bid updates.
- **Efficiency**: low-latency interactions and intuitive listing tools for heavy-machinery auctions.
- **Market integrity**: verified seller profiles and append-only bid histories.

## Differentiators

- Real-time bidding via Convex reactive queries (target sub-200ms).
- Farming-specific data: condition reports, operating hours, hierarchical Category -> Make -> Model lookup.
- Mandatory inspection galleries (Front required; Engine, Cabin, Rear recommended).
- Anti-sniping soft close.

## Core features

- **Real-time bidding engine**: reactive prices, soft close (a bid in the final 2 minutes extends the auction by 2 minutes), proxy bidding.
- **Listing wizard**: multi-step, draft persistence, metadata lookups, guided condition checklist, pricing intelligence; sellers manage drafts and publish from a dashboard.
- **Auction dashboard**: grid of live auctions with countdowns, watchlist, and a grouped "My Bids" view showing status and exposure.
- **Secure authentication**: Clerk, email/password and Google OAuth; roles Buyer, Seller, Admin.
- **Trust and administration**: KYC review, listing moderation, equipment catalog, audit trails, support tickets, live KPI monitoring.

## Non-functional requirements

- **Performance**: p95 bid submission under 200ms; page load under 2s on 4G.
- **Accessibility**: WCAG 2.1 AA (keyboard navigation, screen readers, 4.5:1 contrast).
- **Security**: HTTPS only, granular rate limiting, PII encrypted at rest.
- **Responsive**: fully usable on mobile, since many farmers work from the field.
- **Privacy**: adherence to data protection regulation (e.g. GDPR).
- **Scalability**: efficient pagination on all major data streams; admin tools to tune system limits.

## Brand and tone

- **Professional and robust**: the brand projects reliability, strength and industry expertise, echoing the durable machinery. The interface stays modern and intuitive.

### Communication tone

- **Professional and direct**: clear, precise, efficient copy; direct about transaction details and auction states; no unnecessary jargon.
- **Trust-centric**: reinforce security and transparency so users trust the marketplace.
- **Expert and precise language**: assume expertise; use industry terms (PTO, hour meter, hydraulic flow) accurately and without over-explanation.

### Visual design

- **Clarity and utility**: prioritise information hierarchy and density, especially on the auction dashboard. Current bids, timers and specs must be immediately parseable.
- **Premium marketplace aesthetic**: polished, high-end look with professional photography and modern stylized icons.
- **Imagery**: equipment photos presented professionally, emphasising quality and scale.
- **Iconography**: clean, modern icons that industry professionals recognise.

### Notifications and alerts

- **High urgency for critical events**: outbids, wins and "ending soon" alerts are prominent and immediate (real-time toasts).
- **Action-oriented**: every alert gives a clear next step.
