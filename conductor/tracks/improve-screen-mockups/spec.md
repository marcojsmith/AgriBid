# Spec: New screen design + AgriBid design system

## Goal

1. Ship the approved mockup board (`mockups.html`, rubric round 10) for the three core screens: **Home** (`/`), **Auction event** (`/auctions/:id`), **Lot detail** (`/auction/:id`).
2. Define one **design system** (tokens, type, spacing, components, content and imagery rules) that is implemented in code and documented, so the rest of the app can be migrated screen by screen afterwards.

Out of scope here: migrating other screens (dashboard, profile, seller wizard, admin, KYC, FAQ). After this track merges, the owner reviews and the rollout gets its own track.

## Sources of truth

- Visual: `mockups.html` (+ `final/*.png`), desktop 1440 and phone 375, light and dark.
- Rationale and constraints: `feedback.md` (CMO review), `rubric.md`, `review-round-10.md`.
- Current code: `src/index.css` (tokens), `src/components/ui/*` (shadcn), `docs/architecture/ui-design/theme.md` (out of date: documents hex values that don't match `index.css`).

## Design system (what gets defined)

### Tokens (`src/index.css`, `@theme` + `:root` / `.dark`)

| Group    | Tokens                                                                                                            | Values (light / dark), from the mockup                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces | background, card, muted, border                                                                                   | warm cream `40 30% 98%` / `150 6% 7%`; card `#fff` / `150 5% 11%`; muted `40 20% 92%` / `150 4% 15%`; border `24 10% 86%` / `150 4% 22%` |
| Text     | foreground, muted-foreground                                                                                      | `24 10% 10%` / `40 20% 95%`; `24 10% 36%` / `40 6% 68%`                                                                                  |
| Brand    | primary, primary-foreground, primary-soft, secondary (earth brown)                                                | `142 30% 25%` / `142 35% 58%`; soft `142 25% 93%` / `142 20% 15%`; brown `35 30% 45%` / `35 35% 62%`                                     |
| Buttons  | btn (filled primary in both themes)                                                                               | `142 30% 25%` / `142 36% 32%` with light text in both themes                                                                             |
| Hero     | hero, hero-foreground, hero-muted                                                                                 | `142 30% 12%` / `142 32% 17%`                                                                                                            |
| Status   | live, soon, urgent, sold, passed: each `-solid` (badge fill, white text), `-soft` (pill bg), `-fg` (text on soft) | see mockup `--live-*`, `--soon-*`, `--urgent-*`; sold = info blue, passed = neutral                                                      |
| Feedback | ok-fg, warn-fg, destructive                                                                                       | as mockup; all ≥ 4.5:1 on their backgrounds                                                                                              |

Every text/background pair must pass WCAG AA in both themes. `src/lib/theme-tokens.test.ts` asserts the contrast pairs.

### Type

- **Lora** (display: h1 to h3, prices on the lot page, hero) loaded in `index.html`; **Inter** for UI. `font-display` / `font-sans` theme vars.
- Scale (px): 12 · 13 · 14 · 15 · 17 · 19/21 · 22 · 26/28 · 36. Body 15, meta 13, eyebrow 12 uppercase tracking.
- Money and times use `tabular-nums` (utility `.num`). No monospace timers.

### Shape, space, elevation

- Spacing on a 4px rhythm. Radius: 4px (`rounded-sm`) and 6px (`rounded-md`) on UI; 8px (`rounded-lg`) only for images and avatars; pills are `rounded-sm`, not full.
- Separation with borders and dividers, not shadows; no card-in-card.
- Tap targets ≥ 44px below 760px. Visible `:focus-visible` ring (2px primary, 2px offset).
- Breakpoints: the mockup's 760 / 1080 container breakpoints map to Tailwind defaults `md` (768) and `lg` (1024); no custom breakpoints. Unprefixed classes are phone.

### Components (domain layer on top of shadcn)

`StatusBadge` (one status system: ● Live · Opens [date] · Closing soon · Sold · Passed in), `ReservePill`, `Money` (`R 200 000`, no cents), `Countdown` (neutral, amber < 1 h, red < 2 min, "SAST" dates), `PhotoFrame` (16:9 / 4:3, `object-fit: cover`, branded empty state), `EventMosaic`, `SaleTerms`, `SpecTable`, `ConditionReport` (icon + text, never colour only), `SectionHeader` (h2 + right-aligned controls), `SegmentedControl`, `FilterChips`, `StickyActionBar`. shadcn primitives restyled to the tokens: `Button` (sizes incl. 44px mobile), `Badge`, `Input`, `Tabs`, `Card` (rarely used).

### Content rules

- ZAR as `R 200 000` (narrow no-break spaces), no cents. Labels: Opening bid / Current bid / Sold for.
- Dates `Sat 22 Nov, 10:00 SAST`; no seconds; no internal states or DB ids in UI.
- Plain South African English; no jargon ("about", not "est.").

### Imagery

Events 16:9 (3-photo mosaic from lead lots), lots and gallery 4:3, labelled angles (Front · Engine · Cab · Rear), gallery counter = real photo count, branded empty state when no photo.

## Data the design needs

| Need                                                              | Exists?                                                                | Plan                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Buyer's premium %                                                 | Yes: `auctions.defaultBuyerPremiumPct`, `lots.resolvedBuyerPremiumPct` | Use it; hide the fee row if unset                           |
| VAT rate                                                          | No                                                                     | Admin setting `vat_rate_pct`, default 15 (WP3c)             |
| Event card summary (lot count, from-price, lead photos, location) | Partly: needs a query change                                           | Query change (WP3a)                                         |
| Lot number within sale                                            | No                                                                     | Stored `lots.lotNumber`, assigned on assignment (WP3b)      |
| Watcher count                                                     | Derivable from `watchlist`                                             | Counter per lot, shown (WP3b)                               |
| Seller response time, province, footer reg/VAT/phone              | No                                                                     | Admin-configurable; hidden while unset (WP3b, WP3c)         |
| Sale terms (payment, viewing, collection)                         | No                                                                     | Platform-wide copy in code                                  |
| Staggered lot closing                                             | No (lots close at `auction.endTime`, soft-close via `extendedEndTime`) | Show one close time; staggering is a separate backend track |

## Definition of done (track)

- All WPs merged; the three screens match the board at 375 and 1440 in light and dark; rubric re-scored ≥ 9 on every item against the **real app** by an Opus reviewer.
- `docs/architecture/ui-design/design-system.md` is the single design reference (`theme.md` merged into it or reduced to a pointer); ADR records the design-system decision.
- lint, tests (coverage ≥ 90%), type-check and build clean; STATUS/CHANGELOG updated; version bumped per PR.
