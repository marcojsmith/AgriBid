# 0010 - Permanent strictTypeChecked lint

Date: 2026-09-12 (issue #171, Phase 3) | Status: Accepted

## Context

Issue #171 rolled out typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` in batches (196 errors after batch 1, 73 after batch 3).

## Decision

Both presets are permanently ON for `src/**` and `convex/**` in `eslint.config.js`. All 52 `no-non-null-assertion` sites were fixed with real guards, with zero `eslint-disable` directives. `unbound-method` is off for test files. `no-console` allows only `warn`/`error`, and the pre-commit hook rejects undocumented `eslint-disable` additions.

## Consequences

- Deliberate remaining exceptions: ~16 `prefer-nullish-coalescing`, 2 `consistent-type-definitions` (Convex args), 3 `no-deprecated`.
- `consistent-type-definitions --fix` breaks Convex references, so an override for `convex/**` is still needed.
- Number and boolean template interpolations need `String(...)`.
