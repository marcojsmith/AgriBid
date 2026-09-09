# Task: Visual refresh — Phase 3 (Auction detail: header, gallery, bidding panel, mobile bid bar)

## Context

Continuing the visual modernization (phase 1: typography/tokens/image fallback — merged; phase 2: marketplace cards/toolbar/filters — merged). This phase covers **sections 1 (title hierarchy), 2 (gallery prominence), 5 (mobile bid bar), and 6 (bidding panel simplification)** of the design feedback pasted at the bottom of this file.

Direction: calm typography, clear information hierarchy, thin borders/restrained corners (`border` not `border-2`, `rounded-lg`/`rounded-xl` not `rounded-2xl`/`rounded-3xl`), sentence case instead of uppercase, `font-semibold`/`font-medium` instead of `font-black`/`font-bold` for anything that isn't the primary price. The feedback specifically calls out: _"'Bell L1206E' should be the title, with 'Front-end loader' as supporting text. The current oversized, two-line uppercase heading pushes the equipment image too far down."_

Key files:

- `src/components/AuctionHeader.tsx` — title/badges/watch button, "you won"/"sold" banners
- `src/pages/AuctionDetail.tsx` — page layout, description section, flag section, related-auctions heading, right-column bidding/bid-history/seller sections
- `src/components/bidding/BiddingPanel.tsx` — current bid / countdown / next-min-bid / closed-state UI
- `src/components/bidding/BidForm.tsx` — quick-bid buttons, manual bid input, proxy/auto-bid section
- `src/components/ImageGallery.tsx` — hero image, thumbnails, lightbox (already has broken-image fallback from phase 1 — don't touch that logic)
- Check `src/types/auction.ts` / `convex/schema.ts` for the `auctions` table fields: it has `title` (a marketing-style headline, e.g. "John Deere 8R 410 — Row Crop Titan"), plus separate `make`, `model`, `year` fields. There is no separate "equipment category short name" field on the auction itself beyond `categoryName` (joined in via the query) — use that as the supporting-text equivalent of "Front-end loader" from the feedback example.

## Instructions

### 1. Title hierarchy (`AuctionHeader.tsx`)

The feedback's core complaint is the oversized two-line uppercase title pushing the image down. Since this repo's data model doesn't split "Bell L1206E" from "Front-end loader" the way the feedback's example does, adapt the intent rather than copying it literally:

- Change the `<h1>` (line ~104) from `text-4xl md:text-5xl font-black tracking-tight text-primary uppercase leading-tight` to `text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-snug` — smaller, not uppercase, not forced into the primary brand color (headings don't need to be colored to read as headings).
- Add a supporting subtitle line directly below the `<h1>`, showing `{auction.year} {auction.make} {auction.model}` (e.g. "2017 Bell L1206E") in `text-sm font-medium text-muted-foreground` — this gives the make/model/year prominence similar to what the feedback wants, without inventing data that doesn't exist. Only render it if `auction.make` and `auction.model` are both present (they're required fields per the schema, so this should always render, but guard defensively).
- Badges row (category, year+make, ID, status badges, lines ~72-101): remove `uppercase tracking-wide`/`tracking-widest`/`tracking-wider` from all of them, change `font-bold`/`font-black` to `font-medium`/`font-semibold`. Keep the "SOLD"/"YOU WON"/"UNSOLD" badge text content but convert to sentence case ("Sold", "You won", "Unsold").
- Watch button (lines ~107-123): remove `uppercase tracking-widest`, `font-black` → `font-medium`, `rounded-xl border-2` → `rounded-md border`.
- "Congratulations!" winner banner and "Item Sold" seller banner (lines ~126-156): remove `uppercase tracking-wide` from all text, `font-black`/`font-bold` → `font-semibold`/`font-medium`, `border-2 rounded-xl` → `border rounded-lg`.
- Metadata row (location/hours/year, lines ~158-177): already reasonably calm (`font-medium`) — no changes needed here.

### 2. Image gallery prominence (`ImageGallery.tsx`)

- Add a visible "expand/fullscreen" affordance on the hero image so the lightbox trigger isn't only discoverable by clicking the whole image: add a small icon button overlay (e.g. `Maximize2` or `Expand` from `lucide-react`) in the top-right or bottom-left corner of the hero image (avoid the bottom-right image-count badge already there). It can trigger the same `DialogTrigger` — either wrap it inside the existing trigger button or make it a visually-distinct icon within the same clickable area; `aria-hidden="true"` on the icon since the parent button already has `aria-label="Open full-screen gallery"`.
- Calm corners/borders: hero image container and empty-state placeholder `rounded-2xl border-2` → `rounded-lg border`. Thumbnail `border-2` → `border` (keep the `border-primary`/`ring-primary` active-state treatment as-is — that's a meaningful selection indicator, not noise).

### 3. Bidding panel simplification (`BiddingPanel.tsx`)

Reorganize per the feedback's hierarchy: current bid → time remaining/status → next minimum bid → bid amount + action → auto-bid as optional expandable → fees/verification reassurance. The current DOM order already roughly matches this — focus on calming typography and removing redundant nested boxes, not restructuring the layout wholesale.

- Active-auction current-bid/countdown row (lines ~219-254): remove `uppercase tracking-[0.2em]` from "Current Bid"/"Time Remaining" labels, `font-black` → `font-medium text-xs` (keep them as small caption labels, just not uppercase-tracked). The price itself (`text-4xl font-black tabular-nums`) stays large/bold — that's correct per the feedback, prices should be the boldest element. Reduce `border-2` → `border` on the highlight box.
- "Live" badge: fine as-is, no change needed.
- Closed/ended state (`isEnded`, lines ~256-264): `border-2 border-dashed rounded-xl` → `border border-dashed rounded-lg`; remove `uppercase tracking-widest` from the label, `font-bold` → `font-medium`.
- Soft-close extended alert (lines ~267-277): remove `uppercase tracking-widest`/`uppercase` from title/description, `font-black`/`font-bold` → `font-semibold`/`font-normal`, `rounded-xl border-2` → `rounded-lg border`.
- "Next minimum bid" row (lines ~280-288): already reasonably calm — no changes needed.
- Verification-required alert (lines ~290-316): remove `uppercase tracking-widest`/`uppercase` from title/description, `font-black`/`font-bold` → `font-semibold`/`font-normal`, `rounded-xl border-2` → `rounded-lg border`. Change the button label styling from `font-black uppercase` to `font-medium` (keep link text "Complete KYC Now" as-is, just not force-uppercased). If verification is required, per the feedback the _primary action_ should read "Verify to bid" rather than competing with the warning — this component doesn't currently have a separate always-visible primary CTA button (the `BidForm` below still renders); leave `BidForm`'s own primary button behavior to step 4 below, but do not duplicate a second CTA here.
- Non-active (sold/unsold) state (lines ~77-141): same treatment — remove `uppercase tracking-widest`/`tracking-[0.2em]` throughout, `font-black`/`font-bold` → `font-semibold`/`font-medium`, `border-2 rounded-2xl` → `border rounded-lg`, `rounded-xl border-2` on the "Explore Other Auctions" button → `rounded-md border`.

### 4. Bid form: collapsible auto-bid + calmer quick-bid buttons (`BidForm.tsx`)

- Per the feedback, auto-bid should be an "optional expandable feature," not permanently visible. Change the proxy-bidding section (lines ~152-217) to be collapsed by default and expandable via a toggle (e.g. a small `Button variant="ghost" size="sm"` reading "Auto-bid (optional)" with a chevron, using local `useState` for `isProxyExpanded`) — **except** when `isProxyActive` is true on mount, in which case it should start expanded (the user already has an active proxy bid and needs to see/edit it). The checkbox and its behavior stay the same; only the visibility of the surrounding section becomes toggleable. Don't change the underlying bidding logic (`isProxyEnabled`, `handleManualBid`, `handleQuickBid`, validation) — purely a visibility/UI wrapper around the existing block.
- Quick-bid buttons (lines ~219-241): remove `uppercase tracking-wider` from the "Quick Bid" caption, `font-black` → `font-medium` for the caption and `font-semibold` for the amount (was `font-black`). `border-2` → `border`.
- "Or Enter Custom Amount" divider (lines ~243-252): remove `uppercase`, `font-black tracking-[0.2em]` → `font-medium`.
- Manual bid input + Place Bid button (lines ~254-287): `border-2` → `border` on the input, `rounded-xl` → `rounded-md` on both input and button, button `font-black` → `font-semibold`.
- Validation/help text (lines ~289-311): already calm (`font-bold` on error text is acceptable for urgency) — leave as-is except drop any stray `uppercase` if present (there is none currently in this range — verify).

### 5. Auction detail page polish (`AuctionDetail.tsx`)

- "Auction Starts" banner (lines ~278-289): remove `uppercase tracking-wide`, `font-bold` → `font-medium`, `border-2 rounded-xl` → `border rounded-lg`.
- "Equipment Description" section (lines ~296-341): heading `text-xl font-bold uppercase tracking-tight` → `text-lg font-semibold` (no uppercase). Buttons `rounded-xl font-bold` → `rounded-md font-medium`. Container `border-2 rounded-2xl` → `border rounded-lg`.
- Flag/report section (lines ~343-437): container `border-2 rounded-2xl` → `border rounded-lg` (destructive border color stays).
- "More {make} Equipment" heading (lines ~440-444): `text-lg font-black uppercase tracking-tight` → `text-lg font-semibold` (no uppercase).
- Right column: bidding panel aside, fee breakdown, bid history section, seller info container borders (lines ~461-495): `border-2 rounded-2xl` → `border rounded-lg` on the bidding `<aside>` and bid-history `<section>`. Bid History heading (`text-sm font-black uppercase tracking-widest`) → `text-sm font-semibold` (no uppercase).

### 6. Persistent mobile bid bar (new, `AuctionDetail.tsx` + a new small component)

Per the feedback: _"On auction details, show a persistent bottom bar with the current bid and primary action... If verification is required, that primary action should become 'Verify to bid'."_

- Create `src/components/bidding/MobileBidBar.tsx`: a `fixed bottom-0 left-0 right-0 z-40` bar, visible only below the `lg` breakpoint (`lg:hidden`), with a `border-t bg-background/95 backdrop-blur` and safe-area padding (`pb-[env(safe-area-inset-bottom)]`). Content: current bid label + amount on the left (reuse the same formatting as `BiddingPanel` — `R {auction.currentPrice.toLocaleString("en-ZA")}`, `tabular-nums`), and a primary action button on the right:
  - If `auction.status !== "active"` or the auction has ended: button reads "View auction" (or is omitted — since the user is already on the detail page, scrolling to it is more useful; instead show the closed status label only, no button) — keep this branch simple, just show "Auction {status}" text, no button, since there's nothing actionable.
  - If active and the user is logged in but not verified: button reads "Verify to bid" and links to `/kyc` (mirror the check already in `BiddingPanel`/`AuctionDetail` for `isVerified`/`kycStatus` — this component will need the same `userData`/`useSession` queries, or accept the verification state as props from `AuctionDetail` to avoid duplicate queries; prefer passing props down since `AuctionDetail` doesn't currently compute `isVerified` itself — check whether it's cheap to lift that logic, or query it again in the new component if lifting would require larger changes. Prefer the smaller diff: query independently in `MobileBidBar` using the same pattern as `BiddingPanel`).
  - Otherwise (active, verified or logged out): button reads "Place bid" and scrolls the page to the existing `BiddingPanel` aside (use `document.getElementById`/a ref + `scrollIntoView({ behavior: "smooth" })`; give the bidding `<aside>` in `AuctionDetail.tsx` an `id="bidding-panel"` for this to target) rather than duplicating the bid form in the mobile bar. Logged-out users still get scrolled to the panel, where the existing sign-in redirect flow in `BiddingPanel`/`BidForm` already handles them.
- Render `<MobileBidBar auction={auction} />` at the end of `AuctionDetail.tsx`'s returned JSX (sibling to the main grid, not inside it, so `fixed` positioning works correctly). Add `pb-20 lg:pb-0` (or similar) to the page's outer container so the fixed bar doesn't overlap the last section's content on mobile — check `AuctionDetail.tsx`'s current outermost wrapper (it doesn't have one currently beyond the `Breadcrumb` + grid `div` — add the padding to the grid `div`, `lg:pb-0` cancels it out on desktop where the bar is hidden).
- Keep this component simple and additive — do not remove or duplicate the existing desktop `BiddingPanel`.

## Constraints

- Do NOT touch `Home.tsx`, `FilterSidebar.tsx`, `AuctionCard*.tsx`, or admin pages — separate phases/already done.
- Do NOT change bidding business logic (validation, proxy-bid calculation, mutation calls, error handling) anywhere — this is a visual/structural-only pass except for the new `MobileBidBar` component and the auto-bid collapse toggle in `BidForm`, both of which must not alter existing bid-placement behavior.
- Preserve all `data-testid`, `aria-label`, and `htmlFor` attributes exactly as they are; add new ones as needed for `MobileBidBar` and the new gallery expand button.
- Keep all existing tests passing. Add tests for: `MobileBidBar.tsx` (new file — cover the three branches: closed/no-button, unverified/"Verify to bid", active/"Place bid" scroll), the `BidForm.tsx` auto-bid collapse/expand behavior (starts collapsed unless `isProxyActive`, toggle works), and the `AuctionHeader.tsx` subtitle line rendering.
- Run the repo's lint, test, type-check, and build scripts (bun-based — check `package.json`) before finishing, and report exact results in the Results section below. Also run `bunx coderabbit review --uncommitted` (not `--prompt-only`, per the note in `codebase_notes.md` from phase 2) and fix any findings before finishing.
- Follow `.claude/rules/convex_rules.md` if any Convex files are touched (they shouldn't be — this is frontend-only).

## Results

Completed 2026-09-09. All six instruction sections implemented. Lint, type-check, full test suite (2,036 tests), production build, and CodeRabbit review all pass.

### Implementation

1. **Title hierarchy** (`AuctionHeader.tsx`)
   - `<h1>`: `text-4xl md:text-5xl font-black text-primary uppercase leading-tight` → `text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-snug`.
   - New subtitle `{year} {make} {model}` (`text-sm font-medium text-muted-foreground`) directly below the `<h1>`, rendered only when `make` and `model` are both present; h1 + subtitle wrapped in a `flex-1 min-w-0` div so the watch button keeps its place.
   - Badges: all `uppercase`/`tracking-*` removed; `font-bold`/`font-black` → `font-medium`/`font-semibold`; status badges now sentence case ("Sold", "You won", "Unsold") with text content otherwise unchanged.
   - Watch button: `rounded-xl border-2 font-black uppercase tracking-widest` → `rounded-md border font-medium`.
   - "Congratulations!"/"Item Sold" banners: `border-2 rounded-xl` → `border rounded-md`, `font-black`/`font-bold`/uppercase → `font-semibold`/`font-medium` sentence case.

2. **Image gallery prominence** (`ImageGallery.tsx`)
   - Added a `Maximize2` icon overlay (top-right, `bg-background/80 backdrop-blur rounded-md`, `aria-hidden="true"`) inside the existing hero `DialogTrigger` button (which already has `aria-label="Open full-screen gallery"`), so fullscreen is discoverable without relying on the click-anywhere affordance.
   - Hero image + empty-state placeholder: `rounded-2xl border-2` → `rounded-lg border`. Thumbnails: `border-2` → `border`; active `border-primary`/`ring-primary` selection treatment untouched. Broken-image fallback logic untouched.

3. **Bidding panel** (`BiddingPanel.tsx`)
   - Active row: "Current Bid"/"Time Remaining" labels → `text-xs font-medium` (no uppercase/tracking); price keeps `text-4xl font-black tabular-nums`; highlight box `border-2` → `border`. "Live" badge untouched.
   - Ended state: `border-2 border-dashed rounded-xl` → `border border-dashed rounded-md`, label `font-medium` sentence case.
   - Soft-close and verification alerts: `rounded-lg border` (from `rounded-xl border-2`), titles `font-semibold`, descriptions `font-normal`, no uppercase; "Complete KYC Now" link `font-medium` (no longer forced uppercase; text unchanged).
   - Non-active state: badge/price/labels calmed (`font-semibold`/`font-medium`, no uppercase/tracking), inner box and "Explore Other Auctions" button → `border rounded-md` / `rounded-md border font-medium`.

4. **Bid form** (`BidForm.tsx`)
   - Auto-bid section is now **collapsed by default**: new `isProxyExpanded` state (initialised from `isProxyActive`, so users with an active proxy bid start expanded) toggled by a `variant="ghost" size="sm"` button reading "Auto-bid (optional)" with a rotating `ChevronDown`, `aria-expanded`/`aria-controls`, `data-testid="auto-bid-toggle"`, and the "Active" pill moved onto the toggle. Checkbox, max-bid input, validation, and all bidding logic untouched — purely a visibility wrapper.
   - Quick-bid buttons: caption `text-[10px] font-medium` (no uppercase/tracking), amount `font-semibold`, `border-2` → `border`. Divider: `font-medium`, no uppercase. Manual input `rounded-md border`; Place Bid button `rounded-md font-semibold`.

5. **Auction detail page** (`AuctionDetail.tsx`)
   - "Auction Starts" banner: `font-medium border rounded-md`, no uppercase. Description section: `border rounded-md`, heading `text-lg font-semibold`, report buttons `rounded-md font-medium`. Flag section: `border rounded-md` (destructive tint kept). "More {make} Equipment" heading: `text-lg font-semibold`.
   - Bidding `<aside>` now has `id="bidding-panel"` + `border rounded-md`; Bid History section `border rounded-md`, heading `text-sm font-semibold`. Grid container gets `pb-20 lg:pb-0` so the fixed mobile bar can't overlap content.

6. **Mobile bid bar (new)** (`src/components/bidding/MobileBidBar.tsx` + render in `AuctionDetail.tsx` as a sibling of the grid)
   - `fixed bottom-0 left-0 right-0 z-40 lg:hidden`, `border-t bg-background/95 backdrop-blur`, `pb-[env(safe-area-inset-bottom)]`; left side shows "Current bid" + `R {price.toLocaleString("en-ZA")}` (`tabular-nums whitespace-nowrap`).
   - Branches: ended/closed → status text only, no button; logged-in + unverified (after profile query resolves, mirroring `BiddingPanel`'s `isProfileLoading` guard) → "Verify to bid" `Link` to `/kyc`; otherwise (verified or logged out) → "Place bid" button that `scrollIntoView({ behavior: "smooth" })`s to `#bidding-panel`, where the existing sign-in/verification flows take over. No bid form duplicated.
   - `Date.now()` is read once via a lazy `useState` initializer to satisfy `react-hooks/purity` (the authoritative live signal is `auction.status`, kept in sync by Convex).

### CodeRabbit-driven adjustments (beyond the written plan)

- First `bunx coderabbit review --uncommitted --include-untracked` pass returned 4 majors (all about AGENTS.md rule 10 / theme tokens on lines the task changed) + 1 minor, all fixed:
  - Containers converted `rounded-lg` → `rounded-md` (AuctionHeader banners, BiddingPanel boxes, BidForm auto-bid container, AuctionDetail sections) — the plan's `rounded-lg` targets conflicted with the "reserve `rounded-lg` for images/avatars" rule.
  - Hardcoded palettes → semantic tokens: SOLD badge/winner banner → `success`, watch-button active state → `destructive`, price-highlight flash → `bg-success/10 border-success/30`, soft-close alert → `warning`, verification alert → `destructive` (matches existing `SellerInfo`/`FinanceTab` precedent).
  - Minor: `whitespace-nowrap` on the mobile bar price so it never wraps after "R".
- Re-run: **no new findings**.

### Constraints verification

- `Home.tsx`, `FilterSidebar.tsx`, `AuctionCard*.tsx`, admin pages: untouched. No Convex files touched.
- Bidding business logic unchanged: `handleManualBid`/`handleQuickBid`/`getQuickBidAmounts`/validation/proxy sync effects, `placeBid` mutation flow, and error handling are byte-identical; the auto-bid change is a visibility wrapper only.
- All pre-existing `data-testid` / `aria-label` / `htmlFor` preserved; added `data-testid="auto-bid-toggle"`, `data-testid="mobile-bid-bar"`, `aria-expanded`/`aria-controls`, and the gallery `Maximize2` icon (`aria-hidden`).

### Tests

- **New** `src/components/bidding/MobileBidBar.test.tsx` (7): price display; closed auction → status text, no actions; active-but-past-endTime → "Auction ended", no actions; logged-in unverified → "Verify to bid" link to `/kyc`; verified → "Place bid" click calls `scrollIntoView({ behavior: "smooth" })` (jsdom stub, `#bidding-panel` present); logged-out → "Place bid"; profile still loading → "Place bid".
- `BidForm.test.tsx` (18): existing proxy tests updated to expand the section via `auto-bid-toggle` first; +3 new (collapsed by default, expanded when `isProxyActive` on mount, toggle expand/collapse cycle).
- `AuctionHeader.test.tsx` (15): badge assertions updated to sentence case; +2 new (subtitle renders, subtitle hidden when `model` missing).
- `BiddingPanel.test.tsx` (28): two highlight-style assertions updated to the success tokens (`bg-success/10`, `.border-success\/30`).
- `AuctionDetail.test.tsx` (15): `MobileBidBar` mocked like the other children; render assertion added.
- Coverage file `test-coverage/latest-coverage-output.txt` was not regenerated (no `test:coverage` run requested; component logic is fully exercised by the above).

### Verification (exact commands & results)

| Command                                                    | Result                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `bun run lint`                                             | Pass — 0 errors, 524 warnings (pre-existing baseline; no new warnings from this change) |
| `bun run type-check` (tsgo)                                | Pass — no errors                                                                        |
| `bun run test --run` (full suite)                          | Pass — 168 files, 2,036/2,036 tests                                                     |
| `bun run build`                                            | Pass — `✓ built in 4.75s`                                                               |
| `bunx coderabbit review --uncommitted --include-untracked` | First pass: 4 major + 1 minor (all fixed); final run: no new findings                   |

### Notes for the committer

- No commit/branch/PR was created (not requested). Suggest a **minor** version bump (`0.10.2` → `0.11.0` — new `MobileBidBar` component + collapsible auto-bid) with the eventual commit per the repo's semver rules.
- **Not visually verified via Chrome DevTools MCP**: the dev server (`https://localhost:5173`) was unreachable and the MCP browser connection was down during this task. Recommend a quick manual pass at 375×812 (mobile bid bar overlap, collapsed auto-bid, gallery expand icon) and 1440×900 (calmed header/panel) before committing.
- Untracked `conductor/opencode_tasks/visual-refresh-phase4-admin.md` predates this task and is unrelated — keep it out of this feature's commit.
- Noteworthy discoveries (react-hooks/purity `Date.now()` rule, CodeRabbit `--include-untracked`/`review findings`, success/warning token enforcement) documented in `codebase_notes.md` under "Visual Refresh Phase 3".

---

## Full design feedback (for reference — only sections 1, 2, 5, 6 are in scope for this task)

### 1. Calm the Typography

Currently, headings, listing names, prices, labels, and buttons all compete through heavy weights and uppercase styling. Use a consistent UI font (already done — Inter, phase 1), regular body text and medium/semibold controls. Switch listing titles and buttons to sentence case. Reserve extra-bold type for key prices and a few page headings. Increase small metadata and status labels to readable sizes. Use tabular numerals for prices and countdowns (already done — phase 1).

On the detail page, "Bell L1206E" should be the title, with "Front-end loader" as supporting text. The current oversized, two-line uppercase heading pushes the equipment image too far down.

### 2. Make Photography Reliable

Broken-image fallback already fixed (phase 1). Remaining: on detail pages, make the gallery immediately prominent, with thumbnails and an obvious fullscreen action.

### 5. Design Mobile Around Browsing and Bidding

On auction details, show a persistent bottom bar with the current bid and primary action. If verification is required, that primary action should become "Verify to bid", rather than letting the bidding interface compete with an eligibility warning.

### 6. Simplify the Bidding Panel

The current detail panel has nested boxes, an internal scrollbar, a price that wraps after "R", and many competing controls. Reorganize into: 1. Current bid, on one line. 2. Time remaining and auction status. 3. Next minimum bid. 4. Bid amount and one primary action. 5. Auto-bid as an optional expandable feature. 6. Fees, seller verification, and relevant reassurance. Keep the desktop panel sticky if space allows, but avoid a separately scrolling panel wherever practical.
