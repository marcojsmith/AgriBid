# Task: Bump @convex-dev/aggregate and migrate to explicit table-id db calls

## Context

- `convex` is now `^1.45.0` (just bumped, committed in `8100f18`).
- `package.json` has `"@convex-dev/aggregate": "^0.2.1"`. Latest stable is `0.3.1` (peer `convex ^1.43.0`, satisfied by our 1.45.0).
- 51 call sites in `convex/**` use the old `ctx.db.get(id)` / `.patch(id, ...)` / `.replace(id, ...)` / `.delete(id)` signature (no table name as first arg). 0 use the new `(tableName, id)` signature.
- Convex provides an automated codemod for this: `npx @convex-dev/codemod@latest explicit-ids`.
- Related GitHub issue: https://github.com/marcojsmith/AgriBid/issues/278 (this is step 5, the optional follow-up).

## Instructions

1. Check `convex/convex.config.ts` (or wherever aggregate components are registered) to confirm `@convex-dev/aggregate` is actually used/registered. Note: issue #308 claims it may be unused/unregistered — verify this first and report what you find.
2. If it's used: bump `@convex-dev/aggregate` to `^0.3.1` in `package.json`, run `bun install`, run `bunx convex codegen`, and check for any API changes between 0.2.x and 0.3.x that affect our usage (check its CHANGELOG on npm/GitHub if needed).
   If it's NOT used/registered anywhere: do not bump it, just report that finding — do not remove the dependency either (that's issue #308's scope, not this task).
3. Run `npx @convex-dev/codemod@latest explicit-ids` against the `convex/` directory to migrate `ctx.db.get/patch/replace/delete` call sites to the `(tableName, id)` signature. If the codemod tool supports a dry-run/preview flag, use it first to sanity check the diff before applying.
4. After the codemod runs, run `bun run typecheck`, `bun run lint`, and `bun run test --run`. Fix any errors the codemod introduced (e.g. missed call sites, incorrect table name inference) but do not fix unrelated pre-existing issues.
5. Add the `@convex-dev/explicit-table-ids` ESLint rule to `eslint.config.js` scoped to the `convex/**` block, so future code can't regress to the old signature. Check the rule's actual package/rule name before adding it (verify it exists on npm and check its docs for correct config syntax).
6. Re-run lint after adding the rule to confirm zero violations (the codemod in step 3 should have already fixed all call sites).

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md`
- No `any` types
- Keep the diff scoped to: `package.json`, `bun.lock`, `eslint.config.js`, and files under `convex/` (including `convex/_generated/*` if codegen changes them). Do not touch `src/`.
- If the codemod tool doesn't exist or fails to install, report that clearly instead of hand-rolling the migration — hand-migrating 51 call sites is out of scope if the automated tool isn't usable.

## Results

### 1. `@convex-dev/aggregate` verification — NOT used

`convex/convex.config.ts` is an empty app (`defineApp()` with no `app.use(...)` calls), and a
case-sensitive repo-wide search for `@convex-dev/aggregate` returns **zero** imports/usages
(`convex/**` and the whole repo). The dependency appears unused/unregistered, confirming
issue #308's suspicion.

Per instructions: **did not bump** it (and did not remove it — that's issue #308's scope).
No `bun install`/`convex codegen` was needed for it.

### 2. Codemod (`explicit-ids`) — applied

- Tool exists and supports `--dry-run`/`--allow-dirty`:
  `@convex-dev/codemod@latest explicit-ids`.
- Dry run reported **133 call sites over 33 files** (the task's estimate of 51 was an
  undercount).
- Ran for real: **updated 133 call sites over 33 files** under `convex/**`.
- **1 call site could not be auto-updated**: `convex/seed.ts` `clearTable()` uses a dynamic
  `SeedTableNames` union, so the codemod can't infer a single table name. Fixed by hand:
  `ctx.db.delete(tableName, item._id)`. Since the new `db.delete(table, id)` signature accepts
  a union table name, no casts were needed.
- No other missed call sites (`grep` for `ctx.db.(get|patch|replace|delete)(` without a table
  string returns nothing).

### 3. Tests — updated

After the codemod, the full suite had **125 failures across 38 test files**: tests mock
`ctx.db.*` and asserted the old `(id, …)` signature, and some positional mock implementations
read `id` from argument 0. These are codemod-induced (verified: `git stash` of the codemod
diff → **2217/2217 pass** at baseline).

Fixed **38 test files under `convex/`** (table name prepended to `toHaveBeenCalledWith` /
`toHaveBeenNthCalledWith` / `not.toHaveBeenCalledWith`, positional mock implementations moved to
`(_table, id, …)`, and a few payload index shifts `call[1] → call[2]`). No assertions were
weakened or removed; no production files were edited beyond the codemod; `src/` untouched.

One type error introduced by a typed-mock edit (`dismissFlag.test.ts`) was fixed with the
existing `(vi.mocked(...) as Mock)` pattern. Final: **2217/2217 tests pass (175 files)**.

### 4. ESLint rule — added

- The task named `@convex-dev/explicit-table-ids`, which is **not an npm package**. The real
  package/rule is **`@convex-dev/eslint-plugin`** with rule **`@convex-dev/explicit-table-ids`**
  (confirmed on npm + https://docs.convex.dev/eslint).
- Added `@convex-dev/eslint-plugin@4.0.0` to `devDependencies` (`bun add -d`) and a new
  `eslint.config.js` block scoped to `convex/**/*.ts` with
  `"@convex-dev/explicit-table-ids": "error"`. `src/` is unaffected.
- Verified the rule is active and fires: temporarily reverting one call to the old signature
  produced `Database delete call should include an explicit table name as the first argument.`
- Re-ran lint: **0 errors** (7 pre-existing, unrelated warnings remain).

### 5. Verification

| Check             | Command                                      | Result                                   |
| ----------------- | -------------------------------------------- | ---------------------------------------- |
| Lint              | `bun run lint`                               | Pass — 0 errors, 7 pre-existing warnings |
| Tests             | `bun run test --run`                         | Pass — 175 files, 2217/2217              |
| Type check        | `bun run type-check`                         | Pass                                     |
| Convex type check | `bunx tsgo -p convex/tsconfig.json --noEmit` | Pass                                     |
| Build             | `bun run build`                              | Pass                                     |

### Files changed

- `package.json`, `bun.lock` (added `@convex-dev/eslint-plugin` devDependency)
- `eslint.config.js` (plugin import + convex-scoped rule)
- 33 production files under `convex/**` (codemod) + `convex/seed.ts` (manual fix)
- 38 `convex/**/*.test.ts` files (mock/assertion updates)

### Notes / out of scope

- `AGENTS.md` has an **unrelated pre-existing working-tree change** (Tailscale dev URL note).
  It was left untouched and is not part of this task.
- `@convex-dev/aggregate` remains installed but unused — removal tracked by issue #308.
- Follow-up #278 (the optional step 5 issue) relates to the explicit-table-ids migration.
