# Task: Visual refresh — Phase 2 (Marketplace: cards, toolbar, filters)

## Context

Continuing the visual modernization from Phase 1 (already merged — Inter font, tabular-nums, calmer `AuctionCard` title/badges, image fallback, green-tinted dark mode). This phase covers **section 3 (auction cards) and section 4 (marketplace navigation/filters)** of the design feedback pasted at the bottom of this file. Do NOT touch the auction detail page or bidding panel — that's phase 3.

Direction: less visual noise, clearer information hierarchy, thin borders/restrained corners instead of `border-2`/`rounded-xl`/`rounded-3xl` everywhere, sentence case instead of uppercase, `font-semibold`/`font-medium` instead of `font-black`/`font-bold` for anything that isn't a primary price or page heading.

Key files:

- `src/pages/Home.tsx` — marketplace page: heading, toolbar (sidebar toggle, view mode, sell button), empty state, load-more button
- `src/components/FilterSidebar.tsx` — desktop/mobile filter panel
- `src/components/auction/AuctionCard.tsx` — card shell, footer bid button (title/category badge already calmed in phase 1 — don't redo those)
- `src/components/auction/AuctionCardPrice.tsx` — price/countdown block inside the card
- `src/components/auction/AuctionCardThumbnail.tsx` — already has image fallback (phase 1) — no changes needed here unless noted below

## Instructions

### 1. Card footer & price hierarchy (`AuctionCard.tsx`, `AuctionCardPrice.tsx`)

Read `AuctionCardPrice.tsx` first to see its current structure before editing.

- The footer bar currently has a full-width, heavy `font-black uppercase` "Bid R X" button on every card (`AuctionCard.tsx` lines ~269-285). Change it to `font-semibold` (drop `uppercase`), and reduce visual weight: use `variant="outline"` instead of the default filled `variant="default"` for the **detailed** (non-compact) card view only — keep it filled (`variant="default"`) in compact view since mobile users rely on it as the primary tap target. This matches the feedback's guidance to reserve the strongest bid treatment for the detail page while keeping quick-bid available.
- In `AuctionCardPrice.tsx`, ensure the current bid is visually distinct from any "next minimum bid" text if one exists there — the current price should be the largest/boldest element, any secondary bid-amount hint should be `text-muted-foreground` and smaller. If `AuctionCardPrice.tsx` has no "next minimum" text (bid amount is only shown on the button), leave this as-is — do not invent new UI here, just verify.
- Card shell (`AuctionCard.tsx`): change `border-2 hover:border-primary` to `border hover:border-primary/60`, and `hover:scale-[1.01] hover:shadow-xl` to a more restrained `hover:shadow-md` (drop the scale transform — no card scaling per feedback). Keep `transition-all duration-300` → `transition-shadow duration-200` (motion should be brief).

### 2. Marketplace toolbar & heading (`Home.tsx`)

- Page heading (`<h1>`, line ~227): remove `uppercase`, change `font-black` to `font-bold` (page headings are one of the few places extra-bold type is still fine per the feedback — keep it bold, just drop the forced uppercase transform).
- "Clear search results" link and "Filters Applied" text (lines ~238-250): remove `uppercase tracking-widest`, change `font-bold`/`font-black` to `font-medium`, bump `text-[10px]` to `text-xs` for legibility.
- Toolbar buttons — "Show/Hide Filters", view toggle ("Detailed"/"Compact"), mobile filter icon button, "Sell" button (lines ~255-312): remove `uppercase` from all, change `font-bold`/`font-black` to `font-medium`/`font-semibold`. Change `rounded-xl` to `rounded-md` and `border-2` to `border` on these buttons for restrained corners.
- Empty state (lines ~336-350): remove `uppercase tracking-widest` from the message, change `font-bold` to `font-medium`. Change `rounded-3xl border-2 border-dashed border-primary/10` to `rounded-lg border border-dashed`.
- "Load More Auctions" button (line ~384): remove `uppercase tracking-widest`, `font-black` → `font-medium`, `rounded-xl border-2` → `rounded-md border`.
- **Add an active-filter chips row** below the heading, visible whenever `hasActiveFilters` is true (in addition to the existing "Filters Applied" text — replace that text with actual removable chips): for each active filter (`make`, `minYear`/`maxYear` as one "Year: X–Y" chip if either is set, `minPrice`/`maxPrice` as one "Price: X–Y" chip if either is set, `maxHours`, and `statusFilter` if not `"active"`), render a small pill (`Badge` component or a simple `<button>` styled similarly) showing a human-readable label plus an `×` to remove just that filter (update `searchParams` directly by deleting the relevant key(s) and re-navigating — follow the existing pattern used elsewhere in `Home.tsx`/`FilterSidebar.tsx` for reading `searchParams`, since `Home.tsx` doesn't currently call `setSearchParams` itself — you may need to import `useSearchParams`'s setter or navigate via `Link`/`useNavigate` with updated params. Check how `FilterSidebar.tsx` mutates params for the pattern to mirror). Keep this additive — don't remove the sidebar/mobile-overlay filter UI.

### 3. Filter sidebar polish (`FilterSidebar.tsx`)

- Header ("Filter Equipment", line ~309): remove `uppercase tracking-tight`, `font-black` → `font-semibold`.
- All field labels (`text-[10px] font-black uppercase text-muted-foreground tracking-widest`, appears ~5 times): change to `text-xs font-medium text-muted-foreground` (drop `uppercase tracking-widest`).
- Select/input triggers with `border-2 ... font-bold`: change to `border ... font-medium`.
- "Save Defaults" / "Clear Defaults" buttons (lines ~522-541): the feedback explicitly says filter-saving should be a secondary action, not equal-weight with primary controls. Change both from `variant="outline"` full-width grid buttons with `font-black uppercase tracking-tight border-2` to smaller text-button style: wrap them in a single row using `variant="link"` or `variant="ghost" size="sm"`, `font-medium` (no uppercase), so they read as secondary/tertiary actions rather than a prominent 2-button grid.
- Container: `border-2 rounded-lg shadow-xl shadow-primary/5` → `border rounded-lg shadow-sm` (thinner border, restrained shadow).

## Constraints

- Do NOT touch `AuctionDetail.tsx`, `BiddingPanel.tsx`, `ImageGallery.tsx`, or any admin pages — separate phases.
- Do NOT change the underlying filter logic/query params/preferences behavior — only visual treatment, except for the additive filter-chips feature described in step 2, which must not break existing filter/search/preferences functionality (verify by reading how `Home.tsx` currently derives `make`, `minYear`, etc. before wiring the remove-chip handlers).
- Preserve all `data-testid` attributes and accessible labels (`aria-label`, `htmlFor`) exactly as they are.
- Keep all existing tests passing; add tests for the new filter-chip rendering/removal in `Home.test.tsx` (check the existing test file's patterns for how filters/searchParams are set up in tests before adding new cases).
- Run the repo's lint, test, type-check, and build scripts (check `package.json` — this repo uses `bun`) before finishing, and report exact results in the Results section below.
- Follow `.claude/rules/convex_rules.md` if any Convex files are touched (they shouldn't be — this is frontend-only).

## Results

**Status: Complete.** All three instruction groups implemented; all constraints honored.

### What changed

1. **Card footer & price hierarchy** (`AuctionCard.tsx`, `AuctionCardPrice.tsx`)
   - Card shell: `border-2 hover:border-primary` → `border hover:border-primary/60`; `transition-all duration-300 hover:scale-[1.01] hover:shadow-xl` → `transition-shadow duration-200 hover:shadow-md` (no card scaling).
   - Footer bid button: added `variant={isCompact ? "default" : "outline"}` — filled in compact view (primary mobile tap target), outline in detailed view. `font-semibold` / no `uppercase` was already in place from phase 1; verified and kept.
   - `AuctionCardPrice.tsx`: verified it has **no** "next minimum bid" text (bid amount only appears on the footer button), so per instructions it was left untouched.

2. **Marketplace toolbar & heading** (`Home.tsx`)
   - `<h1>`: dropped `uppercase`, `font-black` → `font-bold`.
   - "Clear search results" link: dropped `uppercase tracking-widest`, `font-bold` → `font-medium`, `text-[10px]` → `text-xs`.
   - Toolbar: sidebar toggle, view toggle (incl. container), mobile filter icon button, and Sell button — all `uppercase` removed, `font-bold`/`font-black` → `font-medium`/`font-semibold`, `rounded-xl` → `rounded-md`, `border-2` → `border`.
   - Empty state: container → `rounded-lg border border-dashed` (dropped `border-primary/10`), message → `font-medium` sentence case, "Clear All Filters" button → `rounded-md font-medium border`.
   - "Load More Auctions": dropped `uppercase tracking-widest`, `font-black` → `font-medium`, `rounded-xl border-2` → `rounded-md border`.

3. **Active-filter chips (new, additive)** (`Home.tsx`)
   - Replaced the "Filters Applied" text with a removable-chip row below the heading: `Make: X`, combined `Year: X–Y` (min+max), combined `Price: R X–R Y` (min+max), `Max Hours: X`, and `Status: Closed/All`. Each chip is an outline `Button` with an `×` (`aria-label="Remove filter: <label>"`, `data-testid="filter-chip-*"`) that deletes the relevant `searchParams` key(s) and re-navigates via `setSearchParams` (mirroring `FilterSidebar`'s param-mutation pattern). Sidebar/mobile-overlay filter UI untouched.
   - CodeRabbit-corrected edge case: a status chip is only rendered for an **explicit non-active URL status** — not for a `defaultStatusFilter` preference fallback, where deleting the (absent) URL param could not remove the filter. Chips-row gate is `activeFilterChips.length > 0`; the now-unused `hasActiveFilters` const was removed.

4. **Filter sidebar polish** (`FilterSidebar.tsx`)
   - Header → `font-semibold` (no uppercase). All 5 field labels → `text-xs font-medium` (no `uppercase tracking-widest`). Native selects + 5 `SelectTrigger`s → `border` + `font-medium`. Container → `border rounded-lg shadow-sm`.
   - Save/Clear Defaults: no longer a 2-up outline grid; single centered row of `ghost`/`sm` `font-medium` text buttons.
   - CodeRabbit-corrected addition: both buttons now disable while a defaults write is in flight (`pendingDefaultsAction: "save" | "clear" | null`), with "Saving..."/"Clearing..." labels on the in-flight action, per the repo's feedback guideline.

### Constraints verification

- `AuctionDetail.tsx`, `BiddingPanel.tsx`, `ImageGallery.tsx`, admin pages: untouched. No Convex files touched.
- All pre-existing `data-testid` / `aria-label` / `htmlFor` preserved; filter logic, query params, and preferences behavior unchanged (chips are additive).

### Tests

- `Home.test.tsx`: replaced the "Filters Applied" assertion with 7 chip tests (render per filter type, combined year/price chips, removal preserving `q`, no-chips-when-clean, and saved-preference-status → no chip regression test).
- `FilterSidebar.test.tsx`: added pending-state test (both buttons disabled + "Saving..." label while save in flight).
- Affected suites: `Home.test.tsx` (36), `FilterSidebar.test.tsx` (44), `AuctionCard.test.tsx` (28).

### Verification (exact commands & results)

| Command                                                                                                                        | Result                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `bun run lint`                                                                                                                 | Pass — 0 errors, 526 warnings (all pre-existing classes; no new warnings from this change) |
| `bun run test --run src/pages/Home.test.tsx src/components/FilterSidebar.test.tsx src/components/auction/AuctionCard.test.tsx` | Pass — 108/108                                                                             |
| `bun run type-check` (tsgo)                                                                                                    | Pass — no errors                                                                           |
| `bun run build`                                                                                                                | Pass — `✓ built in 4.7s`                                                                   |
| `bunx coderabbit review --uncommitted`                                                                                         | Final run: no new findings (2 minor findings from the first pass were fixed)               |

### Notes for the committer

- No commit/branch/PR was created (not requested). Suggest a **minor** version bump (`package.json`) with the eventual commit per the repo's semver rules.
- `conductor/issue-backlog-plan.md` shows as modified in the working tree — that change predates this task and is unrelated; keep it out of this feature's commit.
- CodeRabbit CLI syntax in AGENTS.md is outdated (`--prompt-only` no longer exists; use `bunx coderabbit review --uncommitted`) — noted in `codebase_notes.md`.

---

## Full design feedback (for reference — only sections 3 & 4 are in scope for this task)

After looking at the marketplace on desktop and a narrow viewport, plus an auction detail page, I'd evolve AgriBid into a premium agricultural marketplace: precise, calm, image-led, and trustworthy.

### 3. Refine the Auction Cards

The desktop cards have substantial empty space, heavy borders, tiny category badges, and repetitive full-width green buttons. The compact mobile cards prioritize descriptions over clear price information.

Consistent information order:

```
[Equipment photo                         ♡]
2017 Bell L1206E
Front-end loader
Johannesburg · 5,200 hrs
Current bid                     Ends in
R 134 000                       20h 33m
View auction →
```

- Keep titles to two lines and align prices across the grid.
- Replace descriptions on compact cards with year, hours, and location.
- Use thin borders, restrained corners, and subtle hover feedback.
- Keep countdowns neutral until an auction is genuinely ending soon.
- Make the current bid distinct from the next minimum bid.
- Reserve the strongest "Place bid" treatment for the detail page; if quick bidding is important, retain it as an explicit action with a clear confirmation step.

### 4. Improve Marketplace Navigation

The desktop filter panel takes significant space, while "Save defaults" and "Clear defaults" have more visual weight than they need.

- Introduce a clear results toolbar: auction count, sorting, filters, and view mode.
- Add useful shortcuts such as "Ending soon", "Tractors", and "Harvesting".
- Show applied filters as removable chips.
- Make filter-saving a secondary action.
- Keep "Sell equipment" in a consistent navigation position rather than competing with browsing controls.
- Do not add a huge homepage hero. Buyers should reach equipment immediately.
