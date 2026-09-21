# Task: Review open PRs and suggest a merge plan

## Context

Repo: AgriBid (github: marcojsmith/AgriBid). Open PRs, all from dependabot:

- #314 chore(deps-dev): bump vite from 7.3.1 to 8.2.2 (major bump)
- #313 chore(deps): bump @radix-ui/react-alert-dialog from 1.1.15 to 1.1.23
- #312 chore(deps): bump react-dom and @types/react-dom
- #311 chore(deps): bump react and @types/react
- #310 chore(deps-dev): bump @testing-library/react from 16.3.2 to 16.3.3
- #309 chore(deps): bump actions/checkout from 4 to 7 (GH Actions, major bump)

Use `gh pr view <number>` and `gh pr diff <number>` to inspect each PR's changelog/diff.

## Instructions

1. For each PR listed above, run `gh pr view <number> --json title,body,files` and `gh pr diff <number>` to see the actual change and any changelog notes dependabot included in the body.
2. Assess risk for each: is it a patch/minor bump (likely safe) or a major bump (check for breaking changes in the changelog notes in the PR body)?
3. Check for interdependencies: #311 (react) and #312 (react-dom) should likely be merged together/in sequence since they must stay in sync. Note this explicitly.
4. For the vite major bump (#314) and actions/checkout major bump (#309), specifically look for breaking changes noted in the PR body/release notes and flag anything requiring config changes (e.g. vite config, workflow yaml).
5. Produce a merge plan: order to merge PRs in, which are safe to batch-merge immediately, which need manual testing/verification first (e.g. running `bun run build` / `bun test` locally after merging vite or react bumps), and which (if any) should be held back.
6. Do not merge or modify any PRs. This is a read-only review/planning task.

## Constraints

- Read-only: do not push, merge, comment, or edit files.
- Use `gh` CLI for all GitHub interaction.

## Results

_Reviewed by opencode (model: `openrouter/deepseek/deepseek-v4.1-flash`) on 2026-09-13. Read-only: no PRs were merged, commented on, or modified._

### Summary table

| PR   | Bump                                           | Semver                  | Risk     | Verdict                                                                  |
| ---- | ---------------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------ |
| #310 | `@testing-library/react` 16.3.2 → 16.3.3       | patch                   | Low      | Batch-merge now                                                          |
| #309 | `actions/checkout` v4 → v7                     | major                   | Low      | Batch-merge now (breaking change does not apply to this repo)            |
| #313 | `@radix-ui/react-alert-dialog` 1.1.15 → 1.1.23 | patch range             | Low      | Batch-merge now, then run component tests                                |
| #311 | `react` + `@types/react` → 19.3.0              | minor (0.x major-minor) | Medium   | Merge **together with #312** in sequence, then verify                    |
| #312 | `react-dom` + `@types/react-dom` → 19.3.0      | minor                   | Medium   | Merge **together with #311** in sequence, then verify                    |
| #314 | `vite` 7.3.1 → 8.2.2                           | major                   | **High** | **HOLD/blocked** — requires a companion migration PR, cannot merge as-is |

### Detailed findings

#### #310 — `@testing-library/react` 16.3.2 → 16.3.3 (safe)

- Single bugfix: "Avoid act() re-entrant when dispatching events" (#1468).
- `bun.lock` + `package.json` only; peer range still `^18.0.0 || ^19.0.0`. No API changes.
- Safe to batch-merge. Recommend `bun run test --run` as normal CI covers it.

#### #309 — `actions/checkout` v4 → v7 (safe for this repo)

- Touches only `.github/workflows/ci.yml` (4 occurrences) and `.github/workflows/claude.yml` (1 occurrence).
- The v7 breaking change blocks checking out fork PRs for `pull_request_target` and `workflow_run` triggers. **This repo uses neither trigger**:
  - `ci.yml` triggers on `pull_request` and `push`.
  - `claude.yml` triggers on `issue_comment`, `pull_request_review_comment`, `issues`, `pull_request_review`.
- v6 also moved to the Node 24 action runtime; `ubuntu-latest` supports Node 24, so no runner change is needed.
- No workflow YAML changes required. Safe to batch-merge; CI will self-verify on the PR.

#### #313 — `@radix-ui/react-alert-dialog` 1.1.15 → 1.1.23 (safe)

- Patch-level range bump. Changelog shows no API breaks; notable items are dependency updates, tree-shaking improvements (#1.1.20), and a **revert of RSC-breaking changes** (#1.1.23).
- Imported directly at `src/components/ui/alert-dialog.tsx:2`, and also referenced in the `vendor-ui` manualChunks list in `vite.config.ts:35`.
- Note: the `radix-ui` umbrella package (`^1.4.3`) still pins its own nested `@radix-ui/react-alert-dialog@1.1.15`; this PR only bumps the direct dep. Independent of the other PRs.
- Safe to batch-merge; run the alert-dialog component tests after.

#### #311 + #312 — React 19.3.0 (must merge together)

- **Interdependency is real and must be called out.** As authored in isolation:
  - #311 bumps `react` 19.2.4 → 19.3.0 and `@types/react` 19.2.14 → 19.3.0, leaving `react-dom@19.2.4`. That is fine (`react-dom@19.2.4` peer wants `react ^19.2.4`, satisfied by 19.3.0).
  - #312 bumps `react-dom` 19.2.4 → 19.3.0 and `@types/react-dom` 19.2.3 → 19.3.0, leaving `react@19.2.4`. **This is broken in isolation**: `react-dom@19.3.0` peer requires `react ^19.3.0` and `@types/react-dom@19.3.0` peer requires `@types/react ^19.3.0`, neither of which are satisfied by the un-bumped react/@types/react.
- Both PRs edit the same lines in `package.json`/`bun.lock`, so whichever merges second will need a Dependabot rebase anyway. Merge them together (or rebase #312 immediately after #311) so react, react-dom, `@types/react`, and `@types/react-dom` all land on 19.3.0 atomically.
- React 19.3.0 is a feature/minor release: new `<ViewTransition />`/`addTransitionType`, Fragment refs, `browser()`. Notable behavior changes to watch: transitions now render independently (#37290), Trusted Types enabled (#35816), CJS interop changes. No breaking API removal for our usage, but requires verification (see below).

#### #314 — `vite` 7.3.1 → 8.2.2 (HIGH RISK — do not merge as-is)

This is a true major bump and the PR as authored is **incomplete**. The lock diff reveals the bundler swap `rollup@4.59.0` → `rolldown@1.2.8` and `esbuild` removed from direct deps. Concrete blockers found in-repo:

1. **`vite.config.ts` will fail to build.** Vite 8 removed the object form of `build.rollupOptions.output.manualChunks`. The config uses exactly that at `vite.config.ts:25-43` (`manualChunks: { "vendor-react": [...], ... }`). Per the Vite v7→v8 migration guide, the object form is unsupported; the function form is deprecated; the supported replacement is Rolldown's `build.rolldownOptions.output.advancedChunks`/`codeSplitting`. Also `build.rollupOptions` is renamed to `build.rolldownOptions` (still supported, but deprecated).
2. **`@vitejs/plugin-react@5.1.4` does not support Vite 8.** Its peer range is `^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` (confirmed in `bun.lock`). PR #314 does not bump it, so `bun install` will hit a peer conflict / the plugin may break. A Vite 8-compatible plugin-react release must be added.
3. **`@tailwindcss/vite@4.2.1` does not support Vite 8.** Its peer range is `^5.2.0 || ^6 || ^7` (confirmed in `bun.lock`). PR #314 does not bump it either. A Vite 8-compatible `@tailwindcss/vite` must be added.
4. Other Vite 8 changes to keep in mind: esbuild/Oxc and Rollup/Rolldown fallbacks (`transformWithEsbuild` needs esbuild re-added as a dev dep if any plugin uses it), CJS `default` interop change (`legacy.inconsistentCjsInterop` escape hatch), default browser target bumped, CSS minification now Lightning CSS.
5. `vitest@5.0.0` is fine — its peer already allows `^8.0.0`.

**Verdict: hold #314 (mark draft or leave blocked).** It needs a dedicated migration PR that bumps the two Vite plugins, rewrites the chunking config for Rolldown, and re-validates build + deploy before Vite 8 can land.

### Merge plan

**Phase 1 — batch-merge immediately (low risk, independent):**

1. #310 — testing-library patch.
2. #309 — actions/checkout v7 (CI self-verifies; no YAML edits needed).
3. #313 — radix alert-dialog.

These three touch disjoint files and can be merged in any order. CI (`lint` → `type-check` → `test` → `build`) must pass on each.

**Phase 2 — React 19.3, merge as a pair, then verify:** 4. Merge #311 first, then immediately rebase/merge #312 (or combine both into one commit/PR) so `react`, `react-dom`, `@types/react`, and `@types/react-dom` all reach 19.3.0 together. 5. After merging, locally verify before relying on CI:

- `bun install`
- `bun run lint`
- `bun run test --run`
- `bun run type-check`
- `bun run build`
- Smoke-test in the browser (Chrome DevTools MCP) at 375×812, 768×1024, 1440×900 — especially anything using Suspense/transitions/dialogs.

**Phase 3 — Vite 8, HOLD:** 6. Do **not** merge #314 as-is. Create a separate `feature/vite-8-migration` PR/branch that:

- bumps `vite` to `^8.2.2` together with a Vite 8-compatible `@vitejs/plugin-react` and `@tailwindcss/vite`;
- migrates `vite.config.ts` off the removed object-form `manualChunks` (use `build.rolldownOptions`/`advancedChunks`) and updates the `vendor-ui` list if needed;
- re-checks for any esbuild-dependent plugins;
- verifies `bun run lint`, `bun run test --run`, `bun run type-check`, `bun run build`, `bunx vercel build`, and a dev-server smoke test.
- Once that PR is green, close/supersede #314 (comment `@dependabot close`) or fold its bump into the migration PR.

**Hold back:** #314 only. Everything else can proceed.

### Verification commands (post-merge, per AGENTS.md)

```
bun run lint
bun run test --run
bun run type-check
bun run build
```

For Phase 2/3 additionally run `bunx vercel build` and the MCP breakpoint checks. Remember `package.json` version bumps follow the semver table in AGENTS.md (these are dependency chores; a patch bump is appropriate when they ship).
