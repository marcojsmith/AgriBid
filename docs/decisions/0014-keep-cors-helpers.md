# 0014 - Keep CORS helpers without consumers

Date: 2026-09 | Status: Accepted

## Context

After the Clerk migration (0001), `getCorsHeaders`/`addCorsHeaders` in `convex/http.ts` have no production consumer; the `httpRouter` registers no routes. A cleanup phase deleted them as dead code.

## Decision

Keep the helpers and their tests, exported from `convex/http.ts`. The originating task file (`clerk-auth-migration.md`) explicitly forbade removing them. Origin matching is strict, with `ALLOWED_ORIGINS` (default `http://localhost:5173`) and suffix wildcards such as `.vercel.app`, and the header is omitted for disallowed origins.

## Consequences

- Ready for future Clerk webhook or CORS routes.
- Carries unused code and its coverage until then.
