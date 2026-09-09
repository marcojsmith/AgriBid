# Task: Visual refresh — Phase 1 (Foundation: typography, tokens, image fallback)

## Context

We're modernizing AgriBid's visuals per external design feedback (GPT-6 Astra review). Full feedback is pasted at the bottom of this file for reference — this task covers only **section 1 (typography), section 2 (photography reliability), and section 7 (visual tokens)**. Later phases (cards, filters, detail page, bidding panel, mobile) are separate follow-up tasks — do NOT touch those areas beyond what's listed below.

Direction: calm, precise, image-led, trustworthy. Less visual noise (no more uppercase/font-black everywhere), tabular numerals for prices, reliable image fallbacks, consistent tokens. Keep the forest-green/warm-neutral identity — this is a polish pass, not a redesign.

Key files to read first:

- `src/index.css` — theme tokens (`@theme`, `:root`, `.dark`)
- `src/components/auction/AuctionCard.tsx` — heaviest offender: `uppercase`, `font-black`, `tracking-wider/tight` used throughout
- `src/components/auction/AuctionCardThumbnail.tsx` — image render with no `onError` fallback
- `src/components/auction/AuctionCardPrice.tsx` — price rendering (needs tabular-nums)
- `src/pages/AuctionDetail.tsx` — page title treatment, gallery images
- `src/components/ui/badge.tsx`, `src/components/ui/button.tsx` — base component variants (these are already reasonably calm; don't rewrite variants, just stop overriding them with uppercase/font-black at call sites)
- `index.html` — no font is currently loaded; Tailwind falls back to system sans

## Instructions

1. **Add Inter as the UI font.**
   - Add a Google Fonts `<link>` (preconnect + stylesheet) for Inter (weights 400, 500, 600, 700) in `index.html`, OR install `@fontsource/inter` and import it in `src/main.tsx` — pick whichever pattern matches how fonts/assets are currently loaded in this repo (check `src/main.tsx` and `package.json` for an existing pattern before adding a new dependency).
   - Set `--font-sans` in the `@theme` block in `src/index.css` to `"Inter", ui-sans-serif, system-ui, sans-serif` so Tailwind's `font-sans` (the default) picks it up everywhere. Do not hardcode font-family on individual components.

2. **Add a tabular-numerals utility and apply it to prices/countdowns.**
   - In `src/index.css`, nothing new needed — Tailwind already ships `tabular-nums` as a utility class. Apply `tabular-nums` to:
     - `src/components/auction/AuctionCardPrice.tsx` — the price display element(s)
     - `src/components/CountdownTimer.tsx` — the countdown text element
     - Any price display in `src/pages/AuctionDetail.tsx` (current bid, next minimum bid)

3. **Calm down typography in `AuctionCard.tsx`:**
   - Remove `uppercase` and `tracking-wider`/`tracking-tight` from the listing title (`CardTitle`). Titles should render in normal sentence case as authored in the data (do not transform casing in code — just stop forcing uppercase via CSS).
   - Change the title's `font-black` to `font-semibold`.
   - Change the category badge (`Badge variant="outline"` with `text-[8px] ... uppercase font-bold`) to a normal-case, slightly larger label: replace `uppercase font-bold` with `font-medium`, and bump `text-[8px]` to `text-[10px]` (compact) / keep readable size for detailed mode — use `text-xs` for the non-[8px] case if none is set explicitly, check current classes first.
   - Change the "SOLD"/"UNSOLD" badge from `font-black uppercase tracking-wider` to `font-semibold` (keep the text content "Sold"/"Unsold" in sentence case instead of `SOLD`/`UNSOLD` — update the literal strings too).
   - Change the bid button text from `font-black uppercase` to `font-semibold`, and change button label text from `Bid R ...` / `Closed` to sentence case (already is — just drop the `uppercase` class so it doesn't get force-capitalized).
   - Location/hours metadata row: change `font-bold` to `font-medium` for readability (it's currently very heavy for metadata).

4. **Fix broken-image handling (photography reliability, section 2 of feedback).**
   - In `src/components/auction/AuctionCardThumbnail.tsx`, the `<img>` tag has no `onError` handler — if `primaryImage` is a non-empty URL that fails to load (404, broken CDN link), the browser shows a broken-image icon instead of the existing placeholder (🚜 "Image Pending").
   - Add local state (`useState`) tracking whether the image failed to load, and an `onError` handler on the `<img>` that sets this state to `true`. When true, render the same placeholder block currently used for `!primaryImage` (the 🚜 + text), instead of the broken `<img>`. Reset this state on `primaryImage` change (useEffect) in case the parent swaps to a different (valid) image.
   - Check `src/pages/AuctionDetail.tsx` for its own gallery `<img>` rendering — apply the same broken-image → placeholder fallback pattern there if a gallery/image component exists without one already. If AuctionDetail delegates to a shared gallery component, fix it there instead of duplicating logic.

5. **Unify visual tokens (section 7 of feedback) in `src/index.css`:**
   - Border color already exists (`--border`) — no change needed there.
   - Radius: current `--radius: 0.5rem` (8px) is used for `--radius-lg`. Astra recommends 4–6px for controls, 8px for images. Rather than a global radius change (risky, touches every component), leave `--radius` as-is for now — this sub-item is deferred to a later phase. Do NOT change `--radius` in this task.
   - Dark mode: `.dark` currently uses a fully grayscale palette (`--primary: 0 0% 98%`), which loses the green brand identity Astra explicitly asked to preserve. Update `.dark`'s `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring` to green-tinted dark-mode-appropriate values consistent with the light theme's forest green (`142 30% 25%` light-mode primary hue). Use a lighter, desaturated-enough-for-dark-bg green for `--primary` in dark mode (e.g. hue ~142, higher lightness) so text/icons on dark backgrounds stay legible — pick reasonable HSL values, verify contrast isn't broken (primary-foreground stays dark or light appropriately for contrast).

## Constraints

- Do NOT touch card layout, filters, marketplace toolbar, bidding panel structure, or mobile nav — those are separate follow-up tasks.
- Do NOT change the `--radius` token.
- Do NOT rename or remove any exported component props/interfaces.
- Keep all existing tests passing. Update/add tests only for the new `onError` fallback behavior in `AuctionCardThumbnail.test.tsx` (there's already a test file for this component — add a case for image load failure showing the placeholder).
- Run `npm run lint` and `npm run test -- AuctionCardThumbnail AuctionCard AuctionCardPrice` (or the repo's actual lint/test scripts — check `package.json`) before finishing, and report results in the Results section.
- Follow `.claude/rules/convex_rules.md` if any Convex files are touched (they shouldn't be for this task — it's frontend-only).

## Results

**Status: Complete.** All phase-1 scope items implemented; `lint` / `test --run` / `type-check` / `build` all pass.

### 1. Inter font ✅

- `index.html`: added Google Fonts `<link>` (preconnect ×2 + stylesheet, weights 400/500/600/700, `display=swap`). Chosen over `@fontsource/inter` because the repo loads assets via `index.html` (existing preconnect pattern) and has no font-package dependency — no new dependency added.
- `src/index.css`: `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif` set in `@theme`, so Tailwind's default `font-sans` picks it up everywhere. No hardcoded font-family on components.

### 2. Tabular numerals ✅

- `AuctionCardPrice.tsx`: `tabular-nums` on the current-bid price.
- `CountdownTimer.tsx`: `tabular-nums` on all countdown spans (TBD / Ended / live countdown) — covers every countdown usage app-wide (cards, BiddingPanel).
- Detail page prices: `AuctionDetail.tsx` delegates all price rendering to `BiddingPanel.tsx` (current bid, final price, "Final Price:" line, next minimum bid) — `tabular-nums` applied there instead of duplicating on the page.

### 3. Calm typography in AuctionCard ✅

- Title (`CardTitle`): removed `uppercase tracking-tight`; `font-black` → `font-semibold` (titles render in authored sentence case).
- Category badge: `uppercase font-bold` → `font-medium`; size now `text-[10px]` in compact mode, `text-xs` in detailed mode (was `text-[8px]` for both).
- Closed badge: `font-black uppercase tracking-wider` → `font-semibold`; literals `SOLD`/`UNSOLD` → `Sold`/`Unsold`.
- Bid button: `font-black uppercase` → `font-semibold` (labels were already sentence case).
- Location/hours metadata row: `font-bold` → `font-medium`.
- `badge.tsx`/`button.tsx` variants untouched (they were already calm).

### 4. Broken-image fallback ✅

- `AuctionCardThumbnail.tsx`: tracks the failed URL (`useState<string | null>`) and renders the 🚜 "Image Pending" placeholder via `onError`. Content-addressed (failed URL, not a boolean), so a swap to a different `primaryImage` recovers automatically — no reset effect needed (see note below).
- `AuctionDetail.tsx` delegates its gallery to the shared `ImageGallery.tsx`, so the fix lives there (no duplicated logic): hero image, lightbox image, and thumbnails all fall back to the same placeholder used for missing images. Extracted a shared `ImagePlaceholder` in the file; empty-state now reuses it.

### 5. Visual tokens ✅

- `--border`: already existed, untouched. `--radius`: untouched per constraints.
- `.dark` updated to green-tinted values consistent with light-mode forest green (`142 30% 25%`): `--primary: 142 35% 55%` (lifted green, legible on dark bg), `--primary-foreground: 142 50% 8%` (dark text on primary — ~5:1 contrast), `--accent: 142 20% 16%`, `--accent-foreground: 142 20% 92%` (~12:1), `--ring: 142 30% 60%`.

### Tests

- `AuctionCardThumbnail.test.tsx`: added 2 cases — placeholder renders on image `error` event (img removed from DOM), and image re-renders after `primaryImage` changes post-failure. 6 → 8 tests.
- `AuctionCard.test.tsx`: updated 5 assertions/2 test names for the `SOLD`/`UNSOLD` → `Sold`/`Unsold` literal change (required to keep tests passing per the task's text-content change).

### Verification (repo scripts, bun per AGENTS)

| Check      | Command                                                                                                                              | Result                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Lint       | `bun run lint`                                                                                                                       | ✅ 0 errors, 524 warnings (all pre-existing baseline; was 527 problems / 2 errors before) |
| Tests      | `bun run test --run` on the 5 touched test files (AuctionCardThumbnail, AuctionCard, AuctionCardPrice, CountdownTimer, ImageGallery) | ✅ 54/54 passed                                                                           |
| Type check | `bun run type-check`                                                                                                                 | ✅ passed                                                                                 |
| Build      | `bun run build`                                                                                                                      | ✅ built in 5.31s                                                                         |

### Implementation notes / deviations

- **Error-state design**: the planned "boolean + useEffect reset on `primaryImage` change" fails the repo's `react-hooks/set-state-in-effect` rule (eslint-plugin-react-hooks v7 errors on setState directly inside effects). Replaced with content-addressed tracking (failed URL / set of failed URLs), which is lint-clean and behaviorally equivalent — recovery on image change is automatic.
- **Tabular-nums on BiddingPanel**: the task named "price display in AuctionDetail.tsx"; those displays live in `BiddingPanel.tsx`. Only the `tabular-nums` class was added — no structural/typographic changes to the bidding panel (untouched for later phases).
- **Left for later phases (intentionally, per scope)**: remaining `uppercase`/`font-black` labels in `AuctionCardPrice.tsx` ("Current Bid"/"Ends In") and `BiddingPanel.tsx` (closed-state copy, KYC alerts), plus `--radius` and all card/filter/mobile-nav work.
- `package.json` version bumped `0.10.1` → `0.10.2` (UI tweaks + bug fix → patch) per repo semantic-versioning policy.
- Findings documented in `codebase_notes.md` ("Visual Refresh Phase 1 — Foundation").
