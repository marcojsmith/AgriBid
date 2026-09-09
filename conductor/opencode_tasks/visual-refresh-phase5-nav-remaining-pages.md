# Task: Visual refresh — Phase 5 (Global nav/mobile menu + remaining buyer-facing pages sweep)

## Context

Continuing the visual modernization (phase 1: typography/tokens/image fallback; phase 2: marketplace cards/toolbar/filters; phase 3: auction detail/bidding panel; phase 4: admin section sweep — all committed on this branch). This phase covers **section 5 (mobile navigation)** of the design feedback plus a final mechanical sweep of every remaining buyer-facing page/component that still has the old heavy styling, using the exact same substitution rules that worked cleanly in phase 4.

This closes out the visual refresh — after this phase, every page in the app (marketplace, auction detail, admin, global nav, and all remaining account/dashboard/support pages) should share the same calm visual language.

## Substitution rules (identical to phase 4 — apply consistently)

| Find                                                          | Replace with                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uppercase` (on text elements)                                | remove entirely (also remove any paired `tracking-wide`/`tracking-wider`/`tracking-widest`/`tracking-[0.2em]`/`tracking-tight` that existed only for the all-caps effect — keep `tracking-tight` on large headings where it aids readability) |
| `font-black`                                                  | `font-semibold` generally; `font-bold` for a primary page heading or a prominent price/number — use judgment                                                                                                                                  |
| `border-2`                                                    | `border`                                                                                                                                                                                                                                      |
| `rounded-3xl`                                                 | `rounded-lg`                                                                                                                                                                                                                                  |
| `rounded-2xl`                                                 | `rounded-lg`                                                                                                                                                                                                                                  |
| `rounded-xl`                                                  | `rounded-md` (except on images/avatars, which keep `rounded-lg` per `AGENTS.md` rule 10 — check that file's radius conventions if unsure)                                                                                                     |
| `text-[10px]` (caption labels paired with uppercase/tracking) | `text-xs`                                                                                                                                                                                                                                     |

Do **not** apply these rules to: semantic color classes, icon sizes, spacing/layout classes, or test files (except to fix a broken assertion on now-changed text/class, same as phases 1-4). If you find a **hardcoded status color** (`text-green-500`, `bg-yellow-500`, `bg-blue-500`, `border-red-500`, etc.) on a line you're already touching, convert it to the semantic token (`success`/`warning`/`destructive`; use `primary` if there's no fitting token — there is no `info`/blue token in this theme, same finding as phase 4) — this is what CodeRabbit will flag if you don't, based on phases 3 and 4's review passes.

## Instructions

### 1. Global navigation — mobile nav gap fix + typography calm (`src/components/header/`)

Read `Header.tsx`, `MobileMenu.tsx`, `SearchBar.tsx`, `UserDropdown.tsx` first.

- **Fix a real gap, not just visual noise**: the design feedback explicitly asks for "clear mobile navigation for Marketplace, Watchlist, My bids, and Account." `MobileMenu.tsx`'s authenticated quick-actions grid (lines ~195-254) currently has Admin (if applicable)/Profile/My Bids/My Listings, but **no Watchlist link**, even though `/watchlist` is a real route and `UserDropdown.tsx` (the desktop equivalent) already links to it (line ~211). Add a "Watchlist" button to that grid, matching the existing button pattern (`variant="outline"`, appropriate icon — `Heart` from `lucide-react` to match how watchlist is represented elsewhere, e.g. `AuctionCardThumbnail.tsx`), linking to `/watchlist`. Adjust the grid's column-span logic (currently `role !== "admin" && "col-span-2"` on the last item) so the grid still lays out sensibly with 5 possible items instead of 4 for non-admins / 5 for admins — use your judgment for a clean 2-column wrap (it's fine if the last item doesn't perfectly fill the row).
- Apply the substitution rules throughout `Header.tsx` (logo, nav links, login button), `MobileMenu.tsx` (nav links, user info panel, verification CTA, quick-action buttons, sign out button, login button), `SearchBar.tsx`, and `UserDropdown.tsx`.
- Logo treatment (`Header.tsx` line ~57-62, `font-black text-2xl tracking-tighter text-primary` + `.toUpperCase()`): the feedback doesn't specifically address the logo/wordmark, so use lighter judgment here — you can keep it bold as a brand mark, but remove the `.toUpperCase()` JS call and `uppercase`-equivalent forcing if the app name should render as authored (check `useBranding()`'s `appName` value/casing — if it's already meant to display in a specific case, don't force-transform it). If unsure, leave the logo's own casing/weight as-is and only touch surrounding nav typography — the logo is brand identity, not a place to blindly apply the sweep rule.

### 2. Remaining buyer-facing pages (mechanical sweep, same as phase 4)

Apply the substitution rules to each of these (read before editing; some have page-specific structure beyond a blind find-replace):

- `src/pages/FAQ.tsx`
- `src/pages/KYC.tsx`
- `src/pages/Login.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Sell.tsx`
- `src/pages/SellerListings.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Support.tsx`
- `src/pages/Watchlist.tsx`
- `src/pages/dashboard/MyBids.tsx`
- `src/pages/dashboard/MyListings.tsx`
- `src/components/kyc/ListItem.tsx`
- `src/pages/kyc/sections/DocumentUploadSection.tsx`
- `src/pages/kyc/sections/PersonalInfoSection.tsx`
- `src/pages/kyc/sections/VerificationStatusSection.tsx`

### 3. Remaining shared components (mechanical sweep)

- `src/components/AuctionCardSkeleton.tsx`
- `src/components/BidConfirmation.tsx`
- `src/components/DashboardListSkeleton.tsx`
- `src/components/Footer.tsx`
- `src/components/LoadingIndicator.tsx`
- `src/components/NotificationDropdown.tsx`
- `src/components/ProfileSkeleton.tsx`
- `src/components/RoleProtectedRoute.tsx`
- `src/components/SellerInfo.tsx`

### 4. Verify nothing was missed

After finishing steps 1-3, run this and sweep any additional files it turns up (excluding files already handled in phases 1-4 — `AuctionHeader.tsx`, `AuctionDetail.tsx`, `Home.tsx`, `FilterSidebar.tsx`, `ImageGallery.tsx`, `AuctionCard*.tsx`, `BiddingPanel.tsx`, `BidForm.tsx`, `MobileBidBar.tsx`, and anything under `src/pages/admin`/`src/components/admin`):

```
grep -rlE "uppercase|font-black|border-2|rounded-(xl|2xl|3xl)" src/pages src/components --include='*.tsx' | grep -v '\.test\.tsx$' | grep -vE "admin|AuctionHeader|AuctionDetail|Home\.tsx|FilterSidebar|ImageGallery|AuctionCard|BiddingPanel|BidForm|MobileBidBar"
```

If this turns up files under `src/components/ListingWizard/` or elsewhere not listed above, sweep those too — the goal is zero remaining matches outside admin (admin is already done) by the end of this task.

## Constraints

- **Visual/className changes only**, except the one explicit functional addition in step 1 (Watchlist link in `MobileMenu.tsx`) — do not touch business logic, data fetching, mutation calls, validation, or component props/interfaces anywhere else.
- Do NOT touch `src/pages/admin/*`, `src/components/admin/*`, or any file already modified in phases 1-4 (listed in step 4's exclusion list above) — this phase is additive to what's already done.
- Preserve all `data-testid`, `aria-label`, and `htmlFor` attributes exactly as they are; add new ones only for the new Watchlist link if needed for testing.
- If a text-content casing change is needed (sentence-case precedent from earlier phases), update both source and any test asserting the exact string.
- Keep all existing tests passing. Add a test for the new Watchlist link in `MobileMenu.test.tsx` (assert it renders and links to `/watchlist` when authenticated). Otherwise, don't add new test files — this is a visual sweep, just fix what breaks.
- Work through files in batches, running `bun run lint` / targeted `bun run test --run` periodically rather than only at the very end.
- Run the full repo lint, test suite, type-check, and build before finishing, and report exact results in the Results section below. Also run `bunx coderabbit review --uncommitted` (add `--include-untracked` if the new-file exclusion matters — check phase 3's notes in `codebase_notes.md`) and fix any findings before finishing.
- Follow `.claude/rules/convex_rules.md` if any Convex files are touched (they shouldn't be — this is frontend-only).

## Results

**Task complete — the visual refresh is closed out. The post-sweep grep (step 4) returns zero matches outside the phase-1–4 exclusion list and admin.**

### Step 1 — Global navigation (`src/components/header/`)

- **Watchlist gap fixed (the one functional change)**: `MobileMenu.tsx` authenticated quick-actions grid now includes a **Watchlist** button (`variant="outline"`, `Heart` icon from lucide — matching `AuctionCardThumbnail`/`UserDropdown` usage, `Link to="/watchlist"`, `onClick={onClose}`) between My Bids and My Listings. Column-span logic inverted: `role === "admin" && "col-span-2"` now applies to My Listings (last item), so non-admins get a clean 2×2 grid (Profile / My Bids / Watchlist / My Listings) and admins get a full-width My Listings closing row. Covered by a new `MobileMenu.test.tsx` test (asserts render + `href="/watchlist"` when authenticated).
- **`Header.tsx`**: logo now renders the authored brand casing — `.toUpperCase()` removed, `{branding?.appName ?? "AgriBid"}` (checked `useBranding`/`BrandingProvider`: `appName` is "AgriBid" from `SITE_NAME`, so forcing caps was mangling it); weight calmed `font-black tracking-tighter` → `font-bold tracking-tight` (kept bold as brand mark per task latitude). Nav links `font-bold uppercase tracking-wider` → `font-medium`. Login button de-stylized (`font-semibold text-xs rounded-md`).
- **`MobileMenu.tsx`**: nav links → `text-lg font-semibold rounded-lg border`; user panel name/status de-caps (`font-semibold` / `text-xs font-medium`); verification CTA → `bg-warning hover:bg-warning/90 text-warning-foreground rounded-md`; all quick-action buttons → `rounded-md font-semibold text-xs` (`text-[10px]` → `text-xs`); sign-out → `font-semibold rounded-md`; login → `text-lg font-bold rounded-lg`.
- **`SearchBar.tsx`**: `border-2 rounded-xl` → `border rounded-md`.
- **`UserDropdown.tsx`**: Verified badge `bg-green-500/10 text-green-600 border-green-500/20` → `bg-success/10 text-success border-success/20`; Unverified/Pending badge → `warning` equivalents; KYC CTA item `bg-orange-500/*` → `bg-warning/10 text-warning focus:bg-warning/20 border-warning/20`; avatar hover `text-white` → `text-primary-foreground`; trigger/menu/items → `rounded-md font-semibold text-xs` (menu content `rounded-2xl border-2` → `rounded-md border`); sign-out item de-caps.
- **Test updates**: `Header.test.tsx` — two `getByText("AGRIBID")` assertions → `"AgriBid"` (de-uppercased logo). `MobileMenu.test.tsx` — new Watchlist test added. No other test changes needed.

### Step 2 — Remaining buyer-facing pages (all 16 swept)

`FAQ` (empty state `rounded-3xl border-2` → `rounded-lg border`; h1 `font-bold tracking-tight`), `KYC` (edit-mode notice → `warning` tokens; rejected box, compliance card, submit button), `Login` (h2 de-caps), `Notifications` (mark-all-read button, icon tiles, captions), `Profile` (badges → `success`/`warning` tokens; amber "Complete Verification" → `bg-warning hover:bg-warning/90 text-warning-foreground`; `text-green-600`/`text-green-700` stats/heading → `text-success`; stat numbers `font-bold`), `Sell` (h1 only), `SellerListings` ("Past sales" heading → `text-success`), `Settings` (SelectTriggers `rounded-xl border-2` → `rounded-md border`), `Support`, `Watchlist`, `dashboard/MyBids` (stat `text-green-600`/`text-red-600` → `text-success`/`text-destructive`; "Outbid!" → `text-destructive`; `hover:text-white` → `hover:text-primary-foreground`), `dashboard/MyListings` (thumbnail wrapper keeps `rounded-lg` as image container), `kyc/ListItem` (uppercase removal only), `kyc/sections/DocumentUploadSection` (badge `border-green-500/20` → `border-success/20`), `kyc/sections/PersonalInfoSection` (labels/inputs/error lines), `kyc/sections/VerificationStatusSection` (status cards → `success`/`warning`/`destructive` token combos).

### Step 3 — Remaining shared components (all 9 swept)

`AuctionCardSkeleton`, `BidConfirmation` (dialog `rounded-2xl border-2` → `rounded-lg border`; amounts `font-bold`; captions `text-xs font-semibold`), `DashboardListSkeleton`, `Footer` (brand heading `font-bold`; all section headings/captions de-caps), `LoadingIndicator`, `NotificationDropdown` (badge `font-bold`; items `rounded-md border`), `ProfileSkeleton` (skeleton blocks `rounded-md`; avatar skeleton `rounded-lg` per image convention), `RoleProtectedRoute` (h1 de-caps, kept `font-bold`), `SellerInfo` (containers `rounded-lg border`; already-semantic `success` tokens left).

### Step 4 — Verification grep sweep (files beyond the task list)

The grep turned up **10 additional files**, all swept with the same rules: the whole `src/components/listing-wizard/` tree (`ListingWizard`, `StepIndicator`, `WizardNavigation`, all 6 steps — image thumbs/dropzone kept `rounded-lg`; "High" badge → `success` token; `text-white` overlay → `text-primary-foreground`), `src/components/auction/FeeBreakdown.tsx`, `src/components/bidding/BidHistory.tsx`, and `src/components/ui/card.tsx` — the shadcn base **Card primitive went `rounded-xl` → `rounded-md`** (layout container per AGENTS rule 10; applies app-wide since all Cards compose from it). Final grep: **0 matches** (excluding phases-1–4 files and admin, per the task's command).

### Judgment calls

- `font-bold` reserved for page h1/h2 headings, prominent prices/numbers (stat values, bid amounts), brand marks, and the mobile login CTA; `font-semibold` everywhere else.
- Hardcoded status colours converted **only on lines already touched** (per task rule). Remaining hardcoded colours on untouched lines are documented in `codebase_notes.md` as a future pass (Profile activity-feed chips, VerificationStatusSection solid icon circles, MyBids status strip, ListingWizard success icon, MediaGallery check icon, PricingDuration progress fill, WizardNavigation Saved icon).
- `border-t-2`/`border-b-2/-4` divider & spinner weights and `border-4` were not in the substitution table — except BidConfirmation's separator, which CodeRabbit's review flagged and was converted to `border-t`.
- `Footer`'s business-name `.toUpperCase()` and LoadingIndicator's "AGRIBID LOADING..." left as-is (JSX text/props outside the logo scope; tests match those strings).
- No `status.toUpperCase()` enum transforms touched (tests assert uppercase status display strings).

### Verification (all pass)

| Check              | Command                                                    | Result                                                                       |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Lint (full repo)   | `bun run lint`                                             | 0 errors, 524 warnings (exact pre-existing baseline; 0 new)                  |
| Tests (full suite) | `bun run test --run`                                       | 168 files, **2037 passed**, 0 failed (incl. new Watchlist test)              |
| Type check         | `bun run type-check`                                       | Clean (tsgo, no errors)                                                      |
| Build              | `bun run build`                                            | ✓ built in 4.65s                                                             |
| CodeRabbit         | `bunx coderabbit review --uncommitted --include-untracked` | 1 minor (`border-t-2` → `border-t`, fixed) → re-run: **"No new findings ✔"** |
| Post-sweep grep    | task's step-4 grep command                                 | 0 matches in non-excluded, non-admin, non-test files                         |

### Constraints honoured

- Visual/className changes only, except the explicit Watchlist quick-action in `MobileMenu.tsx` (plus its test). No business logic, data fetching, mutations, validation, or props/interfaces touched.
- `src/pages/admin/*`, `src/components/admin/*`, and all phase-1–4 files untouched; all `data-testid`, `aria-label`, `htmlFor` preserved (one new test added, no new attributes needed in source).
- No Convex files touched. Noteworthy discoveries documented in `codebase_notes.md` (Visual Refresh Phase 5 section), including the Clerk-vs-BetterAuth docs discrepancy spotted in `Login.tsx`/`Header.tsx`.
- Ready to commit as `feat: visual refresh phase 5 — global nav, mobile watchlist link, remaining pages sweep` with a semver minor bump (0.10.2 → 0.11.0, new non-breaking feature).

---

## Full design feedback (for reference — only section 5 is directly new here; everything else is the same calming direction applied throughout this task)

### 5. Design Mobile Around Browsing and Bidding

In the narrow layout, search and main navigation disappear, while the Sell button becomes a dominant action.

- Keep a visible search field below the mobile header. (Already present — `SearchBar` renders inside `MobileMenu`.)
- Provide clear mobile navigation for Marketplace, Watchlist, My bids, and Account. (Gap: Watchlist is missing from the mobile quick-actions grid — fixed in this task.)
- Open filters in an accessible sheet with a clear "Show results" action. (Already handled — phase 2's `FilterSidebar` mobile overlay.)
- Make watchlist and other icon controls comfortably tappable. (Already reasonable — verify no regressions.)
- On auction details, show a persistent bottom bar with the current bid and primary action. (Already done — phase 3's `MobileBidBar`.)
