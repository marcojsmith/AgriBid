# Implementation Plan: Refactor Auction Mutations

## Phase 1: File Structure and Base Migration

- [x] Task: Create new mutations directory and base files
  - [x] Create `convex/auctions/mutations/` directory
  - [x] Create `create.ts`, `update.ts`, `delete.ts`, `publish.ts`, `bidding.ts` inside `mutations/`
- [x] Task: Migrate production code to new files
  - [x] Move creation-related mutations to `create.ts`
  - [x] Move update-related mutations to `update.ts`
  - [x] Move deletion-related mutations to `delete.ts`
  - [x] Move publish/status-related mutations to `publish.ts`
  - [x] Move bidding-related mutations to `bidding.ts`
  - [x] Ensure all necessary helper functions are properly imported in each new file
- [x] Task: Conductor - User Manual Verification 'Phase 1: File Structure and Base Migration' (Protocol in workflow.md)

## Phase 2: Tests Migration

- [x] Task: Restructure test files
  - [x] Create `create.test.ts`, `update.test.ts`, `delete.test.ts`, `publish.test.ts`, `bidding.test.ts` inside `mutations/`
  - [x] Move corresponding tests from `mutations.test.ts` to the new test files
  - [x] Fix any import paths within the test files to point to the new mutation files
- [x] Task: Conductor - User Manual Verification 'Phase 2: Tests Migration' (Protocol in workflow.md) using a generalist subagent with Chrome DevTools to verify test coverage if needed.

## Phase 3: Update Imports and Verification

- [x] Task: Update project-wide imports
  - [x] Search for all imports of `convex/auctions/mutations` across the codebase
  - [x] Update imports to point directly to the relevant new files (e.g., `convex/auctions/mutations/create`)
  - [x] Delete original `convex/auctions/mutations.ts` and `convex/auctions/mutations.test.ts` files
- [x] Task: Run automated checks
  - [x] Run `bun run build` and ensure no type errors
  - [x] Run `bun run lint` and fix any linting errors
  - [x] Run `bun run test --run` to ensure all tests pass
- [x] Task: Conductor - User Manual Verification 'Phase 3: Update Imports and Verification' (Protocol in workflow.md) using a generalist subagent with Chrome DevTools to manually test auction creation, bidding, and admin functions.