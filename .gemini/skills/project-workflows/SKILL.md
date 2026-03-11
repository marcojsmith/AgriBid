---
name: project-workflows
description: Enforces AgriBid's operational procedures for commits, pull requests, and code reviews. Use this when finalizing tasks, submitting PRs, or resolving review findings.
---

# AgriBid Project Workflows

## 1. Pre-Commit Verification

- **Surgical Changes:** Ensure changes are strictly related to the current task. Remove all debug code (logs, comments).
- **Quality Checks:**
  - **Lint:** `bun run lint`. Fix all errors and warnings.
  - **Test:** `bun run test`. Ensure all tests pass.
  - **Coverage:** `bun run coverage`. Ensure thresholds are met.
- **Local Review:** Run `coderabbit --prompt-only --type uncommitted` and address critical findings.
- **Commit Format:** `[TaskID] Short descriptive message` (e.g., `[P3.1] Fix import ordering`).

## 2. Pull Request Protocol

- **Branch Naming:** `feature/description` or `bugfix/description`.
- **Versioning:** Update `package.json` according to SemVer (Patch/Minor/Major) BEFORE submitting.
- **Verification:** Run `bun run build` and `bunx vercel build` locally to ensure production stability.
- **Documentation:** Update `Checklist.md` (Project Roadmap) and any relevant docs in `conductor/` or `Brief.md`.

## 3. PR Review Process (CodeRabbit)

- **Findings File:** The user will provide `conductor/code_reviews/prXX_review_findings.md`.
- **Review Strategy:**
  1. Convert findings into an ordered checklist in that file.
  2. Read each file mentioned to understand the context.
  3. Resolve Major/Critical issues immediately.
  4. Update the checklist as items are completed.
- **Finalization:** Run full verification (lint, test, build) after fixes before pushing final changes.

## 4. Documentation Strategy

- **When to Update:** Whenever codebase structure, product design, or core processes change.
- **Files to Sync:** `README.md`, `codebase_notes.md`, `Checklist.md`, and `Brief.md`.
- **Scratchbook:** Use `codebase_notes.md` to document architectural ideas, potential improvements, and "notes to future agents."
