# Task: Add a Messages header nav entry (follow-up to #231, PR #262)

PR #262 (issue #231, seller messaging) intentionally skipped adding a header nav
entry for the new `/messages` inbox, judging it more than "small, low-risk" for that
PR. The user has now explicitly asked for it. This task adds it to both header nav
surfaces this repo has.

## Context

- `src/components/header/UserDropdown.tsx` — the primary account dropdown. Nav items
  live as `DropdownMenuItem asChild` wrapping a `Link`, each with an icon +
  uppercase label, e.g. (~line 198-227):
  ```tsx
  <DropdownMenuItem
    asChild
    className="rounded-xl font-bold uppercase text-[10px] tracking-wide h-10"
  >
    <Link to="/dashboard/bids" className="flex items-center gap-2 w-full">
      <LayoutDashboard className="h-4 w-4" />
      My Bids
    </Link>
  </DropdownMenuItem>
  ```
  Note `MessageSquare` (lucide icon) is already imported and used for the existing
  "Support Tickets" item (~line 241-244) — pick a **different** icon for Messages to
  avoid visual duplication (e.g. `Mail` or `Inbox` from `lucide-react`).
- `src/components/header/MobileMenu.tsx` — a sparser mobile menu; it does NOT mirror
  every UserDropdown item (no Watchlist/Settings/Support here), only a 2-column grid
  of tiles (~line 195-254): conditionally Admin, Profile, then "My Bids" and
  "My Listings" as `Button variant="outline" asChild` tiles inside
  `<div className="grid grid-cols-2 gap-3">`. Add a "Messages" tile to this same grid
  (it'll make the grid uneven at 5 items in a 2-col layout when admin is shown, which
  is already how it behaves today with an odd item count — don't restructure the grid,
  just add another tile in the existing style).
- `src/components/header/Header.test.tsx` and any `UserDropdown.test.tsx`/
  `MobileMenu.test.tsx` (check which test files actually exist first) will need
  updates for the new link/tile.
- `convex/notifications.ts`'s `getMyNotificationsHandler` and
  `NotificationDropdown.tsx` are the precedent for an unread-count badge on a header
  nav item — `convex/messages.ts`'s `getConversations` query (from PR #262) returns
  per-conversation `unreadCount`, but there's no single "total unread across all
  conversations" query yet.

## Instructions

1. Add a **`Messages`** entry to `src/components/header/UserDropdown.tsx`: a new
   `DropdownMenuItem asChild` linking to `/messages`, same style/className pattern as
   the other items, using an icon distinct from `MessageSquare` (already used for
   Support Tickets) — `Mail` from `lucide-react` is a sensible choice. Place it
   logically near the other personal-activity items (My Bids/Watchlist/My Listings),
   before the Settings/Support Tickets pair or wherever reads best given the existing
   grouping and `DropdownMenuSeparator`s.
2. Add a matching **"Messages"** tile to `src/components/header/MobileMenu.tsx`'s
   existing 2-column grid, same `Button variant="outline" asChild` tile style as
   "My Bids"/"My Listings", same icon choice as step 1, linking to `/messages`,
   `onClick={onClose}` like the other mobile links.
3. **Unread badge (small, keep it simple)**: add a public query
   `getUnreadConversationCount` to `convex/messages.ts` — counts the caller's
   conversations (buyer + seller side, same merge approach `getConversationsHandler`
   already uses) that have at least one unread message from the other participant
   (reuse the same `by_conversation_read` check pattern already in
   `getConversationsHandler`/`markReadHandler`). Returns `v.number()`. Wire this into
   both the `UserDropdown` "Messages" item and the `MobileMenu` "Messages" tile as a
   small `Badge` showing the count when `> 0`, matching `NotificationDropdown.tsx`'s
   badge styling/pattern for the bell icon. If threading this query through
   `UserDropdown`'s/`MobileMenu`'s existing prop-drilling pattern (they receive data
   via props from a parent `Header` component, not their own `useQuery` calls —
   check `Header.tsx` first) turns out to require non-trivial plumbing changes, it's
   fine to have `UserDropdown`/`MobileMenu` call `useQuery(api.messages.getUnreadConversationCount)`
   directly instead, as a self-contained addition — check what's simpler given how
   `NotificationDropdown` itself fetches its own unread count (does it call
   `useQuery` itself, or receive it via props?) and follow that same approach for
   consistency.
4. Update tests: whichever of `UserDropdown.test.tsx`/`MobileMenu.test.tsx`/
   `Header.test.tsx` exist need a mock for the new query and an assertion that the
   Messages link/tile renders and links to `/messages`, plus a badge-count case.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — argument + return
  validators, no `any` types, prefer indexes over `.filter()`.
- Do not restructure the existing dropdown/menu layout beyond adding the one new
  item/tile — no reordering of unrelated existing items, no visual redesign.
- Do not touch `/messages`/`/messages/:conversationId` page implementation itself
  (already shipped in PR #262) — this task is nav-entry only.
- Follow this repo's existing code style and component patterns.
- Bump `package.json` version per `AGENTS.md`'s semver section (this branch continues
  from `0.14.0` — likely a patch bump, since this is a small addition to an
  already-shipped feature rather than a new feature in itself; use judgment against
  whatever the semver section actually says).

## Verification

Run these yourself and record actual results — do not assume:

1. `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`
   AND `bun run type-check` — both must pass.
2. `npx convex dev --once` — deploys cleanly if `convex/messages.ts` changed.
3. `bun run test --run` (full suite) — all green, including new/updated tests.
4. `bunx eslint` on every touched/created file — zero errors, no new warnings vs the
   current HEAD of this branch (path-scoped `git stash` baseline comparison, not
   `eslint --stdin` — see `codebase_notes.md` for why).
5. Manually confirm (via diff) that no unrelated dropdown/menu items were reordered
   or modified beyond the new Messages entry.

## Results

<!-- opencode: fill this in when done -->

**Status: complete.** All work done as scoped; all verification steps pass.

### Changes

- `convex/messages.ts` — added public query `getUnreadConversationCount` (+ exported `getUnreadConversationCountHandler`, following the file's handler+query pattern). Args `{}`, returns `v.number()`. Counts the caller's **conversations** (not messages) with ≥1 unread message from the other participant: buyer-side + seller-side `by_buyer`/`by_seller` index fetches (same merge/cap approach as `getConversationsHandler`), per-conversation `by_conversation_read` lookup with the same `senderId !== callerId` check as `getConversationsHandler`/`markReadHandler`.
- `src/components/header/UserDropdown.tsx` — new `Messages` `DropdownMenuItem asChild` linking to `/messages`, inserted after My Listings / before Settings (with the personal-activity group). Icon is `Mail` (distinct from `MessageSquare` used by Support Tickets). Component calls `useQuery(api.messages.getUnreadConversationCount)` directly (NotificationDropdown fetches its own count via self-contained `useQuery`, so this follows the same approach; `Header` only renders it inside `<Authenticated>`). JSDoc updated.
- `src/components/header/MobileMenu.tsx` — new `MessagesTile` appended as the last tile in the existing 2-col grid (same `Button variant="outline" asChild` style as My Bids/My Listings, same `Mail` icon, `onClick={onClose}`). The tile is a small internal component whose `useQuery` runs inside `<Authenticated>` — `MobileMenu` itself mounts regardless of auth state, so a top-level `useQuery` there would fire an authenticated query for logged-out users. No existing tiles touched; grid not restructured (5 tiles render unevenly with admin shown, as the task anticipated).
- Badge (both surfaces): small round count badge shown only when count > 0, positioned over the icon, matching `NotificationDropdown.tsx`'s bell badge styling (`rounded-full bg-primary font-black text-primary-foreground border-2 border-background animate-in zoom-in`), `aria-hidden`, with `aria-label="Messages, N unread"` on the link mirroring the bell's accessible-label pattern.
- Tests (written first; confirmed failing before implementation):
  - `convex/messages.test.ts` — new `getUnreadConversationCount query` describe block (3 tests): counts across both sides (multiple unread in one conversation counts it once, index names asserted), ignores caller's own unread messages, returns 0 with no conversations (no message queries fired). Per-conversation mock chains are keyed off the `conversationId` captured from the filter builder, avoiding the `mockResolvedValueOnce` per-call-requeue gotcha documented in `codebase_notes.md`.
  - `UserDropdown.test.tsx` — added `convex/react` + `convex/_generated/api` mocks; 3 new tests (link renders with `href="/messages"`, badge shown with count when > 0 incl. accessible name, badge hidden when 0).
  - `MobileMenu.test.tsx` — extended the `convex/react` mock with `useQuery` + api mock; 4 new tests (tile renders with `href="/messages"`, badge when > 0, badge hidden when 0, `onClose` fired on click).
  - `Header.test.tsx` — no changes needed: it fully mocks `UserDropdown`, so the Messages assertion and query mock live in `UserDropdown.test.tsx`.
- `package.json` — version `0.14.0` → `0.14.1` (patch: small addition to the already-shipped #231 feature, per the task's semver guidance).
- `codebase_notes.md` — documented the MobileMenu auth-boundary `useQuery` gotcha in the Seller Messaging section.

### Verification (all run at final state, actual results)

1. **Type checks** — `bunx tsgo -p tsconfig.json --noEmit && bunx tsgo -p convex/tsconfig.json --noEmit`: PASS (no output, exit 0). `bun run type-check` (tsgo -b tsconfig.build.json): PASS (exit 0).
2. **`npx convex dev --once`** — PASS: "✔ Convex functions ready! (5.82s)", exit 0; `convex/messages.ts` deployed to the dev deployment. (Note: `convex/_generated/api.d.ts` intentionally doesn't change — modern codegen maps the `messages` module to the source file, so the new function reference type-checks directly against `convex/messages.ts`.)
3. **`bun run test --run` (full suite)** — PASS: 171 test files / **2120 tests, all green** (incl. the 10 new tests).
4. **`bunx eslint` on all 6 touched files** — 0 errors; 5 warnings, **all pre-existing at HEAD**: the working tree was clean before editing, so the baseline was captured directly pre-edit on the same paths (equivalent to the path-scoped stash comparison, without the stash — `codebase_notes.md` documents that `git stash push -u` is unsafe here and that the Convex watcher can corrupt stash/pop via `api.d.ts` rewrites). Same 5 warnings at HEAD and after (rules identical, line numbers shifted by the inserted tests: MobileMenu.test.tsx 45→56 ×2 no-unsafe-\*, 149→210 + 271→332 require-await; UserDropdown.test.tsx 112→148 require-await). Two issues found and fixed during verification before reaching this state: 2 `import-x/order` errors from my initial convex import placement in `MobileMenu.test.tsx`, and 1 new `security/detect-object-injection` warning from a `Record` lookup in `convex/messages.test.ts` (switched to a `Map`).
5. **Diff review** — `git diff` on all touched files inspected: every diff is purely additive (imports, new component/item/tile, new tests, version bump). One regression caught and reverted during review: the edit tool had fuzzy-matched and de-indented 6 unrelated lines of the existing My Listings tile in `MobileMenu.tsx` — restored to original indentation, confirmed via diff that no existing dropdown/menu items were reordered or modified.

### Notes / deviations

- None material. The badge uses a positioned `span` (matching NotificationDropdown's actual pattern) rather than the shadcn `Badge` component — the task said "small Badge … matching NotificationDropdown's badge styling/pattern for the bell icon", and the bell uses a styled span, so that pattern was followed. Grid placement of the Messages tile (appended last, plain style) was chosen because any other position in the 2-col grid creates an empty-cell hole for non-admins once `My Listings`' conditional `col-span-2` is factored in; appending last matches the task's "add another tile in the existing style / don't restructure the grid".
