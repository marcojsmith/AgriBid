# Issue Backlog Plan — Profile Page & Beyond

Working plan for tackling AgriBid's open GitHub issues in priority order. Update the
**Status** column as work lands — this file is the source of truth for "what's next,"
so whoever (or whatever agent) picks this up next should read it first, not just the
raw GitHub issue list.

## How this plan is used

Each issue below gets the same treatment as #219 and #233 (already done/in-progress as
of 2026-09-06):

1. Sync `main` (`git checkout main && git pull origin main`).
2. Create a branch: `feat/issue-<N>-<short-slug>`.
3. Read the issue fully (`gh issue view <N>`) plus whatever source files it names, and
   write a task file at `conductor/opencode_tasks/issue-<N>-<short-slug>.md` — mirror
   the structure of `conductor/opencode_tasks/issue-219-verification-fields.md` or
   `issue-233-seller-listings-page.md` (Context / Instructions / Constraints /
   Verification / Results). Verify the issue's claims against the _current_ code before
   writing the task — issues can go stale (see #218, which turned out to already be
   done).
4. Run it: `opencode run --model openrouter/z-ai/glm-5.3-flash "Read conductor/opencode_tasks/issue-<N>-<slug>.md and implement it exactly as scoped (GitHub issue #<N>). Run the full Verification section at the end and fill in the Results section."`
5. **Independently re-verify** — don't just trust the agent's self-report:
   `bun run type-check`, `bunx eslint <touched files>`, `bun run test --run
<touched files>` (then full suite), `npx convex dev --once` if schema/queries
   changed. Read the actual diff for anything that smells like scope creep or a
   dangerous judgment call (see the CORS-helpers incident in
   `conductor/opencode_tasks/fix-auth-migration-tests.md` for what that looks like and
   why it needs catching).
6. Commit, push, `gh pr create --base main --head <branch> ...`.
7. Update this file's **Status** column and move to the next issue.

Handle version bumps (`package.json`) per `AGENTS.md`'s semver section if it has one;
otherwise a small patch bump per PR is the pattern established in PRs #255/#257.

## Priority order

All of #221/#232/#231/#220 stem from the same parent (#131 — profile page rework) and
each has a written implementation plan already in its issue body, same as #219/#233
did — that's why they're front-loaded before the less-scoped issues.

| #   | Issue                                                                                            | Status                                                                                                                                                   | Why this order                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [#233](https://github.com/marcojsmith/AgriBid/issues/233) — seller-filtered auction listing page | **In progress** (branch `feat/issue-233-seller-listings-page`, task file written, opencode run kicked off 2026-09-06 — check for a PR before restarting) | Dead "View all" links on a page already in active use                                                                                                                                                                                                                                                |
| 2   | [#221](https://github.com/marcojsmith/AgriBid/issues/221) — seller review/rating system          | Not started                                                                                                                                              | Completes the "Seller Rating" trust item (currently hardcoded "No reviews"); other issues' TODO comments already (mistakenly) reference this number, so clearing it first avoids confusion                                                                                                           |
| 3   | [#232](https://github.com/marcojsmith/AgriBid/issues/232) — report profile functionality         | Not started                                                                                                                                              | Trust & safety; the issue explicitly proposes a `profileFlags` table parallel to the existing `auctionFlags` table — small, self-contained                                                                                                                                                           |
| 4   | [#231](https://github.com/marcojsmith/AgriBid/issues/231) — seller messaging/contact system      | Not started                                                                                                                                              | Larger (new `conversations`/`messages` tables + real-time UI) — do after the two smaller trust-focused issues                                                                                                                                                                                        |
| 5   | [#220](https://github.com/marcojsmith/AgriBid/issues/220) — user activity feed system            | Not started                                                                                                                                              | Replaces the hardcoded `getActivityItems()`; lowest urgency of the #131 sub-issues since the current hardcoded feed doesn't actively mislead users the way "Not linked"/disabled buttons do                                                                                                          |
| 6   | [#217](https://github.com/marcojsmith/AgriBid/issues/217) — add `og-image.png`                   | Not started                                                                                                                                              | Quick, but needs a **designed image asset**, not just code — an agent can generate a technically-compliant placeholder (1200×630, on-brand colors) programmatically (e.g. an SVG template rendered to PNG), but flag it for human design review rather than treating it as done                      |
| 7   | [#171](https://github.com/marcojsmith/AgriBid/issues/171) — stricter ESLint rules                | Not started                                                                                                                                              | Explicitly incremental per the issue itself — only take **Phase 1** (`no-console`, banning `eslint-disable` in `src/`/`convex/`, flagging `as unknown as` double-casts) in one task; do not attempt Phases 2-3 (full `strictTypeChecked` migration) in a single pass, that's its own multi-PR effort |
| 8   | [#253](https://github.com/marcojsmith/AgriBid/issues/253) — image upload for icons               | Not started                                                                                                                                              | Larger, more speculative UI feature (crop/preview flow); no existing hardcoded stub blocking it                                                                                                                                                                                                      |
| 9   | [#251](https://github.com/marcojsmith/AgriBid/issues/251) — push/email notifications service     | Not started                                                                                                                                              | Infrastructure-heavy (VAPID keys already exist in env — check `.env.local`/`convex env list` for what's already wired before scoping); large, no written implementation plan in the issue yet — needs a planning pass first, not a direct opencode task                                              |
| 10  | [#236](https://github.com/marcojsmith/AgriBid/issues/236) — automated screenshot capture         | **Skip** (explicit instruction, 2026-09-06)                                                                                                              | Dev/troubleshooting tooling scaffolding, no user-facing or code-quality value — do not implement                                                                                                                                                                                                     |
| 11  | [#129](https://github.com/marcojsmith/AgriBid/issues/129) — AI chatbot support                   | Not started                                                                                                                                              | Large, speculative, no implementation plan — needs product scoping before any code task, not a good opencode candidate as-is                                                                                                                                                                         |

### Already resolved this session (context, not action items)

- **#218** (location field) — closed 2026-09-06, was already fully implemented.
- **#219** (granular verification fields) — PR [#257](https://github.com/marcojsmith/AgriBid/pull/257), open, needs review/merge.
- Two unrelated production fixes also shipped: PR [#255](https://github.com/marcojsmith/AgriBid/pull/255) (Clerk env-driven auth config + doc corrections — merged) and a live prod incident (Clerk publishable key pointed at the wrong instance) fixed directly in Vercel/Convex dashboards, not via PR.

## Quality bar

Per explicit instruction (2026-09-06): only implement genuine features, fixes, and
best-practice work with lasting product/code value. Skip issues that are pure
dev/troubleshooting scaffolding with no user-facing or code-quality payoff (see #236,
above). If an issue turns out to be speculative, under-specified, or not worth building
as written, say so and skip it with a reason rather than implementing it anyway to
"complete the list."

## Known gotchas for whoever continues this

- **This repo's opencode model calls must use the `openrouter/z-ai/...` prefix**, never
  bare `opencode/...` — the latter fails with a billing error on this account.
- **Don't trust an opencode agent's Results section at face value** on anything that
  touches a hard constraint, production config, or deletes a file — independently
  re-verify. One run in this session unilaterally deleted CORS helpers against an
  explicit "Do NOT remove" constraint in another task doc; it was caught on review and
  reverted. Always diff before committing.
- **`convex/auth.config.ts` must stay free of imports from other `convex/` modules** —
  Convex's bundler treats every env var read in its transitive import graph as required
  to deploy auth, so importing shared helpers (e.g. `convex/config.ts`) breaks deploys
  for unrelated env vars.
- **Convex `returns` validators throw on undeclared properties** — if a task adds a
  field to a table that flows through a hand-written validator (e.g. `ProfileValidator`
  in `convex/users.ts`), that validator must be updated too, even if the issue didn't
  mention it.
- Production and development currently **share one Clerk instance** (no registered
  custom domain yet) — this is a deliberate, temporary decision (see PR #255's
  description), not a bug to "fix" independently.
