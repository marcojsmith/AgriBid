# AgriBid Foundations (GEMINI.md)

This document serves as the foundational source of truth for project-wide mandates and architectural decisions. It takes precedence over general defaults.

## Core Operational Rules

- **Communication:** Clarity is paramount. Always ask for clarification if a task is underspecified. Provide regular updates and explain the rationale behind changes.
- **Decision Making:** Align all technical and design decisions with the project's vision of a production-ready agricultural auction platform.
- **Planning:** For any significant feature or refactor, document a plan before execution.
- **Tools:** Use internal editing tools for code changes. **Never use shell commands (sed, echo, etc.) to modify file content.**

## Development Standards

- **Commit Excellence:** Commits must be surgical, clear, and verified. No debug code, no unused imports.
- **Verification:** Mandatory `lint`, `test`, and `build` checks before any success claim. Use Chrome DevTools MCP for visual and functional verification.
- **Modularity:** Strive for small, focused files (< 300 LOC) and clear separation of concerns.
- **Type Safety:** TypeScript is non-negotiable. Zero usage of `any`.
- **Consistency:** Follow naming conventions and established patterns strictly.

## Project Documents

- **Rulebook:** Logic and mechanics are defined in `conductor/product.md` and `conductor/product-guidelines.md`.
- **Workflow:** Defined in `conductor/workflow.md`.
- **Tracking:** Progress is tracked in `Checklist.md` and `conductor/tracks.md`.

## User Involvement

- Keep the user in the loop for major changes.
- Act on suggestions only after explicit approval.
- Maintain the `README.md` and `Brief.md` as living documents.
