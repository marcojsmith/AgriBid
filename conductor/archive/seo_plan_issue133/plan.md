# SEO Implementation Plan — AgriBid (Issue #133)

Phases are ordered easiest-to-hardest within each tier. Items marked ✅ are complete.

---

## Phase 1 — Critical Foundation

### ✅ 1.1 Meta Tag Management

React-helmet-async installed and wired up. Per-page `<Helmet>` on Home and AuctionDetail with title, description, canonical, Open Graph, and Twitter Card tags. Default fallback Helmet in Layout.

### ✅ 1.2 Structured Data (JSON-LD)

- `Organization` schema injected globally from Layout.
- `Product` + `Offer` schema injected per-auction on AuctionDetail.
- `noindex` set for non-active (closed/ended) auctions.

### ✅ 1.3 Technical Foundation

- `public/robots.txt` — disallows `/admin/`, `/dashboard/`, `/kyc`, `/watchlist`, `/notifications`, `/login`, `/support`.
- `public/sitemap.xml` — static entries for `/` and `/sell` (protected routes excluded).
- `src/lib/seo.ts` — centralised `SITE_URL`, `buildTitle`, `buildCanonical`, `buildAuctionDescription`, `truncate`, `buildBreadcrumbSchema` helpers.

### ✅ 1.4 Performance Optimisation

#### ✅ 1.4.1 Lazy-load images (`loading="lazy"`)

Added `loading="eager"` to hero image and `loading="lazy"` to lightbox/thumbnail images in `ImageGallery.tsx`, and `loading="lazy"` to card images in `AuctionCardThumbnail.tsx`.

#### ✅ 1.4.2 Explicit image dimensions

Images use Tailwind `aspect-*` and `object-cover` classes — CLS is handled by the aspect containers; no explicit width/height needed.

#### ✅ 1.4.3 `<link rel="preconnect">` hints in `index.html`

Added preconnect for `https://dynamic.convex.cloud`.

---

## Phase 2 — Important Optimisations

### ✅ 2.1 Content & Semantic HTML

#### ✅ 2.1.1 Alt text on all auction images

`AuctionCardThumbnail` now accepts `make` and `model` props; alt text uses `"${make} — ${model} — ${title}"` pattern. `AuctionCard` passes `make` and `model` through. `ImageGallery` already had descriptive alt text.

#### ✅ 2.1.2 Heading hierarchy audit

Home page `<h2>` promoted to `<h1>`. AuctionDetail `<h1>` is in `AuctionHeader`. Description and bid history sections use `<h2>`.

#### ✅ 2.1.3 Semantic landmark elements

AuctionDetail: Description wrapped in `<section aria-label="Equipment Description">`, bidding panel in `<aside aria-label="Bidding">`, bid history in `<section aria-label="Bid History">`.

---

### ✅ 2.2 Local SEO (South Africa focus)

#### ✅ 2.2.1 `LocalBusiness` / `Place` schema on location

`productSchema.offers` in AuctionDetail now includes `availableAtOrFrom` with `Place` + `PostalAddress addressCountry: "ZA"` when `auction.location` is set.

#### ✅ 2.2.2 ZAR currency consistency

All Offer schemas use `priceCurrency: "ZAR"`. Visible prices use "R" prefix consistently.

#### ✅ 2.2.3 `hreflang` default (en-ZA)

Added `<link rel="alternate" hreflang="en-ZA" href={SITE_URL} />` in the default Layout Helmet.

---

### ✅ 2.3 Internal Linking & Breadcrumbs

#### ✅ 2.3.1 Breadcrumb component + `BreadcrumbList` JSON-LD

`src/components/Breadcrumb.tsx` renders `<nav aria-label="breadcrumb">` and injects `BreadcrumbList` JSON-LD via `<Helmet>`. `buildBreadcrumbSchema` helper added to `src/lib/seo.ts`. AuctionDetail uses `<Breadcrumb crumbs={[Home, auction.title]} />` replacing the back button.

#### ✅ 2.3.2 Related auctions section on AuctionDetail

`getRelatedLots` Convex query added to `convex/auctions/queries/browse.ts` (max 4 live lots with same make, excluding current). "More {Make} Equipment" section added at the bottom of the left column in AuctionDetail.

---

### ✅ 2.4 Analytics & Search Console (Admin-Configurable)

#### ✅ 2.4.1 Convex settings keys

`getSeoSettings` (public query) and `updateSeoSettings` (admin mutation) added to `convex/admin/settings.ts`. Keys: `seo.ga4MeasurementId`, `seo.searchConsoleVerification`, `seo.bingVerification`.

#### ✅ 2.4.2 Admin SEO Settings page

`src/pages/admin/AdminSEOSettings.tsx` created with GA4, Search Console, and Bing inputs plus live meta-tag previews. "SEO & Analytics" card added to `AdminSettings`. Route `/admin/seo` registered in `App.tsx`.

#### ✅ 2.4.3 Dynamic script/meta injection in Layout

`Layout.tsx` queries `getSeoSettings` and conditionally injects: GA4 `<script>` tags, `<meta name="google-site-verification">`, `<meta name="msvalidate.01">` — all via react-helmet-async.

---

## Phase 3 — Advanced (Long-term)

### 3.1 Advanced Structured Data

- ✅ `FAQPage` schema on the Support page — FAQ section with 6 Q&As added; `FAQPage` JSON-LD injected via Helmet; page title/description/canonical meta tags added.
- `AggregateRating` / `Review` schema on AuctionDetail once reviews are implemented.
- `Event` schema for scheduled live auction events.

### 3.2 International SEO

- Full `hreflang` matrix when Afrikaans or other language support is added.
- Language toggle in Header.

### 3.3 Voice Search Optimisation

- Add conversational Q&A content blocks on key pages.
- Target featured-snippet-friendly heading structures.

### 3.4 Video Content SEO

- `VideoObject` schema for any condition-report or demo videos attached to auctions.

---

## Effort Key

| Label | Meaning                                  |
| ----- | ---------------------------------------- |
| XS    | < 1 hour, single file                    |
| S     | 1–3 hours, 1–2 files                     |
| M     | half-day, new component or Convex query  |
| L     | full day+, new feature with backend + UI |
