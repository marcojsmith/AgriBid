# Task: Visual refresh — Phase 4 (Admin: shared chrome + systematic typography/token sweep)

## Context

Continuing the visual modernization (phase 1: typography/tokens/image fallback; phase 2: marketplace cards/toolbar/filters; phase 3: auction detail/bidding panel — all merged or in review on sibling branches/commits). This phase extends the same calming treatment to the **admin section**, which was never in scope for the original design feedback but has the identical visual-noise problem (uppercase, `font-black`, `border-2`, oversized rounded corners) applied even more heavily than the buyer-facing pages, since it's the same design system used inconsistently everywhere.

This is a **mechanical, rule-based sweep** — same substitution rules applied consistently across every listed file — not a redesign. Admin is an internal power-user tool, so keep information density; just remove the visual noise (uppercase/heavy weights/thick borders) that makes it look unfinished, matching the calmer style already applied to the buyer-facing marketplace and detail pages in phases 1-3.

## Substitution rules (apply consistently everywhere below)

| Find                                                                            | Replace with                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `uppercase` (on text elements — headings, labels, badges, button text)          | remove entirely (also remove any `tracking-wide`/`tracking-wider`/`tracking-widest`/`tracking-[0.2em]`/`tracking-tight` that was paired with it for the all-caps effect — keep `tracking-tight` only on large headings where it aids readability, not on small caption labels) |
| `font-black`                                                                    | `font-semibold` (or `font-bold` if it's a primary heading/price — use judgment: page titles and prominent numeric stats can stay `font-bold`, everything else `font-semibold`/`font-medium`)                                                                                   |
| `border-2`                                                                      | `border`                                                                                                                                                                                                                                                                       |
| `rounded-3xl`                                                                   | `rounded-lg`                                                                                                                                                                                                                                                                   |
| `rounded-2xl`                                                                   | `rounded-lg`                                                                                                                                                                                                                                                                   |
| `rounded-xl`                                                                    | `rounded-md`                                                                                                                                                                                                                                                                   |
| `text-[10px]` (caption labels paired with the uppercase/tracking pattern above) | `text-xs`                                                                                                                                                                                                                                                                      |

Do **not** apply these rules to:

- Status/semantic color classes (`text-destructive`, `bg-primary`, etc.) — leave color logic untouched.
- Icon sizes, spacing (`gap-*`, `p-*`, `space-y-*`), or layout classes.
- Any file not listed below.
- Test files (`*.test.tsx`) — except where a test asserts on now-changed text content (e.g. a test expects the literal string `"SOLD"` and the file's copy changes to `"Sold"` per the pattern from phase 1) or a class name is asserted on directly; update only what's necessary to keep tests passing and accurate, don't rewrite test structure.

## Instructions

### 1. Shared admin chrome (highest leverage — every admin page inherits these)

- **`src/components/admin/AdminLayout.tsx`**: apply the substitution rules to the sidebar "Management" label, nav links (`font-bold` → `font-medium`), KPI header title/subtitle, "Announce" button, and the header's `border-b-2` → `border-b`. Sidebar active-link `shadow-lg shadow-primary/20` can stay (that's a deliberate active-state affordance, not noise).
- **`src/components/admin/StatCard.tsx`**: apply the rules to the label (`text-[10px] font-black uppercase tracking-widest` → `text-xs font-medium`) and the card's `border-2` → `border`. Keep the value at `font-bold` (or `font-semibold` if `font-black` currently) since it's a prominent stat number — don't shrink it.
- **`src/components/admin/SummaryCard.tsx`**, **`src/components/admin/SettingsCard.tsx`**, **`src/components/admin/EmptyState.tsx`**, **`src/components/admin/DetailItem.tsx`**, **`src/components/admin/ConditionItem.tsx`**, **`src/components/admin/ModerationCard.tsx`**, **`src/components/admin/AdminConnectionError.tsx`**: read each file, apply the substitution rules throughout.

### 2. Admin page-level sweep

Apply the same substitution rules to these files (read each before editing — some may have page-specific headings/tables/badges beyond what a blind find-replace would catch correctly, use judgment consistent with phases 1-3):

- `src/pages/admin/AdminAnnouncements.tsx`
- `src/pages/admin/AdminAuctions.tsx`
- `src/pages/admin/AdminFAQ.tsx`
- `src/pages/admin/AdminModeration.tsx`
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/admin/dialogs/BulkActionDialog.tsx`
- `src/pages/admin/dialogs/KycReviewDialog.tsx`
- `src/pages/admin/dialogs/PromoteAdminDialog.tsx`
- `src/components/admin/AuditTab.tsx`
- `src/components/admin/BidMonitor.tsx`
- `src/components/admin/CategoryManager.tsx`
- `src/components/admin/FinanceTab.tsx`
- `src/components/admin/MetadataCatalog.tsx`
- `src/components/admin/SupportTab.tsx`

After finishing this list, run this search yourself to check for anything missed, and apply the same rules to any additional admin-scoped files it turns up (there may be more admin pages/components beyond the ones enumerated above — the codebase changes over time, so treat the list above as a floor, not a ceiling):

```
grep -rlE "uppercase|font-black|border-2|rounded-(xl|2xl|3xl)" src/pages/admin src/components/admin --include='*.tsx' | grep -v '\.test\.tsx$'
```

### 3. Other admin pages not caught by the grep (visual consistency pass)

Some admin pages may already avoid the heaviest markers above but still use inconsistent spacing/borders/corners relative to the newly-calmed style. Skim these and apply the same `rounded-xl`→`rounded-md` / `border-2`→`border` rules if present, but don't force changes where none of the flagged patterns exist:

- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/AdminAudit.tsx`
- `src/pages/admin/AdminBusinessInfo.tsx`
- `src/pages/admin/AdminEquipmentCatalog.tsx`
- `src/pages/admin/AdminErrorReportingSettings.tsx`
- `src/pages/admin/AdminErrorReports.tsx`
- `src/pages/admin/AdminFees.tsx`
- `src/pages/admin/AdminFinance.tsx`
- `src/pages/admin/AdminMarketplace.tsx`
- `src/pages/admin/AdminSEOSettings.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/pages/admin/AdminSupport.tsx`

## Constraints

- **Visual/className changes only.** Do not touch any business logic, data fetching, mutation calls, validation, or component props/interfaces in any file.
- Do NOT touch any buyer-facing pages/components (`src/pages/*.tsx` outside `admin/`, `src/components/auction/*`, `src/components/bidding/*`, `src/components/FilterSidebar.tsx`, `src/components/ImageGallery.tsx`, `src/components/AuctionHeader.tsx`) — those are separate phases, some in progress on sibling work.
- Preserve all `data-testid`, `aria-label`, and `htmlFor` attributes exactly as they are.
- If a text-content change is needed to match sentence case (e.g. a literal `"SOLD"` string, matching the phase-1 precedent of `SOLD`→`Sold`), update both the source and any test asserting on that exact string — but don't invent new copy beyond a casing change.
- Keep all existing tests passing. Do not add new test files for this phase (it's a visual sweep, not new functionality) — just fix any test that breaks due to a copy/class assertion.
- Work through the files in batches and run `bun run lint` / `bun run test --run <touched files>` periodically rather than only once at the very end, so a mistake in an early file doesn't compound across 25+ files.
- Run the full repo lint, test suite, type-check, and build before finishing, and report exact results in the Results section below. Also run `bunx coderabbit review --uncommitted` and fix any findings before finishing.
- Follow `.claude/rules/convex_rules.md` if any Convex files are touched (they shouldn't be — this is frontend-only).

## Results

**Status: complete.** All rules applied, all verification green. 30 files changed (25 source + 7 test files; 190 insertions / 190 deletions).

### What was done

- **Shared chrome (step 1)** — all 9 files swept: `AdminLayout` (sidebar label/links, KPI title/subtitle, Announce button, `border-b`), `StatCard` (label → `text-xs font-medium`, value kept prominent at `font-bold`, `border`), `SummaryCard`, `SettingsCard`, `EmptyState` (JSDoc "uppercase" wording corrected too), `DetailItem`, `ConditionItem`, `ModerationCard`, `AdminConnectionError`.
- **Page-level sweep (step 2)** — all 14 enumerated files: `AdminAnnouncements`, `AdminAuctions`, `AdminFAQ`, `AdminModeration`, `AdminUsers`, the 3 dialogs, `AuditTab`, `BidMonitor`, `CategoryManager`, `FinanceTab`, `MetadataCatalog`, `SupportTab`. Verification grep from the task returns **zero matches** across both admin directories (floor confirmed as ceiling — no additional files turned up).
- **Section-3 consistency pass (step 3)** — all 12 remaining pages grepped individually: zero flagged patterns present, so per instructions no forced changes.
- **Judgment calls consistent with phases 1–3**: `tracking-tight` kept only on text-xl+ headings; small utility buttons → `font-medium`, primary/destructive CTAs → `font-semibold`; `text-[8px]`/`text-[9px]` caption labels paired with the uppercase pattern → `text-xs`.
- **Copy changes (phase-1 `SOLD`→`Sold` precedent)**: `ConditionItem` literals `PASS`/`FAIL` → `Pass`/`Fail` (JSDoc updated; `ConditionItem.test.tsx`, `ModerationCard.test.tsx`, `AdminModeration.test.tsx` updated). `BulkActionDialog` dropped the `uppercase` class and its `.toUpperCase()` display call, so the status renders as authored (`active`); its test updated (`ACTIVE` → `active`, `UNSPECIFIED` → `unspecified`). No other copy invented.
- **Test-class assertions fixed**: `StatCard.test.tsx` (`.border-2` → `.border`), `SummaryCard.test.tsx`, `SettingsCard.test.tsx` (`rounded-md`).
- **CodeRabbit review**: initial run produced **5 majors** — all fixed: hardcoded status colours on touched lines → semantic tokens (`success`/`warning`; blue "Sold" badge → `bg-primary/10 text-primary` since there is no info token — muted forest stays distinguishable from vivid success "Active"); container `rounded-lg` → `rounded-md` per AGENTS rule 10 (applied to all admin `AlertDialogContent`s and icon chips, not just flagged lines); `ModerationCard` year-badge scrim → `bg-foreground/70 text-background`. Re-run: **"No new findings ✔"**. (Used `bunx coderabbit review --uncommitted` — the AGENTS.md `--prompt-only` syntax errors on the installed CLI, as already noted in codebase_notes.md.)

### Verification (all pass)

| Check              | Command                                | Result                                                      |
| ------------------ | -------------------------------------- | ----------------------------------------------------------- |
| Lint (full repo)   | `bun run lint`                         | 0 errors, 524 warnings (exact pre-existing baseline; 0 new) |
| Tests (full suite) | `bun run test --run`                   | 168 files, **2036 passed**, 0 failed                        |
| Type check         | `bun run type-check`                   | Clean (tsgo, no errors)                                     |
| Build              | `bun run build`                        | ✓ built in ~4.7s                                            |
| CodeRabbit         | `bunx coderabbit review --uncommitted` | 5 majors fixed → no new findings                            |
| Post-sweep grep    | task's grep command                    | 0 matches in non-test admin files                           |

### Constraints honoured

- Visual/className changes only; no business logic, data fetching, mutations, validation, or props/interfaces touched (sole exception: `BulkActionDialog`'s display-only `.toUpperCase()` removal, per the sentence-case precedent).
- No buyer-facing files touched; all `data-testid`, `aria-label`, `htmlFor` preserved; no Convex files touched.
- Noteworthy discoveries documented in `codebase_notes.md` (Visual Refresh Phase 4 section), including the status-token mapping and the overlay-scrim token pattern.
