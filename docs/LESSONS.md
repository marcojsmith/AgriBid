# Lessons

Durable gotchas and non-obvious findings. Newest first within each topic.

Format: `YYYY-MM-DD - what happened/surprised us → what to do instead (PR/issue link if known)`

Dates are the notes' section dates (month-only where the source gave only a month).

## Convex

- 2026-09 - Convex `returns` validators reject extra fields, not just `args`. Spreading a whole doc (`{...profile}`) through a hand-rolled validator broke once `profiles` gained `emailVerified` etc. → extend the validator whenever the table schema gains fields (issue #219).
- 2026-09 - `paginationOpts` must be a required validator field for `usePaginatedQuery` type inference; paginated queries cannot return `null` for authz denial (the hook throws) → throw `ConvexError` and catch it with a local error boundary (issue #231).
- 2026-09 - Convex array-field indexes are not "contains" lookups → for two-party data use two scalar indexed fields and union the queries, not a `participantIds` array (issue #231).
- 2026-09 - Rate limits and duplicate checks done as collect-all + JS filter violate the "prefer indexes" rule and are easy to get off by one (`>` vs `>=`) → use an index range and `>=` on the pre-send count (issue #231).
- 2026-09 - Mutation whose handler args are a named interface makes the generated `FunctionReference` infer `never` args → declare the validator once as a `v.object` const, type the handler with `Infer<typeof validator>`, pass the same const to `mutation({ args })` (multi-lot rework, 2026-09-16).
- 2026-09 - Convex `useQuery` returns `T | undefined | null`; `=== undefined` alone does not prove non-null → check both when removing `!` (issue #171).
- 2026-09 - `interface` handler-arg types degrade Convex references to `never`, failing at distant call sites → keep `type` aliases for Convex args types (issue #171 Phase 3). See Build/CI for the lint side.
- 2026-09 - Bulk N+1 in admin views (announcement read counts) → use one indexed batch helper (`batchFetchReadCounts`) plus a single `.collect()` + Set filter, not N x `.unique()`.
- 2026-09 - Storage id string-arg overloads (`storage.delete`/`getUrl`) are deprecated → cast with `as Id<"_storage">`.
- 2026-09 - Internal mutations (e.g. the weekly reset cron) have no caller identity, so admin/env guards like `checkDestructiveAccess` wrongly reject them → don't call identity guards from cron-only internals.
- 2026-09 - Seeds must be idempotent: insert-if-absent by natural unique key, seed keyless tables only while empty → plain re-runs never duplicate.
- Undated - `getMyBids` paginates via `indexOf(cursor) + 1` over an in-memory array → refactor to a real cursor query if per-user bid-on auctions exceed ~1,000.

## Testing

- 2026-09 - Vitest 4 asymmetric matchers (`expect.any`, `stringContaining`, `arrayContaining`, `objectContaining`) return `any`; as object-literal properties they trip `no-unsafe-assignment` → cast the property value (`as unknown` / `as Record<string, unknown>`).
- 2026-09 - `vi.fn()` implementation params are contextually `any` for the linter → annotate them explicitly; mock `useQuery` with `(...args: unknown[])`, never `any[]`.
- 2026-09 - `@ts-expect-error` covers only the next line; Prettier-wrapped dynamic imports orphan it (TS2578) → wrap in one typed loader helper.
- 2026-09 - `vi.fn(idx => ({ collect: vi.fn().mockResolvedValueOnce(x) }))` rebuilds the chain per call and resets `Once` queues → build persistent chain objects outside the `withIndex` mock.
- 2026-09 - `vi.mock("./_generated/server")` must expose identity `mutation`/`internalMutation` wrappers or `.handler` is unreachable at runtime (pattern from `presence.test.ts`).
- 2026-09 - Pre-migration Clerk tests: mock `@clerk/clerk-react` `useAuth`/`useUser`/`useClerk` rather than the old auth client (`fix-auth-migration-tests`).
- 2026-09 - Removing an "unnecessary" `?.` in `a?.b?.c` changes short-circuit behaviour → make nullishness visible in the type instead.
- 2026-09 - Changing display copy (`PASS` to `Pass`, dropping `.toUpperCase()`) cascades into page-level tests asserting through child components → grep tests for the old strings.
- 2026-09 - Settings page treats `null` preferences as "render with defaults", not loading; adding `=== null` to the guard broke 14 tests → preserve that semantic.
- 2026-09 - Component tests must click `data-testid="auto-bid-toggle"` before touching the proxy checkbox (collapsed by default).

## UI

- 2026-09 - `react-hooks/purity` errors on `Date.now()` in render; `react-hooks/set-state-in-effect` errors on prop-reset effects → lazy `useState(() => Date.now())`, and track failed image URLs (content-addressed) instead of a boolean reset.
- 2026-09 - `MobileMenu` mounts regardless of auth state, so an authenticated `useQuery` at top level throws for logged-out users → put it in a child rendered inside `<Authenticated>`.
- 2026-09 - `#bidding-panel` id in `AuctionDetail.tsx` is the scroll target for `MobileBidBar` → keep it when restructuring.
- 2026-09 - Status chips derived from a preference fallback cannot be removed (deleting an absent URL param is a no-op) → only render chips for explicit URL params.
- 2026-09 - Use semantic tokens (`--success`/`--warning`, `bg-success/10`) not hardcoded `green-*`/`amber-*`; no info/blue token exists (Sold badge uses `bg-primary/10`). Overlays on imagery: `bg-foreground/70 text-background`. Containers use `rounded-md`, `rounded-lg` only for images/avatars (AGENTS rule 10). CodeRabbit flags touched lines that violate these.
- 2026-09 - Verification checks are duplicated in `BiddingPanel`, `BidForm`, `MobileBidBar` → keep in sync if the profile shape changes.
- 2026-09 - A phase's grep gate (`uppercase|font-black|border-2|rounded-(xl|2xl|3xl)`) is the contract for the visual sweep; hardcoded colours on untouched lines were left deliberately.

## Auth

- 2026-09 - Clerk dev and prod instances must not be mixed: `CLERK_JWT_ISSUER_DOMAIN` (Convex env) and `VITE_CLERK_PUBLISHABLE_KEY` (Vite build) must point at the same instance. Keep `convex/auth.config.ts` free of imports from other `convex/` modules, since Convex requires every env var read in its import graph to deploy auth (PR #255).
- 2026-09 - Sync only writes `name`/`email` to `profiles` when the claim is present, so a transient missing claim never overwrites stored values with `undefined`.
- 2026-09 - Deleting code that contradicts an explicit task constraint (CORS helpers) had to be reverted → re-read constraints in the originating task file before "dead code" removals.

## Build/CI

- 2026-09 - `strictTypeChecked` is permanently on. Deliberate exceptions, do not "fix": ~16 `prefer-nullish-coalescing` (empty string means missing), 2 `consistent-type-definitions` (Convex args), 3 `no-deprecated` (`COMMISSION_RATE` fallback tests). `--fix` re-converts Convex args types to interfaces every run and breaks distant call sites → add an override for `convex/**` (issue #171).
- 2026-09 - Strict preset sets `restrict-template-expressions` with no number/boolean allowance → wrap in `String(...)`; use `getErrorMessage(err)` not `String(unknown)` (`no-base-to-string`); use `arr.at(i) ?? "x"` not `arr[i]` (`detect-object-injection`).
- 2026-09 - `security/detect-object-injection` is purely syntactic (`obj[identifier]`); `hasOwnProperty` does not silence it → use `Map`, computed destructuring, or zipped pairs.
- 2026-09 - `Array.isArray` false-branch drops `null`, `const x: T | null = nonNull` narrows null away, `Object.entries` strips `undefined` → do null checks first, use widening casts (`init as T | null | undefined`).
- 2026-09 - Full-repo type-aware eslint intermittently reports extra `no-unsafe-*` warnings (5-12 variance) → verify against a per-file run before fixing.
- 2026-09 - Lint baseline is ~524 warnings, 0 errors; new code must not add to it. `.husky/pre-commit` rejects new undocumented `eslint-disable` (needs `-- reason`). `no-console` allows only `warn`/`error`.
- 2026-09 - CodeRabbit CLI: installed 0.7.6 supports `bunx coderabbit review --uncommitted` (AGENTS.md's `--prompt-only --type uncommitted` errors); add `--include-untracked` for new files; `review findings` reprints the last review.
- 2026-09 - With `core.autocrlf=true` on Windows, `prettier --check` fails on every file (no `endOfLine` set) → never run repo-wide `prettier --write`.
- 2026-09 - `git stash push -u` fails on this repo (Windows) and leaves a dirty tree; the running `convex dev` watcher rewrites `convex/_generated/api.d.ts` mid-operation and blocks pop → treat `api.d.ts` as perpetually modified (`git checkout -- convex/_generated/api.d.ts && git stash pop`), and diff instead of stashing.
- 2026-09 - `eslint --stdin --stdin-filename` lints the on-disk file with the type-aware config → use a path-scoped stash baseline.
- 2026-09 - `git diff -- 'convex/'` is an invalid pathspec → use `git diff -- convex/`.

## Process

- 2026-09 - Removing legacy tables/fields from the schema after a migration: leftover rows are inert; drop the indexes and migration module in the same cleanup (multi-lot rollout, 2026-09-17).
- 2026-09 - Audit for stubbed "Not implemented"/"Coming soon"/`TODO(#n)` affordances with a repo-wide grep before declaring a feature done (issue #231 follow-up).
- 2026-09 - Pre-existing warnings encountered in unrelated files are left for a separate cleanup commit, not folded into feature work.
