# Task: Add repo governance files and CI workflow (redo of closed PR #284)

## Context

A previous attempt at this (PR #284, branch `chore/repo-governance`) went stale and was closed/deleted because it drifted too far from `main` and had real merge conflicts. This is a clean redo from current `main`. Keep it minimal and config-only — do not touch application code.

`.github/dependabot.yml` already exists on `main` with a `bun` ecosystem entry (weekly). Read it first — do not remove or restructure the existing `bun` entry, only add to it.

`package.json` scripts (confirmed working): `bun run lint`, `bun run type-check`, `bun run test` (runs `vitest run`), `bun run build`. Bun version pinned in `.husky/pre-commit`/CI convention elsewhere in similar repos is not fixed here — check `package.json`'s `packageManager` field or `.bun-version` file if one exists; otherwise use `"1.3.9"` (matches other recent tooling in this repo, e.g. any existing bun-version references — grep for `bun-version` or `packageManager` first to confirm).

## Instructions

1. **`.github/workflows/ci.yml`** — new file:

   ```yaml
   name: CI

   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]

   concurrency:
     group: ci-${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     lint:
       name: Lint
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: "<version from step above>"
         - run: bun install --frozen-lockfile
         - run: bun run lint

     type-check:
       name: Type check
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: "<version from step above>"
         - run: bun install --frozen-lockfile
         - run: bun run type-check

     test:
       name: Test
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: "<version from step above>"
         - run: bun install --frozen-lockfile
         - run: bun run test

     build:
       name: Build
       runs-on: ubuntu-latest
       needs: [lint, type-check, test]
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v2
           with:
             bun-version: "<version from step above>"
         - run: bun install --frozen-lockfile
         - run: bun run build
   ```

   Job names (`Lint`, `Type check`, `Test`, `Build`) must be exact — they'll be referenced later by branch-protection required-status-check names, so don't rename them.

2. **`.github/CODEOWNERS`** — new file, single line making the repo owner the default reviewer for everything:

   ```
   * @marcojsmith
   ```

3. **`.github/pull_request_template.md`** — new file, short and generic:

   ```markdown
   ## Summary

   <!-- What does this PR do and why? -->

   ## Test plan

   <!-- How was this verified? -->
   ```

4. **`.github/ISSUE_TEMPLATE/bug_report.yml`** and **`.github/ISSUE_TEMPLATE/feature_request.yml`** — new files, using GitHub's issue-forms YAML syntax (not the old markdown template format). Keep each short: a title, a couple of required fields (e.g. bug report: "What happened", "Expected behavior", "Steps to reproduce"; feature request: "Problem", "Proposed solution"). Also add **`.github/ISSUE_TEMPLATE/config.yml`** with `blank_issues_enabled: true` and no contact links (keep it minimal, don't invent external URLs).

5. **`.github/dependabot.yml`** — add a `github-actions` ecosystem entry alongside the existing `bun` one (don't remove or edit the `bun` entry):

   ```yaml
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
       interval: "weekly"
   ```

6. Validate all new/changed YAML files parse correctly (e.g. `bunx js-yaml .github/workflows/ci.yml` or equivalent — check what YAML validation tooling, if any, is already used in this repo; if none, at minimum eyeball indentation carefully since GitHub Actions YAML is indentation-sensitive).

## Constraints

- Config/docs only. Do not touch anything under `src/` or `convex/`.
- Do not modify `.github/workflows/claude.yml` — it was already fixed separately (restricted to repo owner) and is out of scope here.
- Do not create a `dependabot.yml` groups feature or anything beyond what's specified — keep this minimal, matching what's described above exactly.
- This branch should be based on current `main` (not any stale branch) — confirm `git log -1 --oneline` shows a recent commit before starting, and if it doesn't, stop and report rather than guessing.

## Results

**Status:** Complete — all files created on branch `chore/repo-governance-v2` (uncommitted, ready for review/commit).

**Pre-flight checks:**

- Branch confirmed based on current `main` (`git log -1` → `442a40c security: sanitize error reports before persisting/posting to GitHub (#288)`); working tree clean apart from this task file.
- Bun version resolved from `package.json` → `"packageManager": "bun@1.3.9"` (no `.bun-version` file exists), so `bun-version: "1.3.9"` is used in all CI jobs.

**Files created:**

- `.github/workflows/ci.yml` — 4 jobs: `Lint`, `Type check`, `Test` (parallel), `Build` (needs all three). Exact job names preserved for future branch-protection required checks. Triggers on PR + push to `main`, with `cancel-in-progress` concurrency group.
- `.github/CODEOWNERS` — `* @marcojsmith` (default reviewer for everything).
- `.github/pull_request_template.md` — Summary + Test plan template as specified.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — issue-forms YAML: required textareas "What happened", "Expected behavior", "Steps to reproduce".
- `.github/ISSUE_TEMPLATE/feature_request.yml` — issue-forms YAML: required textareas "Problem", "Proposed solution".
- `.github/ISSUE_TEMPLATE/config.yml` — `blank_issues_enabled: true`, no contact links.

**Files modified:**

- `.github/dependabot.yml` — appended `github-actions` ecosystem entry (weekly, `/`); existing `bun` entry and its comments untouched.

**Validation:**

- All 5 YAML files parse cleanly via `bunx js-yaml <file>` (js-yaml 4.1.1 already present via bun.lock — this is the repo's existing YAML tooling; no dedicated YAML linter was configured).
- `git status --porcelain` confirms only the files above changed: `.github/dependabot.yml` modified, 5 new paths added. `src/` and `convex/` untouched; `.github/workflows/claude.yml` unmodified (out of scope per constraints).
- No `dependabot.yml` groups feature or extras beyond spec.

**Not done (by design):** nothing committed or pushed, and no PR opened — committing wasn't part of the instructions and requires explicit request. Run `bunx coderabbit --prompt-only --type uncommitted` before committing per AGENTS.md pre-commit review step.
