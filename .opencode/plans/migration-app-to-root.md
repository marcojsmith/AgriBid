# Migration Plan: AgriBid from `app/` to Root Folder

**Objective:** Migrate the codebase from a monorepo structure (`app/` folder) to having all source code at the project root.

---

## Overview

| Aspect | Current | Target |
|--------|---------|--------|
| Source code | `app/src/` | `./src/` |
| Backend | `app/convex/` | `./convex/` |
| Config files | `app/` | Root |
| Package name | `"app"` | `"agribid"` |

---

## Pre-Migration Checklist

- [ ] **1.1** Create git branch: `git checkout -b chore/migrate-to-root`
- [ ] **1.2** Verify all tests pass: `cd app && bun run test --run`
- [ ] **1.3** Commit any pending changes to avoid conflicts

---

## Phase 1: Move Source Files

**Dependencies:** 1.1, 1.3

- [ ] **2.1** Move `app/src/` → `./src/`
- [ ] **2.2** Move `app/convex/` → `./convex/`
- [ ] **2.3** Move `app/index.html` → `./index.html`
- [ ] **2.4** Verify moved directories exist at root

---

## Phase 2: Move Configuration Files

**Dependencies:** 2.1, 2.2, 2.3

- [ ] **3.1** Move `app/package.json` → `./package.json`
- [ ] **3.2** Move `app/vite.config.ts` → `./vite.config.ts`
- [ ] **3.3** Move `app/tsconfig.json` → `./tsconfig.json`
- [ ] **3.4** Move `app/tsconfig.app.json` → `./tsconfig.app.json`
- [ ] **3.5** Move `app/tsconfig.node.json` → `./tsconfig.node.json`
- [ ] **3.6** Move `app/eslint.config.js` → `./eslint.config.js`
- [ ] **3.7** Move `app/convex.json` → `./convex.json`
- [ ] **3.8** Move `app/vitest.config.ts` → `./vitest.config.ts`
- [ ] **3.9** Move `app/components.json` → `./components.json`
- [ ] **3.10** Move `app/.prettierrc` → `./.prettierrc`
- [ ] **3.11** Move `app/.env.example` → `./.env.example`

---

## Phase 3: Update Package Configuration

**Dependencies:** 3.1

- [ ] **4.1** Update `package.json` name: `"app"` → `"agribid"`
- [ ] **4.2** Verify all dependencies are present (compare with original)

---

## Phase 4: Update Vite Configuration

**Dependencies:** 3.2, 3.3

- [ ] **5.1** Update path alias `@`:
  ```typescript
  "@": path.resolve(__dirname, "./src")
  ```
- [ ] **5.2** Update convex path alias:
  ```typescript
  "convex/_generated": path.resolve(__dirname, "./convex/_generated")
  ```
- [ ] **5.3** Remove `pkg` import (line 5) - version will come from package.json
- [ ] **5.4** Test vite config loads: `bun run build` (should fail on imports first)

---

## Phase 5: Update Root Configuration Files

**Dependencies:** 3.6, 3.9

- [ ] **6.1** Update `eslint.config.js` - verify paths are correct (should work as-is)
- [ ] **6.2** Update `tsconfig.json` paths:
  ```json
  {
    "paths": {
      "@/*": ["./src/*"],
      "convex/_generated/*": ["./convex/_generated/*"]
    }
  }
  ```
- [ ] **6.3** Update `tsconfig.app.json` if needed (typically inherits from tsconfig.json)
- [ ] **6.4** Update `tsconfig.node.json` if needed

---

## Phase 6: Update Vercel Configuration

**Dependencies:** 3.7

- [ ] **7.1** Update `vercel.json`:
  ```json
  {
    "buildCommand": "bun run build",
    "installCommand": "bun install",
    "outputDirectory": "dist"
  }
  ```
- [ ] **7.2** Remove old `app/dist` from output directory references

---

## Phase 7: Update .gitignore

**Dependencies:** 3.10

- [ ] **8.1** Update root `.gitignore`:
  - Keep existing root ignores
  - Add `app/dist/` to ignore list
  - Add `app/.env.local` to ignore list
  - Ensure `dist/` and `.env.local` are present
- [ ] **8.2** Remove `app/` specific entries if they conflict

---

## Phase 8: Update Documentation References

**Dependencies:** 2.1, 2.2

**Files to update:**
- [ ] **9.1** `AGENTS.md` - update all `app/` references
- [ ] **9.2** All files in `docs/` (~100 references)
- [ ] **9.3** All files in `conductor/`
- [ ] **9.4** Any source file comments referencing `app/` (e.g., `// app/src/pages/...`)

**Search pattern to verify:**
```bash
# After migration, verify no app/ references remain in non-app directories
grep -r "app/" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v "node_modules" | grep -v "src/" | grep -v "convex/"
```

---

## Phase 9: Local Verification

**Dependencies:** Phase 1-8 complete

- [ ] **10.1** Remove old node_modules: `rm -rf node_modules`
- [ ] **10.2** Install dependencies: `bun install`
- [ ] **10.3** Run lint: `bun run lint`
- [ ] **10.4** Run tests: `bun run test --run`
- [ ] **10.5** Run build: `bun run build`
- [ ] **10.6** Test dev server: `bun run dev` (verify localhost:5173 works)

---

## Phase 10: Secrets & Deployment

**Dependencies:** 10.6 (all local checks pass)

- [ ] **11.1** Move `app/.env.local` → `.env.local` (user action required)
- [ ] **11.2** Verify `.env.local` is in `.gitignore`
- [ ] **11.3** Deploy to Vercel staging: `bunx vercel`
- [ ] **11.4** Verify staging deployment works
- [ ] **11.5** Deploy to production: `bunx vercel --prod`

---

## Rollback Plan

If migration fails:

1. `git checkout -- .` to restore all changes
2. `git branch -D chore/migrate-to-root` (if branch created)
3. Continue working in `app/` as before

---

## Post-Migration Cleanup (Optional)

After successful deployment, can be done later:

- [ ] Remove empty `app/` directory
- [ ] Update any CI/CD scripts that reference `app/`
- [ ] Update any local scripts/aliases

---

## Summary of File Movements

| From | To |
|------|-----|
| `app/src/*` | `src/*` |
| `app/convex/*` | `convex/*` |
| `app/index.html` | `index.html` |
| `app/package.json` | `package.json` |
| `app/vite.config.ts` | `vite.config.ts` |
| `app/tsconfig*.json` | `tsconfig*.json` |
| `app/eslint.config.js` | `eslint.config.js` |
| `app/convex.json` | `convex.json` |
| `app/vitest.config.ts` | `vitest.config.ts` |
| `app/components.json` | `components.json` |
| `app/.prettierrc` | `.prettierrc` |
| `app/.gitignore` | `.gitignore` (merge) |
| `app/.env.example` | `.env.example` |
