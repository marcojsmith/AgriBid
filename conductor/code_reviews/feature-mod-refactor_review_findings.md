# PR Review Findings - Modularization Refactor (Round 6)

Fix the following issues. The issues can be from different files or can overlap on same lines in one file.

- Verify each finding against the current code and only fix it if needed.

In @app/convex/admin.ts around lines 310 - 323, The countQuery function currently uses a non-existent query.after(...) pattern; rewrite countQuery to use Convex's cursor-based pagination by calling query.paginate({ numItems: PAGE_SIZE, cursor }) and looping while paginate returns a continueCursor (assign it to cursor for the next call) accumulating results.length into count; update references to lastItem/_id are unnecessary with paginate. Also remove the any type on the query parameter and replace it with an appropriate Convex query type (or add a short comment describing the expected query shape) so TypeScript can validate usage.

- Verify each finding against the current code and only fix it if needed.

In @app/src/pages/kyc/hooks/useKYCForm.ts around lines 84 - 90, The comment above the two-line inference (variables currentYearShort, yearPart, fullYear) is inaccurate: update the wording to state that only people born in the cutoff year (e.g., yearPart === currentYearShort, such as 1926 → interpreted as 2026) are mapped to the future 20xx, while those born before that cutoff (yearPart < currentYearShort) are mapped to their corresponding 20xx years (e.g., 1925 → 2025, 1924 → 2024), which are past dates and may incorrectly pass validation; keep the note about the 100-year ambiguity and that the cutoff can be changed if needed.
