# Task: Sanitize error report fields before posting to public GitHub issues (fixes #281)

## Context

`convex/errors.ts` posts error reports to a GitHub repo (admin-configurable, `repoOwner`/`repoName` in `convex/admin/settings.ts`, may be public) via `formatIssueBody` (around line 316-370+) and the GitHub-posting code further down (~line 472-582).

`errorMessage`, `stackTrace`, and `additionalInfo` come straight from client-side error reporting (`submitErrorReportHandler`, lines ~170-274) and are embedded verbatim into the issue body with no redaction. Only breadcrumb metadata is sanitized today, via `sanitizeBreadcrumbMetadata` (lines ~130-150), which allowlists specific keys (`action`, `path`, `component`, `props`) and only keeps string/number values.

Read `convex/errors.ts` in full before starting — it's ~830 lines, and you need to see `formatIssueBody`, `submitErrorReportHandler`, and the `submitErrorReport` validator together to make consistent changes.

## Instructions

1. Add a `sanitizeText(value: string): string` helper near `sanitizeBreadcrumbMetadata` that redacts common sensitive patterns before the string is ever persisted or posted:
   - Email addresses (regex like `/[\w.+-]+@[\w-]+\.[\w.-]+/g` → `[redacted-email]`)
   - Bearer tokens / API keys / JWTs (long base64/hex-looking tokens, e.g. `/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g` for JWTs, and common patterns like `sk_live_...`, `Bearer <token>`) → `[redacted-token]`
   - Anything that looks like a credit card number (`/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g`) → `[redacted-card]`
   - Keep the rest of the string intact — this is redaction, not truncation.
2. Apply `sanitizeText` to `args.errorMessage` and `args.stackTrace` inside `submitErrorReportHandler` before they are used for the fingerprint, before `errorMessageNormalized` is computed, and before the `ctx.db.insert`/`ctx.db.patch` calls that persist `errorReports` rows. Sanitize at the point of first ingestion (mutation handler), not just at GitHub-posting time, so the sanitized value is also what's stored and shown in the admin UI.
3. For `additionalInfo` (a `Record<string, string | number>`), sanitize each string value the same way (leave numbers as-is). Add a small helper `sanitizeAdditionalInfo` that maps over entries.
4. Do NOT change the `submitErrorReport` mutation's argument validators (`v.string()`, `v.record(...)`, etc.) — validators define the wire shape, not sanitization, and are already correct.
5. Add/update tests in `convex/errors.test.ts` (find it via `Glob convex/errors.test.ts` — if it doesn't exist, check for `convex/*.test.ts` sibling naming convention) covering:
   - An error message containing an email/token/card number gets redacted before storage.
   - A clean error message is unchanged (no false-positive redaction).
   - `additionalInfo` string values are sanitized; number values pass through untouched.
6. Run `bun run type-check` and `bun run test -- errors` (or the equivalent vitest filter) to confirm everything passes.

## Constraints

- Follow Convex rules in `.claude/rules/convex_rules.md` — keep validators as-is, don't add `any` types.
- Don't touch `formatIssueBody`'s markdown formatting logic beyond what's needed — the fields it reads should already be sanitized by the time they reach it, so no changes should be needed there.
- Don't add a new feature flag or config toggle for this — sanitization should always apply, not be optional.
- Keep the diff scoped to `convex/errors.ts` and its test file. Don't refactor unrelated code in the same file.

## Results

Done. All 6 instructions followed; diff scoped to `convex/errors.ts` and `convex/errors.test.ts`.

1. **`sanitizeText`** added near `sanitizeBreadcrumbMetadata` (exported for testing, with JSDoc). Redacts in order: emails → `[redacted-email]`; JWTs (3x base64url segments), prefixed API keys (`sk_live_`, `sk_test_`, `pk_*`, `rk_*`, `ghp`/`gho`/`ghu`/`ghs`/`ghr`, `github_pat_`), and `Bearer <token>`-style strings → `[redacted-token]`; card numbers (4-4-4-4 with space/hyphen separators) → `[redacted-card]`. Rest of string left intact — redaction, not truncation.
2. **Applied at ingestion** in `submitErrorReportHandler`: `args.errorMessage` and `args.stackTrace` are sanitized before `isServerValidationError`, the fingerprint, `errorMessageNormalized`, and both the `db.patch` (duplicate path) and `db.insert` (new path) calls. `formatIssueBody` unchanged per constraints.
3. **`sanitizeAdditionalInfo`** added: maps string values through `sanitizeText`, passes numbers through, returns `undefined` as-is. Used for both the patch and insert paths (`sanitizedAdditionalInfo ?? existingReport.additionalInfo`).
4. **Validators untouched** — `submitErrorReport` args are exactly as before.
5. **Tests added** to `convex/errors.test.ts` (10 new tests, 34 total):
   - `sanitizeText`: email, JWT, `sk_live`, Bearer, card (space + hyphen forms) redacted; clean text unchanged.
   - `sanitizeAdditionalInfo`: strings sanitized, numbers pass through, `undefined` as-is.
   - `submitErrorReportHandler`: sensitive patterns (email + card in message, JWT in stackTrace, email in `additionalInfo`) redacted before `db.insert`; clean message stored verbatim.
6. **Verification**: `bun run type-check` ✓ · `bun run test --run convex/errors.test.ts` — 34/34 passed ✓ · `bun run lint` — 0 errors; only pre-existing warnings remain (errors.ts:56 unsafe-regex predates this change; my new regexes did not trigger it). Test strings are constructed programmatically (e.g. `"a".repeat(25)`) to satisfy the `no-secrets` entropy rule.

Note: `bun run lint` runs eslint over all files regardless of path args, so the output above includes unrelated files (seed.ts, MyBids.tsx, encryption.ts) — all pre-existing, not introduced by this task.
