# Continuation prompt — AgriBid issue backlog

Copy-paste this into a new Claude Code chat (or use it as the prompt for a scheduled
agent) to pick up where the AgriBid GitHub issue backlog work last left off.

---

Read `conductor/issue-backlog-plan.md` in this repo — it's the prioritized backlog and
status tracker for GitHub issues we're working through. Do the following:

1. **Check real state before trusting the plan file.** Run `gh pr list --state open`
   and `gh issue list --state open` to see what's actually true right now — the plan
   file's Status column may be stale if a PR merged, got closed, or review feedback
   came in since it was last updated.
2. **Find the next actionable item**: the first row in the priority table that is not
   yet done. "Done" means either merged, or has an open PR just waiting on review (in
   which case skip it and move to the next "Not started" row — don't duplicate work).
   If the in-progress row (#233 as of this writing) has no PR yet, check
   `git branch -a` and the task file under `conductor/opencode_tasks/` for its state —
   the opencode run may have completed but not been reviewed/committed yet, in which
   case finish that (review the diff, verify, commit, push, open PR) before starting
   anything new.
3. **For the next unstarted issue**, follow the exact workflow documented in
   `conductor/issue-backlog-plan.md`'s "How this plan is used" section:
   - Sync `main`, branch as `feat/issue-<N>-<slug>`.
   - Read the issue with `gh issue view <N>` **and re-verify its claims against the
     current codebase** — issues go stale (e.g. #218 turned out to already be done).
   - Write a task file at `conductor/opencode_tasks/issue-<N>-<slug>.md` modeled on
     `issue-219-verification-fields.md` / `issue-233-seller-listings-page.md` in the
     same directory — Context, numbered Instructions with real current file/line
     references (re-check them, don't trust old line numbers), Constraints, a
     Verification checklist, and a Results section for the agent to fill in.
   - Delegate to opencode:
     `opencode run --model openrouter/z-ai/glm-5.3-flash "Read conductor/opencode_tasks/issue-<N>-<slug>.md and implement it exactly as scoped (GitHub issue #<N>). Run the full Verification section at the end and fill in the Results section."`
     (always the `openrouter/z-ai/...` model id — bare `opencode/...` ids fail billing
     on this account).
   - **Independently re-verify everything** before committing — don't just relay the
     agent's self-reported Results. Run `bun run type-check`, `bunx eslint` on touched
     files, `bun run test --run` (full suite), and `npx convex dev --once` if
     schema/queries changed. Read the actual diff. Pay special attention to anything
     that deletes a file, touches a hard constraint documented elsewhere, or changes
     production/deployment config — those need a human decision, not an agent's
     unilateral judgment call (see the "Known gotchas" section of the plan file for a
     real incident of this in this repo).
   - Commit (conventional message, note the issue number, `Co-Authored-By: Claude
Sonnet 5 <noreply@anthropic.com>`), push, and `gh pr create --base main --head
<branch>` with a summary of what changed and the verification checklist.
4. **Update `conductor/issue-backlog-plan.md`**: mark the issue's Status as done (with
   the PR link) or in-progress (with the branch name), so the next run of this prompt
   picks up correctly.
5. **Stop after one issue** unless explicitly told to keep going — report what you did,
   the PR link, and what's next per the plan, then end the turn. This keeps each run
   reviewable and bounded rather than silently chaining through the whole backlog
   unattended.

If you hit something the plan doesn't cover (an issue with no clear implementation
plan, a merge conflict, a production incident, ambiguous scope), stop and ask rather
than guessing — the same way prior work in this backlog surfaced things like a
mis-set Clerk instance in production that needed a human decision, not code.
