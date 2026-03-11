# Migration Plan: Move app/ contents to root folder

## Overview

This checklist documents the migration of application code from the `app/` subdirectory to the repository root level.

**Issue:** #60 - Move the app and convex to the root folder  
**Branch:** `feature/move-app-to-root`

---

## Phase 1: Migrate Application Files to Root

### 1.1 Move Core Application Directories

> **Dependency:** None (start here)

- [ ] **1.1.1** Move `app/src/` directory to root as `src/`
  - Contains: React components, pages, hooks, contexts, types, test setup
  - Verify all imports using `@/*` paths still resolve correctly
  - Command: `git mv app/src src`

- [ ] **1.1.2** Move `app/convex/` directory to root as `convex/`
  - Contains: Backend schema, mutations, queries, auth, seed data
  - Verify convex.config.ts paths work from root
  - Command: `git mv app/convex convex`

- [ ] **1.1.3** Move `app/public/` directory to root as `public/`
  - Contains: Static assets (vite.svg, etc.)
  - Command: `git mv app/public public`

- [ ] **1.1.4** Move `app/index.html` to root level
  - Vite entry point
  - Command: `git mv app/index.html .`

### 1.2 Move Configuration Files

> **Dependency:** 1.1 (directories must be moved first)

- [ ] **1.2.1** Move `app/package.json` to root
  - Main project configuration
  - Command: `git mv app/package.json .`

- [ ] **1.2.2** Move `app/bun.lock` to root
  - Dependency lockfile
  - Command: `git mv app/bun.lock .`

- [ ] **1.2.3** Move `app/vite.config.ts` to root
  - Vite bundler configuration
  - Check if `base` path needs adjustment (likely not, it's relative to config)
  - Command: `git mv app/vite.config.ts .`

- [ ] **1.2.4** Move TypeScript configuration files to root
  - `app/tsconfig.json` → `.`
  - `app/tsconfig.app.json` → `.`
  - `app/tsconfig.node.json` → `.`
  - Verify `@/*` path aliases resolve from new location
  - Command: `git mv app/tsconfig*.json .`

- [ ] **1.2.5** Move `app/vitest.config.ts` to root
  - Test runner configuration
  - Command: `git mv app/vitest.config.ts .`

- [ ] **1.2.6** Move `app/convex.json` to root
  - Convex deployment configuration
  - Command: `git mv app/convex.json .`

- [ ] **1.2.7** Move `app/components.json` to root
  - Shadcn UI component configuration
  - Verify `tailwind.config.ts` path references work
  - Command: `git mv app/components.json .`

- [ ] **1.2.8** Move `app/eslint.config.js` to root
  - ESLint configuration
  - Command: `git mv app/eslint.config.js .`

- [ ] **1.2.9** Move `app/.prettierrc` to root
  - Prettier configuration
  - Command: `git mv app/.prettierrc .`

### 1.3 Move Environment Files

> **Dependency:** 1.2 (config files moved)

- [ ] **1.3.1** Move `app/.env.example` to root as `.env.example`
  - Environment variable template
  - Command: `git mv app/.env.example .env.example`

- [ ] **1.3.2** Move `app/.env.local` to root as `.env.local`
  - Local environment variables (contains secrets)
  - Command: `git mv app/.env.local .env.local`
  - **Note:** Ensure this is in .gitignore (see Phase 2.3)

### 1.4 Clean Up Empty App Directory

> **Dependency:** 1.1, 1.2, 1.3 (all files moved)

- [ ] **1.4.1** Verify all files have been moved from `app/`
  - Run: `ls -la app/` to check for any remaining files
  - Check for hidden files: `ls -la app/.*`

- [ ] **1.4.2** Remove empty `app/` directory
  - Command: `rmdir app` (will fail if not empty)
  - Or: `git rm -d app` (removes empty directory from git)

- [ ] **1.4.3** Verify build works from root
  - Run: `bun install && bun run build`
  - Ensure no import/path resolution errors

---

## Phase 2: Update Deployment & Tooling Configuration

> **Dependency:** Phase 1 complete (all files moved)

### 2.1 Update Vercel Configuration

> **Dependency:** 1.4 (app directory removed)

- [ ] **2.1.1** Update `vercel.json` buildCommand
  - Remove `cd app &&` prefix
  - Old: `cd app && if [ "$VERCEL_ENV" = "production" ]; then bunx convex deploy --cmd 'bun run build'; else bun run build; fi`
  - New: `if [ "$VERCEL_ENV" = "production" ]; then bunx convex deploy --cmd 'bun run build'; else bun run build; fi`

- [ ] **2.1.2** Update `vercel.json` installCommand
  - Remove `cd app &&` prefix
  - Old: `cd app && bun install`
  - New: `bun install`

- [ ] **2.1.3** Update `vercel.json` outputDirectory
  - Change from `app/dist` to `dist`
  - Old: `"outputDirectory": "app/dist"`
  - New: `"outputDirectory": "dist"`

- [ ] **2.1.4** Verify Vercel build locally
  - Run: `bunx vercel build`
  - Ensure deployment succeeds

### 2.2 Update Git Hooks

> **Dependency:** 1.4 (app directory removed)

- [ ] **2.2.1** Update `.husky/pre-commit` hook
  - Remove `cd app &&` prefix
  - Old: `cd app && bunx lint-staged && bun run build`
  - New: `bunx lint-staged && bun run build`

### 2.3 Update Git Ignore

> **Dependency:** Phase 1 complete

- [ ] **2.3.1** Update `.gitignore` - dist folder
  - Change `app/dist` to `dist`
  - Line 12: Remove `app/dist/`

- [ ] **2.3.2** Update `.gitignore` - env files
  - Change `app/.env.local` to `.env.local`
  - Line 31: Remove `app/.env.local`

- [ ] **2.3.3** Merge app/.gitignore to root if needed
  - Check `app/.gitignore` contents before deletion
  - Merge any unique patterns into root `.gitignore`

---

## Phase 3: Update Project Documentation

> **Dependency:** Phase 2 complete (deployment works)

### 3.1 Update Primary Documentation

- [ ] **3.1.1** Update `README.md`
  - [ ] Lines 50-72: Update directory structure diagram
  - [ ] Line 122: Remove `cd app` from setup instructions
  - [ ] Line 127: Update .env.local path reference
  - [ ] Line 171: Remove "Set Root Directory to `app/`"

- [ ] **3.1.2** Update `AGENTS.md`
  - [ ] Lines 9-13: Update command table (remove `cd app &&`)
  - [ ] Lines 43-57: Update folder structure section
  - [ ] Line 147: Update package.json version path
  - [ ] Lines 207: Update Vercel CLI section
  - [ ] Lines 333-335: Update worktree instructions

- [ ] **3.1.3** Update `Checklist.md`
  - [ ] Line 15: Update item referencing issue #60
  - Note: This is the checklist item being completed by this migration

- [ ] **3.1.4** Update `Brief.md`
  - [ ] Line ~160: Update File Structure section

### 3.2 Update Development Guides

- [ ] **3.2.1** Update `.gemini/skills/project-workflows/SKILL.md`
  - [ ] Line 11: Remove `cd app` from lint command
  - [ ] Line 12: Remove `cd app` from test command
  - [ ] Line 13: Remove `cd app` from coverage command
  - [ ] Line 19: Update versioning path
  - [ ] Line 20: Remove `cd app` from build command

### 3.3 Update Conductor Documentation

> **Note:** These are historical/archive documents. Consider whether updates are necessary or if they should remain as historical record.

- [ ] **3.3.1** Update `conductor/tracks/*.md` files
  - Search for `app/` references and update paths
  - Priority: Only files with active work or future reference

- [ ] **3.3.2** Update `conductor/archive/*.md` files
  - Optional: Update paths for consistency
  - These are historical documents, may not require updates

- [ ] **3.3.3** Update conductor index or overview files
  - Check `conductor/*.md` for path references

### 3.4 Update Codebase Notes

- [ ] **3.4.1** Update `codebase_notes.md`
  - [ ] Line 31: `app/convex/config.ts` → `convex/config.ts`
  - [ ] Line 32: `app/convex/auth.ts` → `convex/auth.ts`
  - [ ] Line 33: `app/convex/auth.config.ts` → `convex/auth.config.ts`
  - [ ] Line 37: `app/convex/http.ts` → `convex/http.ts`
  - [ ] Line 39: `app/convex/config.ts` → `convex/config.ts`
  - [ ] Line 46: `app/convex/http.ts` → `convex/http.ts`
  - [ ] Line 58: `app/convex/admin_utils.ts` → `convex/admin_utils.ts`
  - [ ] Line 65: `app/convex/users.ts` → `convex/users.ts`
  - [ ] Line 70: `app/convex/admin_utils.ts` → `convex/admin_utils.ts`
  - [ ] Line 77: `app/convex/auctions.ts` → `convex/auctions.ts`
  - [ ] Line 97: `app/convex/auctions.ts` → `convex/auctions.ts`

### 3.5 Update Opencode Plans (Optional)

- [ ] **3.5.1** Update `.opencode/plans/*.md`
  - These are temporary plan files
  - Optional: Update for consistency

---

## Phase 4: Verification & Testing

> **Dependency:** Phases 1-3 complete

### 4.1 Local Development Verification

- [ ] **4.1.1** Test development server starts
  - Run: `bun run dev`
  - Verify: `https://localhost:5173` loads correctly

- [ ] **4.1.2** Test linting passes
  - Run: `bun run lint`
  - Verify: No errors

- [ ] **4.1.3** Test type checking passes
  - Run: `bun run typecheck` (or `bunx tsc --noEmit`)
  - Verify: No type errors

- [ ] **4.1.4** Test build succeeds
  - Run: `bun run build`
  - Verify: `dist/` folder created with correct content

- [ ] **4.1.5** Test pre-commit hook works
  - Run: `bunx lint-staged && bun run build`
  - Verify: Commands execute from root without `cd app`

### 4.2 Deployment Verification

- [ ] **4.2.1** Test Vercel build locally
  - Run: `bunx vercel build`
  - Verify: Build succeeds

- [ ] **4.2.2** Test Convex deployment
  - Run: `bunx convex deploy`
  - Verify: Schema and functions deploy successfully

### 4.3 Verify All Path References

- [ ] **4.3.1** Search for remaining `app/` references in code
  - Run: `grep -r "app/" --include="*.ts" --include="*.tsx" --include="*.json" src/ convex/`
  - Fix any remaining hardcoded `app/` paths

- [ ] **4.3.2** Verify all imports work correctly
  - Check: `@/*` imports resolve from `src/`
  - Check: `convex/*` imports resolve from `convex/`
  - Check: Configuration file imports work

---

## Phase 5: Commit & Deploy

> **Dependency:** Phase 4 complete (all tests pass)

### 5.1 Commit Changes

- [ ] **5.1.1** Review all changes
  - Run: `git status`
  - Review: `git diff --stat`

- [ ] **5.1.2** Create commit
  - Message: `refactor: move app structure to root for standard convention`

- [ ] **5.1.3** Push to remote
  - Command: `git push -u origin feature/move-app-to-root`

### 5.2 Deploy to Staging (Optional)

- [ ] **5.2.1** Deploy to Vercel staging
  - Command: `bunx vercel`
  - Verify: Staging URL works correctly

### 5.3 Create Pull Request

- [ ] **5.3.1** Create PR
  - Title: `refactor: move app structure to root (#60)`
  - Description: Link to issue #60

- [ ] **5.3.2** Request review
  - Assign reviewers as appropriate

---

## Rollback Plan

If issues arise, rollback steps:

1. `git revert <commit>` or `git reset --hard HEAD~1`
2. Restore `app/` from git history
3. Restore `vercel.json`, `.husky/pre-commit`, `.gitignore`

---

## Notes

- **Path aliases:** TypeScript path aliases (`@/*`) in `tsconfig.json` are relative to the config file location. Moving config to root means `@/*` now resolves from root, which is the intended behavior.
- **Convex:** The `convex.json` file at root will automatically find `convex/` at root level. No changes needed.
- **Vite:** The `vite.config.ts` at root will find `src/` and `public/` at root level. No changes needed.
- **Git history:** Using `git mv` preserves file history in git.
- **Build output:** `dist/` folder location changes from `app/dist` to `dist`. Vercel config updated accordingly.
