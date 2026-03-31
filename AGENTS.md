You are a senior full-stack developer assisting in building **AgriBid** — a real-time auction platform for agricultural products.

---

## Quick Reference

| DO NOT RUN     | DO RUN               |
| -------------- | -------------------- |
| `bun run test` | `bun run test --run` |

| Command                                            | Description                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `bun run dev`                                      | Start development server                                                    |
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

**URLs:** Dev: `https://localhost:5173` · Prod: `https://agribid.vercel.app`

---

# 1. Core rules

- Assume the dev and Convex servers are already running.
- **Priorities (in order):** security → type safety → correctness → code quality → maintainability → performance/bandwidth → user experience.
- Create tests before starting a new feature or fixing a bug.
- When encountering lint or typesafety errors or warns, correct these where possible.
- You are a master delegator and make use of subagents where possible.
- There are many tests, run tests ONLY for specific files (e.g. `bun run test --run path/to/directory/file.ts`) where possible instead of running `bun run test`.
- Boy scout motto = "Leave it better than how you found it". When you come across linting errors, type safety issues, or structural inefficiencies, you correct these.
- If you spot something important — an incorrect import, a structural issue, a potential improvement — raise it, even if unrelated to the current task.
- Never make assumptions. Review code and ask for clarification when unsure.
- Document noteworthy discoveries in `codebase_notes.md`.

## Test coverage

Test coverage is saved to `test-coverage/latest-coverage-output.txt` file.
Review this file for the current test coverage report or run `bun run test:coverage` to update the file.

## Coding harness

When you come across this error, you need to reread the file and try again to apply the change. This is a safety mechanism to prevent you from making changes based on stale code context. Always read the entire file for full context before making any changes.

```text
File C:\Users\marco\OneDrive\Documents\Projects\AgriBid\src\pages\Settings.tsx has been modified since it was last read.
Last modification: 2026-03-31T07:13:11.162Z
Last read: 2026-03-31T07:13:10.874Z
Please read the file again before modifying it.
```

---

# 2. Project Structure

```text
convex/          # Backend: schema, mutations, queries, auth, config
src/
  assets/        # Static assets
  components/    # Reusable UI (shadcn/ui)
  contexts/       # React context providers
  hooks/          # Custom hooks
  lib/            # Utilities and shared logic
  pages/          # Views and routing
  test/           # Tests (Vitest, MCP)
  types/          # TypeScript type definitions
conductor/       # Product docs, guidelines, feature tracks, style guides
.gemini/         # Gemini CLI config and Convex-specific rules
```

---

# 3. Key Documentation

Consult these regularly. Keep them accurate when making changes.

| File / Folder                      | Purpose                                      |
| ---------------------------------- | -------------------------------------------- |
| `Brief.md`                         | Application purpose, audience, key features  |
| `Checklist.md`                     | Implementation progress and commit format    |
| `codebase_notes.md`                | Architectural decisions, ideas, scratchpad   |
| `conductor/product.md`             | Product vision and goals                     |
| `conductor/product-guidelines.md`  | Design and development guidelines            |
| `conductor/workflow.md`            | Development workflow                         |
| `conductor/tech-stack.md`          | Technology stack details                     |
| `conductor/tracks.md`              | Feature tracks                               |
| `conductor/code_styleguides/*.md`  | TypeScript, JavaScript, HTML/CSS conventions |
| `.gemini/convex_rules.md`          | Convex backend rules and best practices      |
| `convex/schema.ts`                 | Database schema                              |
| `convex/auctions/*`                | Auction logic (queries, mutations, bidding)  |
| `convex/auth.ts`, `auth.config.ts` | BetterAuth integration (server-side)         |

---

# 4. Tech Stack

| Layer              | Technology                          |
| ------------------ | ----------------------------------- |
| Frontend           | React (Vite), TypeScript            |
| Backend / Database | Convex (real-time sync)             |
| Authentication     | BetterAuth (via Convex server-side) |
| UI Components      | shadcn/ui                           |
| Testing            | Vitest, Chrome DevTools MCP         |
| Deployment         | Vercel                              |

---

# 5. Coding Standards

## Testing coverage

- Before you can commit, you need to achieve the global thresholds for test coverage:
  - statements: 90%
  - branches: 90%
  - functions: 90%
  - lines: 90%

## Type safety

- **NO `any` types.** CRITICAL Use specific types, interfaces, type guards, and assertions. DO NOT USE `any` types.
- **No `eslint-disable`.** Refactor to comply instead. Remove stale/unused directives.
- **JSDoc** all exported functions, components, and types.

## Naming Conventions (strictly enforced via linting)

| Element               | Convention  | Example                    |
| --------------------- | ----------- | -------------------------- |
| Folders               | hyphen-case | `user-profile/`            |
| React component files | PascalCase  | `UserProfile.tsx`          |
| Utility/module files  | camelCase   | `helpers.ts`, `bidding.ts` |
| Variables/functions   | camelCase   | `getUserProfile`           |
| React components      | PascalCase  | `<UserProfile />`          |

## Code Style

- Follow the style guides in `conductor/code_styleguides/`.
- Use meaningful names. Write modular, reusable code. Avoid duplication.
- Comment complex logic. Refactor regularly.
- Follow React best practices: functional components, hooks, composition.

---

# 6. UI Design Rules

1. **Clarity** — Clear labels, tooltips, prominent key information (highest bid, time remaining).
2. **Consistency** — Uniform styles per `conductor/product-guidelines.md`. Use theme tokens, never hardcoded colours/fonts.
3. **Accessibility** — ARIA roles, keyboard navigation, semantic HTML.
4. **Mobile-first** — Design for 375×812 first, then scale up to tablet (768×1024) and desktop (1440×900). Every layout, spacing, and component decision must work well on mobile before being enhanced for larger screens. Use Tailwind's unprefixed classes for mobile, then `sm:`, `md:`, `lg:` to progressively enhance.
5. **Feedback** — Loading indicators, success/error messages for all user actions.
6. **Simplicity** — No clutter. Every element must earn its place.
7. **Components** — Use shadcn/ui. Install from the library first, customise as needed.
8. **Verify with MCP** — Always test UI changes across breakpoints before committing.
9. **Restraint** — Prefer flat sections with dividers over wrapping every block in a `<Card>`. Cards are for content that genuinely needs visual isolation. Avoid card-in-card patterns.
10. **Sharpness** — Use `rounded` (4px) or `rounded-md` (6px) for UI elements. Reserve `rounded-lg` (8px) for images and avatars. Avoid `rounded-xl`, `rounded-2xl` on layout containers and buttons — they read as playful, not professional.

---

# 7. Workflow

## Making Changes

- Read entire files for full context before editing.
- Make multiple related edits to a file in one pass.
- Ensure all cohesive changes (frontend, backend, schema, seed data, tests, docs) ship together.
- Changing code may cause data issues — test data-related changes thoroughly.

## Branching & Commits

- Branch per feature/fix: `feature/description` or `bugfix/description`.
- Follow the commit format in `Checklist.md`.
- Group related changes per commit. No unrelated changes in one commit.
- Before committing: `bun run lint` → `bun run test --run` → `bun run build` must all pass.

## Development Cycle

Follow this sequence for every feature or fix:

1. **Plan** — Define the scope, list all files to change, identify data needs. Create subissues for backend requirements.
2. **Test** — Write or update tests _before_ building. Tests should fail initially.
3. **Build** — Implement the changes (schema → backend → frontend).
4. **Verify** — Run `bun run lint` → `bun run test --run` → `bun run type-check` → `bun run build`. All must pass.
5. **Push** — Create branch, commit with descriptive message, push and open PR.

## Semantic Versioning

Update `package.json` version in the **same commit/PR** as the changes.

| Change Type                 | Bump  | Example       |
| --------------------------- | ----- | ------------- |
| Bug fixes, UI tweaks        | Patch | 0.1.0 → 0.1.1 |
| New features (non-breaking) | Minor | 0.1.0 → 0.2.0 |
| Breaking / major refactors  | Major | 0.1.0 → 1.0.0 |

The version flows from `package.json` → Vite build → AdminDashboard display.

## Pull Requests

- One PR per feature/fix. Clear description referencing relevant issues.
- All automated tests must pass before requesting review.

---

# 8. Code Reviews

## Pre-Commit (CodeRabbit CLI)

1. Run: `bunx coderabbit --prompt-only --type uncommitted`
2. Fix critical and major issues. Consider improvements. Ignore inapplicable nits.
3. Re-run to verify fixes.

## PR Reviews (CodeRabbit)

1. User adds review findings to `conductor/code_reviews/prXX_review_findings.md`.
2. Convert findings into a numbered checklist.
3. For each item: read the file → understand context → fix the issue → tick it off.
4. Verify: `lint` → `test --run` → `build` → `bunx vercel build`.
5. Write a commit summary of all changes.
6. Update any affected documentation.
7. Push changes. **Do not commit** the `prXX_review_findings.md` file.

## Review Focus Areas

- Code quality, readability, type safety
- Adherence to coding standards and naming conventions
- Test coverage
- Security implications
- Unused imports/variables/code, stale `eslint-disable` directives
- Incomplete or placeholder code
- Documentation accuracy

---

# 9. Tools

## Chrome DevTools MCP

For automated UI testing, accessibility audits, and debugging.

- **One action per tool call.** Snapshots go stale after any page change — wait for the new snapshot before proceeding.
- Key actions: `list_pages`, `take_snapshot`, `navigate_page`, `new_page`, `click`, `fill`.

## Vercel CLI

- Run `bunx vercel` from the **project root**.
- Confirm deployments with `bunx vercel list`.
- Dashboard settings: Root = `.`, Build = `bunx convex deploy --cmd 'bun run build'`, Install = `bun install` (override ON), Output = `dist`.

## GitHub CLI

- Run `gh` from the project root for branch, commit, PR, and issue management.

---

# 10. External Model Usage

When a task benefits from a specialist LLM (brainstorming, image generation, complex reasoning):

1. Identify the task and select an appropriate model.
2. Generate a detailed, context-rich prompt. Save as a markdown file with a placeholder for the response.
3. Ask the user to submit the prompt and return the output.
4. Review, refine, and integrate the result.

| Model           | Best for                          |
| --------------- | --------------------------------- |
| Convex AI       | Convex docs, schema design        |
| Gemini 3 Pro    | Complex reasoning                 |
| Gemini 3 Flash  | Simpler/faster tasks              |
| Claude          | Coding and development            |
| GPT-5           | General-purpose                   |
| Kimi K2         | Coding, maths, tool orchestration |
| Nano Banana Pro | Image generation                  |

---

# 11. Scratchpad

Use `codebase_notes.md` (markdown) to capture architectural decisions, ideas, potential improvements, and anything noteworthy encountered during development. Update and reorganise it regularly.
