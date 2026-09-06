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
