---
name: testing-standards
description: Expertise in AgriBid's testing philosophy, including unit, integration, and backend testing. Use this when writing tests with Vitest or Convex Test Runner.
---

# AgriBid Testing Standards

## 1. Component Testing (Vitest + JSDOM)
- **Behavior-First:** Test what the user sees and does, not the internal implementation details.
- **Mocking:** Always mock Convex hooks (`useQuery`, `useMutation`) and Auth hooks to isolate components from the backend during unit tests.
- **Interactions:** Prefer `user-event` for simulating browser interactions over `fireEvent`.
- **Selectors:** Use accessibility-first selectors like `screen.getByRole` or `screen.getByText`.

## 2. Backend Testing (Convex)
- **Mutation Logic:** Test all state transitions, validation rules, and error paths using the Convex test runner.
- **Audit Logs:** Verify that critical operations generate the correct entries in the `auditLogs` table.
- **Query Performance:** Ensure queries return the expected data shapes and filtered results efficiently.

## 3. Quality Thresholds
- **Coverage:** Maintain or exceed the project's coverage thresholds (Statements, Branches, Functions, Lines).
- **No Regressions:** Never lower coverage thresholds. If a change drops coverage, add corresponding tests.
- **Continuous Verification:** Run `bun run coverage` after every significant change to verify status.
