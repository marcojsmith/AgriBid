# Task: Make currency/number formatting deterministic across environments (fixes #293)

## Context

CI (added in PR #292) exposed that 9 tests fail on `ubuntu-latest` runners but pass locally on Windows. All failures are currency/number-formatting assertions. Root cause: this codebase relies on the JS runtime's `Intl`/`toLocaleString` behavior for `en-ZA`-style formatting ("R 50 000,00" — space thousands separator, comma decimal), and that behavior is NOT guaranteed identical across platforms/ICU builds:

- Some call sites use `.toLocaleString()` with **no locale argument at all** (e.g. `src/components/admin/BidMonitor.tsx:146,150`, `src/components/admin/FinanceTab.tsx:55,135`) — this resolves to whatever the JS engine's _default_ locale is, which differs between your Windows dev machine and the Ubuntu CI runner (e.g. `150,000` with a comma vs `150 000` with a space).
- Some call sites use `.toLocaleString(undefined, { minimumFractionDigits: 2, ... })` (e.g. `src/pages/admin/AdminFees.tsx:34,43,52`, `src/components/admin/FinanceTab.tsx:64,73,82,142`) — same default-locale problem.
- The one shared helper that exists, `formatCurrency` in `src/lib/currency.ts`, uses `Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", ... })`. This explicitly requests `en-ZA`, but ICU's grouping separator character for that locale can still vary by ICU/CLDR version between environments (regular space vs narrow no-break space U+202F vs no-break space U+00A0). `src/lib/currency.test.ts` already works around this by normalizing NBSP → space before asserting — proof this has been a known fragility, just not one that was ever exercised on Linux CI until now.

Since all of this is client-side code rendered in real users' browsers (which always ship full ICU), the bug **never affects production** — it's purely a test-environment inconsistency. The fix is to stop depending on runtime `Intl`/locale behavior for these values at all: replace it with a small deterministic, pure string-formatting function that produces the same output on every platform, always.

## Instructions

1. **Rewrite `formatCurrency` in `src/lib/currency.ts`** to be deterministic — no `Intl`, no `toLocaleString`. It must produce exactly the same style as before (e.g. `formatCurrency(1234.56)` → `"R 1 234,56"`, `formatCurrency(0)` → `"R 0,00"`, `formatCurrency(50000)` → `"R 50 000,00"`), using manual string manipulation:
   - Round/fix to 2 decimal places.
   - Group the integer part with a plain ASCII space (`" "`) every 3 digits from the right.
   - Use a comma (`,`) as the decimal separator (matches en-ZA convention already used throughout the app's UI copy).
   - Handle negative amounts (prefix `-` before `R`, e.g. `-R 100,00` — check `formatCurrency`'s existing JSDoc/callers for the expected convention if any negative-amount usage exists; if none exists in the codebase, a simple `-` prefix is fine).
   - Keep the exported function signature identical: `formatCurrency(amount: number): string`.

2. **Add a new pure helper `formatNumber(amount: number): string`** in the same file, for the plain-number-with-grouping (no currency symbol, no forced decimals) use case — e.g. `formatNumber(150000)` → `"150 000"`, `formatNumber(1234.5)` → `"1 234.5"` (do NOT force 2 decimals here; only group the integer part, leave the fractional part as-is if present — check actual call sites in step 3 to confirm none of them need forced decimals; if any do, use `formatCurrency`-style rounding for those instead and skip adding fractional handling to `formatNumber`).

3. **Replace every ad-hoc `.toLocaleString(...)` call used for displaying Rand amounts** with the appropriate shared helper. Read each file fully before editing — some already correctly use `formatCurrency`, most don't:
   - `src/components/admin/BidMonitor.tsx:146,150` — `R {bid.amount.toLocaleString()}` → import and use `formatCurrency(bid.amount)` (drop the manual `"R "` prefix template text since `formatCurrency` includes it), OR if the design intent here is a whole-number-only display (check the test file `BidMonitor.test.tsx` for expected format — it uses a flexible regex `/R\s*150\s*000/`, so either works, but prefer `formatCurrency` for consistency).
   - `src/components/admin/FinanceTab.tsx:55,64,73,82,135,142` — same pattern; replace all six with `formatCurrency(...)`, dropping the manual `` `R ${...}` `` template wrapping since `formatCurrency` already includes the `R` prefix.
   - `src/pages/admin/AdminFees.tsx:34,43,52` — same pattern, replace with `formatCurrency(...)`.
   - Grep the whole `src/` tree yourself for any other `.toLocaleString(` calls used to display a Rand/currency amount (search for the pattern `` `R ${...toLocaleString`` and ` R {...toLocaleString` in JSX) and consolidate those too, EXCEPT:
     - Do NOT touch `.toLocaleString(...)` calls used for **dates/times** (e.g. `src/pages/AuctionDetail.tsx:284` formats `auction.startTime` as a date, not currency — leave it alone).
     - Do NOT touch plain non-currency numeric displays that aren't money (e.g. counts, hours) unless they're clearly part of this same bug class — if unsure whether a given call site is in scope, leave it and note it in the Results section instead of guessing.
   - Files that already correctly call `formatCurrency` (`src/components/admin/ModerationCard.tsx`, `src/components/auction/FeeBreakdown.tsx`, `src/pages/admin/AdminAuctions.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/dashboard/MyBids.tsx`) need no changes — they'll automatically get the deterministic output once `formatCurrency` itself is fixed in step 1.

4. **Do not touch `.toLocaleString("en-ZA")` calls that are for plain bid/price amounts without a currency-style wrapper** (e.g. `src/components/bidding/BiddingPanel.tsx`, `src/components/auction/AuctionCard.tsx`, `src/pages/Home.tsx`'s `formatRand`, `src/pages/Profile.tsx`) **only if they are outside the 9 failing tests and not exercised by CI failures** — but DO check each one: if it's a simple `` `R ${x.toLocaleString("en-ZA")}` `` pattern (no explicit `minimumFractionDigits`), it has the same latent bug (ICU grouping-character variance) even though it's not currently failing on CI (maybe not covered by a test assertion). Since this is a systemic pattern, consolidate these onto `formatCurrency` too where the value is clearly a Rand amount, for consistency and to close out the bug class — this was called out explicitly in the issue's follow-up comment. Use your judgment on scope but prefer consistency over leaving known-fragile code in place.

5. **Run the full test suite** (`bun run test --run`) and confirm all tests pass, in particular:
   - `src/lib/currency.test.ts`
   - `src/components/admin/BidMonitor.test.tsx`
   - `src/components/admin/ModerationCard.test.tsx`
   - `src/pages/admin/AdminFees.test.tsx`
   - `src/pages/admin/AdminFinance.test.tsx`
   - `src/pages/admin/AdminMarketplace.test.tsx`
     You may need to update hardcoded test expectations if the exact rendered string changes shape (e.g. if a test expected `formatCurrency`'s old `Intl`-based output format and the new deterministic format differs in some edge case) — but the target output format (`"R 50 000,00"` style) should match what most tests already expect, since that's the format they were written against.

6. Run `bun run type-check` and `bun run lint` to confirm no regressions.

## Constraints

- No `any` types. Follow existing code style (JSDoc on exported functions, per `AGENTS.md`/`convex_rules.md` conventions already used in `src/lib/currency.ts`).
- Do not introduce a new dependency (e.g. a number-formatting library) — plain string/regex manipulation is sufficient and keeps this dependency-free.
- Do not change `.toLocaleString` calls used for dates/times.
- Keep the diff focused on currency/number-formatting consolidation. Don't refactor unrelated component logic.
- This should fully resolve GitHub issue #293 — reference it in your Results summary.

## Results

**Status: Complete — fully resolves #293.** All currency/number formatting is now deterministic (pure string manipulation, zero `Intl`/`toLocaleString` dependencies), producing identical output on every platform/ICU build.

### 1. `src/lib/currency.ts` rewritten (step 1 & 2)

- `formatCurrency(amount: number): string` — same signature, now deterministic: fixes to 2 decimals via `toFixed(2)`, groups the integer part with an ASCII space every 3 digits (shared private `groupThousands` helper, implemented with string slicing — no regex), comma decimal separator. Output: `1234.56` → `"R 1 234,56"`, `0` → `"R 0,00"`, `50000` → `"R 50 000,00"`, `-100` → `"-R 100,00"` (simple `-` prefix; no negative-amount callers exist in the codebase). Stale JSDoc example (`"R 1,234.56"`) corrected to the actual en-ZA format.
- `formatNumber(amount: number): string` — added as specified: groups integer part only, fractional part left as-is, no forced decimals (`150000` → `"150 000"`, `1234.5` → `"1 234.5"`). After auditing all call sites (step 3), none needed a bare grouped number without a currency symbol, so it currently has no production caller; it is exported for this use case and covered by tests to satisfy coverage thresholds.

### 2. Call sites consolidated (steps 3 & 4)

- **The 9 CI-failure sites:** `BidMonitor.tsx` (2×), `FinanceTab.tsx` (6×), `AdminFees.tsx` (3×) — all `R ${...toLocaleString(...)}` wrappers replaced with `formatCurrency(...)`, dropping the manual `R` prefixes.
- **Same-bug-class consolidation** (simple `en-ZA` / default-locale `toLocaleString` on Rand amounts, per the issue follow-up): `BiddingPanel.tsx` (6×), `BidForm.tsx` (7×, default-locale — worst offenders), `FeeManager.tsx` (1×), `AuctionCard.tsx` (2×), `AuctionCardPrice.tsx` (1×), `BidHistory.tsx` (1×), `MobileBidBar.tsx` (1×), `MyListings.tsx` (2×), `Home.tsx` (deleted local `formatRand`, passes `formatCurrency` directly), `NotificationListener.tsx` (3×), `Profile.tsx` (`formatPrice` body), `ReviewSubmitStep.tsx` (2×).
- `ModerationCard.test.tsx`'s `formatCurrency` mock was itself env-dependent (`amount.toLocaleString()`); made deterministic (`amount.toFixed(2)`). No assertions depend on its exact output.
- Files already using `formatCurrency` untouched, as instructed. Final grep: the only remaining `toLocaleString(` calls in `src/` are dates (`AuditTab.tsx:92`, `AuctionDetail.tsx:284`) and operating-hours counts (`AuctionCard.tsx:245`, `AuctionHeader.tsx:174`, `Home.tsx:211`) — left alone per the plan; noted here rather than guessing, since hours are counts, not money.

### 3. Tests & verification (steps 5 & 6)

- `src/lib/currency.test.ts` rewritten: the old `normalize()` NBSP workaround (proof of the fragility) replaced with exact deterministic assertions, plus new cases for rounding carry-over (`999.999` → `"R 1 000,00"`), sub-rand values, negatives, and a full `formatNumber` suite. 14 tests total.
- Targeted check of the CI-failure list first: `currency.test.ts`, `BidMonitor.test.tsx`, `ModerationCard.test.tsx`, `AdminFees.test.tsx`, `AdminFinance.test.tsx`, `AdminMarketplace.test.tsx` — all pass (`AdminFees`' exact `"R 50 000,00"`-style assertions match the new output; all other currency assertions were already flexible regexes).
- Full suite: **175 files / 2217 tests passed**. `bun run type-check` (tsgo): clean. `bun run lint`: **0 errors**; all touched files clean except the repo-wide pre-existing "Unsafe call" test-file warnings (flagged lines untouched by this change). The new formatter initially triggered `security/detect-unsafe-regex` on the regex-based grouping, so grouping was reimplemented with pure string slicing — no warnings remain in any changed file.
- No new dependencies; no `any` types; JSDoc on all exported functions; no date/time `toLocaleString` touched.

### Notes / follow-ups

- `FinanceTab.tsx:145` renders per-fee line items as `R${f.amount.toFixed(2)}` — deterministic already, but stylistically inconsistent with `formatCurrency` (no space, dot decimal). Left as-is to keep the diff focused; candidate for a follow-up cosmetic cleanup.
- Cosmetic user-visible change: amounts previously shown as `R 50 000` (or `R50 000`, `R 5,000` on non-en locales) now render as `R 50 000,00` in the consolidated sites. This matches the format the failing tests and most of the app already expect.
