# UI/UX Design System

This document describes the design system for AgriBid, including color palette, typography, component library, and design principles.

## Design Philosophy

AgriBid's design reflects the agricultural heritage of its marketplace:
- **Professional & Robust**: Projects reliability, strength, and industry expertise
- **Intuitive UX**: Modern and streamlined interface despite the complexity of bidding and listing
- **Trust & Transparency**: Clear visual hierarchy emphasizing important information

---

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#2D5016` (Dark Olive Green) | Primary buttons, headers, active states |
| Primary Light | `#4A7C23` | Hover states, secondary accents |
| Primary Dark | `#1A3009` | Pressed states, emphasis |

### Secondary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Secondary | `#8B4513` (Saddle Brown) | Secondary buttons, accents |
| Secondary Light | `#A0522D` | Hover states |
| Secondary Dark | `#654321` | Pressed states |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#FAFAF9` | Page backgrounds |
| Surface | `#FFFFFF` | Card backgrounds, modals |
| Border | `#E5E5E5` | Dividers, input borders |
| Text Primary | `#171717` | Main text |
| Text Secondary | `#525252` | Secondary text, labels |
| Text Muted | `#A3A3A3` | Placeholders, disabled text |

### Status Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success | `#16A34A` | Success messages, verified badges |
| Warning | `#D97706` | Warnings, pending status |
| Error | `#DC2626` | Errors, validation failures |
| Info | `#2563EB` | Informational notices |

### Auction Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| Active | `#16A34A` (Green) | Live auctions |
| Draft | `#A3A3A3` (Gray) | Draft listings |
| Pending Review | `#D97706` (Amber) | Awaiting admin approval |
| Sold | `#2563EB` (Blue) | Successfully sold |
| Unsold | `#DC2626` (Red) | Ended without sale |
| Rejected | `#DC2626` (Red) | Rejected by admin |

---

## Typography

### Font Families

| Name | Usage | Source |
|------|-------|--------|
| Inter | UI elements, body text | Google Fonts |
| Lora | Headings, titles | Google Fonts |

### Font Sizes

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| xs | 12px | 16px | Labels, captions |
| sm | 14px | 20px | Secondary text |
| base | 16px | 24px | Body text |
| lg | 18px | 28px | Large body text |
| xl | 20px | 28px | Subheadings |
| 2xl | 24px | 32px | Section headings |
| 3xl | 30px | 40px | Page titles |
| 4xl | 36px | 44px | Hero text |

### Font Weights

| Name | Value | Usage |
|------|-------|-------|
| Normal | 400 | Body text |
| Medium | 500 | Labels, emphasis |
| Semibold | 600 | Headings, buttons |
| Bold | 700 | Important text |

---

## Spacing System

Based on 4px grid system:

| Name | Value | Usage |
|------|-------|-------|
| 0 | 0 | No spacing |
| 1 | 4px | Tight spacing |
| 2 | 8px | Icon padding |
| 3 | 12px | Component internal |
| 4 | 16px | Standard padding |
| 5 | 20px | Section spacing |
| 6 | 24px | Card padding |
| 8 | 32px | Section gaps |
| 10 | 40px | Large gaps |
| 12 | 48px | Page margins |
| 16 | 64px | Hero sections |

---

## Component Library

### Shadcn/UI Components

AgriBid uses [Shadcn/UI](https://ui.shadcn.com/) as the base component library. All components are customized with the project's design tokens.

#### Core Components

| Component | Usage | Location |
|-----------|-------|----------|
| Button | Actions, forms | `components/ui/button.tsx` |
| Input | Text fields | `components/ui/input.tsx` |
| Select | Dropdowns | `components/ui/select.tsx` |
| Checkbox | Boolean selections | `components/ui/checkbox.tsx` |
| Dialog | Modals, forms | `components/ui/dialog.tsx` |
| Table | Data display | `components/ui/table.tsx` |
| Card | Content containers | `components/ui/card.tsx` |
| Badge | Status indicators | `components/ui/badge.tsx` |
| Alert | Notifications | `components/ui/alert.tsx` |
| Tabs | Content switching | `components/ui/tabs.tsx` |
| Textarea | Multi-line input | `components/ui/textarea.tsx` |
| Label | Form labels | `components/ui/label.tsx` |
| Dropdown Menu | Menus, actions | `components/ui/dropdown-menu.tsx` |
| Accordion | Collapsible content | `components/ui/accordion.tsx` |

### Custom Components

#### Auction Components

| Component | Description | Location |
|-----------|-------------|----------|
| AuctionCard | Main auction listing card | `components/auction/AuctionCard.tsx` |
| AuctionCardThumbnail | Card image thumbnail | `components/auction/AuctionCardThumbnail.tsx` |
| AuctionCardPrice | Price display with formatting | `components/auction/AuctionCardPrice.tsx` |
| AuctionHeader | Auction detail header | `components/AuctionHeader.tsx` |
| CountdownTimer | Live countdown display | `components/CountdownTimer.tsx` |
| ImageGallery | Photo gallery with lightbox | `components/ImageGallery.tsx` |

#### Bidding Components

| Component | Description | Location |
|-----------|-------------|----------|
| BidForm | Bid input form | `components/bidding/BidForm.tsx` |
| BiddingPanel | Bidding controls panel | `components/bidding/BiddingPanel.tsx` |
| BidHistory | Bid history list | `components/bidding/BidHistory.tsx` |
| BidConfirmation | Bid confirmation modal | `components/BidConfirmation.tsx` |

#### Listing Wizard Components

| Component | Description | Location |
|-----------|-------------|----------|
| WizardNavigation | Step navigation | `components/listing-wizard/WizardNavigation.tsx` |
| StepIndicator | Step progress indicator | `components/listing-wizard/StepIndicator.tsx` |
| GeneralInfoStep | Equipment details step | `components/listing-wizard/steps/GeneralInfoStep.tsx` |
| TechnicalSpecsStep | Technical specifications | `components/listing-wizard/steps/TechnicalSpecsStep.tsx` |
| MediaGalleryStep | Image upload step | `components/listing-wizard/steps/MediaGalleryStep.tsx` |
| ReviewSubmitStep | Final review step | `components/listing-wizard/steps/ReviewSubmitStep.tsx` |

#### Admin Components

| Component | Description | Location |
|-----------|-------------|----------|
| AdminLayout | Admin page layout | `components/admin/AdminLayout.tsx` |
| StatCard | Statistics card | `components/admin/StatCard.tsx` |
| SummaryCard | Summary display | `components/admin/SummaryCard.tsx` |
| ModerationCard | Listing moderation card | `components/admin/ModerationCard.tsx` |
| SupportTab | Support tickets tab | `components/admin/SupportTab.tsx` |
| AuditTab | Audit logs tab | `components/admin/AuditTab.tsx` |
| BidMonitor | Real-time bid monitor | `components/admin/BidMonitor.tsx` |

---

## Responsive Design

### Breakpoints

| Name | Width | Target |
|------|-------|--------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Small laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large screens |

### View Modes

AgriBid supports two marketplace view modes:

1. **Detailed View**
   - Full auction cards with all information
   - Larger images
   - Best for desktop browsing

2. **Compact View**
   - Condensed cards for mobile
   - Smaller images
   - Optimized for high-density browsing on mobile devices

---

## Accessibility

### WCAG 2.1 AA Compliance

- **Color Contrast**: Minimum 4.5:1 ratio for text
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and roles
- **Focus Indicators**: Visible focus states on all interactive elements

### Implementation

- Semantic HTML elements
- ARIA roles where necessary
- `aria-label` for icon-only buttons
- `aria-describedby` for form validation
- Skip links for main content

---

## Animations & Transitions

### Timing Functions

| Name | Value | Usage |
|------|-------|-------|
| Default | 200ms ease-in-out | Standard transitions |
| Fast | 150ms ease-out | Hover states |
| Slow | 300ms ease-in-out | Page transitions |

### Common Animations

- **Countdown Timer**: Pulse animation when under 1 minute
- **Bid Update**: Highlight animation when price changes
- **Card Hover**: Subtle lift with shadow
- **Modal**: Fade in/out with scale

---

## Layout Structure

### Page Layout

```
┌─────────────────────────────────────────┐
│              Header/Nav                  │
├─────────────────────────────────────────┤
│  Sidebar (optional)  │    Main Content  │
│                      │                  │
│                      │                  │
│                      │                  │
├─────────────────────────────────────────┤
│                Footer                    │
└─────────────────────────────────────────┘
```

### Auction Card Layout

```
┌─────────────────────────┐
│    [Image Thumbnail]   │
├─────────────────────────┤
│  Title (Make + Model)   │
│  Year | Hours           │
├─────────────────────────┤
│  Current Bid            │
│  [Countdown Timer]      │
├─────────────────────────┤
│  [Watch] [Bid Button]   │
└─────────────────────────┘
```

---

*Last Updated: 2026-03-02*
