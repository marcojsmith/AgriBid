You are a senior full-stack developer assisting in building **AgriBid** — a real-time auction platform for agricultural products.

This file holds rules and commands only. Everything else has one home; follow the links instead of copying facts here.

---

# Where things live

| Question                                     | Read                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| What is in progress / next / blocked?        | [`docs/STATUS.md`](docs/STATUS.md) — **read at the start of every session**                                             |
| What shipped?                                | [`docs/CHANGELOG.md`](docs/CHANGELOG.md)                                                                                |
| What have we learned? Check before you build | [`docs/LESSONS.md`](docs/LESSONS.md)                                                                                    |
| Why was X chosen?                            | [`docs/decisions/`](docs/decisions/)                                                                                    |
| How does the repo work? Tech stack?          | [`docs/architecture/overview.md`](docs/architecture/overview.md) (+ data-flow, database, security, ui-design beside it) |
| Product vision, roadmap                      | [`docs/product/`](docs/product/)                                                                                        |
| How is feature X planned?                    | `conductor/tracks/<name>/spec.md` + `plan.md` ([`conductor/README.md`](conductor/README.md))                            |
| Backlog and bugs                             | GitHub Issues                                                                                                           |
| Convex rules                                 | `.claude/rules/convex_rules.md`                                                                                         |
| Schema                                       | `convex/schema.ts`                                                                                                      |

When you start, finish or change the scope of work, update `docs/STATUS.md` in the same PR. When something non-obvious happens (a bug's real cause, a gotcha, a surprising tool behaviour), add a dated line to `docs/LESSONS.md`. When a real choice is made, add an ADR in `docs/decisions/`. Do not rely on chat history for state.

---

# Quick reference

| DO NOT RUN     | DO RUN               |
| -------------- | -------------------- |
| `bun run test` | `bun run test --run` |

| Command                                            | Description                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `bun run dev`                                      | Start development server                                                    |
| `bunx convex dev`                                  | Run Convex backend in dev / regenerate `convex/_generated`                  |
| `bun run type-check`                               | Type check with tsgo (4.6x faster than tsc)                                 |
| `bun run lint`                                     | Check code for errors on all files                                          |
| `bunx eslint path/to/directory.file.ts`            | Run linting on a specific file                                              |
| `bun run test --run path/to/directory/file.ts`     | Run test for a specific file                                                |
| `bun run test:coverage`                            | Run tests with coverage - saves to test-coverage/latest-coverage-output.txt |
| `bun run build`                                    | Production build (uses tsgo)                                                |
| `bun run format`                                   | Format code with Prettier                                                   |
| `bunx vercel`                                      | Deploy to staging                                                           |
| `bunx vercel --prod`                               | Deploy to production                                                        |
| `bunx coderabbit --prompt-only --type uncommitted` | CodeRabbit review (uncommitted)                                             |
| `bunx coderabbit review --prompt-only --base main` | CodeRabbit review (PR vs main)                                              |

**URLs:** Dev: `https://localhost:5173` · Dev (Tailscale): `https://trio5700x.taila18a1c.ts.net:5173` · Prod: `https://agribid.vercel.app`

The dev server runs HTTPS using a Tailscale-issued cert for this machine's MagicDNS name (`vite.config.ts` loads it from `certs/`, which is git-ignored). Regenerate with `tailscale cert --cert-file certs/trio5700x.taila18a1c.ts.net.crt --key-file certs/trio5700x.taila18a1c.ts.net.key trio5700x.taila18a1c.ts.net` if it expires. The cert matches `trio5700x.taila18a1c.ts.net`, so that URL is warning-free on every tailnet device; `https://localhost:5173` works but shows a name-mismatch warning.

When sharing local dev-server changes for review, give the Tailscale URL instead of `localhost` so it's reachable from any device on the tailnet (`vite.config.ts` already sets `host: true`).

**Clerk note:** Clerk blocks sign-in requests whose origin isn't allow-listed (`403` from Cloudflare, and the Google button silently does nothing). Any origin you use — `https://localhost:5173`, `https://trio5700x.taila18a1c.ts.net:5173` — must be added under Clerk Dashboard → Configure → API Keys → Allowed origins.

---

# 1. Core rules

- Assume the dev and Convex servers are already running.
- **Priorities (in order):** security → type safety → correctness → code quality → maintainability → performance/bandwidth → user experience.
- Create tests before starting a new feature or fixing a bug.
- There are many tests: run tests ONLY for specific files (e.g. `bun run test --run path/to/file.ts`) where possible instead of the whole suite.
- Boy scout motto = "Leave it better than how you found it". Correct lint errors, type-safety issues and structural inefficiencies you come across.
- If you spot something important — an incorrect import, a structural issue, a potential improvement — raise it, even if unrelated to the current task.
- Never make assumptions. Review code and ask for clarification when unsure.
- Read entire files for full context before editing, and make related edits to a file in one pass. If the harness says a file changed since you last read it, re-read it and retry.
- Ship cohesive changes together: frontend, backend, schema, seed data, tests and docs. Data-related changes need thorough testing.

## Testing and coverage

- Every module needs tests; cover success and failure paths; mock external dependencies.
- Global coverage thresholds (enforced in `vitest.config.ts`, currently 90% for statements, branches, functions and lines) must pass before you commit.
- The latest coverage report is `test-coverage/latest-coverage-output.txt`; run `bun run test:coverage` to refresh it.

## Type safety and style

- **NO `any` types.** Use specific types, interfaces, type guards and assertions.
- **No `eslint-disable`.** Refactor to comply instead. Remove stale or unused directives.
- **JSDoc** all exported functions, components and types.
- Use meaningful names, modular reusable code, functional components, hooks and composition. Comment complex logic.
- Formatting and generic style are enforced by ESLint and Prettier; do not restate them by hand.

## Naming conventions (enforced via linting)

| Element               | Convention  | Example                    |
| --------------------- | ----------- | -------------------------- |
| Folders               | hyphen-case | `user-profile/`            |
| React component files | PascalCase  | `UserProfile.tsx`          |
| Utility/module files  | camelCase   | `helpers.ts`, `bidding.ts` |
| Variables/functions   | camelCase   | `getUserProfile`           |
| React components      | PascalCase  | `<UserProfile />`          |

---

# 2. UI design rules

1. **Clarity** — Clear labels, tooltips, prominent key information (highest bid, time remaining).
2. **Consistency** — Uniform styles per [`docs/product/vision.md`](docs/product/vision.md) and [`docs/architecture/ui-design/`](docs/architecture/ui-design/). Use theme tokens, never hardcoded colours/fonts.
3. **Accessibility** — ARIA roles, keyboard navigation, semantic HTML.
4. **Mobile-first** — Design for 375×812 first, then scale up to tablet (768×1024) and desktop (1440×900). Use Tailwind's unprefixed classes for mobile, then `sm:`, `md:`, `lg:` to progressively enhance.
5. **Feedback** — Loading indicators, success/error messages for all user actions.
6. **Simplicity** — No clutter. Every element must earn its place.
7. **Components** — Use shadcn/ui. Install from the library first, customise as needed.
8. **Verify with MCP** — Test UI changes across breakpoints before committing.
9. **Restraint** — Prefer flat sections with dividers over wrapping every block in a `<Card>`. Avoid card-in-card patterns.
10. **Sharpness** — Use `rounded` (4px) or `rounded-md` (6px) for UI elements. Reserve `rounded-lg` (8px) for images and avatars. Avoid `rounded-xl`/`rounded-2xl` on layout containers and buttons.

---

# 3. Workflow

## Development cycle

1. **Plan** — Define scope, list files to change, identify data needs. Anything spanning more than one PR gets a track in `conductor/tracks/` (`spec.md` + `plan.md`); single-PR fixes need only an issue and the PR.
2. **Test** — Write or update tests _before_ building; they should fail first.
3. **Build** — Implement (schema → backend → frontend).
4. **Verify** — `bun run lint` → `bun run test --run` → `bun run type-check` → `bun run build`. All must pass. For UI changes, also check in the browser (Chrome DevTools MCP) across breakpoints.
5. **Review** — Run the CodeRabbit CLI on uncommitted changes (see section 4).
6. **Push** — Branch, commit, push, open a PR, and update `docs/STATUS.md` in that PR.

## Branching and commits

- **Never commit or push directly to `main`, even when you have permission to bypass branch protection.** Always create a branch and merge via pull request.
- Branch names: `feature/description` or `bugfix/description` (`chore/`, `docs/`, `fix/` are fine for non-feature work).
- Commit format: `<type>(<scope>): <description>` with types `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Example: `feat(auth): add remember-me option`.
- Group related changes per commit. No unrelated changes in one commit.
- Before committing, `bun run lint` → `bun run test --run` → `bun run build` must pass (the husky pre-commit hook also runs them).

## Semantic versioning

Update the `package.json` version in the **same PR** as the changes: patch for fixes and UI tweaks, minor for non-breaking features, major for breaking or major refactors. The version flows from `package.json` → Vite build → AdminDashboard display.

## Pull requests

- One PR per feature/fix, with a clear description referencing relevant issues (`Closes #n`).
- All automated tests must pass before requesting review.
- Fill in the PR template checklist, including the docs items.

## Definition of done

Code implemented to spec; tests written and passing; coverage thresholds met; lint, type-check and build clean; works on mobile; no secrets or security regressions; `docs/STATUS.md` (and `LESSONS.md` / `decisions/` where applicable) updated; deviations from a track's spec noted in its `plan.md`.

## Emergencies

- **Production bug:** hotfix branch from `main` → failing test → minimal fix → verify → PR → record the cause in `docs/LESSONS.md`.
- **Suspected secret leak or breach:** rotate secrets immediately, review access logs, patch, then document.

---

# 4. Code reviews

## Pre-commit (CodeRabbit CLI)

1. Run: `bunx coderabbit --prompt-only --type uncommitted`
2. Fix critical and major issues. Consider improvements. Ignore inapplicable nits.
3. Re-run to verify fixes.

## PR reviews (CodeRabbit)

1. The user places review findings in a local `prXX_review_findings.md` (do not commit it).
2. Convert findings into a numbered checklist; for each item read the file → understand context → fix → tick it off.
3. Verify: `lint` → `test --run` → `build` → `bunx vercel build`.
4. Write a commit summary, update any affected documentation, push.

## Review focus areas

Code quality, readability, type safety; adherence to standards and naming; test coverage; security; unused imports/variables/code and stale `eslint-disable` directives; incomplete or placeholder code; documentation accuracy.

---

# 5. Tools

## Chrome DevTools MCP

For automated UI testing, accessibility audits and debugging.

- **One action per tool call.** Snapshots go stale after any page change — wait for the new snapshot before proceeding.
- Key actions: `list_pages`, `take_snapshot`, `navigate_page`, `new_page`, `click`, `fill`.

## Vercel CLI

- Run `bunx vercel` from the **project root**; confirm deployments with `bunx vercel list`.
- Dashboard settings: Root = `.`, Build = `bunx convex deploy --cmd 'bun run build'`, Install = `bun install` (override ON), Output = `dist`.

## GitHub CLI

Run `gh` from the project root for branch, commit, PR and issue management.

## Local scratch

`conductor/opencode_tasks/` is local scratch for delegated task files. It is gitignored: never commit its contents.
