# Task: Report Profile functionality (GitHub issue #232)

## Context

- `src/pages/Profile.tsx` — the "Report Profile" button (~line 578-587, inside the
  `{!isOwner && (...)}` block) is permanently disabled with
  `title="Coming soon - see issue #221"` (that TODO comment is stale/wrong — #221 is
  the seller-reviews feature, already shipped; this is a distinct feature). `isOwner`
  is computed at ~line 191-193. `userId` (the profile being viewed) is available in
  this component's scope.
- `convex/schema.ts` — existing parallel pattern `auctionFlags` table (search `//
Auction flagging system for community moderation`, ~line 95-115): `reason` union,
  `details` optional string, `status` union (`pending`/`reviewed`/`dismissed`),
  `createdAt`, indexed by the flagged entity, by reporter, by status, and by
  entity+status combined.
- `convex/auctions/mutations/publish.ts` — `flagAuctionHandler`/`flagAuction`
  (~line 105-191) and `dismissFlagHandler`/`dismissFlag` (~line 201-276) are the
  exact functional pattern to mirror for profile reports: auth via
  `getAuthenticatedUserId`, self-report guard, duplicate-pending-report guard,
  `ConvexError` for rejections, `logAudit` call, admin-only guard via
  `getCallerRole(ctx) !== "admin"` (or `requireAdmin(ctx)`, both used elsewhere in
  this file — follow whichever this file already imports) for the dismiss/review path.
- `convex/auctions/queries/admin.ts` — `getAllPendingFlags`/`getAuctionFlags`
  (~line 151-260) is the pattern for the admin-facing paginated/listing queries,
  including how they join reporter info.
- `src/pages/AuctionDetail.tsx` (~line 85-136, and the JSX around line 353-434) is the
  exact UI pattern to mirror: a `Dialog`/`DialogTrigger`/`DialogContent` with a
  `Select` for reason and a textarea/details field, `useMutation`, `toast.success`/
  `toast.error` on submit, resetting local state on close. Copy this pattern's
  structure for the profile report dialog rather than inventing a new one.
- `src/pages/admin/AdminModeration.tsx` (~line 35, 85, 140, 153, 172) — where
  `auctionFlags` are surfaced in the admin moderation panel; add a parallel section
  for `profileFlags`.

## Instructions

1. **Schema**: add a `profileFlags` table to `convex/schema.ts`, placed near
   `auctionFlags` for discoverability:

   ```typescript
   profileFlags: defineTable({
     reportedUserId: v.string(),
     reporterId: v.string(),
     reason: v.union(
       v.literal("fake_account"),
       v.literal("fraudulent_listings"),
       v.literal("abusive_behaviour"),
       v.literal("identity_misrepresentation"),
       v.literal("other")
     ),
     details: v.optional(v.string()),
     status: v.union(
       v.literal("pending"),
       v.literal("reviewed"),
       v.literal("dismissed")
     ),
     adminNotes: v.optional(v.string()),
     createdAt: v.number(),
   })
     .index("by_reported_user", ["reportedUserId"])
     .index("by_reporter", ["reporterId"])
     .index("by_status", ["status"])
     .index("by_reported_status", ["reportedUserId", "status"]);
   ```

2. **New file `convex/flags/profileFlags.ts`** (or `convex/profileFlags.ts` — pick
   whichever matches this repo's existing file organization for feature modules;
   check whether `convex/auctions/` is a directory-per-feature convention and follow
   it) with:
   - `reportProfileHandler`/`reportProfile` (public mutation). Args:
     `{ reportedUserId: v.string(), reason: v.union(...same 5 literals...), details:
v.optional(v.string()) }`. Guards (mirror `flagAuctionHandler`'s style):
     caller authenticated via `getAuthenticatedUserId`; reject if
     `reportedUserId === callerId` ("You cannot report your own profile"); reject if
     no profile exists for `reportedUserId` (check `profiles` table by `userId`
     index); reject duplicate — a caller with an existing **pending** report against
     the same `reportedUserId` within the last 30 days (use `by_reporter` index,
     filter reportedUserId + createdAt in JS, matching how `flagAuctionHandler`
     checks `userHasFlagged`). Insert into `profileFlags` with `status: "pending"`.
     Returns `v.object({ success: v.boolean() })`.
   - `getAllPendingProfileFlagsHandler`/`getAllPendingProfileFlags` (public query,
     admin-only — same admin-role guard as `dismissFlagHandler`/`getAllPendingFlags`
     use elsewhere in this codebase). Returns pending flags with reporter/reported
     user display names attached (mirror `getAllPendingFlags`'s join style in
     `convex/auctions/queries/admin.ts`).
   - `reviewProfileFlagHandler`/`reviewProfileFlag` (public mutation, admin-only).
     Args: `{ flagId: v.id("profileFlags"), status: v.union(v.literal("reviewed"),
v.literal("dismissed")), adminNotes: v.optional(v.string()) }`. Guards: admin
     role required; flag exists; flag is currently `"pending"` (reject otherwise, same
     as `dismissFlagHandler`). Patches `status` and `adminNotes`. Call `logAudit` with
     action `"REVIEW_PROFILE_FLAG"` mirroring the `DISMISS_FLAG` audit call's shape.
     Returns `v.object({ success: v.boolean() })`.
   - Do NOT implement auto-hiding a profile on flag threshold (issue's Notes list
     this as a "Consider" item, not a requirement) — out of scope for this task.

3. **Admin dashboard**: in `src/pages/admin/AdminModeration.tsx`, add a parallel
   "Reported Profiles" section next to the existing flagged-auctions section, backed
   by `getAllPendingProfileFlags`, with a way to mark each as reviewed/dismissed
   (reuse whatever button/action pattern the auction-flags section already uses for
   its own review/dismiss actions).

4. **`src/pages/Profile.tsx`**: enable the "Report Profile" button for non-owners.
   - Remove the stale `disabled`/`title="Coming soon - see issue #221"` and the
     `{/* TODO(#221): ... */}` comment above it.
   - Add local state for a report dialog (`reportDialogOpen`, `reportReason`,
     `reportDetails`) and a `useMutation(api.<path>.reportProfile)` call, following
     `AuctionDetail.tsx`'s `flagDialogOpen`/`flagReason`/`flagDetails`/
     `handleFlagAuction` pattern exactly (same component structure: `Dialog` wraps
     the button as `DialogTrigger`, `DialogContent` has a `Select` for the 5 reason
     literals with human-readable labels, e.g. "Fake Account", "Fraudulent Listings",
     "Abusive Behaviour", "Identity Misrepresentation", "Other", plus a details
     textarea, and a submit button calling the mutation with `toast.success`/
     `toast.error` feedback and dialog-close + state-reset on success).
   - The mutation call uses `reportedUserId: userId` (the profile being viewed).

5. **Tests**: add `convex/flags/profileFlags.test.ts` (or co-located per whatever
   convention you used in step 2) covering `reportProfile` — success, self-report
   rejected, reported-user-not-found rejected, duplicate-pending-report rejected —
   and `reviewProfileFlag` — success (reviewed), success (dismissed), non-admin
   rejected, already-reviewed flag rejected. Follow `convex/auctions/flagAuction.test.ts`
   / `dismissFlag.test.ts`'s existing mocking conventions. Update
   `src/pages/Profile.test.tsx` for the enabled button + dialog flow (open dialog,
   select reason, submit, success toast). Add/extend
   `src/pages/admin/AdminModeration.test.tsx` if it exists (check first) for the new
   Reported Profiles section.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument + return
  validators on every mutation/query, no `any` types, prefer indexes over `.filter()`.
- Do not touch `auth.config.ts`, CORS helpers, deployment config, or unrelated files.
- Do not implement auto-hiding profiles on flag count (explicitly out of scope, see
  step 2 above).
- Follow this repo's existing code style, `ConvexError` messages, `logAudit` calls,
  and dialog/component patterns rather than inventing new ones.
- Bump `package.json` version per `AGENTS.md`'s semver section (this branch continues
  from `0.12.0` after the #221 follow-up work — a minor bump for this additive
  feature).

## Verification

Run these yourself and record actual results in the Results section below — do not
assume success:

1. `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`
   AND `bun run type-check` (both — the pre-commit hook uses the former, `bun run
type-check` uses `tsconfig.build.json`; both must pass or the commit will be
   blocked by husky).
2. `npx convex dev --once` — deploys cleanly (schema change: new `profileFlags`
   table).
3. `bun run test --run` (full suite) — all green, including new/updated tests.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs the
   current HEAD of this branch.
5. Manually confirm (via diff) that `auctions`, `auctionFlags`, `reviews`, `profiles`
   table definitions in `convex/schema.ts` are unchanged, and that "Contact Seller"
   and its own TODO(#220) are untouched in `Profile.tsx`.

## Results

<!-- opencode: fill this in when done -->

**Status: complete.** All 5 instruction steps implemented, all Verification items run with real results recorded below.

### Files changed

| File                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`                         | Added `profileFlags` table directly below `auctionFlags` (exact definition from step 1, all 4 indexes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `convex/profileFlags.ts`                   | **New.** Chose flat top-level file (matches `reviews.ts`/`support.ts`/`watchlist.ts` convention; `convex/auctions/` is only a directory because that feature is large). Exports `reportProfileHandler`/`reportProfile`, `getAllPendingProfileFlagsHandler`/`getAllPendingProfileFlags`, `reviewProfileFlagHandler`/`reviewProfileFlag`. All guards per spec: auth via `getAuthenticatedUserId`; self-report rejected ("You cannot report your own profile"); profile existence via `profiles.by_userId` ("Profile not found"); duplicate pending report within 30 days via `by_reporter` index + JS filter on `reportedUserId`/`createdAt` ("You have already reported this profile"). Query uses `requireAdmin` (mirrors `getAllPendingFlags`) and joins both reporter and reported-user display names. Review mutation uses `getCallerRole(ctx) !== "admin"` (mirrors `dismissFlagHandler`), rejects non-pending flags, patches `status` + `adminNotes`, and logs audit action `REVIEW_PROFILE_FLAG` (targetType `profileFlag`) with the same details shape as `DISMISS_FLAG`. 30-day window defined locally as `PROFILE_REPORT_DUPLICATE_WINDOW_MS = 30 * MS_PER_DAY`. Auto-hiding profiles intentionally **not** implemented (out of scope per Constraints). |
| `src/pages/Profile.tsx`                    | Removed stale `disabled`/`title="Coming soon - see issue #221"` and the `TODO(#221)` comment; Report Profile button is now a `DialogTrigger`. Added `reportDialogOpen`/`reportReason`/`reportDetails` state, `useMutation(api.profileFlags.reportProfile)`, and `handleReportProfile` mirroring `handleFlagAuction` in `AuctionDetail.tsx` (reason-required toast, trimmed-details→`undefined`, success toast + dialog close + state reset, error toast with server `ConvexError` message). Dialog contains the 5 reason literals with human-readable labels + optional details textarea. Mutation uses `reportedUserId: userId` (route param) with a `if (!userId) return;` guard. **Contact Seller and its `TODO(#220)` are byte-identical to before (verified by diff).**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/pages/admin/AdminModeration.tsx`      | Added "Reported Profiles" section (parallel to Flagged Listings: destructive `UserX` header + count badge, card grid showing reported user name, reporter name, reason badge, details, date) backed by `getAllPendingProfileFlags`. Review/dismiss reuses the existing dismiss `AlertDialog`: the profile card's "Mark Reviewed"/"Dismiss Report" buttons open the same dialog in profile mode (dynamic title "Review Profile Report", description, "Admin notes" label, confirm handler `handleReviewProfileFlag` calling `reviewProfileFlag`), while auction flags keep their existing "Dismiss Flag" flow unchanged. Added `pendingProfileFlags` to the loading condition and to the "Queue is Clear" condition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `convex/profileFlags.test.ts`              | **New.** 12 tests: `reportProfile` — success (insert shape verified), self-report rejected, profile-not-found rejected, duplicate-pending rejected, pending-report-older-than-30-days allowed; `reviewProfileFlag` — success reviewed (patch + audit shape verified), success dismissed, non-admin rejected, flag-not-found, already-reviewed rejected; `getAllPendingProfileFlags` — name join (incl. "Unknown User" fallback), non-admin rejected. Mocking conventions copied from `flagAuction.test.ts`/`dismissFlag.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/pages/Profile.test.tsx`               | Added `sonner`, `ui/dialog`, `ui/select` mocks (copied from `AuctionDetail.test.tsx` patterns) and `profileFlags.reportProfile` to the api mock. Extended non-owner test to assert the button is enabled; added a 6-test "Report Profile dialog" suite (opens with select+textarea, cancel closes, no-reason error toast, submit success with exact args + toast + dialog closes, blank details → `undefined`, failure toast + dialog stays open).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/pages/admin/AdminModeration.test.tsx` | Added `profileFlags` api mocks, `mockReviewProfileFlagMutation`, default `beforeEach` mocks, and `profileFlags: []` to the empty-state test (required since the new query now participates in the loading condition). One existing assertion widened (`getByText`→`getAllByText` for the reporter name, which now legitimately appears in both sections). New 5-test "Reported Profiles section" suite (renders cards, mark reviewed w/ toast, dismiss w/ admin notes + toast, failure toast, cancel closes dialog). Existing auction-flag dialog tests pass unchanged (button naming keeps `/^dismiss$/i` unique).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `package.json`                             | `0.12.0` → `0.13.0` (minor, additive feature, per semver section of AGENTS.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `convex/_generated/api.d.ts`               | Regenerated by codegen (`profileFlags` module added) — generated file, not hand-edited                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `codebase_notes.md`                        | Added "Profile Reports (issue #232)" section documenting the flat-file placement decision, merged review/dismiss mutation, and shared-AlertDialog admin UI approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Verification results (all run, not assumed)

1. **Type checks — PASS.**
   - `bunx tsgo -p tsconfig.json --noEmit` → clean exit 0
   - `bunx tsgo -p convex/tsconfig.json --noEmit` → clean exit 0
   - `bun run type-check` (`tsgo -b tsconfig.build.json --noEmit`) → clean exit 0
   - (Run order note: `npx convex dev --once` was executed before the type checks so `convex/_generated` contains the new `profileFlags` table types — a fresh checkout will need codegen first or the convex type-check will fail on the new module.)
2. **`npx convex dev --once` — PASS.** "✔ Convex functions ready! (5.87s)" — schema push with the new `profileFlags` table deployed cleanly, no prompts, no errors.
3. **`bun run test --run` (full suite) — PASS.** 169 test files, **2068 tests passed, 0 failed** (up from 2054 on this branch before the task: +12 convex, +7 Profile, +5 AdminModeration net-new after updating existing assertions). One iteration was needed: 3 initial failures were in the new tests themselves (missing `renderProfile()` call in a helper, a query-test mock returning the same profile for both joins, and a `getByText` collision after two sections rendered the reporter name) — fixed and re-run green.
4. **`bunx eslint` on every touched file — PASS.** `convex/schema.ts`, `convex/profileFlags.ts`, `convex/profileFlags.test.ts`, `src/pages/Profile.tsx`, `src/pages/Profile.test.tsx`, `src/pages/admin/AdminModeration.tsx`, `src/pages/admin/AdminModeration.test.tsx`: **0 errors, 10 warnings**. Baseline check: stashed the changes, linted the HEAD versions of the 3 previously-existing files — identical 10 warnings (same rules; 6× `require-await` + 1× `no-unnecessary-condition` in Profile.test.tsx/Profile.tsx, 3× in AdminModeration.test.tsx incl. the pre-existing `apiPath?._path` unsafe-access in the unknown-reason test). **Zero new warnings vs HEAD.** (Method note: `eslint --stdin` does not work for this comparison here — it lints the on-disk file — so a path-scoped `git stash` baseline was used instead. The stash pop initially aborted on a concurrently-regenerated `convex/_generated/api.d.ts`; resolved with `git checkout -- <file> && git stash pop`, and all changes were verified restored afterwards.)
5. **Diff confirmation — PASS.**
   - `git diff convex/schema.ts` contains only the additive `profileFlags` block; `auctions`, `auctionFlags`, `reviews`, `profiles` definitions are byte-identical.
   - In `src/pages/Profile.tsx` the only removed lines matching TODO/Contact-Seller patterns are the stale `TODO(#221)` comment and `title="Coming soon - see issue #221"`; the "Contact Seller" button and its `TODO(#220)` are untouched (context-only in the diff).

### Notes for review

- `getAllPendingProfileFlags` returns `reporterName` and `reportedUserName` (both joined via `profiles.by_userId`, "Unknown User" fallback) — the admin card shows the reported user's name as the card title.
- `reviewProfileFlag` intentionally writes `adminNotes: undefined` when no notes are supplied (patches the field to absent), matching how `dismissFlagHandler` patches only the fields it changes; the return validators on all three functions follow the new-function-syntax rules in `.claude/rules/convex_rules.md`.
- Not committed — left staged-free on `feat/issue-232-report-profile` for review (pre-commit verification above was run manually in lieu of the husky hook).
