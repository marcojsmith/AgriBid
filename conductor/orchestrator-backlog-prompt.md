# Orchestrator prompt — work the full AgriBid issue backlog, PR per issue

Copy-paste this into a new Claude Code chat to run the whole backlog end to end,
producing one reviewable PR per issue.

---

You are orchestrating work through AgriBid's GitHub issue backlog. Read
`conductor/issue-backlog-plan.md` first — it's the prioritized, annotated list with
current status and a documented workflow. Your job is to work through every
not-yet-done row in priority order, **one at a time**, each ending in an open PR for
human review. Do not merge anything yourself.

**This is a stacked-PR chain, not independent branches off `main`.** The plan file's
"How this plan is used" section names the **current tip branch** — each new issue
branches from _that_ branch, not from `main`, and its PR's `--base` is that same tip
branch, not `main`. This is deliberate: several of these issues touch the same file
(`src/pages/Profile.tsx`), and branching everything off `main` independently would
produce a pile of PRs that conflict with each other at merge time instead of one clean
sequence. After each issue, update the plan file's "current tip" to the new branch
before starting the next one — get this wrong and you silently break the chain (the
next issue would branch off a stale base and reintroduce exactly the conflict problem
this structure avoids).

## Ground rules

- **Quality bar**: only implement genuine features, fixes, and best-practice work with
  real product or code-quality value. If an issue is marked "Skip" in the plan (e.g.
  #236 — dev/troubleshooting tooling with no lasting value), skip it — do not implement
  it anyway. If you judge an unmarked issue to be similarly low-value, speculative, or
  not worth building as written, stop and flag it in your report instead of building it
  just to check a box.
- **One issue fully resolved before starting the next** — don't parallelize issues
  against the same working tree; opencode runs and git branch switches will conflict
  with each other if run concurrently in one repo checkout.
- **Never merge a PR, never force-push, never touch production config/secrets**
  without explicit sign-off in this conversation. Your output per issue is an open PR,
  nothing more.
- **Independently verify everything** before opening a PR — don't relay a subagent's or
  opencode's self-reported success at face value. Read the actual diff.

## Per-issue loop

For each not-yet-done issue in `conductor/issue-backlog-plan.md`'s priority table (skip
anything marked "Skip" or already done/merged — check `gh pr list --state all` and
`gh issue list --state all` for real current state, the plan file may be stale):

1. Spawn a subagent (Agent tool, `subagent_type: general-purpose`, run in the
   foreground — the next issue depends on this one finishing cleanly first, and its
   git branch/working-tree state) with a self-contained prompt that instructs it to:
   a. Read the plan file's "current tip" branch name. `git checkout <tip-branch> &&
git pull origin <tip-branch>` — **do not** check out or pull `main` here; that
   would break the stack (see the plan file's "How this plan is used" section for
   why). Then branch as `feat/issue-<N>-<slug>` off that tip.
   b. Read the GitHub issue (`gh issue view <N>`) and re-verify its claims against the
   _current_ codebase (the tip branch's state) before writing anything — issues go
   stale (e.g. #218 in this backlog turned out to already be fully implemented; it
   was closed instead of redone).
   c. Write a task file at `conductor/opencode_tasks/issue-<N>-<slug>.md`, modeled
   structurally on `conductor/opencode_tasks/issue-219-verification-fields.md` and
   `issue-233-seller-listings-page.md` in the same directory (Context / numbered
   Instructions with real current file+line references / Constraints / a
   Verification checklist / an empty Results section).
   d. Delegate implementation to opencode:
   `opencode run --model openrouter/z-ai/glm-5.3-flash "Read conductor/opencode_tasks/issue-<N>-<slug>.md and implement it exactly as scoped (GitHub issue #<N>). Run the full Verification section at the end and fill in the Results section."`
   — always this exact model id (`openrouter/z-ai/...`); bare `opencode/...` ids
   fail billing on this account.
   e. Independently re-verify: `bun run type-check`, `bunx eslint` on every touched
   file, `bun run test --run` (full suite, not just touched files), and
   `npx convex dev --once` if schema/queries changed. Read the full diff. Treat any
   of the following as a stop-and-report condition rather than something to push
   through: a deleted file, a change to production/deployment config or secrets, or
   an action that contradicts an explicit constraint documented elsewhere in the
   repo (see the "Known gotchas" section of the plan file for a real precedent).
   f. Commit (conventional message referencing the issue number,
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`), push, and open a PR
   **based on the tip branch, not `main`**:
   `gh pr create --base <tip-branch> --head feat/issue-<N>-<slug> --title "..." --body "..."`
   — body should summarize the change and list the verification steps that passed,
   same style as PRs #255/#257/#258 in this repo's history.
   g. **Comment on the newly created PR to trigger CodeRabbit review:**
   `gh pr comment <PR-number> --body "@coderabbitai full review"`
   h. Update `conductor/issue-backlog-plan.md`: set this issue's Status to "Done — PR #<N>", and **update the "current tip" branch name to `feat/issue-<N>-<slug>`**
   (the branch just created is now the tip the next issue builds on) — this second
   part is easy to forget and breaks the chain if skipped.
   i. Report back to you (the orchestrator) with: the PR link, a one-paragraph summary,
   and any deviations/judgment calls made (same bar as this session's prior PRs
   #255/#257/#258 — deviations get documented, not silently made).
2. Read the subagent's report and the actual PR diff yourself before moving on. If
   something looks wrong (scope creep, a skipped verification step, a risky judgment
   call), fix it or flag it in your final summary rather than proceeding to the next
   issue with an unresolved problem sitting in an open PR.
3. Move to the next not-yet-done issue and repeat.

## A note on merging

Because this is a stacked chain, PRs must be merged **bottom-up** (earliest issue
first) once the user reviews and approves them — merging out of order will produce
confusing diffs. You don't merge anything yourself either way, but mention this order
requirement in your final report so the user doesn't merge them in the wrong sequence.

## When to stop early

Stop the whole run and report back to the user (don't keep going) if you hit any of:

- An issue with no clear implementation plan and no obvious best-practice
  implementation (per the plan file, this currently applies to #251 and #129 — they
  need a human scoping/planning pass before a subagent can implement them well).
- A merge conflict you can't resolve confidently.
- Anything touching production credentials, deployment config, or billing.
- Two issues in a row where the subagent's output needed significant correction —
  pause and let the user know rather than continuing to spend effort on a pattern
  that isn't working.

## Final report

When you've worked through everything actionable (or hit a stop condition), give the
user a summary: which issues got a PR (with links), which were skipped and why, which
were left for a future planning pass, and the final state of
`conductor/issue-backlog-plan.md`.
